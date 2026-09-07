import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAlertRecord, normalizeFlatGeometryRecord, normalizeFractureRecord, normalizeRobotFleetStatsRecord, normalizeRobotRecord, normalizeSceneNodeRecord, normalizeSceneStatsRecord } from './normalizers';

test('normalizeRobotRecord accepts alternate battery and status fields', () => {
  const normalized = normalizeRobotRecord({
    id: 'R-001',
    batteryLevel: '82%',
    state: 'critical',
    mesh_role: 'relay',
    coords: { x: 1, y: 2, z: -3 },
    mesh_connected: 0,
  });

  assert.equal(normalized.battery, 82);
  assert.equal(normalized.status, 'error');
  assert.deepEqual(normalized.position, [1, 2, -3]);
  assert.equal(normalized.depth, 3);
  assert.equal(normalized.meshConnected, false);
});

test('normalizeRobotRecord falls back safely when optional fields are missing', () => {
  const normalized = normalizeRobotRecord({
    robot_id: 'R-002',
  });

  assert.equal(normalized.id, 'R-002');
  assert.equal(normalized.status, 'maintenance');
  assert.deepEqual(normalized.position, [0, 0, 0]);
});

test('normalizeSceneStatsRecord accepts alternate backend field names', () => {
  const normalized = normalizeSceneStatsRecord({
    total_nodes: 128,
    avg_primary: 2.6,
    avg_temperature: 34.5,
    avg_confidence: '0.82',
    over_threshold_count: 170,
    sensor_online: 999,
    updated_at: 1710000000000,
  });

  assert.equal(normalized.totalNodes, 128);
  assert.equal(normalized.avgGas, 2.6);
  assert.equal(normalized.avgTemp, 34.5);
  assert.equal(normalized.avgConf, 82);
  assert.equal(normalized.overThreshold, 128);
  assert.equal(normalized.onlineSensors, 128);
  assert.equal(normalized.lastUpdate, 1710000000000);
});

test('normalizeAlertRecord accepts alternate alert shapes and safe defaults', () => {
  const normalized = normalizeAlertRecord({
    alert_id: 'AL-001',
    severity: 'critical',
    event_type: 'radiation',
    message: 'Dose rate exceeded',
    details: 'Loop A above control threshold',
    robot_id: 'R-101',
    coords: [2, 4, 6],
    created_at: 1710000000000,
    ack: 1,
  });

  assert.equal(normalized.id, 'AL-001');
  assert.equal(normalized.level, 'danger');
  assert.equal(normalized.type, 'system');
  assert.equal(normalized.title, 'Dose rate exceeded');
  assert.equal(normalized.description, 'Loop A above control threshold');
  assert.equal(normalized.robotId, 'R-101');
  assert.deepEqual(normalized.position, [2, 4, 6]);
  assert.equal(normalized.timestamp, 1710000000000);
  assert.equal(normalized.acknowledged, true);
});

test('normalizeRobotFleetStatsRecord accepts camelCase and snake_case fields', () => {
  const normalized = normalizeRobotFleetStatsRecord({
    total_count: 100,
    online_count: 121,
    offline_count: 25,
    low_battery_count: 19,
    error_count: 7,
    maintenance_count: 28,
    mesh_connected: 162,
    avg_battery_pct: 63,
  });

  assert.equal(normalized.total, 200);
  assert.equal(normalized.online, 121);
  assert.equal(normalized.offline, 25);
  assert.equal(normalized.lowBattery, 19);
  assert.equal(normalized.error, 7);
  assert.equal(normalized.maintenance, 28);
  assert.equal(normalized.meshConnected, 162);
  assert.equal(normalized.avgBattery, 63);
});

test('normalizeSceneNodeRecord accepts alternate geometry and sensor field shapes', () => {
  const normalized = normalizeSceneNodeRecord({
    id: 'N-001',
    created_at: 1710000000000,
    confidence: 0.77,
    center: [1, 2, 3],
    raw_points: [{ x: 1, y: 2, z: 3, intensity: 0.5 }],
    gas: 2.4,
    temp_c: 31.6,
    pressure_mpa: 1.8,
  });

  assert.equal(normalized.node_id, 'N-001');
  assert.equal(normalized.timestamp, 1710000000000);
  assert.equal(normalized.confidence_score, 0.77);
  assert.deepEqual(normalized.geometry.center, { x: 1, y: 2, z: 3 });
  assert.equal(normalized.sensors.ch4_concentration_pct, 2.4);
  assert.equal(normalized.sensors.temperature_celsius, 31.6);
  assert.equal(normalized.sensors.pressure_kpa, 1800);
});

