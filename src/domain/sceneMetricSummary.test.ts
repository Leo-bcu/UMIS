import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSceneMetricSummary } from './sceneMetricSummary';
import type { Fracture, SensorReading } from '../types';

const reading: SensorReading = {
  ch4_pct: 0.05,
  co_ppm: 70,
  h2s_ppm: 3,
  temperature_c: 82,
  stress_mpa: 10,
  stress_sigma1: 12,
  stress_sigma2: 8,
  stress_sigma3: 5,
  permeability_md: 6200,
  water_pressure_mpa: 7.8,
  microseismic_count: 2,
  acoustic_emission_mv: 120,
  humidity_pct: 98,
  fracture_aperture_um: 520,
  displacement_mm: 0.4,
  rock_strength_mpa: 60,
  pore_pressure_mpa: 7.1,
  porosity_pct: 0.52,
  fluid_ph: 7.4,
  water_saturation_pct: 99,
};

function channel(id: string, permeability: number): Fracture {
  const sensors = { ...reading, permeability_md: permeability };
  return {
    id,
    name: id,
    type: 'main',
    path: [[0, 0, 0], [1, 0, 0]],
    length: 1,
    aperture_um: 520,
    porosity: 0.52,
    fractal_dim: 1,
    tortuosity: 1,
    dip_angle: 0,
    azimuth_angle: 0,
    roughness_coeff: 0.1,
    connectivity: 1,
    sensorReading: sensors,
    nodes: [
      { id: `${id}-N1`, position: [0, 0, 0], sensors, timestamp: 1, robotId: null },
      { id: `${id}-N2`, position: [1, 0, 0], sensors, timestamp: 2, robotId: null },
    ],
    parentFractureId: null,
  };
}

describe('buildSceneMetricSummary', () => {
  it('summarizes underground scene from channel sensor readings, not CH4 defaults', () => {
    const summary = buildSceneMetricSummary([channel('UC-1', 6200), channel('UC-2', 900)], 'underground', 5000);

    assert.equal(summary.totalNodes, 4);
    assert.equal(summary.primaryLabel, '渗透率');
    assert.equal(summary.primaryUnit, 'mD');
    assert.equal(summary.auxLabel, '水压');
    assert.equal(summary.auxUnit, 'MPa');
    assert.equal(summary.avgAux, 7.8);
    assert.equal(summary.overThreshold, 2);
    assert.ok(summary.avgPrimary > 3000);
    assert.ok(summary.avgTemperature > 70);
  });
});
