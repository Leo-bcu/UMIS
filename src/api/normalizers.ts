import type { AlertEvent, AlertLevel, AlertType, Fracture, FractureNode, Geometry, MeshRole, POI, RawPoint, Robot, RobotStatus, ScenarioType, SceneNode, SensorReading, Vec3 } from '../types';
import type { FlatGeometryData, RobotFleetStats, SceneStats } from '../types/api';
import { sanitizeSensorReading } from '../lib/sensorSanitizer';

const ROBOT_STATUS_ALIASES: Record<string, RobotStatus> = {
  online: 'online',
  active: 'online',
  running: 'online',
  offline: 'offline',
  disconnected: 'offline',
  warning: 'low_battery',
  low_battery: 'low_battery',
  lowbattery: 'low_battery',
  critical: 'error',
  error: 'error',
  fault: 'error',
  maintenance: 'maintenance',
  idle: 'maintenance',
};

const MESH_ROLE_ALIASES: Record<string, MeshRole> = {
  gateway: 'gateway',
  core: 'gateway',
  relay: 'relay',
  repeater: 'relay',
  edge: 'edge',
  terminal: 'leaf',
  leaf: 'leaf',
};

function pickString(input: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

function pickNumber(input: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.replace(/,/g, '').trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function toPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const pct = value > 0 && value <= 1 ? value * 100 : value;
  return Math.round(Math.max(0, Math.min(100, pct)) * 100) / 100;
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function pickTuple3(input: Record<string, unknown>, keys: string[]): [number, number, number] | null {
  for (const key of keys) {
    const value = input[key];
    if (
      Array.isArray(value) &&
      value.length === 3 &&
      value.every((item) => typeof item === 'number' && Number.isFinite(item))
    ) {
      return [value[0], value[1], value[2]];
    }
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as Record<string, unknown>).x === 'number' &&
      typeof (value as Record<string, unknown>).y === 'number' &&
      typeof (value as Record<string, unknown>).z === 'number'
    ) {
      const record = value as Record<string, number>;
      return [record.x, record.y, record.z];
    }
  }
  return null;
}

function pickVec3Record(input: Record<string, unknown>, keys: string[]): Vec3 | null {
  for (const key of keys) {
    const value = input[key];
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as Record<string, unknown>).x === 'number' &&
      typeof (value as Record<string, unknown>).y === 'number' &&
      typeof (value as Record<string, unknown>).z === 'number'
    ) {
      const obj = value as Record<string, number>;
      return { x: obj.x, y: obj.y, z: obj.z };
    }
  }
  return null;
}

function pickNumberArray(input: Record<string, unknown>, keys: string[]): number[] | null {
  for (const key of keys) {
    const value = input[key];
    if (Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item))) {
      return value;
    }
  }
  return null;
}

function pickPathTuples(input: Record<string, unknown>, keys: string[]): [number, number, number][] | null {
  for (const key of keys) {
    const value = input[key];
    if (
      Array.isArray(value) &&
      value.every((item) =>
        Array.isArray(item)
        && item.length === 3
        && item.every((coord) => typeof coord === 'number' && Number.isFinite(coord)))
    ) {
      return value as [number, number, number][];
    }

    if (
      Array.isArray(value) &&
      value.every((item) =>
        item
        && typeof item === 'object'
        && typeof (item as Record<string, unknown>).x === 'number'
        && typeof (item as Record<string, unknown>).y === 'number'
        && typeof (item as Record<string, unknown>).z === 'number')
    ) {
      return value.map((item) => {
        const record = item as Record<string, number>;
        return [record.x, record.y, record.z];
      });
    }
  }

  return null;
}

function coerceRawPoints(input: unknown): RawPoint[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).x === 'number' &&
      typeof (item as Record<string, unknown>).y === 'number' &&
      typeof (item as Record<string, unknown>).z === 'number'
    ) {
      const raw = item as Record<string, number>;
      return [{
        x: raw.x,
        y: raw.y,
        z: raw.z,
        intensity: typeof raw.intensity === 'number' ? raw.intensity : 0,
      }];
    }
    return [];
  });
}

