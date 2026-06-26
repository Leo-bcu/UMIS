/**
 * 裂缝网络数据生成器
 * 基于论文真实数据参数生成 mock 数据
 *
 * 核心规则：
 * - 主裂缝从岩体表面有入口，向内部延伸
 * - 分支从主裂缝节点分叉（蛛网状连通）
 * - 机器人部署在裂缝网络中（不是随机散布）
 * - 岩体范围: x[-50,50], y[-20,20], z[-40,40]
 *
 * 参考文献：
 * - Huang et al. 2024 (Frontiers in Earth Science) — 裂缝开度38-68µm, 渗透率0.01-4mD
 * - 煤矿安全规程 — CH4安全阈值1.0%, CO安全阈值24ppm
 * - 井下实测典型温度22-45°C, 地应力5-40MPa
 */

import type { Fracture, SensorReading, ScenarioType } from '../types';
import { seedScenarioAnomalies } from './anomalySeeding';

type GeologicalScenario = 'coal' | 'gold' | 'oil';

// 随机工具
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randRange = (range: readonly [number, number]) => rand(range[0], range[1]);
const randIntRange = (range: readonly [number, number]) => randInt(range[0], range[1]);
const toGeologicalScenario = (scenario: ScenarioType): GeologicalScenario =>
  scenario === 'gold' || scenario === 'oil' ? scenario : 'coal';
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function dedupePath(points: [number, number, number][]): [number, number, number][] {
  const cleaned: [number, number, number][] = [];
  for (const point of points) {
    const prev = cleaned[cleaned.length - 1];
    if (!prev || Math.hypot(point[0] - prev[0], point[1] - prev[1], point[2] - prev[2]) >= 0.05) {
      cleaned.push(point);
    }
  }
  return cleaned;
}

// 场景传感器范围（基于论文数据）
const SCENARIO_RANGES: Record<GeologicalScenario, Record<string, readonly [number, number]>> = {
  coal: {
    ch4_pct: [0.1, 4.5],
    co_ppm: [0, 50],
    h2s_ppm: [0, 15],
    temperature_c: [22, 45],
    stress_mpa: [5, 25],
    stress_sigma1: [9, 17],
    stress_sigma2: [6, 14],
    stress_sigma3: [8, 16],
    permeability_md: [0.01, 4.0],
    water_pressure_mpa: [0.5, 8.0],
    microseismic_count: [0, 25],
    acoustic_emission_mv: [0, 5000],
    humidity_pct: [40, 95],
    fracture_aperture_um: [38, 68],
  },
  gold: {
    stress_mpa: [8, 35],
    stress_sigma1: [12, 30],
    stress_sigma2: [8, 20],
    stress_sigma3: [6, 15],
    temperature_c: [25, 50],
    displacement_mm: [0, 12],
    microseismic_count: [0, 30],
    acoustic_emission_mv: [0, 8000],
    permeability_md: [0.001, 2.0],
    rock_strength_mpa: [30, 120],
    fracture_aperture_um: [20, 55],
    humidity_pct: [35, 85],
    water_pressure_mpa: [0.2, 5.0],
    ch4_pct: [0, 0.1],
    co_ppm: [0, 2],
    h2s_ppm: [0, 1],
  },
  oil: {
    pore_pressure_mpa: [5, 35],
    permeability_md: [0.01, 100],
    porosity_pct: [2, 25],
    fracture_aperture_um: [10, 300],
    temperature_c: [30, 90],
    stress_mpa: [10, 45],
    stress_sigma1: [15, 40],
    stress_sigma2: [10, 25],
    stress_sigma3: [8, 18],
    fluid_ph: [5.5, 8.5],
    salinity_ppm: [5000, 80000],
    gas_oil_ratio: [100, 5000],
    water_saturation_pct: [10, 60],
    humidity_pct: [20, 70],
    ch4_pct: [0, 0.1],
    co_ppm: [0, 2],
    h2s_ppm: [0, 5],
    water_pressure_mpa: [2, 30],
    microseismic_count: [0, 5],
    acoustic_emission_mv: [0, 500],
    displacement_mm: [0, 2],
    rock_strength_mpa: [20, 80],
  },
};

