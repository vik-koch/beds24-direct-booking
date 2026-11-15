import assert from 'node:assert/strict';
import { test } from 'node:test';
import { select } from './prune-images.mjs';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const sha = (n) => `sha-${String(n).padStart(40, '0')}`;
const version = (name, day, ...tags) => ({
  id: name,
  name,
  created_at: `2026-11-${String(day).padStart(2, '0')}T10:00:00Z`,
  metadata: { container: { tags } },
});
const names = (versions) => versions.map((v) => v.name).sort();

test('keeps the newest commits and removes the older ones', () => {
  const versions = [version('a', 1, sha(1)), version('b', 2, sha(2)), version('c', 3, sha(3))];
  const { keep, remove } = select(versions, new Map(), 2, NOW);
  assert.deepEqual(names(keep), ['b', 'c']);
  assert.deepEqual(names(remove), ['a']);
});

test('keeps a release however old, without counting it as a commit', () => {
  const versions = [
    version('a', 1, sha(1), '0.1.0'),
    version('b', 2, sha(2)),
    version('c', 3, sha(3)),
    version('d', 4, sha(4)),
  ];
  const { keep, remove } = select(versions, new Map(), 2, NOW);
  assert.deepEqual(names(keep), ['a', 'c', 'd']);
  assert.deepEqual(names(remove), ['b']);
});

test('keeps what a kept index points to and removes the parts of a removed one', () => {
  const versions = [
    version('old', 1, sha(1)),
    version('old-image', 1),
    version('old-attestation', 1),
    version('new', 2, sha(2)),
    version('new-image', 2),
    version('new-attestation', 2),
  ];
  const children = new Map([
    ['old', ['old-image', 'old-attestation']],
    ['new', ['new-image', 'new-attestation']],
  ]);
  const { keep, remove } = select(versions, children, 1, NOW);
  assert.deepEqual(names(keep), ['new', 'new-attestation', 'new-image']);
  assert.deepEqual(names(remove), ['old', 'old-attestation', 'old-image']);
});

test('leaves an untagged version of the last day alone: its push may still be running', () => {
  const versions = [version('fresh', 15), version('stale', 13), version('tagged', 10, sha(1))];
  const { keep, remove } = select(versions, new Map(), 1, NOW);
  assert.deepEqual(names(keep), ['fresh', 'tagged']);
  assert.deepEqual(names(remove), ['stale']);
});

test('removes nothing when there is nothing to remove', () => {
  const { keep, remove } = select([version('a', 1, sha(1))], new Map(), 10, NOW);
  assert.deepEqual(names(keep), ['a']);
  assert.deepEqual(remove, []);
});
