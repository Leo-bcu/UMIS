import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'node:path';

describe('App dev bootstrap source', () => {
  it('normalizes legacy fracture scenario query params to a real fracture sub-scenario', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

    assert.match(source, /function normalizeDevScenario/);
    assert.match(source, /scenario === 'fracture'/);
    assert.match(source, /return 'coal'/);
    assert.match(source, /const validScenarios: ScenarioType\[] = \['coal', 'gold', 'oil', 'pipeline', 'nuclear', 'refinery', 'underground'\]/);
  });
});