function genSensorReading(scenario: GeologicalScenario): SensorReading {
  const ranges = SCENARIO_RANGES[scenario];
  return {
    ch4_pct: +randRange(ranges.ch4_pct || [0, 0]).toFixed(2),
    co_ppm: +randRange(ranges.co_ppm || [0, 2]).toFixed(1),
    h2s_ppm: +randRange(ranges.h2s_ppm || [0, 1]).toFixed(1),
    temperature_c: +randRange(ranges.temperature_c).toFixed(1),
    stress_mpa: +randRange(ranges.stress_mpa).toFixed(2),
    stress_sigma1: +randRange(ranges.stress_sigma1 || ranges.stress_mpa).toFixed(2),
    stress_sigma2: +randRange(ranges.stress_sigma2 || ranges.stress_mpa).toFixed(2),
    stress_sigma3: +randRange(ranges.stress_sigma3 || ranges.stress_mpa).toFixed(2),
    permeability_md: +randRange(ranges.permeability_md).toFixed(4),
    water_pressure_mpa: +randRange(ranges.water_pressure_mpa || [0, 1]).toFixed(2),
    microseismic_count: randIntRange(ranges.microseismic_count || [0, 2]),
    acoustic_emission_mv: +randRange(ranges.acoustic_emission_mv || [0, 100]).toFixed(0),
    humidity_pct: +randRange(ranges.humidity_pct).toFixed(1),
    fracture_aperture_um: +randRange(ranges.fracture_aperture_um).toFixed(1),
    displacement_mm: +randRange(ranges.displacement_mm || [0, 0.5]).toFixed(2),
    rock_strength_mpa: +randRange(ranges.rock_strength_mpa || [50, 80]).toFixed(1),
    pore_pressure_mpa: +randRange(ranges.pore_pressure_mpa || [0, 1]).toFixed(2),
    porosity_pct: +randRange(ranges.porosity_pct || [0, 5]).toFixed(1),
    fluid_ph: +randRange(ranges.fluid_ph || [7, 7.5]).toFixed(1),
    water_saturation_pct: +randRange(ranges.water_saturation_pct || [0, 10]).toFixed(1),
  };
}

// ==================== 路径生成器 ====================

/** 从岩体表面出发、朝指定方向延伸的裂缝路径 */
function generateSurfacePath(
  surfacePoint: [number, number, number],
  dirInward: [number, number, number],
  length: number,
  roughness: number
): [number, number, number][] {
  const points: [number, number, number][] = [[...surfacePoint]];
  const segments = Math.max(10, Math.floor(length / 2));
  let [x, y, z] = surfacePoint;

  const mag = Math.sqrt(dirInward[0] ** 2 + dirInward[1] ** 2 + dirInward[2] ** 2);
  let dx = dirInward[0] / mag;
  let dy = dirInward[1] / mag;
  let dz = dirInward[2] / mag;

  for (let i = 1; i <= segments; i++) {
    const step = length / segments;
    dx += rand(-0.08, 0.08);
    dy += rand(-0.04, 0.04);
    dz += rand(-0.08, 0.08);
    const m = Math.sqrt(dx * dx + dy * dy + dz * dz);
    dx /= m; dy /= m; dz /= m;

    x += dx * step + rand(-roughness, roughness) * step * 0.2;
    y += dy * step + rand(-roughness, roughness) * step * 0.1;
    z += dz * step + rand(-roughness, roughness) * step * 0.2;
    // 钳制：默认地质场景保持在 topologyAudit 认可的岩体边界内。
    x = clamp(x, -57, 57);
    y = clamp(y, -19, 18);
    z = clamp(z, -48, 48);
    points.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)]);
  }
  return dedupePath(points);
}

/** 从某个内部点出发的自由延伸路径（分支用） */
function generateBranchPath(
  origin: [number, number, number],
  length: number,
  roughness: number
): [number, number, number][] {
  const points: [number, number, number][] = [[...origin]];
  const segments = Math.max(6, Math.floor(length / 2));
  let [x, y, z] = origin;

  // 分支方向总体向下偏（避免裂缝浮到地表之上）
  const dirX = rand(-1, 1);
  const dirY = rand(-0.8, -0.1); // 始终向下
  const dirZ = rand(-1, 1);
  const mag = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

  for (let i = 1; i <= segments; i++) {
    const step = length / segments;
    x += (dirX / mag) * step + rand(-roughness, roughness) * step * 0.3;
    y += (dirY / mag) * step + rand(-roughness, roughness) * step * 0.15;
    z += (dirZ / mag) * step + rand(-roughness, roughness) * step * 0.3;
    // 钳制：默认地质场景保持在 topologyAudit 认可的岩体边界内。
    x = clamp(x, -57, 57);
    y = clamp(y, -19, 17);
    z = clamp(z, -48, 48);
    points.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)]);
  }
  return dedupePath(points);
}

