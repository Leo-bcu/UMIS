/**
 * 地下暗流数据生成器
 *
 * 模拟地质勘探中的地下岩溶暗河/渗流通道网络：
 * - 岩溶暗河系统 (Karst conduit network) — 地下水在石灰岩中溶蚀形成的通道
 * - 深层渗流通道 (Deep seepage channel) — 承压含水层中的水流通道
 *
 * 物理特征（基于真实地质研究）：
 * - 通道管径沿路径大幅变化：狭窄瓶颈(0.3-0.8m) ↔ 开阔溶洞(3-8m)
 * - 蛇形机器人穿越狭窄段，履带/蛛形机器人在开阔段作业
 * - 网络拓扑：主干暗河 + 支流 + 合流 + 盲端溶洞
 * - 流体类型：地下水、卤水、 mineral water
 * - 地温梯度：~25°C/km，深处温度可达80-120°C
 * - 渗透率：岩溶通道1-10000 mD（远高于孔隙基质）
 *
 * 注：石油储存在岩石微孔隙中（非通道），深度1500-7500m，不适合机器人通道探索。
 *     本场景聚焦地下水流通道（深度10-800m），这是机器人可以实际穿行的地质空间。
 *
 * 参考文献：
 * - KarstConduitCatalogue (ESSD 2025) — LiDAR 欧洲岩溶通道数据集
 * - Worthington (2015) — 深部岩溶管道流体动力学, Groundwater
 * - 广西地下暗河数字化分布图 (2025)
 */

import type { Fracture, SensorReading } from '../types';
import { seedScenarioAnomalies } from './anomalySeeding';

let _seed = 5555;
function srnd(): number { _seed = (_seed * 16807) % 2147483647; return _seed / 2147483647; }
function rand(min: number, max: number): number { return min + srnd() * (max - min); }
function randInt(min: number, max: number): number { return Math.floor(rand(min, max + 1)); }
function r1(v: number): number { return Math.round(v * 10) / 10; }

// ==================== 通道物理参数 ====================

/**
 * 通道类型 — 管径沿路径变化
 * porosity 字段存储管径(m)，用于 TubeGeometry 渲染
 */
type ChannelType = 'trunk' | 'tributary' | 'constriction' | 'chamber' | 'blind_end';

const CHANNEL_SPECS: Record<ChannelType, {
  diameter_m: [number, number];    // 管径范围(m) — 直接映射到 porosity
  flow_velocity_ms: [number, number]; // 流速(m/s) — Darcy-Weisbach
  reynolds: [number, number];      // 雷诺数
  temperature_c: [number, number]; // 温度(°C) — 地温梯度
  fluid_type: string[];            // 流体类型
}> = {
  // 主干暗河 — 最宽最深，大量流体通过
  trunk: {
    diameter_m: [0.35, 0.55],
    flow_velocity_ms: [0.3, 2.0],
    reynolds: [50000, 500000],
    temperature_c: [35, 85],
    fluid_type: ['地下水', '承压水', '岩溶水', '矿化水'],
  },
  // 支流通道 — 中等管径，从主干分出
  tributary: {
    diameter_m: [0.12, 0.25],
    flow_velocity_ms: [0.1, 0.8],
    reynolds: [8000, 80000],
    temperature_c: [30, 70],
    fluid_type: ['地下水', '岩溶水', '渗流水'],
  },
  // 狭窄瓶颈 — 只有蛇形机器人能通过
  constriction: {
    diameter_m: [0.04, 0.08],
    flow_velocity_ms: [0.5, 3.5],   // 文丘里效应：狭窄处流速激增
    reynolds: [10000, 100000],
    temperature_c: [40, 95],
    fluid_type: ['地下水', '承压水'],
  },
  // 开阔溶洞 — 履带/蛛形机器人作业区
  chamber: {
    diameter_m: [0.5, 0.8],
    flow_velocity_ms: [0.01, 0.3],  // 溶洞内流速骤降
    reynolds: [40000, 300000],
    temperature_c: [45, 110],
    fluid_type: ['地下水', '岩溶水', '矿化水', '卤水'],
  },
  // 盲端溶洞 — 流体停滞，沉积物堆积
  blind_end: {
    diameter_m: [0.18, 0.35],
    flow_velocity_ms: [0.0, 0.1],
    reynolds: [0, 5000],
    temperature_c: [50, 120],
    fluid_type: ['滞留卤水', '矿化水', '沉积盐水'],
  },
};

