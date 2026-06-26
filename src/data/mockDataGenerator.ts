import type { SceneNode, Vec3, RawPoint } from '../types';

// Seeded random for reproducible data
let seed = 42;
function seededRandom(): number {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

function rand(min: number, max: number): number {
  return min + seededRandom() * (max - min);
}

// Tunnel path generator - creates a winding underground tunnel
function tunnelPath(t: number): Vec3 {
  // Main tunnel: curved along Z with variation
  const z = t * 200 - 100; // -100 to 100
  const x = Math.sin(t * Math.PI * 1.5) * 15 + Math.cos(t * Math.PI * 0.8) * 5;
  const y = Math.sin(t * Math.PI * 0.7) * 3 + rand(-0.5, 0.5);
  return { x, y, z };
}

// Gas hotspot centers (high CH4 zones)
const gasHotspots = [
  { center: { x: 8, y: -2, z: -40 }, radius: 12, intensity: 3.2 },
  { center: { x: -5, y: 1, z: 20 }, radius: 10, intensity: 2.8 },
  { center: { x: 12, y: -3, z: 60 }, radius: 15, intensity: 4.0 },
];

// Temperature anomaly zones
const tempHotspots = [
  { center: { x: 10, y: -1, z: -30 }, radius: 14, baseTemp: 45 },
  { center: { x: -8, y: 2, z: 50 }, radius: 12, baseTemp: 38 },
];

function getGasConcentration(pos: Vec3): number {
  let maxGas = 0.3;
  for (const h of gasHotspots) {
    const dx = pos.x - h.center.x;
    const dy = pos.y - h.center.y;
    const dz = pos.z - h.center.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < h.radius) {
      const factor = 1 - dist / h.radius;
      maxGas = Math.max(maxGas, h.intensity * factor + rand(-0.2, 0.2));
    }
  }
  return Math.max(0.1, Math.min(5.0, maxGas));
}

function getTemperature(pos: Vec3): number {
  let temp = 22 + rand(-2, 2);
  for (const h of tempHotspots) {
    const dx = pos.x - h.center.x;
    const dy = pos.y - h.center.y;
    const dz = pos.z - h.center.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < h.radius) {
      const factor = 1 - dist / h.radius;
      temp = Math.max(temp, h.baseTemp * factor + 22 * (1 - factor));
    }
  }
  // Slight temperature increase with depth
  temp += Math.abs(pos.z) * 0.05;
  return Math.round(temp * 10) / 10;
}

function getPressure(pos: Vec3): number {
  // Pressure increases with depth
  return Math.round((100 + Math.abs(pos.z) * 0.15 + rand(-3, 3)) * 10) / 10;
}

function getConfidence(pos: Vec3): number {
  // Core tunnel areas have high confidence, edges/fractures have low
  const distFromCenter = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
  let conf = 0.9 - distFromCenter * 0.02;
  // Some zones have lower confidence (AI uncertain areas)
  if (pos.z > 30 && pos.z < 50 && pos.x > 5) {
    conf -= 0.3;
  }
  if (pos.z < -60) {
    conf -= 0.2;
  }
  return Math.max(0.15, Math.min(0.98, conf + rand(-0.08, 0.08)));
}