// ==================== 裂缝构建 ====================

const FRACTURE_NAMES = [
  'F-1', 'F-2', 'F-3', 'F-4', 'F-5', 'F-6', 'F-7', 'F-8', 'F-9', 'F-10',
  'F-11', 'F-12', 'F-A1', 'F-A2', 'F-B1', 'F-B2', 'F-C1', 'F-C2',
];

/** 从已有路径构建裂缝实体 */
function buildFracture(
  id: number,
  path: [number, number, number][],
  scenario: GeologicalScenario,
  isMain: boolean,
  parentId: string | null
): Fracture {
  const ranges = SCENARIO_RANGES[scenario];
  const fracture: Fracture = {
    id: `F-${String(id).padStart(3, '0')}`,
    name: FRACTURE_NAMES[id % FRACTURE_NAMES.length],
    type: isMain ? 'main' : 'branch',
    path,
    length: +pathLength(path).toFixed(1),
    aperture_um: +randRange(ranges.fracture_aperture_um).toFixed(1),
    porosity: +(rand(0.005, 0.035)).toFixed(4),
    fractal_dim: +(rand(2.03, 2.35)).toFixed(4),
    tortuosity: +(rand(1.05, 1.25)).toFixed(4),
    dip_angle: +rand(2, 38).toFixed(1),
    azimuth_angle: +rand(0, 360).toFixed(1),
    roughness_coeff: +rand(0.1, 0.6).toFixed(2),
    connectivity: randInt(1, 6),
    sensorReading: genSensorReading(scenario),
    nodes: [],
    parentFractureId: parentId,
  };

  // 在路径上生成测点（每隔几个路径点放一个传感器节点）
  const nodeCount = Math.max(3, Math.floor(path.length / 3));
  for (let i = 0; i < nodeCount; i++) {
    const pathIdx = Math.floor((i / nodeCount) * (path.length - 1));
    fracture.nodes.push({
      id: `${fracture.id}-N${i}`,
      position: path[pathIdx],
      sensors: genSensorReading(scenario),
      timestamp: Date.now() - randInt(0, 300000),
      robotId: null, // 稍后统一分配
    });
  }

  return fracture;
}

/** 计算路径总长度 */
function pathLength(path: [number, number, number][]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i - 1][0];
    const dy = path[i][1] - path[i - 1][1];
    const dz = path[i][2] - path[i - 1][2];
    len += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return len;
}

// ==================== 裂缝网络 + 机器人统一生成 ====================

/** 缓存（按场景分别缓存，切换场景时重新生成） */
const cache: Partial<Record<ScenarioType, Fracture[]>> = {};
let cachedNodePositions: [number, number, number][] = [];

// ==================== 煤矿专用：矿坑腔体 + 巷道 + 内部裂隙 ====================

interface CoalMineObjectSpec {
  name: string;
  morphology: 'cavity' | 'tunnel' | 'fracture';
  type: 'main' | 'branch';
  path: [number, number, number][];
  size: number;
  parentId: string | null;
  hazard: 'fresh' | 'gas' | 'water' | 'seal' | 'roof';
  connectivity?: number;
}

const COAL_RELEASE_POINT: [number, number, number] = [-48, 10, -28];
let coalDeploymentPathPoints: [number, number, number][] = [];

function interpolatePath(path: [number, number, number][], step = 1.4): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dist = Math.max(0.01, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    const count = Math.max(1, Math.ceil(dist / step));
    for (let j = 0; j < count; j++) {
      const t = j / count;
      points.push([
        +(a[0] + (b[0] - a[0]) * t).toFixed(2),
        +(a[1] + (b[1] - a[1]) * t).toFixed(2),
        +(a[2] + (b[2] - a[2]) * t).toFixed(2),
      ]);
    }
  }
  points.push(path[path.length - 1]);
  return dedupePath(points);
}