/** 生成通道传感器数据 */
function genUndergroundSensorReading(ct: ChannelType): SensorReading {
  const s = CHANNEL_SPECS[ct];
  const dia = +rand(...s.diameter_m).toFixed(2);
  const vel = +rand(...s.flow_velocity_ms).toFixed(3);
  const temp = +rand(...s.temperature_c).toFixed(1);

  // 等效渗透率 — 岩溶暗河/承压含水层通道显著高于普通岩石裂隙
  // 与通道直径呈强相关：开阔溶洞、主干暗河可进入 5000mD 以上高渗透预警区。
  const permScaleByType: Record<ChannelType, [number, number]> = {
    trunk: [12000, 26000],
    tributary: [8000, 18000],
    constriction: [20000, 60000],
    chamber: [14000, 32000],
    blind_end: [3000, 9000],
  };
  const perm = +(dia * dia * rand(...permScaleByType[ct])).toFixed(2);
  // 水压 — 深度梯度 ~10MPa/km + 动压
  const depth_m = rand(200, 800);
  const waterP = +(depth_m * 0.01 + 0.5 * vel * vel).toFixed(2);
  // 孔隙压力
  const poreP = +(depth_m * 0.0098 + rand(-1, 3)).toFixed(2);
  // 含水饱和度 — 地下水场景接近饱和
  const oilSat = +rand(0, 5).toFixed(1);
  const waterSat = +(95 - oilSat + rand(-2, 2)).toFixed(1);
  // pH
  const ph = +rand(5.0, 8.5).toFixed(1);
  // 矿化度 (TDS)
  // 微地震 — 构造活动区偏高
  const micro = ct === 'constriction' ? randInt(5, 30) : randInt(0, 8);
  // 声发射
  const ae = ct === 'constriction' ? randInt(500, 6000) : randInt(0, 500);
  // 应力
  const stress = +(depth_m * 0.025 + rand(-2, 5)).toFixed(2);
  // 开度(µm) = 管径 × 1000
  const aperture = Math.round(dia * 1000);
  // 粗糙度
  // CH₄ — 地下水微量甲烷（地下有机物厌氧分解）
  const ch4 = +rand(0, 0.3).toFixed(2);
  // H₂S — 地下水微量（硫酸盐还原菌活动）
  const h2s = +rand(0, 15).toFixed(0);
  // CO₂
  const co2 = +rand(0, 150).toFixed(0);
  // 位移
  const disp = +rand(0, 3.5).toFixed(2);
  // 岩石强度
  const rockStr = +rand(15, 85).toFixed(1);

  return {
    ch4_pct: ch4,
    co_ppm: co2,  // 复用 co_ppm 字段存 CO₂
    h2s_ppm: h2s,
    temperature_c: temp,
    stress_mpa: stress,
    stress_sigma1: +(stress + rand(2, 8)).toFixed(2),
    stress_sigma2: +(stress * 0.6 + rand(-1, 2)).toFixed(2),
    stress_sigma3: +(stress * 0.4 + rand(-1, 1)).toFixed(2),
    permeability_md: perm,
    water_pressure_mpa: waterP,
    microseismic_count: micro,
    acoustic_emission_mv: ae,
    humidity_pct: +rand(75, 100).toFixed(1),  // 地下接近饱和
    fracture_aperture_um: aperture,
    displacement_mm: disp,
    rock_strength_mpa: rockStr,
    pore_pressure_mpa: poreP,
    porosity_pct: dia,  // 复用 porosity 存管径(m) — TubeGeometry 半径
    fluid_ph: ph,
    water_saturation_pct: waterSat,
  };
}

// ==================== 路径生成器 ====================

type Pt3 = [number, number, number];

