import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateMockSensorTrend } from './sensorTrendGenerator';
import type { Fracture, SensorReading } from '../types';

const undergroundReading: SensorReading = {
  ch4_pct: 0.08,
  co_ppm: 80,
  h2s_ppm: 4,
  temperature_c: 74,
  stress_mpa: 16,
  stress_sigma1: 22,
  stress_sigma2: 12,
  stress_sigma3: 8,
  permeability_md: 5200,
  water_pressure_mpa: 7.4,
  microseismic_count: 4,
  acoustic_emission_mv: 300,
  humidity_pct: 96,
  fracture_aperture_um: 420,
  displacement_mm: 1.2,
  rock_strength_mpa: 45,
  pore_pressure_mpa: 6.8,
  porosity_pct: 0.42,
  fluid_ph: 7.2,
  water_saturation_pct: 98,
};

function undergroundChannel(id: string, x: number, z: number): Fracture {
  return {
    id,
    name: id,
    type: id.endsWith('0') ? 'main' : 'branch',
    path: [[x, -10, z], [x + 6, -18, z + 4], [x + 14, -26, z + 12]],
    length: 28,
    aperture_um: 420,
    porosity: 0.42,
    fractal_dim: 1.2,
    tortuosity: 1.4,
    dip_angle: 18,
    azimuth_angle: 45,
    roughness_coeff: 0.2,
    connectivity: 2,
    sensorReading: undergroundReading,
    nodes: [
      { id: `${id}-N1`, position: [x, -10, z], sensors: undergroundReading, timestamp: 1, robotId: 'R-083' },
      { id: `${id}-N2`, position: [x + 6, -18, z + 4], sensors: undergroundReading, timestamp: 2, robotId: 'R-084' },
    ],
    parentFractureId: null,
  };
}

describe('generateMockSensorTrend', () => {
  it('generates underground trend labels and values from underground source data', () => {
    const trend = generateMockSensorTrend(8, [
      undergroundChannel('UC-010', -30, -30),
      undergroundChannel('UC-011', 30, 30),
    ], 'underground');

    assert.match(trend.source, /暗流|通道|含水层/);
    assert.doesNotMatch(trend.source, /裂缝/);
    assert.ok(trend.regions.every((region) => !/裂缝/.test(region.regionName)));
    assert.ok(trend.ch4.some((value) => value > 1000), 'primary underground trend should reflect permeability-scale source data');
    assert.ok(trend.pressure.some((value) => value > 1), 'aux trend should reflect water pressure source data');
    assert.equal(trend.regions.reduce((sum, region) => sum + region.nodeCount, 0), 8);
  });
});