function coerceMeshVertices(input: unknown): Vec3[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).x === 'number' &&
      typeof (item as Record<string, unknown>).y === 'number' &&
      typeof (item as Record<string, unknown>).z === 'number'
    ) {
      const raw = item as Record<string, number>;
      return [{ x: raw.x, y: raw.y, z: raw.z }];
    }
    return [];
  });
}

function pickBoolean(input: Record<string, unknown>, keys: string[], fallback = false): boolean {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lowered = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'acked', 'acknowledged'].includes(lowered)) return true;
      if (['false', '0', 'no', 'n', 'new', 'unacked', 'unacknowledged'].includes(lowered)) return false;
    }
  }
  return fallback;
}

function normalizeStatus(raw: string): RobotStatus {
  return ROBOT_STATUS_ALIASES[raw.trim().toLowerCase()] ?? 'maintenance';
}

function normalizeMeshRole(raw: string): MeshRole {
  return MESH_ROLE_ALIASES[raw.trim().toLowerCase()] ?? 'leaf';
}

function normalizeScenario(raw: string): ScenarioType {
  const lowered = raw.trim().toLowerCase();
  if (['coal', 'gold', 'oil', 'pipeline', 'nuclear', 'refinery', 'underground'].includes(lowered)) return lowered as ScenarioType;
  return 'coal';
}

function normalizeAlertLevel(raw: string): AlertLevel {
  const lowered = raw.trim().toLowerCase();
  if (['danger', 'critical', 'fatal', 'high'].includes(lowered)) return 'danger';
  if (['warning', 'warn', 'medium'].includes(lowered)) return 'warning';
  return 'info';
}

function normalizeAlertType(raw: string): AlertType {
  const lowered = raw.trim().toLowerCase();
  if (['gas_overload', 'gas', 'ch4', 'overload'].includes(lowered)) return 'gas_overload';
  if (['robot_offline', 'offline'].includes(lowered)) return 'robot_offline';
  if (['mesh_disconnect', 'mesh', 'disconnect'].includes(lowered)) return 'mesh_disconnect';
  if (['temp_anomaly', 'temperature', 'temp', 'heat'].includes(lowered)) return 'temp_anomaly';
  if (['battery_low', 'battery', 'low_battery'].includes(lowered)) return 'battery_low';
  if (['robot_error', 'error', 'fault'].includes(lowered)) return 'robot_error';
  if (['task_complete', 'complete', 'done'].includes(lowered)) return 'task_complete';
  return 'system';
}

function normalizeFractureType(raw: string): Fracture['type'] {
  const lowered = raw.trim().toLowerCase();
  if (['main', 'primary', 'trunk', 'backbone'].includes(lowered)) return 'main';
  return 'branch';
}

function normalizePOIType(raw: string): POI['type'] {
  const lowered = raw.trim().toLowerCase();
  if (['crack', 'entry', 'entrance', 'fracture_entry'].includes(lowered)) return 'crack';
  if (['gas', 'danger', 'hazard', 'leak'].includes(lowered)) return 'gas';
  if (['collapse', 'structural', 'subsidence'].includes(lowered)) return 'collapse';
  return 'sensor';
}

function normalizeSensorReading(input: Record<string, unknown>): SensorReading {
  return {
    ch4_pct: pickNumber(input, ['ch4_pct', 'ch4', 'gas', 'gas_pct'], 0),
    co_ppm: pickNumber(input, ['co_ppm', 'co'], 0),
    h2s_ppm: pickNumber(input, ['h2s_ppm', 'h2s'], 0),
    temperature_c: pickNumber(input, ['temperature_c', 'temperature_celsius', 'temp_c', 'temperature'], 0),
    stress_mpa: pickNumber(input, ['stress_mpa', 'stress'], 0),
    stress_sigma1: pickNumber(input, ['stress_sigma1', 'sigma1'], 0),
    stress_sigma2: pickNumber(input, ['stress_sigma2', 'sigma2'], 0),
    stress_sigma3: pickNumber(input, ['stress_sigma3', 'sigma3'], 0),
    permeability_md: pickNumber(input, ['permeability_md', 'permeability'], 0),
    water_pressure_mpa: pickNumber(input, ['water_pressure_mpa', 'pressure_mpa', 'fluid_pressure_mpa'], 0),
    microseismic_count: pickNumber(input, ['microseismic_count', 'microseismic'], 0),
    acoustic_emission_mv: pickNumber(input, ['acoustic_emission_mv', 'acoustic_emission', 'ae_mv'], 0),
    humidity_pct: pickNumber(input, ['humidity_pct', 'humidity'], 0),
    fracture_aperture_um: pickNumber(input, ['fracture_aperture_um', 'aperture_um', 'aperture'], 0),
    displacement_mm: pickNumber(input, ['displacement_mm', 'displacement'], 0),
    rock_strength_mpa: pickNumber(input, ['rock_strength_mpa', 'rock_strength'], 0),
    pore_pressure_mpa: pickNumber(input, ['pore_pressure_mpa', 'pore_pressure'], 0),
    porosity_pct: pickNumber(input, ['porosity_pct', 'porosity'], 0),
    fluid_ph: pickNumber(input, ['fluid_ph', 'ph'], 7),
    water_saturation_pct: pickNumber(input, ['water_saturation_pct', 'water_saturation'], 0),
  };
}