function offsetPath(
  path: [number, number, number][],
  dx: number,
  dy: number,
  dz: number,
): [number, number, number][] {
  return path.map((point) => [
    +(point[0] + dx).toFixed(2),
    +(point[1] + dy).toFixed(2),
    +(point[2] + dz).toFixed(2),
  ]);
}

function generateChamberOutline(
  center: [number, number, number],
  halfSpanX: number,
  halfSpanZ: number,
  floorDrop = 1.2,
): [number, number, number][] {
  const [cx, cy, cz] = center;
  const path: [number, number, number][] = [
    [cx - halfSpanX, cy - floorDrop, cz - halfSpanZ * 0.58],
    [cx - halfSpanX * 0.7, cy - floorDrop * 0.55, cz - halfSpanZ],
    [cx - halfSpanX * 0.12, cy - floorDrop * 0.2, cz - halfSpanZ * 0.88],
    [cx + halfSpanX * 0.55, cy - floorDrop * 0.35, cz - halfSpanZ * 0.72],
    [cx + halfSpanX, cy - floorDrop * 0.7, cz - halfSpanZ * 0.24],
    [cx + halfSpanX * 0.9, cy - floorDrop * 0.2, cz + halfSpanZ * 0.48],
    [cx + halfSpanX * 0.28, cy + floorDrop * 0.12, cz + halfSpanZ],
    [cx - halfSpanX * 0.48, cy, cz + halfSpanZ * 0.78],
    [cx - halfSpanX * 0.95, cy - floorDrop * 0.45, cz + halfSpanZ * 0.18],
  ].map((point) => [
    +point[0].toFixed(2),
    +point[1].toFixed(2),
    +point[2].toFixed(2),
  ]);
  path.push([...path[0]]);
  return path;
}

function coalSensorReading(hazard: CoalMineObjectSpec['hazard']): SensorReading {
  const base = genSensorReading('coal');
  if (hazard === 'gas') {
    return {
      ...base,
      ch4_pct: +rand(2.4, 4.2).toFixed(2),
      co_ppm: +rand(26, 44).toFixed(1),
      temperature_c: +rand(34, 42).toFixed(1),
      humidity_pct: +rand(72, 92).toFixed(1),
      water_pressure_mpa: +rand(1.4, 3.2).toFixed(2),
      microseismic_count: randInt(8, 18),
      permeability_md: +rand(1.6, 3.8).toFixed(4),
    };
  }
  if (hazard === 'water') {
    return {
      ...base,
      ch4_pct: +rand(0.4, 1.4).toFixed(2),
      co_ppm: +rand(4, 18).toFixed(1),
      temperature_c: +rand(24, 32).toFixed(1),
      humidity_pct: +rand(88, 98).toFixed(1),
      water_pressure_mpa: +rand(4.8, 7.6).toFixed(2),
      permeability_md: +rand(1.2, 3.4).toFixed(4),
    };
  }
  if (hazard === 'seal') {
    return {
      ...base,
      ch4_pct: +rand(1.8, 3.3).toFixed(2),
      co_ppm: +rand(18, 34).toFixed(1),
      temperature_c: +rand(31, 39).toFixed(1),
      humidity_pct: +rand(62, 84).toFixed(1),
      water_pressure_mpa: +rand(1.0, 2.6).toFixed(2),
      acoustic_emission_mv: +rand(1200, 3200).toFixed(0),
    };
  }
  if (hazard === 'roof') {
    return {
      ...base,
      ch4_pct: +rand(0.7, 1.8).toFixed(2),
      co_ppm: +rand(8, 22).toFixed(1),
      stress_mpa: +rand(16, 24).toFixed(2),
      microseismic_count: randInt(10, 24),
      acoustic_emission_mv: +rand(1800, 4600).toFixed(0),
      fracture_aperture_um: +rand(56, 68).toFixed(1),
    };
  }
  return {
    ...base,
    ch4_pct: +rand(0.18, 0.95).toFixed(2),
    co_ppm: +rand(1, 12).toFixed(1),
    temperature_c: +rand(23, 31).toFixed(1),
    humidity_pct: +rand(50, 76).toFixed(1),
    water_pressure_mpa: +rand(0.7, 2.2).toFixed(2),
    permeability_md: +rand(0.04, 1.1).toFixed(4),
  };
}

