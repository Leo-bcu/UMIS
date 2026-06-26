import type { Fracture, ScenarioType, SensorReading } from '../types';
import { getSceneSemantics } from '../lib/sceneSemantics';

export interface SceneMetricSummary {
  totalNodes: number;
  avgPrimary: number;
  primaryLabel: string;
  primaryUnit: string;
  avgAux: number;
  auxLabel: string;
  auxUnit: string;
  avgTemperature: number;
  overThreshold: number;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function readingValues(fractures: Fracture[]): SensorReading[] {
  return fractures.flatMap((fracture) => fracture.nodes.map((node) => node.sensors));
}

export function buildSceneMetricSummary(
  fractures: Fracture[],
  scenario: ScenarioType,
  thresholdValue?: number
): SceneMetricSummary {
  const semantics = getSceneSemantics(scenario);
  const primary = semantics.trend.primary;
  const temperature = semantics.trend.temperature;
  const aux = semantics.trend.aux;
  const threshold = thresholdValue ?? semantics.threshold.defaultValue;
  const readings = readingValues(fractures);
  const primaryValues = readings.map((reading) => reading[primary.key]);
  const temperatureValues = readings.map((reading) => reading[temperature.key]);
  const auxValues = readings.map((reading) => reading[aux.key]);

  return {
    totalNodes: readings.length,
    avgPrimary: Math.round(average(primaryValues) * 100) / 100,
    primaryLabel: primary.label,
    primaryUnit: primary.unit,
    avgAux: Math.round(average(auxValues) * 100) / 100,
    auxLabel: aux.label,
    auxUnit: aux.unit,
    avgTemperature: Math.round(average(temperatureValues) * 10) / 10,
    overThreshold: primaryValues.filter((value) => value > threshold).length,
  };
}
