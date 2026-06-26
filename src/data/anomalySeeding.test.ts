import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneDataset, clearSceneDatasetCache } from '../domain/sceneDataset';
import { generateRefineryNetwork } from './refineryDataGenerator';
import type { DataSourceType, ScenarioType, SensorReading } from '../types';

const scenarios = [
  ['fracture', 'coal'],
  ['fracture', 'gold'],
  ['fracture', 'oil'],
  ['pipeline', 'pipeline'],
  ['nuclear', 'nuclear'],
  ['refinery', 'refinery'],
  ['underground', 'underground'],
] as const satisfies readonly [DataSourceType, ScenarioType][];

function allReadings(dataSource: DataSourceType, scenario: ScenarioType): SensorReading[] {
  clearSceneDatasetCache();
  const dataset = buildSceneDataset(dataSource, scenario);
  return dataset.fractures.flatMap((fracture) => [
    fracture.sensorReading,
    ...fracture.nodes.map((node) => node.sensors),
  ]);
}

function has(readings: SensorReading[], predicate: (reading: SensorReading) => boolean): boolean {
  return readings.some(predicate);
}

test('each demo scenario contains physically plausible seeded abnormalities in raw source readings', () => {
  for (const [dataSource, scenario] of scenarios) {
    const readings = allReadings(dataSource, scenario);

    if (scenario === 'coal') {
      assert.equal(has(readings, (r) => r.ch4_pct >= 1.5 && r.co_ppm >= 24), true, 'coal needs gas + CO abnormality');
    } else if (scenario === 'gold') {
      assert.equal(has(readings, (r) => r.microseismic_count >= 15 && r.acoustic_emission_mv >= 5000), true, 'gold needs rockburst abnormality');
    } else if (scenario === 'oil') {
      assert.equal(has(readings, (r) => r.pore_pressure_mpa >= 30 && r.water_saturation_pct >= 45), true, 'oil needs high-pressure water-bearing abnormality');
    } else if (scenario === 'pipeline') {
      assert.equal(has(readings, (r) => r.rock_strength_mpa >= 20 && r.permeability_md >= 0.3), true, 'pipeline needs wall-loss + corrosion abnormality');
    } else if (scenario === 'nuclear') {
      assert.equal(has(readings, (r) => r.ch4_pct >= 25 && r.water_pressure_mpa >= 60), true, 'nuclear needs dose + fatigue abnormality');
    } else if (scenario === 'refinery') {
      assert.equal(has(readings, (r) => r.h2s_ppm >= 50 && r.ch4_pct >= 10 && r.stress_mpa < 19.5), true, 'refinery needs H2S/LEL/O2 abnormality');
    } else if (scenario === 'underground') {
      assert.equal(has(readings, (r) => r.permeability_md >= 5000 && r.water_pressure_mpa >= 8), true, 'underground needs high-permeability water-pressure abnormality');
    }
  }
});

test('seeded demo readings are sanitized before reaching the scene dataset', () => {
  const refinery = allReadings('refinery', 'refinery');
  assert.equal(refinery.every((r) => r.water_saturation_pct <= 100), true);
  assert.equal(refinery.every((r) => Number.isInteger(r.microseismic_count)), true);
});

test('direct scenario generators expose sanitized seeded readings', () => {
  const readings = generateRefineryNetwork().flatMap((fracture) => [
    fracture.sensorReading,
    ...fracture.nodes.map((node) => node.sensors),
  ]);

  assert.equal(readings.every((r) => r.water_saturation_pct <= 100), true);
});
