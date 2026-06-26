import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'node:path';

describe('App dev test API source', () => {
  it('exposes a dev-only test API for browser regression hooks', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

    assert.match(source, /__HIVE_TEST_API__/);
    assert.match(source, /data-testid="dev-state"/);
    assert.match(source, /data-selected-robot=/);
    assert.match(source, /data-selected-fracture=/);
    assert.match(source, /data-testid="dev-interactions"/);
    assert.match(source, /dev-locale/);
    assert.match(source, /dev-scenario/);
    assert.match(source, /dev-tool/);
    assert.match(source, /dev-robot/);
    assert.match(source, /dev-fracture/);
    assert.match(source, /selectRobotById/);
    assert.match(source, /selectFractureById/);
    assert.match(source, /switchScenario/);
    assert.match(source, /setActiveTool/);
    assert.match(source, /getInteractiveTargets/);
    assert.match(source, /__HIVE_DEV_VIEW__/);
  });
});