function normalizeFractureNodeRecord(input: Record<string, unknown>): FractureNode {
  const sensorsValue = input.sensors;
  const sensorsInput = sensorsValue && typeof sensorsValue === 'object' ? sensorsValue as Record<string, unknown> : input;

  return {
    id: pickString(input, ['id', 'node_id'], 'fracture-node-unknown'),
    position: pickTuple3(input, ['position', 'coords', 'xyz']) ?? [0, 0, 0],
    sensors: normalizeSensorReading(sensorsInput),
    timestamp: pickNumber(input, ['timestamp', 'created_at', 'updated_at'], Date.now()),
    robotId: pickString(input, ['robotId', 'robot_id'], '') || null,
  };
}

export function normalizeRobotRecord(input: Record<string, unknown>): Robot {
  const id = pickString(input, ['id', 'robot_id', 'robotId'], 'R-UNKNOWN');
  const battery = Math.max(0, Math.min(100, pickNumber(input, ['battery', 'batteryLevel', 'power_pct', 'battery_pct'], 0)));
  const status = normalizeStatus(pickString(input, ['status', 'state'], 'maintenance'));
  const meshRole = normalizeMeshRole(pickString(input, ['meshRole', 'mesh_role', 'role'], 'leaf'));
  const position = pickTuple3(input, ['position', 'coords', 'xyz']) ?? [0, 0, 0];

  return {
    id,
    model: 'snake',
    status,
    position,
    battery,
    meshRole,
    meshConnected: pickBoolean(input, ['meshConnected', 'mesh_connected', 'mesh_online', 'connected'], true),
    task: pickString(input, ['task', 'mission'], '待命中'),
    depth: Math.abs(pickNumber(input, ['depth', 'depth_m'], position[2])),
    signalStrength: pickNumber(input, ['signalStrength', 'signal_dbm', 'rssi'], -60),
    sensors: {
      ch4: pickNumber(input, ['ch4', 'gas', 'primary_metric'], 0),
      temperature: pickNumber(input, ['temperature', 'temp_c'], 0),
      humidity: pickNumber(input, ['humidity', 'humidity_pct'], 0),
    },
    lastUpdate: pickNumber(input, ['lastUpdate', 'timestamp'], Date.now()),
  };
}

export function normalizeSceneStatsRecord(input: Record<string, unknown>): SceneStats {
  const totalNodes = clampNonNegative(pickNumber(input, ['totalNodes', 'total_nodes', 'node_count'], 0));
  const overThreshold = Math.min(totalNodes, clampNonNegative(pickNumber(input, ['overThreshold', 'over_threshold', 'over_threshold_count'], 0)));
  const onlineSensors = Math.min(totalNodes, clampNonNegative(pickNumber(input, ['onlineSensors', 'online_sensors', 'sensor_online'], totalNodes)));

  return {
    totalNodes,
    avgGas: pickNumber(input, ['avgGas', 'avg_gas', 'avg_primary', 'avg_primary_metric'], 0),
    avgTemp: pickNumber(input, ['avgTemp', 'avg_temp', 'avg_temperature'], 0),
    avgConf: toPercent(pickNumber(input, ['avgConf', 'avg_conf', 'avg_confidence', 'confidence_pct'], 0)),
    overThreshold,
    onlineSensors,
    lastUpdate: pickNumber(input, ['lastUpdate', 'last_update', 'updated_at', 'timestamp'], Date.now()),
  };
}