/** 生成蜿蜒地下通道路径 — 模拟流体沿水力梯度流动 */
function conduitPath(
  start: Pt3,
  end: Pt3,
  segments: number,
  roughness: number,
  sinuosity: number = 1.3
): Pt3[] {
  const points: Pt3[] = [[...start]];
  const [sx, sy, sz] = start;
  const [ex, ey, ez] = end;
  // 总方向
  const dx = ex - sx, dy = ey - sy, dz = ez - sz;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const ux = dx / dist;
  const uz = dz / dist;
  // 垂直方向（用于蜿蜒摆动）
  const perpX = -uz, perpZ = ux;
  const perpMag = Math.sqrt(perpX * perpX + perpZ * perpZ) || 1;

  let [cx, cy, cz] = [sx, sy, sz];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    // 线性插值基线
    const bx = sx + dx * t, by = sy + dy * t, bz = sz + dz * t;
    // 蜿蜒偏移 — sin 波 + 噪声
    const phase = t * Math.PI * sinuosity * 2;
    const sway = Math.sin(phase) * dist * 0.15 * sinuosity;
    const sway2 = Math.sin(phase * 0.7 + 1.3) * dist * 0.1 * sinuosity;
    // 噪声扰动
    const noiseX = rand(-roughness, roughness) * dist / segments;
    const noiseY = rand(-roughness * 0.4, roughness * 0.4) * dist / segments;
    const noiseZ = rand(-roughness, roughness) * dist / segments;

    cx = bx + sway * perpX / perpMag + noiseX;
    cy = by + sway2 * 0.5 + noiseY;
    cz = bz + sway * perpZ / perpMag + noiseZ;

    points.push([r1(cx), r1(cy), r1(cz)]);
  }
  // 确保最后一个点精确等于 end
  points[points.length - 1] = [r1(ex), r1(ey), r1(ez)];
  return points;
}

/** 从某点向下/侧方延伸的自由路径 — 用于支流和盲端 */
function branchPath(
  origin: Pt3,
  direction: Pt3,
  length: number,
  segments: number,
  roughness: number
): Pt3[] {
  const points: Pt3[] = [[...origin]];
  let [cx, cy, cz] = origin;
  let [dx, dy, dz] = direction;
  const mag = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= mag; dy /= mag; dz /= mag;

  const step = length / segments;
  for (let i = 1; i <= segments; i++) {
    dx += rand(-0.12, 0.12);
    dy += rand(-0.08, 0.04); // 总体微微向下
    dz += rand(-0.12, 0.12);
    const m = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    dx /= m; dy /= m; dz /= m;

    cx += dx * step + rand(-roughness, roughness) * step * 0.25;
    cy += dy * step + rand(-roughness * 0.5, roughness * 0.5) * step * 0.15;
    cz += dz * step + rand(-roughness, roughness) * step * 0.25;
    points.push([r1(cx), r1(cy), r1(cz)]);
  }
  return points;
}

// ==================== 通道构建 ====================

let channelId = 0;

const CHANNEL_NAMES = [
  'UR-1', 'UR-2', 'UR-3', 'UR-4', 'UR-5', 'UR-6',
  'UR-A1', 'UR-A2', 'UR-B1', 'UR-B2', 'UR-C1', 'UR-C2',
  'UR-D1', 'UR-D2', 'UR-E1', 'UR-E2', 'UR-F1', 'UR-F2',
  'UR-G1', 'UR-H1',
];

function buildChannel(
  path: Pt3[],
  ct: ChannelType,
  isMain: boolean,
  parentId: string | null,
  nameOverride?: string
): Fracture {
  const id = `UC-${String(channelId).padStart(3, '0')}`;
  channelId++;
  const dia = CHANNEL_SPECS[ct].diameter_m;
  const fracture: Fracture = {
    id,
    name: nameOverride || CHANNEL_NAMES[channelId % CHANNEL_NAMES.length],
    type: isMain ? 'main' : 'branch',
    path,
    length: +pathLen(path).toFixed(1),
    aperture_um: Math.round(rand(...dia) * 1000),
    porosity: +rand(...dia).toFixed(2),  // 管径(m) → TubeGeometry 半径
    fractal_dim: +(rand(2.05, 2.45)).toFixed(4),
    tortuosity: +(rand(1.1, 2.5)).toFixed(3),
    dip_angle: +rand(2, 45).toFixed(1),
    azimuth_angle: +rand(0, 360).toFixed(1),
    roughness_coeff: +rand(0.15, 0.85).toFixed(2),
    connectivity: randInt(1, 6),
    sensorReading: genUndergroundSensorReading(ct),
    nodes: [],
    parentFractureId: parentId,
  };

  // 沿路径生成测点（每隔几个点放一个传感器节点）
  const nodeCount = Math.max(3, Math.floor(path.length / 3));
  for (let i = 0; i < nodeCount; i++) {
    const pathIdx = Math.floor((i / nodeCount) * (path.length - 1));
    fracture.nodes.push({
      id: `${fracture.id}-N${i}`,
      position: path[pathIdx],
      sensors: genUndergroundSensorReading(ct),
      timestamp: Date.now() - randInt(0, 300000),
      robotId: null,
    });
  }
  return fracture;
}

