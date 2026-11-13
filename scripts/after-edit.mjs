#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

// A Claude Code hook after Edit and Write: the tool call arrives as JSON on stdin, and exit code 2
// sends what was written to stderr back to the agent.
const file = JSON.parse(readFileSync(0, 'utf8')).tool_input.file_path;
const root = process.env.CLAUDE_PROJECT_DIR;
if (relative(root, file).startsWith('..')) process.exit(0);

// The linter's fixes come first, so that the formatter has the last word on the file.
// A tool that did not start or was killed has no status and has printed nothing itself.
const run = (tool, ...args) => {
  const { status, error, signal } = spawnSync(`node_modules/.bin/${tool}`, [...args, file], {
    cwd: root,
    stdio: ['ignore', 2, 2],
  });
  if (status === null) console.error(`${tool}: ${error?.message ?? signal}`);
  return status !== 0;
};
const lint = run('eslint', '--fix', '--max-warnings', '0', '--no-warn-ignored');
const format = run('prettier', '--write', '--ignore-unknown', '--log-level', 'warn');
if (lint || format) process.exit(2);
