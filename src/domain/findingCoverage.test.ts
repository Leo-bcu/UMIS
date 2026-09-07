import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarizeExplorationCoverage } from './findingCoverage';
import type { Finding } from './findingTypes';
import type { Fracture, SensorReading } from '../types';

const reading: SensorReading = {
  ch4_pct: 0.4,
  co_ppm: 4,
  h2s_ppm: 0,
  temperature_c: 28,
  stress_mpa: 12,
  stress_sigma1: 13,
  stress_sigma2: 9,
  stress_sigma3: 8,
  permeability_md: 0.3,
  water_pressure_mpa: 1.2,
  microseismic_count: 2,
  acoustic_emission_mv: 120,
  humidity_pct: 60,
  fracture_aperture_um: 42,
  displacement_mm: 0.2,
  rock_strength_mpa: 62,
  pore_pressure_mpa: 1,
  porosity_pct: 4,
  fluid_ph: 7,
  water_saturation_pct: 12,
};

function fracture(): Fracture {
  return {
    id: 'F-001',
    name: 'F-1',
    type: 'main',
    path: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]],
    length: 3,
    aperture_um: 42,
    porosity: 0.02,
    fractal_dim: 2.1,
    tortuosity: 1.1,
    dip_angle: 10,
    azimuth_angle: 20,
    roughness_coeff: 0.3,
    connectivity: 2,
    sensorReading: reading,
    nodes: [
      { id: 'N-1', position: [0, 0, 0], sensors: reading, timestamp: 1, robotId: 'R-001' },
      { id: 'N-2', position: [1, 0, 0], sensors: reading, timestamp: 2, robotId: 'R-001' },
    ],
    parentFractureId: null,
  };
}

function finding(id: string, truthBoundary: Finding['truthBoundary'], confidence: number): Finding {
  return {
    id,
    sourceType: 'manual',
    sourceId: id,
    title: id,
    description: id,
    level: 'warning',
    status: 'new',
    position: [0, 0, 0],
    truthBoundary,
    confidence,
    createdAt: 1,
    updatedAt: 1,
    evidence: [],
  };
}

describe('summarizeExplorationCoverage', () => {
  it('summarizes measured and unknown path sampling plus finding boundaries', () => {
    const summary = summarizeExplorationCoverage(
      [fracture()],
      [
        finding('ai-1', 'ai_inferred', 0.66),
        finding('verified-1', 'human_verified', 0.91),
      ]
    );

    assert.equal(summary.pathPoints, 4);
    assert.equal(summary.measuredNodes, 2);
    assert.equal(summary.unknownPathPoints, 2);
    assert.equal(summary.measuredPct, 0.5);
    assert.equal(summary.unknownPct, 0.5);
    assert.equal(summary.aiInferredFindings, 1);
    assert.equal(summary.lowConfidenceFindings, 1);
    assert.equal(summary.truthBoundaryCounts.measured, 2);
    assert.equal(summary.truthBoundaryCounts.unknown, 2);
    assert.equal(summary.truthBoundaryCounts.ai_inferred, 1);
    assert.equal(summary.truthBoundaryCounts.human_verified, 1);
  });

  it('returns zero coverage for empty data', () => {
    const summary = summarizeExplorationCoverage([], []);

    assert.equal(summary.pathPoints, 0);
    assert.equal(summary.measuredPct, 0);
    assert.equal(summary.unknownPct, 0);
  });
});
