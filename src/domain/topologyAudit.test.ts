import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneDataset } from './sceneDataset';
import { auditScenarioTopology } from './topologyAudit';

const scenarios = [
  ['fracture', 'coal'],
  ['fracture', 'gold'],
  ['fracture', 'oil'],
  ['pipeline', 'pipeline'],
  ['nuclear', 'nuclear'],
  ['refinery', 'refinery'],
  ['underground', 'underground'],
] as const;

test('all scenario networks satisfy physical topology audit', () => {
  for (const [dataSource, scenario] of scenarios) {
    const dataset = buildSceneDataset(dataSource, scenario);
    const issues = auditScenarioTopology(scenario, dataset.fractures).filter((issue) => issue.severity === 'error');

    assert.deepEqual(
      issues.map((issue) => `${issue.scenario}:${issue.fractureId}:${issue.code}:${issue.message}`),
      [],
    );
  }
});

