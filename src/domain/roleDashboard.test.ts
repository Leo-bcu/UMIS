import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRoleDashboard } from './roleDashboard';
import type { AlertEvent } from '../data/alertDataGenerator';
import type { Finding } from './findingTypes';
import type { Fracture, Robot, SensorReading } from '../types';

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

function robot(id: string, status: Robot['status'], battery: number): Robot {
  return {
    id,
    model: 'tracked',
    status,
    position: [0, 0, 0],
    battery,
    meshRole: 'edge',
    meshConnected: status !== 'offline',
    task: '巡检',
    depth: 12,
    signalStrength: -70,
    sensors: { ch4: 0.5, temperature: 28, humidity: 60 },
    lastUpdate: 1,
  };
}

function finding(id: string, level: Finding['level'], truthBoundary: Finding['truthBoundary'], confidence: number): Finding {
  return {
    id,
    sourceType: 'manual',
    sourceId: id,
    title: id,
    description: id,
    level,
    status: 'new',
    position: [0, 0, 0],
    truthBoundary,
    confidence,
    createdAt: 1,
    updatedAt: 1,
    evidence: [],
  };
}

function fracture(): Fracture {
  return {
    id: 'F-001',
    name: 'F-1',
    type: 'main',
    path: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]],
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
      { id: 'N-1', position: [0, 0, 0], sensors: reading, timestamp: 1, robotId: 'R-001' },
      { id: 'N-2', position: [1, 0, 0], sensors: reading, timestamp: 2, robotId: 'R-002' },
    ],
    parentFractureId: null,
  };
}

const alerts: AlertEvent[] = [
  {
    id: 'alert-1',
    level: 'danger',
    type: 'gas_overload',
    title: 'CH4 超限',
    description: '危险',
    timestamp: 10,
    acknowledged: false,
  },
];

describe('buildRoleDashboard', () => {
  it('summarizes manager, safety, engineer, and timeline views', () => {
    const dashboard = buildRoleDashboard({
      robots: [robot('R-001', 'online', 80), robot('R-002', 'low_battery', 18), robot('R-003', 'offline', 50)],
      alerts,
      findings: [
        finding('danger-1', 'danger', 'measured', 0.9),
        finding('ai-1', 'warning', 'ai_inferred', 0.65),
      ],
      fractures: [fracture()],
    });

    assert.equal(dashboard.manager.openCriticalCount, 2);
    assert.equal(dashboard.manager.onlineRobotPct, 1 / 3);
    assert.equal(dashboard.safetyQueue.length, 3);
    assert.equal(dashboard.engineerDataQuality.lowConfidenceFindings, 1);
    assert.equal(dashboard.engineerDataQuality.measuredPct, 0.5);
    assert.ok(dashboard.missionTimeline.length >= 3);
  });
});
