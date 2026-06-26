import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveNodeTestEntries } from './run-node-tests-lib.ts';
const root = process.cwd();

describe('resolveNodeTestEntries', () => {
  it('falls back to the repository node test suite when no entries are provided', async () => {
    const entries = await resolveNodeTestEntries([], root);

    assert.ok(entries.length > 10);
    assert.ok(entries.includes('src/domain/sceneDataset.test.ts'));
    assert.ok(entries.includes('src/api/normalizers.test.ts'));
    assert.ok(entries.includes('src/lib/sceneSemantics.test.ts'));
  });

  it('preserves explicit test file arguments as-is', async () => {
    const entries = await resolveNodeTestEntries(['src/domain/sceneDataset.test.ts'], root);

    assert.deepEqual(entries, ['src/domain/sceneDataset.test.ts']);
  });
});
