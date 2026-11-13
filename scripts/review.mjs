#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { appToken, repo } from './app-token.mjs';

const {
  values: { model, effort, ask },
  positionals: [number],
} = parseArgs({
  allowPositionals: true,
  options: { model: { type: 'string' }, effort: { type: 'string' }, ask: { type: 'string' } },
});
if (!number || !model || !effort) {
  console.error(
    'Usage: node scripts/review.mjs <pull request> --model <model> --effort <effort> [--ask <question>]',
  );
  process.exit(1);
}

// The verdict becomes the review's state; an answer to a question has none and stays a comment.
const verdict = ask ? {} : { verdict: { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES'] } };
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'findings', ...Object.keys(verdict)],
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'line', 'body'],
        properties: {
          path: { type: 'string' },
          line: { type: 'integer' },
          body: { type: 'string' },
        },
      },
    },
    ...verdict,
  },
};

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 2 ** 28 });
const env = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.includes('_APP_')),
);

// The only place that knows the reviewer's tool: a prompt goes in, JSON of the schema's shape comes out.
// The pull request's text is untrusted and the answer is published, so the tool may read the checkout and
// the repository's git directory, nothing else of this machine, and does not learn where the Apps' keys are.
// Its sandbox starts the CLI again from inside, so the Node installation that holds the CLI must stay readable.
const tool = 'Codex CLI';
function runReviewer(prompt, tree, tmp) {
  writeFileSync(join(tmp, 'schema.json'), JSON.stringify(schema));
  const files = [
    '--output-schema',
    join(tmp, 'schema.json'),
    '--output-last-message',
    join(tmp, 'answer.json'),
  ];
  const gitDir = git('rev-parse', '--path-format=absolute', '--git-common-dir').trim();
  const roots = [gitDir, dirname(dirname(process.execPath))].map(
    (root) => `${JSON.stringify(root)}="read"`,
  );
  const readable = `{":minimal"="read",":workspace_roots"={"."="read"},${roots}}`;
  const config = [
    `model_reasoning_effort="${effort}"`,
    'default_permissions="review"',
    `permissions.review.filesystem=${readable}`,
  ];
  const args = [
    'exec',
    '--cd',
    tree,
    '--model',
    model,
    ...config.flatMap((entry) => ['-c', entry]),
  ];
  execFileSync('codex', [...args, ...files, '-'], {
    input: prompt,
    env,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  return JSON.parse(readFileSync(join(tmp, 'answer.json'), 'utf8'));
}

const { REVIEWER_APP_ID: appId, REVIEWER_APP_KEY: appKey } = process.env;
const token = appId && (await appToken(appId, appKey));
async function github(path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      accept: 'application/vnd.github+json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

const pull = await github(`/repos/${repo}/pulls/${number}`);
const closes = pull.body?.match(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?) #(\d+)/i)?.[1];
const issue = closes && (await github(`/repos/${repo}/issues/${closes}`));
const said = (
  await Promise.all(
    [`pulls/${number}/reviews`, `pulls/${number}/comments`, `issues/${number}/comments`]
      .concat(closes ? `issues/${closes}/comments` : [])
      .map((list) => github(`/repos/${repo}/${list}?per_page=100`)),
  )
)
  .flat()
  .filter((entry) => entry.body)
  .map((entry) => ({ ...entry, at: entry.submitted_at ?? entry.created_at }))
  .sort((a, b) => a.at.localeCompare(b.at))
  .map((entry) => {
    const onIssue = closes && entry.issue_url?.endsWith(`/${closes}`);
    const place = entry.path
      ? ` on ${entry.path}:${entry.line ?? entry.original_line}`
      : onIssue
        ? ' on the issue'
        : '';
    return `${entry.user.login}${place}:\n${entry.body}`;
  });

// Every check here is a job in GitHub Actions, so a check run's id is that job's id.
const { check_runs: runs } = await github(`/repos/${repo}/commits/${pull.head.sha}/check-runs`);
const checks = await Promise.all(
  runs.map(async (run) => {
    if (run.conclusion !== 'failure') return `${run.name}: ${run.conclusion ?? run.status}`;
    const { steps } = await github(`/repos/${repo}/actions/jobs/${run.id}`);
    const failed = steps.filter((step) => step.conclusion === 'failure').map((step) => step.name);
    return `${run.name}: failure in ${failed.join(', ')}`;
  }),
);

git('fetch', '--quiet', 'origin', pull.base.ref, `pull/${number}/head`);
const diff = git('diff', `${pull.base.sha}...${pull.head.sha}`);

// An added line can itself start with "++", so file headers count only before a file's first hunk.
const inDiff = new Set();
let path, line;
for (const text of diff.split('\n')) {
  if (text.startsWith('diff --git ')) line = null;
  else if (text.startsWith('@@')) line = +text.match(/\+(\d+)/)[1];
  else if (line === null) path = text.startsWith('+++ b/') ? text.slice(6) : path;
  else if (text[0] === '+' || text[0] === ' ') inDiff.add(`${path}:${line++}`);
}

const prompt = [
  ask
    ? `Answer this question about the pull request, and nothing else, as AGENTS.md describes:\n${ask}`
    : 'Review this pull request as AGENTS.md describes.',
  `Pull request #${number} in ${repo}: ${pull.title}\n\n${pull.body ?? ''}`,
  issue
    ? `The issue it closes, #${closes}: ${issue.title}\n\n${issue.body ?? ''}`
    : 'It names no issue.',
  `Earlier reviews and comments on the pull request and the issue, oldest first:\n\n${said.join('\n\n') || 'None.'}`,
  `The checks of ${pull.head.sha} in CI:\n\n${checks.join('\n') || 'None have run.'}`,
  `The working directory is a checkout of ${pull.head.sha}. Its diff against ${pull.base.ref}:\n\n${diff}`,
].join('\n\n---\n\n');

const tmp = mkdtempSync(join(tmpdir(), 'review-'));
const tree = join(tmp, 'tree');
git('worktree', 'add', '--quiet', '--detach', tree, pull.head.sha);
let answer;
try {
  answer = runReviewer(prompt, tree, tmp);
} finally {
  git('worktree', 'remove', '--force', tree);
  rmSync(tmp, { recursive: true });
}

// GitHub refuses a whole review when one comment's line is outside the diff, so those move into the text.
const [inline, loose] = [true, false].map((wanted) =>
  answer.findings.filter((finding) => inDiff.has(`${finding.path}:${finding.line}`) === wanted),
);
const body = [
  ask && `> ${ask}`,
  answer.summary,
  ...loose.map((finding) => `\`${finding.path}:${finding.line}\`: ${finding.body}`),
  `_${ask ? 'Answered' : 'Reviewed'} at ${pull.head.sha.slice(0, 7)} with ${tool}, model ${model}, effort ${effort}._`,
]
  .filter(Boolean)
  .join('\n\n');

if (token) {
  const review = await github(`/repos/${repo}/pulls/${number}/reviews`, {
    commit_id: pull.head.sha,
    event: answer.verdict ?? 'COMMENT',
    body,
    comments: inline.map((finding) => ({ ...finding, side: 'RIGHT' })),
  });
  console.log(review.html_url);
} else {
  console.log(
    [answer.verdict, body, ...inline.map((f) => `${f.path}:${f.line}\n${f.body}`)]
      .filter(Boolean)
      .join('\n\n'),
  );
}