function generateNode(index: number): SceneNode {
  const t = index / TOTAL_NODES;
  const basePos = tunnelPath(t);

  // Add radial spread around tunnel center for cross-section
  const angle = rand(0, Math.PI * 2);
  const radius = rand(0, 4);
  const offsetX = Math.cos(angle) * radius;
  const offsetY = Math.sin(angle) * radius * 0.8;

  const center: Vec3 = {
    x: basePos.x + offsetX,
    y: basePos.y + offsetY,
    z: basePos.z + rand(-0.5, 0.5),
  };

  // Generate mesh vertices around center (small cluster)
  const meshVertices: Vec3[] = [];
  for (let i = 0; i < 6; i++) {
    meshVertices.push({
      x: center.x + rand(-0.3, 0.3),
      y: center.y + rand(-0.3, 0.3),
      z: center.z + rand(-0.3, 0.3),
    });
  }

  // Generate raw sensor points (more sparse, noisy)
  const rawPoints: RawPoint[] = [];
  for (let i = 0; i < 4; i++) {
    rawPoints.push({
      x: center.x + rand(-0.15, 0.15),
      y: center.y + rand(-0.15, 0.15),
      z: center.z + rand(-0.15, 0.15),
      intensity: rand(0.3, 1.0),
    });
  }

  return {
    node_id: `V-${String(5832 + index).padStart(4, '0')}`,
    timestamp: Date.now() - rand(0, 3600000),
    confidence_score: getConfidence(center),
    geometry: {
      center,
      mesh_vertices: meshVertices,
      raw_points: rawPoints,
    },
    sensors: {
      ch4_concentration_pct: Math.round(getGasConcentration(center) * 100) / 100,
      temperature_celsius: getTemperature(center),
      pressure_kpa: getPressure(center),
    },
  };
}

const TOTAL_NODES = 12000;

let cachedNodes: SceneNode[] | null = null;

export function generateMockNodes(): SceneNode[] {
  if (cachedNodes) return cachedNodes;

  seed = 42; // Reset seed for reproducibility
  cachedNodes = [];
  for (let i = 0; i < TOTAL_NODES; i++) {
    cachedNodes.push(generateNode(i));
  }
  return cachedNodes;
}

// Pre-compute flat arrays for Three.js BufferGeometry
export interface FlatGeometryData {
  positions: Float32Array;
  confidences: Float32Array;
  gasValues: Float32Array;
  tempValues: Float32Array;
  intensities: Float32Array;
  count: number;
}

let cachedFlatData: FlatGeometryData | null = null;

export function getFlatGeometryData(): FlatGeometryData {
  if (cachedFlatData) return cachedFlatData;

  const nodes = generateMockNodes();
  // Flatten all raw_points from all nodes into one big point cloud
  const allPoints: { pos: Vec3; conf: number; gas: number; temp: number; intensity: number }[] = [];

  for (const node of nodes) {
    for (const rp of node.geometry.raw_points) {
      allPoints.push({
        pos: { x: rp.x, y: rp.y, z: rp.z },
        conf: node.confidence_score,
        gas: node.sensors.ch4_concentration_pct,
        temp: node.sensors.temperature_celsius,
        intensity: rp.intensity,
      });
    }
    // Also add center as a point
    allPoints.push({
      pos: node.geometry.center,
      conf: node.confidence_score,
      gas: node.sensors.ch4_concentration_pct,
      temp: node.sensors.temperature_celsius,
      intensity: 0.7,
    });
  }

  const count = allPoints.length;
  const positions = new Float32Array(count * 3);
  const confidences = new Float32Array(count);
  const gasValues = new Float32Array(count);
  const tempValues = new Float32Array(count);
  const intensities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const p = allPoints[i];
    positions[i * 3] = p.pos.x;
    positions[i * 3 + 1] = p.pos.y;
    positions[i * 3 + 2] = p.pos.z;
    confidences[i] = p.conf;
    gasValues[i] = p.gas;
    tempValues[i] = p.temp;
    intensities[i] = p.intensity;
  }

  cachedFlatData = { positions, confidences, gasValues, tempValues, intensities, count };
  return cachedFlatData;
}

export function getStats() {
  const nodes = generateMockNodes();
  const avgGas = nodes.reduce((s, n) => s + n.sensors.ch4_concentration_pct, 0) / nodes.length;
  const avgTemp = nodes.reduce((s, n) => s + n.sensors.temperature_celsius, 0) / nodes.length;
  const avgConf = nodes.reduce((s, n) => s + n.confidence_score, 0) / nodes.length;
  const overThreshold = nodes.filter(n => n.sensors.ch4_concentration_pct > 1.5).length;
  return {
    totalNodes: nodes.length,
    avgGas: Math.round(avgGas * 100) / 100,
    avgTemp: Math.round(avgTemp * 10) / 10,
    avgConf: Math.round(avgConf * 100),
    overThreshold,
  };
}
