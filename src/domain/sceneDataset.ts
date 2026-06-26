import type { DataSourceType, Fracture, Robot, ScenarioType, SensorReading, Monitor } from '../types';
import type { SceneStats, RobotFleetStats, MonitorFleetStats } from '../types/api';
import { buildSceneMetricSummary } from './sceneMetricSummary';
import { generateFractureNetwork } from '../data/fractureDataGenerator';
import { generatePipelineNetwork } from '../data/pipelineDataGenerator';
import { generateNuclearNetwork } from '../data/nuclearDataGenerator';
import { generateRefineryNetwork } from '../data/refineryDataGenerator';
import { generateUndergroundNetwork } from '../data/undergroundDataGenerator';
import { generateMockRobots, generateMockMonitors } from '../data/robotDataGenerator';
import { generateMockAlerts, type AlertEvent } from '../data/alertDataGenerator';
import { sanitizeSensorReading } from '../lib/sensorSanitizer';

export interface SceneDataset {
  dataSource: DataSourceType;
  scenario: ScenarioType;
  fractures: Fracture[];
  robots: Robot[];
  monitors: Monitor[];
  alerts: AlertEvent[];
  summary: {
    scene: SceneStats;
    robotFleet: RobotFleetStats;
    monitorFleet: MonitorFleetStats;
    alerts: {
      total: number;
      danger: number;
      warning: number;
      info: number;
      unacknowledged: number;
    };
  };
}

const datasetCache = new Map<string, SceneDataset>();

function getFractures(dataSource: DataSourceType, scenario: ScenarioType): Fracture[] {
  switch (dataSource) {
    case 'pipeline':
      return generatePipelineNetwork();
    case 'nuclear':
      return generateNuclearNetwork();
    case 'refinery':
      return generateRefineryNetwork();
    case 'underground':
      return generateUndergroundNetwork();
    case 'fracture':
    default:
      return generateFractureNetwork(scenario);
  }
}

function sanitizeFractures(fractures: Fracture[], scenario: ScenarioType): Fracture[] {
  return fractures.map((fracture) => ({
    ...fracture,
    sensorReading: sanitizeSensorReading(fracture.sensorReading, scenario),
    nodes: fracture.nodes.map((node) => ({ ...node, sensors: sanitizeSensorReading(node.sensors, scenario) })),
  }));
}

function buildRobotFleetSummary(robots: Robot[]): RobotFleetStats {
  const total = robots.length;
  const online = robots.filter((robot) => robot.status === 'online').length;
  const offline = robots.filter((robot) => robot.status === 'offline').length;
  const lowBattery = robots.filter((robot) => robot.status === 'low_battery').length;
  const error = robots.filter((robot) => robot.status === 'error').length;
  const maintenance = robots.filter((robot) => robot.status === 'maintenance').length;
  const meshConnected = robots.filter((robot) => robot.meshConnected).length;
  const avgBattery = total === 0
    ? 0
    : Math.round(robots.reduce((sum, robot) => sum + robot.battery, 0) / total);

  return { total, online, offline, lowBattery, error, maintenance, meshConnected, avgBattery };
}

function hasMeasuredSignal(reading: SensorReading): boolean {
  return Object.values(reading).some((value) => Number.isFinite(value) && value !== 0);
}

function buildDataConfidence(fractures: Fracture[], robots: Robot[]): number {
  const nodes = fractures.flatMap((fracture) => fracture.nodes);
  if (nodes.length === 0) return 0;

  const measuredNodes = nodes.filter((node) => hasMeasuredSignal(node.sensors)).length;
  const robotBoundNodes = nodes.filter((node) => node.robotId).length;
  const freshNodes = nodes.filter((node) => Number.isFinite(node.timestamp) && node.timestamp > 0).length;
  const meshConnected = robots.filter((robot) => robot.meshConnected).length;

  const measuredRatio = measuredNodes / nodes.length;
  const robotBindingRatio = robotBoundNodes / nodes.length;
  const freshnessRatio = freshNodes / nodes.length;
  const meshRatio = robots.length === 0 ? 0 : meshConnected / robots.length;

  const score =
    measuredRatio * 0.45 +
    freshnessRatio * 0.2 +
    robotBindingRatio * 0.2 +
    meshRatio * 0.15;

  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

function buildAlertSummary(alerts: AlertEvent[]) {
  return {
    total: alerts.length,
    danger: alerts.filter((alert) => alert.level === 'danger').length,
    warning: alerts.filter((alert) => alert.level === 'warning').length,
    info: alerts.filter((alert) => alert.level === 'info').length,
    unacknowledged: alerts.filter((alert) => !alert.acknowledged).length,
  };
}

function buildSceneSummary(fractures: Fracture[], robots: Robot[], scenario: ScenarioType): SceneStats {
  const metricSummary = buildSceneMetricSummary(fractures, scenario);

  return {
    totalNodes: metricSummary.totalNodes,
    avgGas: metricSummary.avgPrimary,
    avgTemp: metricSummary.avgTemperature,
    avgConf: buildDataConfidence(fractures, robots),
    overThreshold: metricSummary.overThreshold,
    onlineSensors: metricSummary.totalNodes,
    lastUpdate: Date.now(),
  };
}

export function buildSceneDataset(
  dataSource: DataSourceType,
  scenario: ScenarioType,
): SceneDataset {
  const key = dataSource === 'fracture' ? `${dataSource}:${scenario}` : dataSource;
  const cached = datasetCache.get(key);
  if (cached) return cached;

  const fractures = sanitizeFractures(getFractures(dataSource, scenario), scenario);
  const robots = generateMockRobots(dataSource, scenario);
  const monitors = generateMockMonitors(dataSource, scenario);
  const alerts = generateMockAlerts(robots, dataSource, scenario);
  const dataset: SceneDataset = {
    dataSource,
    scenario,
    fractures,
    robots,
    monitors,
    alerts,
    summary: {
      scene: buildSceneSummary(fractures, robots, scenario),
      robotFleet: buildRobotFleetSummary(robots),
      monitorFleet: { total: monitors.length, online: monitors.filter((m) => m.status === 'online').length, offline: monitors.filter((m) => m.status === 'offline').length, warning: monitors.filter((m) => m.status === 'warning').length, maintenance: monitors.filter((m) => m.status === 'maintenance').length, avgBattery: monitors.length === 0 ? 0 : Math.round(monitors.reduce((sum, monitor) => sum + monitor.battery, 0) / monitors.length) },
      alerts: buildAlertSummary(alerts),
    },
  };

  datasetCache.set(key, dataset);
  return dataset;
}

export function clearSceneDatasetCache() {
  datasetCache.clear();
}
