import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useSceneStore } from './useSceneStore';

function resetScene() {
  useSceneStore.setState({
    dataSource: 'fracture',
    scenario: 'coal',
    gasThreshold: 1.5,
  });
}

describe('useSceneStore data source semantics', () => {
  it('keeps industrial data sources and scenario semantics in sync', () => {
    resetScene();

    useSceneStore.getState().setScenario('oil');
    useSceneStore.getState().setDataSource('nuclear');

    let state = useSceneStore.getState();
    assert.equal(state.dataSource, 'nuclear');
    assert.equal(state.scenario, 'nuclear');
    assert.equal(state.gasThreshold, 25);

    useSceneStore.getState().setDataSource('underground');

    state = useSceneStore.getState();
    assert.equal(state.dataSource, 'underground');
    assert.equal(state.scenario, 'underground');
    assert.equal(state.gasThreshold, 5000);
  });

  it('falls back to coal semantics when returning from industrial source to fracture data source', () => {
    resetScene();

    useSceneStore.getState().setDataSource('refinery');
    useSceneStore.getState().setDataSource('fracture');

    const state = useSceneStore.getState();
    assert.equal(state.dataSource, 'fracture');
    assert.equal(state.scenario, 'coal');
    assert.equal(state.gasThreshold, 1.5);
  });

  it('resets the safety threshold whenever a scenario is switched directly', () => {
    resetScene();

    useSceneStore.getState().setGasThreshold(3);
    useSceneStore.getState().setScenario('refinery');
    assert.equal(useSceneStore.getState().gasThreshold, 50);

    useSceneStore.getState().setGasThreshold(12);
    useSceneStore.getState().setScenario('pipeline');
    assert.equal(useSceneStore.getState().gasThreshold, 20);
  });
});
