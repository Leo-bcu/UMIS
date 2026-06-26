import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { snapMeasurementPoint } from './measurementPicking';
import type { Fracture } from '../types';

const sensorReading = {
  ch4_pct: 0,
  co_ppm: 0,
  h2s_ppm: 0,
  temperature_c: 28,
  stress_mpa: 0,
  stress_sigma1: 0,
  stress_sigma2: 0,
  stress_sigma3: 0,
  permeability_md: 0,
  water_pressure_mpa: 0,
  microseismic_count: 0,
  acoustic_emission_mv: 0,
  humidity_pct: 0,
  fracture_aperture_um: 0,
  displacement_mm: 0,
  rock_strength_mpa: 0,
  pore_pressure_mpa: 0,
  porosity_pct: 0,
  fluid_ph: 7,
  water_saturation_pct: 0,
};

function makeFracture(): Fracture {
  return {
    id: 'UC-001',
    name: '测试暗流通道',
    type: 'main',
    path: [[0, 0, 0], [10, 0, 0]],
    length: 10,
    aperture_um: 0,
    porosity: 0,
    fractal_dim: 0,
    tortuosity: 0,
    dip_angle: 0,
    azimuth_angle: 0,
    roughness_coeff: 0,
    connectivity: 1,
    sensorReading,
    parentFractureId: null,
    nodes: [
      {
        id: 'N-001',
        position: [0, 0, 0],
        sensors: sensorReading,
        timestamp: 0,
        robotId: null,
      },
    ],
  };
}

describe('snapMeasurementPoint', () => {
  it('prefers a nearby semantic node over a raw mesh hit', () => {
    const snapped = snapMeasurementPoint([0.3, 0.2, 0], [makeFracture()], 2);

    assert.equal(snapped.snapped, true);
    assert.equal(snapped.targetType, 'node');
    assert.deepEqual(snapped.point, [0, 0, 0]);
    assert.equal(snapped.targetId, 'N-001');
  });

  it('snaps near-channel clicks to the closest path segment projection', () => {
    const snapped = snapMeasurementPoint([5, 1.2, 0.8], [makeFracture()], 2);

    assert.equal(snapped.snapped, true);
    assert.equal(snapped.targetType, 'path');
    assert.equal(Number(snapped.point[0].toFixed(6)), 5);
    assert.equal(Number(snapped.point[1].toFixed(6)), 0);
    assert.equal(Number(snapped.point[2].toFixed(6)), 0);
  });

  it('keeps the raw point when no semantic target is close enough', () => {
    const snapped = snapMeasurementPoint([30, 20, 10], [makeFracture()], 2);

    assert.equal(snapped.snapped, false);
    assert.equal(snapped.targetType, 'raw');
    assert.deepEqual(snapped.point, [30, 20, 10]);
  });
});
