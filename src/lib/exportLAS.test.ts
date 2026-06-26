import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLASBuffer } from './exportLAS';
import type { Fracture, Robot } from '../types';

const reading = {
  ch4_pct: 1,
  co_ppm: 0,
  h2s_ppm: 0,
  temperature_c: 25,
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

test('LAS export emits an honest LAS 1.2 header with valid classification codes', () => {
  const fracture: Fracture = {
    id: 'F-001',
    name: 'test path',
    type: 'branch',
    path: [[0, 0, 0], [1, 1, 1]],
    length: 1,
    aperture_um: 1,
    porosity: 0,
    fractal_dim: 0,
    tortuosity: 0,
    dip_angle: 0,
    azimuth_angle: 0,
    roughness_coeff: 0,
    connectivity: 1,
    sensorReading: reading,
    nodes: [{ id: 'N-1', position: [0, 0, 0], sensors: reading, timestamp: 0, robotId: null }],
    parentFractureId: null,
  };
  const robot: Robot = {
    id: 'R-001',
    model: 'spider',
    position: [2, 2, 2],
    battery: 100,
    status: 'online',
    meshRole: 'edge',
    task: 'test',
    depth: 0,
    signalStrength: -40,
    lastUpdate: Date.now(),
    sensors: { ch4: 0, temperature: 25, humidity: 0 },
    meshConnected: true,
  };

  const buf = buildLASBuffer([fracture], [robot]);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  assert.equal(String.fromCharCode(...buf.slice(0, 4)), 'LASF');
  assert.equal(buf[24], 1);
  assert.equal(buf[25], 2);
  assert.equal(view.getUint16(94, true), 227);
  assert.equal(view.getUint32(96, true), 227);
  assert.equal(buf[104], 2);

  const pointSize = view.getUint16(105, true);
  assert.equal(pointSize, 26);
  const pointCount = view.getUint32(107, true);
  const classifications = Array.from({ length: pointCount }, (_, i) => buf[227 + i * pointSize + 15]);
  assert.ok(classifications.length > 0);
  assert.equal(classifications.every((code) => code >= 0 && code <= 31), true);
});
