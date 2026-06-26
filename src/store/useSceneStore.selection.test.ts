import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useSceneStore } from './useSceneStore';
import type { Fracture, Robot, SensorReading } from '../types';
import type { Finding } from '../domain/findingTypes';
import { createAIActionAuditEntry } from '../domain/aiActionPolicy';
import { createExportHistoryEntry } from '../domain/exportHistory';

const reading: SensorReading = {
  ch4_pct: 0.8,
  co_ppm: 2,
  h2s_ppm: 0,
  temperature_c: 28,
  stress_mpa: 12,
  stress_sigma1: 14,
  stress_sigma2: 9,
  stress_sigma3: 8,
  permeability_md: 0.2,
  water_pressure_mpa: 1,
  microseismic_count: 1,
  acoustic_emission_mv: 80,
  humidity_pct: 60,
  fracture_aperture_um: 40,
  displacement_mm: 0.1,
  rock_strength_mpa: 55,
  pore_pressure_mpa: 1,
  porosity_pct: 4,
  fluid_ph: 7,
  water_saturation_pct: 12,
};

function robot(id = 'R-083'): Robot {
  return {
    id,
    model: 'floatwalker',
    status: 'online',
    position: [1, -2, 3],
    battery: 86,
    meshRole: 'edge',
    meshConnected: true,
    task: '暗流通道巡检',
    depth: 245,
    signalStrength: -70,
    sensors: { ch4: 0.2, temperature: 24, humidity: 82 },
    lastUpdate: 1,
  };
}

function fracture(id = 'UC-005'): Fracture {
  return {
    id,
    name: '暗河交汇腔',
    type: 'main',
    path: [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
    length: 3,
    aperture_um: 40,
    porosity: 0.02,
    fractal_dim: 2.1,
    tortuosity: 1.1,
    dip_angle: 10,
    azimuth_angle: 20,
    roughness_coeff: 0.3,
    connectivity: 2,
    sensorReading: reading,
    nodes: [
      { id: 'UC-005-N1', position: [0, 0, 0], sensors: reading, timestamp: 1, robotId: 'R-083' },
    ],
    parentFractureId: null,
  };
}

function resetSelection() {
  useSceneStore.setState({
    selectedRobot: null,
    robotDetailOpen: false,
    focusedRobotId: null,
    selectedFracture: null,
    selectedFractureNode: null,
    annotations: [],
    findings: [],
    acknowledgedAlertIds: [],
    aiActionAudit: [],
    exportHistory: [],
    volumeMeasureMode: false,
    highlightRegion: { position: [0, 0, 0], radius: 10, active: false },
  });
}

function finding(): Finding {
  return {
    id: 'finding-1',
    sourceType: 'manual',
    sourceId: 'manual-1',
    title: '跨场景风险',
    description: 'should clear',
    level: 'warning',
    status: 'new',
    position: [0, 0, 0],
    truthBoundary: 'measured',
    confidence: 0.8,
    createdAt: 1,
    updatedAt: 1,
    evidence: [],
  };
}

function seedCrossSceneEvidence() {
  const store = useSceneStore.getState();
  store.addAnnotation({ id: 'a1', type: 'text', points: [[0, 0, 0]], label: 'old', createdAt: 1 });
  store.addFinding(finding());
  store.acknowledgeAlert('alert-1');
  store.addAIActionAudit(createAIActionAuditEntry({ type: 'flyTo', position: [1, 2, 3] }, 'old action', 1));
  store.addExportHistory(createExportHistoryEntry({
    format: 'pdf',
    status: 'success',
    preflightStatus: 'pass',
    findingCount: 1,
    includeAIInferred: true,
    timestamp: 1,
  }));
  store.setVolumeMeasureMode(true);
  store.setHighlightRegion({ position: [1, 2, 3], radius: 5, active: true });
}

function assertCrossSceneEvidenceCleared() {
  const state = useSceneStore.getState();
  assert.equal(state.annotations.length, 0);
  assert.equal(state.findings.length, 0);
  assert.equal(state.acknowledgedAlertIds.length, 0);
  assert.equal(state.aiActionAudit.length, 0);
  assert.equal(state.exportHistory.length, 0);
  assert.equal(state.volumeMeasureMode, false);
  assert.equal(state.highlightRegion.active, false);
}

describe('useSceneStore selection handoff', () => {
  it('uses robot selection as the active right-panel object', () => {
    resetSelection();
    const selectedFracture = fracture();

    useSceneStore.getState().selectFracture(selectedFracture);
    useSceneStore.getState().selectFractureNode('UC-005-N1');
    useSceneStore.getState().openRobotDetail(robot());

    const state = useSceneStore.getState();
    assert.equal(state.selectedRobot?.id, 'R-083');
    assert.equal(state.robotDetailOpen, true);
    assert.equal(state.focusedRobotId, 'R-083');
    assert.equal(state.selectedFracture, null);
    assert.equal(state.selectedFractureNode, null);
  });

  it('uses fracture selection as the active right-panel object', () => {
    resetSelection();
    const selectedRobot = robot();
    const selectedFracture = fracture();

    useSceneStore.getState().openRobotDetail(selectedRobot);
    useSceneStore.getState().selectFracture(selectedFracture);

    const state = useSceneStore.getState();
    assert.equal(state.selectedFracture?.id, 'UC-005');
    assert.equal(state.selectedRobot, null);
    assert.equal(state.robotDetailOpen, false);
    assert.equal(state.focusedRobotId, null);
  });

  it('clears robot and fracture selection together when requested', () => {
    resetSelection();
    useSceneStore.getState().openRobotDetail(robot());
    useSceneStore.getState().selectFracture(fracture());
    useSceneStore.getState().selectFractureNode('UC-005-N1');

    useSceneStore.getState().clearSelection();

    const state = useSceneStore.getState();
    assert.equal(state.selectedRobot, null);
    assert.equal(state.robotDetailOpen, false);
    assert.equal(state.focusedRobotId, null);
    assert.equal(state.selectedFracture, null);
    assert.equal(state.selectedFractureNode, null);
    assert.equal(state.highlightedFractureIds, null);
  });

  it('clears cross-scenario evidence when switching scenario', () => {
    resetSelection();
    seedCrossSceneEvidence();

    useSceneStore.getState().setScenario('pipeline');

    assertCrossSceneEvidenceCleared();
  });

  it('clears cross-scenario evidence when switching data source', () => {
    resetSelection();
    seedCrossSceneEvidence();

    useSceneStore.getState().setDataSource('nuclear');

    assertCrossSceneEvidenceCleared();
  });

  it('clears cross-scenario evidence when resetting scene view', () => {
    resetSelection();
    seedCrossSceneEvidence();

    useSceneStore.getState().resetSceneView();

    assertCrossSceneEvidenceCleared();
  });
});