function pathLen(path: Pt3[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i - 1][0];
    const dy = path[i][1] - path[i - 1][1];
    const dz = path[i][2] - path[i - 1][2];
    len += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return len;
}

// ==================== 地下暗流网络生成 ====================

let cachedChannels: Fracture[] | null = null;
let cachedPathPoints: Pt3[] = [];

export function generateUndergroundNetwork(): Fracture[] {
  if (cachedChannels) return cachedChannels;

  channelId = 0;
  const channels: Fracture[] = [];

  // === 坐标空间: x[-55,55], y[-38,-3], z[-45,45] ===
  // y 越小越深（地下），y=-3 为地表入口

  // === 主干暗河系统 — 3 条主通道，从地表入口向下蜿蜒 ===
  // 主干1: 西北入口 → 深部东南
  const trunk1Path = conduitPath(
    [-48, -3, -35],   // 地表入口 (西北)
    [25, -32, 30],    // 深部终点 (东南)
    20, 0.6, 1.4
  );
  channels.push(buildChannel(trunk1Path, 'trunk', true, null, '主干暗河-UR1'));

  // 主干2: 东北入口 → 深部西南
  const trunk2Path = conduitPath(
    [45, -3, -25],    // 地表入口 (东北)
    [-20, -30, 35],   // 深部终点 (西南)
    18, 0.7, 1.3
  );
  channels.push(buildChannel(trunk2Path, 'trunk', true, null, '主干暗河-UR2'));

  // 主干3: 中央深部 — 连接主干1和主干2
  const trunk1Mid = trunk1Path[Math.floor(trunk1Path.length * 0.5)]; // 主干1中点
  const trunk2Mid = trunk2Path[Math.floor(trunk2Path.length * 0.45)]; // 主干2中点
  const trunk3Path = conduitPath(
    [trunk1Mid[0], trunk1Mid[1], trunk1Mid[2]],
    [trunk2Mid[0], trunk2Mid[1], trunk2Mid[2]],
    14, 0.8, 1.5
  );
  channels.push(buildChannel(trunk3Path, 'trunk', true, null, '深层连通暗河-UR3'));

  // === 开阔溶洞 — 在主干路径上的关键位置扩展（起点必须精确在主干路径点上）===
  // 溶洞A: 主干1 的 60% 处 — 大型溶洞
  const caveAPos = trunk1Path[Math.floor(trunk1Path.length * 0.6)];
  const caveAPath = conduitPath(
    [caveAPos[0], caveAPos[1], caveAPos[2]],  // 起点 = 主干1路径点
    [r1(caveAPos[0] + 7), r1(caveAPos[1] - 2), r1(caveAPos[2] + 5)],
    8, 0.5, 0.8
  );
  channels.push(buildChannel(caveAPath, 'chamber', false, null, '溶洞-A（地下水汇集）'));

  // 溶洞B: 主干2 的 70% 处
  const caveBPos = trunk2Path[Math.floor(trunk2Path.length * 0.7)];
  const caveBPath = conduitPath(
    [caveBPos[0], caveBPos[1], caveBPos[2]],  // 起点 = 主干2路径点
    [r1(caveBPos[0] - 7), r1(caveBPos[1] - 3), r1(caveBPos[2] + 7)],
    8, 0.5, 0.7
  );
  channels.push(buildChannel(caveBPath, 'chamber', false, null, '溶洞-B（深层承压水腔）'));

  // 溶洞C: 主干3 中点 — 起点精确在主干3路径上
  const caveCPos = trunk3Path[Math.floor(trunk3Path.length * 0.5)];
  const caveCPath = conduitPath(
    [caveCPos[0], caveCPos[1], caveCPos[2]],  // 起点 = 主干3路径点
    [r1(caveCPos[0] + 5), r1(caveCPos[1] + 1), r1(caveCPos[2] + 5)],
    6, 0.4, 0.6
  );
  channels.push(buildChannel(caveCPath, 'chamber', false, null, '溶洞-C（暗河交汇腔）'));

  // === 狭窄瓶颈 — 连接溶洞到主干，管径骤缩 ===
  // 瓶颈A: 从溶洞A 底部继续向下收窄
  const constrAEnd = caveAPath[caveAPath.length - 1];
  const constrAPath = conduitPath(
    [constrAEnd[0], constrAEnd[1], constrAEnd[2]],
    [constrAEnd[0] + 5, constrAEnd[1] - 6, constrAEnd[2] + 3],
    6, 0.3, 0.5
  );
  channels.push(buildChannel(constrAPath, 'constriction', false, null, '狭窄通道-A1（蛇形机器人入口）'));

  // 瓶颈B: 从溶洞B 向下
  const constrBEnd = caveBPath[caveBPath.length - 1];
  const constrBPath = conduitPath(
    [constrBEnd[0], constrBEnd[1], constrBEnd[2]],
    [constrBEnd[0] - 4, constrBEnd[1] - 5, constrBEnd[2] + 4],
    6, 0.3, 0.6
  );
  channels.push(buildChannel(constrBPath, 'constriction', false, null, '狭窄通道-B1（蛇形机器人入口）'));

  // 瓶颈C: 从溶洞C 向下
  const constrCEnd = caveCPath[caveCPath.length - 1];
  const constrCPath = conduitPath(
    [constrCEnd[0], constrCEnd[1], constrCEnd[2]],
    [constrCEnd[0] + 3, constrCEnd[1] - 4, constrCEnd[2] - 5],
    5, 0.3, 0.5
  );
  channels.push(buildChannel(constrCPath, 'constriction', false, null, '狭窄通道-C1（蛇形机器人入口）'));

  // === 支流通道 — 从主干/瓶颈分出 ===
  // 支流1: 从瓶颈A 底部继续向下，变为支流
  const constrAEnd2 = constrAPath[constrAPath.length - 1];
  const trib1Path = branchPath(
    [constrAEnd2[0], constrAEnd2[1], constrAEnd2[2]],
    [0.3, -0.8, 0.5],
    rand(18, 30), 12, 0.5
  );
  channels.push(buildChannel(trib1Path, 'tributary', false, null, '支流暗河-A2'));

  // 支流2: 从瓶颈B 底部
  const constrBEnd2 = constrBPath[constrBPath.length - 1];
  const trib2Path = branchPath(
    [constrBEnd2[0], constrBEnd2[1], constrBEnd2[2]],
    [-0.4, -0.7, -0.6],
    rand(18, 28), 10, 0.5
  );
  channels.push(buildChannel(trib2Path, 'tributary', false, null, '支流暗河-B2'));

  // 支流3: 从主干1 的 30% 处分出
  const trunk1Early = trunk1Path[Math.floor(trunk1Path.length * 0.3)];
  const trib3Path = branchPath(
    [trunk1Early[0], trunk1Early[1], trunk1Early[2]],
    [-0.5, -0.6, 0.6],
    rand(15, 25), 10, 0.6
  );
  channels.push(buildChannel(trib3Path, 'tributary', false, null, '支流暗河-A3'));

  // 支流4: 从主干2 的 25% 处分出
  const trunk2Early = trunk2Path[Math.floor(trunk2Path.length * 0.25)];
  const trib4Path = branchPath(
    [trunk2Early[0], trunk2Early[1], trunk2Early[2]],
    [0.4, -0.6, 0.7],
    rand(15, 22), 9, 0.6
  );
  channels.push(buildChannel(trib4Path, 'tributary', false, null, '支流暗河-B3'));

  // 支流5: 从主干1 尾部分出
  const trunk1End = trunk1Path[trunk1Path.length - 1];
  const trib5Path = branchPath(
    [trunk1End[0], trunk1End[1], trunk1End[2]],
    [0.6, -0.5, -0.4],
    rand(12, 20), 8, 0.5
  );
  channels.push(buildChannel(trib5Path, 'tributary', false, null, '支流暗河-A4'));

  // 支流6: 从主干2 尾部分出
  const trunk2End = trunk2Path[trunk2Path.length - 1];
  const trib6Path = branchPath(
    [trunk2End[0], trunk2End[1], trunk2End[2]],
    [-0.5, -0.5, 0.5],
    rand(12, 20), 8, 0.5
  );
  channels.push(buildChannel(trib6Path, 'tributary', false, null, '支流暗河-B4'));

  // === 合流通道 — 支流汇合回到主干（闭合回路）===
  // 合流1: 支流3 尾部 → 主干2
  const trib3End = trib3Path[trib3Path.length - 1];
  const trunk2Mid2 = trunk2Path[Math.floor(trunk2Path.length * 0.55)];
  const merge1Path = conduitPath(
    [trib3End[0], trib3End[1], trib3End[2]],
    [trunk2Mid2[0], trunk2Mid2[1], trunk2Mid2[2]],
    8, 0.4, 1.0
  );
  channels.push(buildChannel(merge1Path, 'tributary', false, null, '汇流通道-A3→UR2'));

  // 合流2: 支流4 尾部 → 主干1
  const trib4End = trib4Path[trib4Path.length - 1];
  const trunk1Late = trunk1Path[Math.floor(trunk1Path.length * 0.75)];
  const merge2Path = conduitPath(
    [trib4End[0], trib4End[1], trib4End[2]],
    [trunk1Late[0], trunk1Late[1], trunk1Late[2]],
    8, 0.4, 1.0
  );
  channels.push(buildChannel(merge2Path, 'tributary', false, null, '汇流通道-B3→UR1'));

  // === 盲端溶洞 — 从支流末端延伸出的盲端 ===
  // 盲端1: 从支流1 尾部
  const trib1End = trib1Path[trib1Path.length - 1];
  const blind1Path = branchPath(
    [trib1End[0], trib1End[1], trib1End[2]],
    [-0.3, -0.6, -0.4],
    rand(8, 14), 6, 0.4
  );
  channels.push(buildChannel(blind1Path, 'blind_end', false, null, '盲端溶洞-D1（沉积物滞留）'));

  // 盲端2: 从支流2 尾部
  const trib2End = trib2Path[trib2Path.length - 1];
  const blind2Path = branchPath(
    [trib2End[0], trib2End[1], trib2End[2]],
    [0.4, -0.6, 0.3],
    rand(8, 14), 6, 0.4
  );
  channels.push(buildChannel(blind2Path, 'blind_end', false, null, '盲端溶洞-D2（矿化水滞留）'));

  // 盲端3: 从瓶颈C 尾部
  const constrCEnd2 = constrCPath[constrCPath.length - 1];
  const blind3Path = branchPath(
    [constrCEnd2[0], constrCEnd2[1], constrCEnd2[2]],
    [-0.3, -0.7, 0.3],
    rand(6, 12), 5, 0.4
  );
  channels.push(buildChannel(blind3Path, 'blind_end', false, null, '盲端溶洞-D3（深层滞水）'));

  // === 深部合流 — 支流5/6 末端汇合到主干3 ===
  const trib5End = trib5Path[trib5Path.length - 1];
  const trunk3End = trunk3Path[trunk3Path.length - 1];
  const merge3Path = conduitPath(
    [trib5End[0], trib5End[1], trib5End[2]],
    [trunk3End[0], trunk3End[1], trunk3End[2]],
    6, 0.4, 0.8
  );
  channels.push(buildChannel(merge3Path, 'tributary', false, null, '深层汇流-A4→UR3'));

  // 缓存所有路径点
  cachedPathPoints = channels.flatMap((ch) => ch.path);

  const sanitized = seedScenarioAnomalies(channels, 'underground');
  cachedChannels = sanitized;
  return sanitized;
}

/** 获取所有通道路径点（供机器人部署用） */
export function getAllUndergroundPathPoints(): Pt3[] {
  if (!cachedChannels) generateUndergroundNetwork();
  return cachedPathPoints;
}

/** 分配机器人到通道节点 */
export function assignRobotsToUndergroundNodes(): void {
  // 由 robotDataGenerator 统一处理
}