function generateCoalWorkings(): Fracture[] {
  const specs: CoalMineObjectSpec[] = [];
  coalDeploymentPathPoints = [];

  const portalDecline: [number, number, number][] = [
    COAL_RELEASE_POINT,
    [-46, 7, -27],
    [-44, 2, -25],
    [-40, -4, -22],
    [-35, -9, -18],
    [-30, -14, -14],
    [-26, -18, -12],
  ];
  const mainHaulage: [number, number, number][] = [
    [-30, -18, -12],
    [-18, -20, -10],
    [-6, -22, -8],
    [10, -24, -5],
    [24, -26, 0],
    [38, -28, 6],
    [52, -30, 12],
  ];
  const returnAirway: [number, number, number][] = [
    mainHaulage[0],
    ...offsetPath(mainHaulage.slice(1, -1), 2.2, 3.2, 16),
    mainHaulage[mainHaulage.length - 1],
  ];
  const southBranch: [number, number, number][] = [
    [-6, -22, -8],
    [-10, -25, 4],
    [-12, -30, 16],
    [-10, -34, 30],
  ];
  const northBranch: [number, number, number][] = [
    [24, -26, 0],
    [20, -30, -10],
    [18, -34, -22],
    [14, -38, -34],
  ];
  const goafDrift: [number, number, number][] = [
    [38, -28, 6],
    [34, -32, 16],
    [28, -37, 28],
    [20, -42, 38],
  ];
  const waterCourse: [number, number, number][] = [
    [20, -42, 38],
    [12, -45, 34],
    [6, -49, 30],
    [2, -52, 26],
    [0, -54, 22],
  ];
  const beltBypass: [number, number, number][] = [
    [-18, -20, -10],
    [-24, -22, 0],
    [-26, -27, 12],
    [-22, -31, 22],
    [-14, -35, 30],
  ];
  const ventilationCrosscut: [number, number, number][] = [
    [10, -24, -5],
    [8.5, -24, 8],
    [9.5, -28, 18],
    [20, -31, 24],
    [34, -33, 27],
  ];
  const blindExplorationDrift: [number, number, number][] = [
    [14, -38, -34],
    [25, -35, -25],
    [35, -38, -29],
    [45, -43, -31],
  ];
  const pumpChamberAccess: [number, number, number][] = [
    [20, -42, 38],
    [12, -44, 34],
    [6, -42, 29],
    [2, -47, 36],
  ];
  const sealBypass: [number, number, number][] = [
    [28, -35, 28],
    [36, -39, 31],
    [45, -43, 34],
    [52, -47, 38],
  ];
  const injection1: [number, number, number][] = [[20, -40, 36], [24, -35, 41], [28, -29, 45]];
  const injection2: [number, number, number][] = [[13, -33, -32], [8, -29, -39], [4, -25, -45]];
  const roofFissure1: [number, number, number][] = [[10, -18, -2], [9, -12, 1], [8, -7, 5], [7, -2, 9]];
  const roofFissure2: [number, number, number][] = [[34, -31, 19], [38, -26, 23], [42, -21, 27]];
  const roofFissure3: [number, number, number][] = [[-8, -26, 5], [-12, -20, 9], [-16, -15, 12], [-22, -9, 16]];
  const gasPocketCrack: [number, number, number][] = [[41, -39, 17], [47, -36, 18], [52, -33, 20]];
  const oldGoafBoundary: [number, number, number][] = [
    [16, -38, 27],
    [28, -43, 40],
    [43, -49, 39],
    [50, -50, 28],
    [41, -48, 17],
    [27, -42, 19],
    [16, -38, 27],
  ];

  specs.push(
    { name: '地表投放井口与斜井', morphology: 'tunnel', type: 'main', path: portalDecline, size: 0.9, parentId: null, hazard: 'fresh', connectivity: 3 },
    { name: '主运输巷-西翼至中央采区', morphology: 'tunnel', type: 'main', path: mainHaulage, size: 0.95, parentId: null, hazard: 'fresh', connectivity: 6 },
    { name: '回风巷-平行通风联络', morphology: 'tunnel', type: 'main', path: returnAirway, size: 0.76, parentId: null, hazard: 'fresh', connectivity: 5 },
    { name: '南翼联络巷-老采区入口', morphology: 'tunnel', type: 'branch', path: southBranch, size: 0.62, parentId: 'F-001', hazard: 'gas', connectivity: 3 },
    { name: '北翼探查巷-瓦斯裂隙带', morphology: 'tunnel', type: 'branch', path: northBranch, size: 0.55, parentId: 'F-001', hazard: 'gas', connectivity: 3 },
    { name: '采空区边界探查巷', morphology: 'tunnel', type: 'branch', path: goafDrift, size: 0.48, parentId: 'F-001', hazard: 'seal', connectivity: 3 },
    { name: '暗流排水巷-涌水治理线', morphology: 'tunnel', type: 'branch', path: waterCourse, size: 0.36, parentId: 'F-003', hazard: 'water', connectivity: 2 },
    { name: '胶带运输旁通巷-南翼回接', morphology: 'tunnel', type: 'branch', path: beltBypass, size: 0.44, parentId: 'F-001', hazard: 'fresh', connectivity: 3 },
    { name: '回风联络横贯-采区上盘', morphology: 'tunnel', type: 'branch', path: ventilationCrosscut, size: 0.38, parentId: 'F-002', hazard: 'roof', connectivity: 3 },
    { name: '北翼盲巷-瓦斯复测末端', morphology: 'tunnel', type: 'branch', path: blindExplorationDrift, size: 0.34, parentId: 'F-004', hazard: 'gas', connectivity: 1 },
    { name: '排水硐室支巷-泵房入口', morphology: 'tunnel', type: 'branch', path: pumpChamberAccess, size: 0.42, parentId: 'F-006', hazard: 'water', connectivity: 2 },
    { name: '封堵墙旁路-老空区外缘', morphology: 'tunnel', type: 'branch', path: sealBypass, size: 0.32, parentId: 'F-005', hazard: 'seal', connectivity: 1 },
    { name: '封堵墙注浆孔-东南老窑', morphology: 'fracture', type: 'branch', path: injection1, size: 0.16, parentId: 'F-005', hazard: 'seal', connectivity: 1 },
    { name: '封堵墙注浆孔-北翼盲端', morphology: 'fracture', type: 'branch', path: injection2, size: 0.14, parentId: 'F-004', hazard: 'seal', connectivity: 1 },
    { name: '顶板裂隙带-中央采区', morphology: 'fracture', type: 'branch', path: roofFissure1, size: 0.18, parentId: 'F-001', hazard: 'roof', connectivity: 1 },
    { name: '顶板裂隙带-采空区上覆', morphology: 'fracture', type: 'branch', path: roofFissure2, size: 0.19, parentId: 'F-005', hazard: 'roof', connectivity: 1 },
    { name: '顶板裂隙簇-南翼破碎带', morphology: 'fracture', type: 'branch', path: roofFissure3, size: 0.13, parentId: 'F-003', hazard: 'roof', connectivity: 1 },
    { name: '瓦斯富集微裂隙-老空区上缘', morphology: 'fracture', type: 'branch', path: gasPocketCrack, size: 0.12, parentId: 'F-011', hazard: 'gas', connectivity: 1 },
    { name: '老窑采空区边界-瓦斯积聚腔', morphology: 'cavity', type: 'main', path: oldGoafBoundary, size: 12.2, parentId: null, hazard: 'gas', connectivity: 4 },
    { name: '中央采区作业腔体', morphology: 'cavity', type: 'main', path: generateChamberOutline([8, -24, -5], 15.8, 6.2, 1.1), size: 8.6, parentId: null, hazard: 'fresh', connectivity: 5 },
    { name: '南翼老采空腔体', morphology: 'cavity', type: 'main', path: generateChamberOutline([-8, -34, 22], 12.8, 7.2, 1.6), size: 7.4, parentId: null, hazard: 'gas', connectivity: 3 },
    { name: '涌水点治理区-低洼积水腔', morphology: 'cavity', type: 'main', path: generateChamberOutline([18, -46, 27], 13.2, 5.2, 2.2), size: 6.3, parentId: null, hazard: 'water', connectivity: 2 },
    { name: '泵房硐室-排水设备空间', morphology: 'cavity', type: 'main', path: generateChamberOutline([2, -52, 36], 7.6, 4.4, 0.8), size: 4.4, parentId: null, hazard: 'water', connectivity: 2 },
    { name: '北翼瓦斯盲巷小采空腔', morphology: 'cavity', type: 'main', path: generateChamberOutline([45, -43, -31], 8.6, 3.8, 1.0), size: 4.8, parentId: null, hazard: 'gas', connectivity: 1 },
  );

  coalDeploymentPathPoints = [
    ...interpolatePath(portalDecline, 1.1),
    ...interpolatePath(mainHaulage, 1.1),
    ...interpolatePath(returnAirway, 1.2),
    ...interpolatePath(southBranch, 1.1),
    ...interpolatePath(northBranch, 1.1),
    ...interpolatePath(goafDrift, 1.1),
    ...interpolatePath(waterCourse, 1.0),
    ...interpolatePath(beltBypass, 1.0),
    ...interpolatePath(ventilationCrosscut, 1.0),
    ...interpolatePath(blindExplorationDrift, 1.0),
    ...interpolatePath(pumpChamberAccess, 1.0),
    ...interpolatePath(sealBypass, 1.0),
    ...interpolatePath(injection1, 1.0),
    ...interpolatePath(injection2, 1.0),
  ];

  return specs.map((spec, index) => buildCoalFracture(index, spec));
}