export function normalizeAlertRecord(input: Record<string, unknown>): AlertEvent {
  return {
    id: pickString(input, ['id', 'alert_id', 'event_id'], 'alert-unknown'),
    level: normalizeAlertLevel(pickString(input, ['level', 'severity', 'priority'], 'info')),
    type: normalizeAlertType(pickString(input, ['type', 'event_type', 'kind'], 'system')),
    title: pickString(input, ['title', 'message', 'name'], 'Untitled Alert'),
    description: pickString(input, ['description', 'details', 'detail'], 'No detail provided'),
    robotId: pickString(input, ['robotId', 'robot_id'], '') || undefined,
    position: pickTuple3(input, ['position', 'coords', 'xyz']) ?? undefined,
    timestamp: pickNumber(input, ['timestamp', 'created_at', 'last_update'], Date.now()),
    acknowledged: pickBoolean(input, ['acknowledged', 'ack', 'acked'], false),
  };
}

export function normalizeRobotFleetStatsRecord(input: Record<string, unknown>): RobotFleetStats {
  const online = clampNonNegative(pickNumber(input, ['online', 'online_count', 'robots_online'], 0));
  const offline = clampNonNegative(pickNumber(input, ['offline', 'offline_count', 'robots_offline'], 0));
  const lowBattery = clampNonNegative(pickNumber(input, ['lowBattery', 'low_battery', 'low_battery_count'], 0));
  const error = clampNonNegative(pickNumber(input, ['error', 'error_count', 'fault_count'], 0));
  const maintenance = clampNonNegative(pickNumber(input, ['maintenance', 'maintenance_count'], 0));
  const statusTotal = online + offline + lowBattery + error + maintenance;
  const total = Math.max(clampNonNegative(pickNumber(input, ['total', 'total_count', 'robot_total'], statusTotal)), statusTotal);

  return {
    total,
    online,
    offline,
    lowBattery,
    error,
    maintenance,
    meshConnected: Math.min(total, clampNonNegative(pickNumber(input, ['meshConnected', 'mesh_connected', 'mesh_online'], 0))),
    avgBattery: Math.max(0, Math.min(100, pickNumber(input, ['avgBattery', 'avg_battery', 'avg_battery_pct'], 0))),
  };
}

export function normalizeSceneNodeRecord(input: Record<string, unknown>): SceneNode {
  const centerTuple = pickTuple3(input, ['center', 'position', 'coords']);
  const centerRecord = pickVec3Record(input, ['center']);
  const center = centerRecord ?? (centerTuple ? { x: centerTuple[0], y: centerTuple[1], z: centerTuple[2] } : { x: 0, y: 0, z: 0 });
  const geometryValue = input.geometry;
  const geometryInput = geometryValue && typeof geometryValue === 'object' ? geometryValue as Record<string, unknown> : {};
  const geometry: Geometry = {
    center: pickVec3Record(geometryInput, ['center']) ?? center,
    mesh_vertices: coerceMeshVertices(geometryInput.mesh_vertices ?? input.mesh_vertices),
    raw_points: coerceRawPoints(geometryInput.raw_points ?? input.raw_points),
  };
  const sensorsValue = input.sensors;
  const sensorsInput = sensorsValue && typeof sensorsValue === 'object' ? sensorsValue as Record<string, unknown> : input;

  return {
    node_id: pickString(input, ['node_id', 'id'], 'node-unknown'),
    timestamp: pickNumber(input, ['timestamp', 'created_at', 'updated_at'], Date.now()),
    confidence_score: clamp01(pickNumber(input, ['confidence_score', 'confidence'], 0)),
    geometry,
    sensors: {
      ch4_concentration_pct: pickNumber(sensorsInput, ['ch4_concentration_pct', 'gas', 'ch4'], 0),
      temperature_celsius: pickNumber(sensorsInput, ['temperature_celsius', 'temp_c', 'temperature'], 0),
      pressure_kpa: pickNumber(sensorsInput, ['pressure_kpa'], pickNumber(sensorsInput, ['pressure_mpa', 'water_pressure_mpa'], 0) * 1000),
    },
  };
}

