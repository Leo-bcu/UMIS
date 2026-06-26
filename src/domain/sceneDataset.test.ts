import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneDataset } from './sceneDataset';

const scenarios = [
  ['fracture', 'coal'],
  ['fracture', 'gold'],
  ['fracture', 'oil'],
  ['pipeline', 'pipeline'],
  ['nuclear', 'nuclear'],
  ['refinery', 'refinery'],
  ['underground', 'underground'],
] as const;

test('scene dataset keeps robot stats consistent with robot list', () => {
  const dataset = buildSceneDataset('fracture', 'coal');

  assert.equal(dataset.summary.robotFleet.total, dataset.robots.length);
  assert.equal(
    dataset.summary.robotFleet.online +
      dataset.summary.robotFleet.offline +
      dataset.summary.robotFleet.lowBattery +
      dataset.summary.robotFleet.error +
      dataset.summary.robotFleet.maintenance,
    dataset.robots.length,
  );
});

test('scene dataset keeps alert summary consistent with alerts list', () => {
  const dataset = buildSceneDataset('fracture', 'gold');

  assert.equal(dataset.summary.alerts.total, dataset.alerts.length);
  assert.equal(
    dataset.summary.alerts.danger +
      dataset.summary.alerts.warning +
      dataset.summary.alerts.info,
    dataset.alerts.length,
  );
});

test('scene dataset scene stats and robots stay aligned across scenario consumers', () => {
  const dataset = buildSceneDataset('fracture', 'oil');

  assert.equal(dataset.summary.scene.totalNodes > 0, true);
  assert.equal(dataset.summary.robotFleet.total, dataset.robots.length);
  assert.equal(dataset.summary.scene.onlineSensors, dataset.summary.scene.totalNodes);
});

test('scene dataset keeps underground scenario vocabulary and valid depth-driven summaries', () => {
  const dataset = buildSceneDataset('underground', 'underground');

  assert.equal(dataset.summary.scene.overThreshold >= 0, true);
  assert.equal(dataset.robots.every((robot) => robot.depth >= 0), true);
  assert.equal(dataset.summary.alerts.unacknowledged <= dataset.alerts.length, true);
});

test('scene dataset data confidence is derived from node evidence instead of a fixed display value', () => {
  for (const [dataSource, scenario] of scenarios) {
    const dataset = buildSceneDataset(dataSource, scenario);
    const nodes = dataset.fractures.flatMap((fracture) => fracture.nodes);
    const robotBoundNodes = nodes.filter((node) => node.robotId).length;
    const measuredNodes = nodes.filter((node) => Object.values(node.sensors).some((value) => Number.isFinite(value) && value !== 0)).length;

    assert.equal(dataset.summary.scene.avgConf >= 0, true);
    assert.equal(dataset.summary.scene.avgConf <= 100, true);
    assert.notEqual(dataset.summary.scene.avgConf, 60);
    assert.equal(dataset.summary.scene.avgConf > 0, measuredNodes > 0);
    assert.equal(robotBoundNodes <= dataset.robots.length, true);
  }
});

test('scene dataset prevents impossible sampled-node and alert totals across all scenarios', () => {
  for (const [dataSource, scenario] of scenarios) {
    const dataset = buildSceneDataset(dataSource, scenario);
    const nodes = dataset.fractures.flatMap((fracture) => fracture.nodes);

    assert.equal(dataset.summary.scene.totalNodes, nodes.length);
    assert.equal((dataset.summary.scene.onlineSensors ?? 0) <= dataset.summary.scene.totalNodes, true);
    assert.equal(dataset.summary.scene.overThreshold <= dataset.summary.scene.totalNodes, true);
    assert.equal(dataset.summary.alerts.unacknowledged <= dataset.summary.alerts.total, true);
    assert.equal(dataset.summary.robotFleet.meshConnected <= dataset.summary.robotFleet.total, true);
  }
});