/** 构建煤矿专用 Fracture（带 morphology 标记） */
function buildCoalFracture(
  id: number,
  spec: CoalMineObjectSpec,
): Fracture {
  const ranges = SCENARIO_RANGES.coal;
  const sensorReading = coalSensorReading(spec.hazard);

  const fracture: Fracture = {
    id: `F-${String(id).padStart(3, '0')}`,
    name: spec.name,
    type: spec.type,
    path: spec.morphology === 'tunnel' ? interpolatePath(spec.path, 2.4) : spec.path,
    length: +pathLength(spec.path).toFixed(1),
    aperture_um: +randRange(ranges.fracture_aperture_um).toFixed(1),
    // porosity 复用为"尺寸"字段：腔体=半径, 巷道=宽度, 裂隙=宽度
    porosity: +spec.size.toFixed(2),
    fractal_dim: +(rand(2.03, 2.35)).toFixed(4),
    tortuosity: +(rand(1.05, 1.25)).toFixed(4),
    dip_angle: +rand(2, 38).toFixed(1),
    azimuth_angle: +rand(0, 360).toFixed(1),
    roughness_coeff: +rand(0.1, 0.6).toFixed(2),
    connectivity: spec.connectivity ?? randInt(1, 6),
    sensorReading,
    nodes: [],
    parentFractureId: spec.parentId,
    morphology: spec.morphology,
  };

  // 生成测点
  const nodeCount = spec.morphology === 'tunnel'
    ? Math.max(3, Math.floor(fracture.path.length / 3))
    : Math.max(3, Math.floor(fracture.path.length / 3));
  for (let i = 0; i < nodeCount; i++) {
    const pathIdx = Math.floor((i / nodeCount) * (fracture.path.length - 1));
    const sensors = coalSensorReading(spec.hazard);
    fracture.nodes.push({
      id: `${fracture.id}-N${i}`,
      position: fracture.path[pathIdx],
      sensors,
      timestamp: Date.now() - randInt(0, 300000),
      robotId: null,
    });
  }

  return fracture;
}