export function normalizeFlatGeometryRecord(input: Record<string, unknown>): FlatGeometryData {
  const positions = pickNumberArray(input, ['positions']) ?? [];
  const confidences = pickNumberArray(input, ['confidences']) ?? [];
  const gasValues = pickNumberArray(input, ['gasValues', 'gas_values']) ?? [];
  const tempValues = pickNumberArray(input, ['tempValues', 'temp_values']) ?? [];
  const intensities = pickNumberArray(input, ['intensities', 'intensity_values']) ?? [];

  return {
    positions: new Float32Array(positions),
    confidences: new Float32Array(confidences),
    gasValues: new Float32Array(gasValues),
    tempValues: new Float32Array(tempValues),
    intensities: new Float32Array(intensities),
    count: pickNumber(input, ['count', 'total'], positions.length / 3),
  };
}

export function normalizeFractureRecord(input: Record<string, unknown>): Fracture {
  const scenario = normalizeScenario(pickString(input, ['scenario', 'dataSource', 'data_source'], 'coal'));
  const sensorValue = input.sensorReading ?? input.sensor_reading;
  const sensorInput = sensorValue && typeof sensorValue === 'object' ? sensorValue as Record<string, unknown> : input;
  const nodesValue = input.nodes;
  const nodes = Array.isArray(nodesValue)
    ? nodesValue.flatMap((node) => (node && typeof node === 'object' ? [normalizeFractureNodeRecord(node as Record<string, unknown>)] : []))
    : [];

  return {
    id: pickString(input, ['id', 'fracture_id'], 'fracture-unknown'),
    name: pickString(input, ['name', 'title', 'label'], 'Unnamed Fracture'),
    type: normalizeFractureType(pickString(input, ['type', 'fracture_type'], 'branch')),
    path: pickPathTuples(input, ['path', 'route', 'polyline']) ?? [],
    length: pickNumber(input, ['length', 'fracture_length'], 0),
    aperture_um: pickNumber(input, ['aperture_um', 'aperture'], 0),
    porosity: pickNumber(input, ['porosity', 'porosity_pct'], 0),
    fractal_dim: pickNumber(input, ['fractal_dim', 'fractal_dimension'], 0),
    tortuosity: pickNumber(input, ['tortuosity', 'tortuosity_index'], 0),
    dip_angle: pickNumber(input, ['dip_angle', 'dip'], 0),
    azimuth_angle: pickNumber(input, ['azimuth_angle', 'azimuth'], 0),
    roughness_coeff: pickNumber(input, ['roughness_coeff', 'roughness'], 0),
    connectivity: pickNumber(input, ['connectivity', 'connectivity_score'], 0),
    sensorReading: sanitizeSensorReading(normalizeSensorReading(sensorInput), scenario),
    nodes: nodes.map((node) => ({
      ...node,
      sensors: sanitizeSensorReading(node.sensors, scenario),
    })),
    parentFractureId: pickString(input, ['parentFractureId', 'parent_fracture_id'], '') || null,
  };
}

export function normalizePOIRecord(input: Record<string, unknown>): POI {
  const sensorsValue = input.sensors;
  const sensorsInput = sensorsValue && typeof sensorsValue === 'object' ? sensorsValue as Record<string, unknown> : input;

  return {
    id: pickString(input, ['id', 'poi_id'], 'poi-unknown'),
    position: pickTuple3(input, ['position', 'coords', 'xyz']) ?? [0, 0, 0],
    label: pickString(input, ['label', 'name', 'title'], 'Unnamed POI'),
    type: normalizePOIType(pickString(input, ['type', 'poi_type', 'category'], 'sensor')),
    description: pickString(input, ['description', 'details', 'detail'], 'No detail provided'),
    sensors: {
      ch4_concentration_pct: pickNumber(sensorsInput, ['ch4_concentration_pct', 'ch4_pct', 'gas', 'ch4'], 0),
      temperature_celsius: pickNumber(sensorsInput, ['temperature_celsius', 'temperature_c', 'temp_c', 'temperature'], 0),
      pressure_kpa: pickNumber(sensorsInput, ['pressure_kpa'], pickNumber(sensorsInput, ['pressure_mpa', 'water_pressure_mpa'], 0) * 1000),
    },
  };
}
