import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSensorReading } from './sensorSanitizer';
import type { SensorReading } from '../types';

const base: SensorReading = {
  ch4_pct: 0,
  co_ppm: 0,
  h2s_ppm: 0,
  temperature_c: 0,
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
  fluid_ph: 0,
  water_saturation_pct: 0,
};

test('clamps coal ch4_pct to [0,5] without crushing nuclear dose-rate reuse', () => {
  assert.equal(sanitizeSensorReading({ ...base, ch4_pct: 62 }, 'coal').ch4_pct, 5);
  assert.equal(sanitizeSensorReading({ ...base, ch4_pct: 62 }, 'nuclear').ch4_pct, 62);
});

test('clamps saturation, humidity, and porosity percentages to [0,100]', () => {
  const r = sanitizeSensorReading({ ...base, water_saturation_pct: 980, humidity_pct: 150, porosity_pct: 120 }, 'refinery');
  assert.equal(r.water_saturation_pct, 100);
  assert.equal(r.humidity_pct, 100);
  assert.equal(r.porosity_pct, 100);
});

test('rounds integer-contract fields', () => {
  const r = sanitizeSensorReading({ ...base, microseismic_count: 9.8, acoustic_emission_mv: 1234.5 }, 'nuclear');
  assert.equal(r.microseismic_count, 10);
  assert.equal(r.acoustic_emission_mv, 1235);
});

test('clamps pH and negative physical values', () => {
  const r = sanitizeSensorReading({ ...base, fluid_ph: 15, temperature_c: -100, stress_mpa: -5, displacement_mm: -2 }, 'underground');
  assert.equal(r.fluid_ph, 14);
  assert.equal(r.temperature_c, -50);
  assert.equal(r.stress_mpa, 0);
  assert.equal(r.displacement_mm, 0);
});

test('preserves physically valid nuclear coolant temperatures', () => {
  assert.equal(sanitizeSensorReading({ ...base, temperature_c: 327 }, 'nuclear').temperature_c, 327);
  assert.equal(sanitizeSensorReading({ ...base, temperature_c: 327 }, 'coal').temperature_c, 200);
});

test('preserves valid high underground permeability', () => {
  assert.equal(sanitizeSensorReading({ ...base, permeability_md: 18000 }, 'underground').permeability_md, 18000);
});

test('handles NaN and Infinity gracefully', () => {
  const r = sanitizeSensorReading({ ...base, ch4_pct: NaN, temperature_c: Infinity }, 'coal');
  assert.equal(r.ch4_pct, 0);
  assert.ok(Number.isFinite(r.temperature_c));
});