/** 生成完整裂缝网络（主裂缝从地表 Y≈20 向下延伸，分支从主裂缝分叉） */
export function generateFractureNetwork(scenario: ScenarioType): Fracture[] {
  if (cache[scenario]) return cache[scenario]!;
  const geologicalScenario = toGeologicalScenario(scenario);

  let fractures: Fracture[];

  // 煤矿：矿坑腔体 + 约1m巷道连通 + 矿坑内壁裂隙
  if (geologicalScenario === 'coal') {
    fractures = generateCoalWorkings();
  } else {
    fractures = generateDefaultFractureNetwork(geologicalScenario);
  }

  // === 分配机器人到裂缝节点 ===
  assignRobotsToNodes(fractures);
  fractures = seedScenarioAnomalies(fractures, scenario);

  // 收集所有节点位置供外部使用
  cachedNodePositions = fractures.flatMap((f) => f.nodes.map((n) => n.position));
  // 收集所有路径点（更密集，供机器人精确部署在裂缝线上）
  cachedPathPoints = geologicalScenario === 'coal'
    ? [...fractures.flatMap((f) => f.path), ...coalDeploymentPathPoints]
    : fractures.flatMap((f) => f.path);

  cache[scenario] = fractures;
  return fractures;
}

/** 默认裂缝网络（金矿/油气：主裂缝从地表向下延伸，分支从主裂缝分叉） */
function generateDefaultFractureNetwork(geologicalScenario: GeologicalScenario): Fracture[] {
  const fractures: Fracture[] = [];
  // 每个裂缝入口在地表的不同XZ位置，方向总体向下
  const surfaceEntries: { origin: [number, number, number]; dirInward: [number, number, number] }[] = [
    { origin: [-35, 18, -20], dirInward: [0.3, -1, 0.2] },
    { origin: [10, 19, -15], dirInward: [-0.2, -1, -0.1] },
    { origin: [-10, 20, 20], dirInward: [0.1, -1, -0.3] },
    { origin: [30, 18, 5], dirInward: [-0.3, -1, 0.1] },
    { origin: [-40, 19, 10], dirInward: [0.2, -1, -0.2] },
    { origin: [20, 20, -30], dirInward: [-0.1, -1, 0.3] },
  ];

  for (let i = 0; i < surfaceEntries.length; i++) {
    const { origin, dirInward } = surfaceEntries[i];
    const path = generateSurfacePath(origin, dirInward, rand(25, 65), rand(0.3, 1.2));
    fractures.push(buildFracture(i, path, geologicalScenario, true, null));
  }

  // === 12 条分支裂缝：从主裂缝的测点分叉 ===
  for (let i = 0; i < 12; i++) {
    const parent = pick(fractures.slice(0, 6));
    const branchOrigin = pick(parent.nodes).position;
    const path = generateBranchPath(branchOrigin as [number, number, number], rand(5, 25), rand(0.3, 1.0));
    fractures.push(buildFracture(6 + i, path, geologicalScenario, false, parent.id));
  }

  return fractures;
}

