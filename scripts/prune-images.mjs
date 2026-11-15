#!/usr/bin/env node
// Removes image versions from the GitHub container registry that nothing can deploy any more.
// Every merge to main pushes a pair of images tagged with its commit; this keeps the releases
// and the newest commits and deletes the rest. The prune-images workflow calls it.
//
//   GITHUB_TOKEN=… GITHUB_REPOSITORY=<owner>/<name> node scripts/prune-images.mjs
//   KEEP_COMMITS=10   how many commit-tagged versions of each image stay
//   DRY_RUN=1         prints the decision and deletes nothing

const COMMIT_TAG = /^sha-[0-9a-f]{40}$/;
const DAY = 24 * 60 * 60 * 1000;

// Decides what stays. `versions` is the registry's list for one image, `children` maps the
// digest of an index to the digests it points to. Kept are:
// - every version with a tag that is not a commit tag: the releases, and anything put by hand;
// - the newest `keepCommits` versions with a commit tag;
// - what a kept version points to. A build pushes the image with an attestation, and the tag
//   names an index over both. The parts carry no tag, and without them the tag is broken;
// - untagged versions younger than a day, which may belong to a push that is still running.
export function select(versions, children, keepCommits, now) {
  const tags = (version) => version.metadata.container.tags;
  const keep = new Set();
  const newestFirst = [...versions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  let commits = 0;
  for (const version of newestFirst) {
    if (tags(version).length === 0) {
      if (now - Date.parse(version.created_at) < DAY) keep.add(version.name);
    } else if (!tags(version).every((tag) => COMMIT_TAG.test(tag)) || commits++ < keepCommits) {
      keep.add(version.name);
    }
  }
  for (const digest of [...keep]) for (const child of children.get(digest) ?? []) keep.add(child);
  return {
    keep: versions.filter((version) => keep.has(version.name)),
    remove: versions.filter((version) => !keep.has(version.name)),
  };
}

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${options?.method ?? 'GET'} ${url}: ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}

// Reads one image's versions and decides; nothing is deleted here.
async function plan(owner, image, { token, keepCommits }) {
  // The owner is a user account here; an organization's packages are under /orgs instead.
  const api = `https://api.github.com/users/${owner}/packages/container/${encodeURIComponent(image)}/versions`;
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' };
  const versions = [];
  for (let page = 1; ; page++) {
    const batch = await request(`${api}?per_page=100&page=${page}`, { headers });
    versions.push(...batch);
    if (batch.length < 100) break;
  }

  // The images are public, so the registry hands out a token for reading to anyone.
  const registry = `https://ghcr.io/v2/${owner}/${image}`;
  const pull = await request(`https://ghcr.io/token?scope=repository:${owner}/${image}:pull`);
  const accept = [
    'application/vnd.oci.image.index.v1+json',
    'application/vnd.oci.image.manifest.v1+json',
    'application/vnd.docker.distribution.manifest.list.v2+json',
    'application/vnd.docker.distribution.manifest.v2+json',
  ].join(', ');
  const children = new Map();
  for (const version of versions) {
    if (version.metadata.container.tags.length === 0) continue;
    const manifest = await request(`${registry}/manifests/${version.name}`, {
      headers: { authorization: `Bearer ${pull.token}`, accept },
    });
    children.set(
      version.name,
      (manifest.manifests ?? []).map((child) => child.digest),
    );
  }

  return { image, api, headers, ...select(versions, children, keepCommits, Date.now()) };
}

async function carryOut({ image, api, headers, keep, remove }, dryRun) {
  const line = (version) =>
    `  ${version.name.slice(0, 19)} ${version.created_at} ${version.metadata.container.tags.join(' ') || '(no tag)'}`;
  console.log(`${image}: keeping ${keep.length}, removing ${remove.length}`);
  for (const version of keep) console.log(`${line(version)}  kept`);
  for (const version of remove) {
    console.log(`${line(version)}  ${dryRun ? 'would be removed' : 'removed'}`);
    if (!dryRun) await request(`${api}/${version.id}`, { method: 'DELETE', headers });
  }
}

if (import.meta.main) {
  const [owner, name] = (process.env.GITHUB_REPOSITORY ?? '').toLowerCase().split('/');
  const token = process.env.GITHUB_TOKEN;
  const keepCommits = Number(process.env.KEEP_COMMITS ?? 10);
  if (!owner || !name || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN must be set');
  // At least one: the newest commit is what the demo runs.
  if (!Number.isInteger(keepCommits) || keepCommits < 1)
    throw new Error('KEEP_COMMITS must be a whole number, 1 or more');
  const dryRun = ['1', 'true'].includes(process.env.DRY_RUN ?? '');
  // Both images are read and decided before anything is deleted: a list or a manifest that
  // cannot be read ends the run here, with the registry untouched.
  const plans = [];
  for (const image of [`${name}-web`, `${name}-sim`])
    plans.push(await plan(owner, image, { token, keepCommits }));
  for (const decided of plans) await carryOut(decided, dryRun);
}