test('normalizeSceneNodeRecord clamps confidence_score to [0,1]', () => {
  assert.equal(normalizeSceneNodeRecord({ confidence: 1.8 }).confidence_score, 1);
  assert.equal(normalizeSceneNodeRecord({ confidence_score: -0.2 }).confidence_score, 0);
});

test('normalizeFlatGeometryRecord coerces array-like geometry payloads into typed arrays', () => {
  const normalized = normalizeFlatGeometryRecord({
    positions: [1, 2, 3, 4, 5, 6],
    confidences: [0.9, 0.8],
    gas_values: [2.1, 2.2],
    temp_values: [30.1, 31.2],
    intensity_values: [0.6, 0.5],
    total: 2,
  });

  assert.equal(normalized.count, 2);
  assert.deepEqual(Array.from(normalized.positions), [1, 2, 3, 4, 5, 6]);
  assert.ok(Math.abs(normalized.gasValues[0] - 2.1) < 1e-5);
  assert.ok(Math.abs(normalized.gasValues[1] - 2.2) < 1e-5);
  assert.ok(Math.abs(normalized.tempValues[0] - 30.1) < 1e-5);
  assert.ok(Math.abs(normalized.tempValues[1] - 31.2) < 1e-5);
  assert.ok(Math.abs(normalized.intensities[0] - 0.6) < 1e-5);
  assert.ok(Math.abs(normalized.intensities[1] - 0.5) < 1e-5);
});

test('normalizeFractureRecord accepts alternate fracture node and sensor shapes', () => {
  const normalized = normalizeFractureRecord({
    fracture_id: 'F-900',
    title: 'Backbone 900',
    fracture_type: 'primary',
    route: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
    ],
    fracture_length: 12.5,
    aperture: 180,
    porosity_pct: 3.2,
    fractal_dimension: 1.42,
    tortuosity_index: 1.8,
    dip: 35,
    azimuth: 120,
    roughness: 0.22,
    connectivity: 4,
    sensor_reading: {
      gas: 1.3,
      temp_c: 29.7,
      humidity_pct: 66,
    },
    nodes: [
      {
        id: 'F-900-N1',
        position: [1, 2, 3],
        sensors: {
          ch4_pct: 1.1,
          temperature_c: 28.4,
          water_pressure_mpa: 2.1,
        },
        created_at: 1710000000000,
        robot_id: 'R-001',
      },
    ],
    parent_fracture_id: null,
  });

  assert.equal(normalized.id, 'F-900');
  assert.equal(normalized.name, 'Backbone 900');
  assert.equal(normalized.type, 'main');
  assert.deepEqual(normalized.path, [[0, 0, 0], [1, 1, 1]]);
  assert.equal(normalized.length, 12.5);
  assert.equal(normalized.aperture_um, 180);
  assert.equal(normalized.porosity, 3.2);
  assert.equal(normalized.fractal_dim, 1.42);
  assert.equal(normalized.tortuosity, 1.8);
  assert.equal(normalized.dip_angle, 35);
  assert.equal(normalized.azimuth_angle, 120);
  assert.equal(normalized.roughness_coeff, 0.22);
  assert.equal(normalized.connectivity, 4);
  assert.equal(normalized.sensorReading.ch4_pct, 1.3);
  assert.equal(normalized.sensorReading.temperature_c, 29.7);
  assert.equal(normalized.nodes[0].id, 'F-900-N1');
  assert.deepEqual(normalized.nodes[0].position, [1, 2, 3]);
  assert.equal(normalized.nodes[0].timestamp, 1710000000000);
  assert.equal(normalized.nodes[0].robotId, 'R-001');
});

test('normalizeFractureRecord sanitizes incoming sensor readings', () => {
  const normalized = normalizeFractureRecord({
    scenario: 'coal',
    sensor_reading: { ch4_pct: 62, humidity_pct: 150, microseismic_count: 9.8 },
    nodes: [{ id: 'n1', position: [0, 0, 0], sensors: { ch4_pct: 9, water_saturation_pct: 980 } }],
  });

  assert.equal(normalized.sensorReading.ch4_pct, 5);
  assert.equal(normalized.sensorReading.humidity_pct, 100);
  assert.equal(normalized.sensorReading.microseismic_count, 10);
  assert.equal(normalized.nodes[0].sensors.ch4_pct, 5);
  assert.equal(normalized.nodes[0].sensors.water_saturation_pct, 100);
});