/** 获取所有裂缝节点的位置（供其他数据生成器使用） */
export function getAllNodePositions(): [number, number, number][] {
  return cachedNodePositions;
}

/** 缓存所有裂缝路径点（比节点更密集） */
let cachedPathPoints: [number, number, number][] = [];

/** 获取所有裂缝路径上的所有点（供机器人部署用，密度远高于节点） */
export function getAllPathPoints(): [number, number, number][] {
  return cachedPathPoints;
}

/** 获取煤矿机器人从井口向巷道深处推进的部署路径点 */
export function getCoalMineDeploymentPathPoints(): [number, number, number][] {
  return coalDeploymentPathPoints.length > 0 ? coalDeploymentPathPoints : cachedPathPoints;
}

/** 将机器人 ID 分配到裂缝节点上 */
function assignRobotsToNodes(fractures: Fracture[]): void {
  let robotIdx = 0;
  for (const fracture of fractures) {
    for (const node of fracture.nodes) {
      if (robotIdx < 200) {
        // 70% 的节点分配机器人
        node.robotId = Math.random() > 0.3
          ? `R-${String(++robotIdx).padStart(3, '0')}`
          : null;
      }
    }
  }
}

/**
 * 获取场景传感器范围描述（用于 AI prompt）
 */
export function getScenarioSensorSummary(scenario: ScenarioType): string {
  const ranges = SCENARIO_RANGES[toGeologicalScenario(scenario)];
  const labels: Record<string, string> = {
    ch4_pct: 'CH4浓度(%)',
    co_ppm: 'CO浓度(ppm)',
    temperature_c: '温度(°C)',
    stress_mpa: '地应力(MPa)',
    permeability_md: '渗透率(mD)',
    water_pressure_mpa: '水压(MPa)',
    microseismic_count: '微震事件(次/h)',
    fracture_aperture_um: '裂缝开度(µm)',
  };

  const lines = Object.entries(labels)
    .filter(([k]) => ranges[k])
    .map(([k, label]) => `- ${label}: ${ranges[k][0]} ~ ${ranges[k][1]}`);

  return `当前场景类型: ${scenario === 'coal' ? '煤矿' : scenario === 'gold' ? '金矿' : '油气'}\n传感器参数范围:\n${lines.join('\n')}`;
}

export { SCENARIO_RANGES };
