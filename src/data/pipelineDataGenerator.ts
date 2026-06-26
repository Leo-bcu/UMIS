/**
 * 小口径管道内检测数据生成器
 * 基于 DN50-DN150 支线/满管小管径工程参数生成 mock 数据
 *
 * 核心规则：
 * - 每条管道必须从阀门/泵站/检测口出发
 * - 管网是连通图——所有管段都从入口可达，不存在漂浮孤立段
 * - 微型蛛型/蛇形机器人从检测口进入，沿小口径管道内部移动
 * - 数据重点是超声壁厚、腐蚀速率、H2S、泄漏、压力、堵塞/可通行性
 *
 * 参考资料（网络检索 2026-06）：
 * - 小口径场景: DN50-DN150, 支线/旁通/市政或油气支管
 * - API 5L: 钢级 X42-X80, 屈服强度 290-552 MPa
 * - Smart-Spider (DHRTC): 自驱适应管径, 无缆自主, 压力反馈调控
 * - NACE MR0175: H₂S 酸性服务阈值 50 ppm
 * - SCADA: 每 5s 评估压力/流量, 泄漏检测阈值 <8% 最大流量
 * - 腐蚀速率: 阴极保护 0.01-0.3 mm/yr, 无保护 0.5-1.0 mm/yr
 */

import type { Fracture, SensorReading } from '../types';
import { seedScenarioAnomalies } from './anomalySeeding';

// 固定种子随机
let _seed = 42;
function sr(): number {
  _seed = (_seed * 16807) % 2147483647;
  return _seed / 2147483647;
}
function rand(min: number, max: number): number {
  return min + sr() * (max - min);
}
function randRange(range: readonly [number, number]): number {
  return rand(range[0], range[1]);
}
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}
// ==================== 真实管道参数 ====================

/** 管道等级规格 — DN50-DN150 小口径内检 */
const PIPE_SPECS = {
  trunk: {
    // DN150 主支线
    diameter_mm: [125, 150],
    wall_thickness_mm: [4.0, 7.1],
    steel_grade: ['X42', 'X52', '20#'],
    yield_strength_mpa: [245, 359],
    design_pressure_mpa: [2, 8],
    operating_pressure_mpa: [1.2, 6],
    flow_rate_m3h: [50, 1200],
    temperature_c: [5, 48],
    corrosion_rate_mmyear: [0.03, 0.35],
  },
  distribution: {
    // DN80-DN100 支线
    diameter_mm: [80, 100],
    wall_thickness_mm: [3.2, 6.0],
    steel_grade: ['X42', '20#', 'Q235B'],
    yield_strength_mpa: [235, 290],
    design_pressure_mpa: [1.6, 6.3],
    operating_pressure_mpa: [0.8, 4.5],
    flow_rate_m3h: [15, 500],
    temperature_c: [5, 45],
    corrosion_rate_mmyear: [0.05, 0.45],
  },
  service: {
    // DN50-DN65 小支管/旁通
    diameter_mm: [50, 65],
    wall_thickness_mm: [2.9, 5.0],
    steel_grade: ['20#', 'Q235B', 'SS304'],
    yield_strength_mpa: [205, 260],
    design_pressure_mpa: [1.0, 4.0],
    operating_pressure_mpa: [0.3, 2.5],
    flow_rate_m3h: [2, 120],
    temperature_c: [5, 42],
    corrosion_rate_mmyear: [0.08, 0.8],
  },
} as const;

type PipeClass = 'trunk' | 'distribution' | 'service';

function getPipeSpec(pipeClass: PipeClass) {
  return PIPE_SPECS[pipeClass];
}

// ==================== 管道传感器读数 ====================

function genPipelineSensorReading(pipeClass: PipeClass): SensorReading {
  const spec = getPipeSpec(pipeClass);
  const operatingPressure = +randRange(spec.operating_pressure_mpa).toFixed(2);
  const wallThickness = +randRange(spec.wall_thickness_mm).toFixed(1);
  const corrosionRate = +randRange(spec.corrosion_rate_mmyear).toFixed(3);
  const temperature = +randRange(spec.temperature_c).toFixed(1);

  // H₂S: 酸性气田 0-500 ppm, NACE MR0175 阈值 50 ppm
  const h2s = +(sr() > 0.7 ? rand(20, 500) : rand(0, 30)).toFixed(1);

  // 可燃气体浓度 %LEL (爆炸下限百分比, 报警阈值 20%LEL)
  const gasLeak = +(sr() > 0.85 ? rand(5, 35) : rand(0, 3)).toFixed(1);

  // CO: 燃烧产物, 正常 0-10 ppm
  const co = +(sr() > 0.9 ? rand(20, 100) : rand(0, 8)).toFixed(1);

  // 流量 (m³/h)
  const flowRate = +randRange(spec.flow_rate_m3h).toFixed(0);

  // 壁厚损失百分比
  const wallLossPct = +(corrosionRate * rand(5, 20)).toFixed(1); // 累积腐蚀

  // 振动频率 (Hz) — 管道流致振动, 异常时 >50Hz
  const vibration = randInt(5, 60);

  // 管道位移/沉降 (mm) — 地质活动导致
  const displacement = +rand(0, 8).toFixed(2);

  // 屈服强度利用率 (实际应力/屈服强度, 报警阈值 72%)
  const yieldUtilization = +(rand(0.3, 0.85)).toFixed(2);

  // 把管道参数映射到 SensorReading 字段（复用现有类型）
  return {
    ch4_pct: gasLeak,                        // 可燃气体 %LEL
    co_ppm: co,                              // CO (ppm)
    h2s_ppm: h2s,                            // H₂S (ppm)
    temperature_c: temperature,              // 管道温度 °C
    stress_mpa: operatingPressure,           // 运行压力 MPa
    stress_sigma1: yieldUtilization * 100,   // 屈服利用率 %
    stress_sigma2: flowRate / 1000,          // 流量 (千 m³/h, 存为副值)
    stress_sigma3: +randRange(spec.yield_strength_mpa).toFixed(0), // 钢材屈服强度 MPa
    permeability_md: corrosionRate,          // 腐蚀速率 mm/yr
    water_pressure_mpa: +rand(0.1, 0.8).toFixed(2), // 外部土压 MPa
    microseismic_count: vibration,           // 振动频率 Hz
    acoustic_emission_mv: randInt(0, 8000),  // 声发射信号 (焊缝缺陷检测)
    humidity_pct: +rand(30, 80).toFixed(1),  // 管道内部湿度 %
    fracture_aperture_um: wallThickness * 1000, // 壁厚 µm (mm×1000)
    displacement_mm: displacement,           // 管道沉降位移 mm
    rock_strength_mpa: wallLossPct,          // 壁厚损失 %
    pore_pressure_mpa: +rand(0.1, 0.5).toFixed(2), // 阴极保护电位
    porosity_pct: +rand(85, 99).toFixed(1),  // 壁厚完整度 % (100 - loss)
    fluid_ph: +rand(5.5, 8.5).toFixed(1),    // 输送介质 pH
    water_saturation_pct: +rand(40, 95).toFixed(1), // 涂层完整性 %
  };
}

// ==================== 管道路径生成 ====================

/**
 * 生成管道中心线路径
 * 管道从入口点开始, 沿指定方向延伸, 可以有弯头和坡度变化
 * 
 * @param entryPoint 地表入口 [x, y, z], y≈18-20 (地表)
 * @param targetPoint 目标终点 [x, y, z]
 * @param pipeClass 管道等级
 */
function _generatePipePath(
  entryPoint: [number, number, number],
  targetPoint: [number, number, number],
  _pipeClass: PipeClass
): [number, number, number][] {
  const points: [number, number, number][] = [[...entryPoint]];

  // 管道首先从检测口竖向进入, 然后转弯水平延伸
  const verticalDepth = rand(12, 20); // 垂直下钻深度
  const bendPoint: [number, number, number] = [
    entryPoint[0],
    entryPoint[1] - verticalDepth,
    entryPoint[2],
  ];
  points.push([...bendPoint.map(v => +v.toFixed(1)) as [number, number, number]]);

  // 弯头后水平延伸到目标点, 中间加入微小弯曲（管道不可能是完美直线）
  const dx = targetPoint[0] - bendPoint[0];
  const dy = targetPoint[1] - bendPoint[1]; // 通常接近 0
  const dz = targetPoint[2] - bendPoint[2];
  const totalDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const segments = Math.max(8, Math.floor(totalDist / 4));

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    // 线性插值 + 弯曲噪声（管道蛇形弯）
    const sway = Math.sin(t * Math.PI * 2 + entryPoint[0] * 0.1) * 1.5;
    const verticalDip = Math.sin(t * Math.PI) * 1.0; // 管道因自重微下垂
    points.push([
      +(bendPoint[0] + dx * t + sway).toFixed(1),
      +(bendPoint[1] + dy * t - verticalDip).toFixed(1),
      +(bendPoint[2] + dz * t).toFixed(1),
    ]);
  }

  return points;
}

/**
 * 生成分支管道路径 — 从主管某点分出
 */
function _generateBranchPath(
  origin: [number, number, number],
  direction: [number, number, number],
  length: number
): [number, number, number][] {
  const points: [number, number, number][] = [[...origin]];
  const segments = Math.max(6, Math.floor(length / 3));

  let [x, y, z] = origin;
  const mag = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
  let dx = direction[0] / mag;
  let dy = direction[1] / mag;
  let dz = direction[2] / mag;

  for (let i = 1; i <= segments; i++) {
    const step = length / segments;
    // 管道方向微调（弯头/弯管）
    dx += rand(-0.1, 0.1);
    dy += rand(-0.05, 0.05);
    dz += rand(-0.1, 0.1);
    const m = Math.sqrt(dx * dx + dy * dy + dz * dz);
    dx /= m; dy /= m; dz /= m;

    x += dx * step;
    y += dy * step;
    z += dz * step;
    // 钳制在岩体范围内
    y = Math.min(15, Math.max(-19, y));
    points.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)]);
  }
  return points;
}

// ==================== 管道实体构建 ====================

const PIPELINE_NAMES = [
  // 检测口立管
  '检测口-A1立管', '检测口-A2立管', '检测口-A3立管', '检测口-A4立管',
  '检测口-A5立管', '检测口-A6立管',
  'DN150 主支线-A', 'DN150 主支线-B',
  'DN100 支管-北', 'DN100 支管-中', 'DN100 支管-南',
  'DN80 分支-D1', 'DN80 分支-D2', 'DN80 分支-D3', 'DN80 分支-D4',
  'DN65 旁通-M1', 'DN65 旁通-M2', 'DN65 旁通-M3', 'DN65 旁通-M4',
  'DN50 阀后盲端-V1', 'DN50 阀后盲端-V2', 'DN50 阀后盲端-V3',
];

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

function buildPipeline(
  id: number,
  path: [number, number, number][],
  pipeClass: PipeClass,
  isMain: boolean,
  parentId: string | null,
  customName?: string
): Fracture {
  const spec = getPipeSpec(pipeClass);
  const diameter = +randRange(spec.diameter_mm).toFixed(0);
  const wallThickness = +randRange(spec.wall_thickness_mm).toFixed(1);

  const fracture: Fracture = {
    id: `P-${String(id).padStart(3, '0')}`,
    name: customName || PIPELINE_NAMES[id % PIPELINE_NAMES.length],
    type: isMain ? 'main' : 'branch',
    path,
    length: +pathLength(path).toFixed(1),
    aperture_um: wallThickness * 1000,   // 壁厚 µm
    porosity: +(diameter / 1000).toFixed(3), // 管径 m
    fractal_dim: +(rand(2.03, 2.35)).toFixed(4),
    tortuosity: +(rand(1.01, 1.15)).toFixed(4), // 管道比裂缝更直
    dip_angle: +rand(0, 15).toFixed(1),  // 管道倾角较小
    azimuth_angle: +rand(0, 360).toFixed(1),
    roughness_coeff: +rand(0.005, 0.05).toFixed(3), // 管道内壁粗糙度很低
    connectivity: randInt(2, 6),
    sensorReading: genPipelineSensorReading(pipeClass),
    nodes: [],
    parentFractureId: parentId,
  };

  // 在路径上生成传感器测点（每隔几个路径点放一个）
  const nodeCount = Math.max(3, Math.floor(path.length / 3));
  for (let i = 0; i < nodeCount; i++) {
    const pathIdx = Math.floor((i / nodeCount) * (path.length - 1));
    fracture.nodes.push({
      id: `${fracture.id}-N${i}`,
      position: path[pathIdx],
      sensors: genPipelineSensorReading(pipeClass),
      timestamp: Date.now() - randInt(0, 300000),
      robotId: null,
    });
  }

  return fracture;
}

// ==================== 管网生成 ====================

/** 缓存 */
let cachedPipelines: Fracture[] | null = null;
let cachedNodePositions: [number, number, number][] = [];
let cachedPathPoints: [number, number, number][] = [];

/**
 * 生成竖直管道路径（检测口立管）
 * 从地表竖直下钻到指定深度，底部加一个 90° 弯头转向
 */
function generateVerticalRiser(
  top: [number, number, number],
  depth: number,
  turnDir: [number, number, number]
): [number, number, number][] {
  const points: [number, number, number][] = [[...top]];
  // 竖直段
  const bottom: [number, number, number] = [top[0], top[1] - depth, top[2]];
  const steps = Math.max(4, Math.floor(depth / 3));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    points.push([top[0], +(top[1] - depth * t).toFixed(1), top[2]]);
  }
  // 弯头（90° 弧，用 3 个点模拟）
  const elbowRadius = 3;
  const elbowEnd: [number, number, number] = [
    +(bottom[0] + turnDir[0] * elbowRadius).toFixed(1),
    bottom[1],
    +(bottom[2] + turnDir[2] * elbowRadius).toFixed(1),
  ];
  points.push(
    [+(bottom[0] + turnDir[0] * elbowRadius * 0.3).toFixed(1), bottom[1], +(bottom[2] + turnDir[2] * elbowRadius * 0.3).toFixed(1)],
    [+(bottom[0] + turnDir[0] * elbowRadius * 0.7).toFixed(1), +(bottom[1] + 0.5).toFixed(1), +(bottom[2] + turnDir[2] * elbowRadius * 0.7).toFixed(1)],
    elbowEnd,
  );
  return points;
}

/**
 * 生成水平管道路径（管廊）
 * 从 start 到 end，沿直线走，加入微小弯曲模拟管段焊接偏移
 */
function generateHorizontalPipe(
  start: [number, number, number],
  end: [number, number, number]
): [number, number, number][] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const segs = Math.max(10, Math.floor(dist / 4));
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    if (i === 0) {
      points.push([...start]);
      continue;
    }
    if (i === segs) {
      points.push([...end]);
      continue;
    }
    // 微小弯曲（管道自重下垂 + 焊接偏移）
    const sag = Math.sin(t * Math.PI) * 0.3;
    const jitter_x = Math.sin(t * Math.PI * 3) * 0.15;
    const jitter_z = Math.cos(t * Math.PI * 2.5) * 0.15;
    points.push([
      +(start[0] + dx * t + jitter_x).toFixed(1),
      +(start[1] + dy * t - sag).toFixed(1),
      +(start[2] + dz * t + jitter_z).toFixed(1),
    ]);
  }
  return points;
}

/**
 * 生成 L 型弯管路径（主管到分配管的连接弯头）
 */
function generateElbowPipe(
  start: [number, number, number],
  end: [number, number, number],
  _midOffset: number
): [number, number, number][] {
  // 真实管件按水平转向 + 竖向/标高调整拆成两段，避免斜插式“硬焊”。
  const corner: [number, number, number] = [end[0], start[1], end[2]];
  const pts1 = generateHorizontalPipe(start, corner);
  const pts2 = generateHorizontalPipe(corner, end);
  return [...pts1, ...pts2.slice(1)];
}

function cappedStubName(prefix: string, index: number): string {
  return `${prefix}-阀后检查盲端-${index}`;
}

let _pipeIdCounter = 0;
function nextPipeId(): number {
  return _pipeIdCounter++;
}

/**
 * 生成完整管网 — 小口径管道局部切片布局
 *
 * 布局结构（俯视）：
 *
 *  西(x=-45)                         东(x=45)
 *  ┌──────────────────────────────────────────┐ z=-35
 *  │ A1  A2  A3     ← 检测口排（6 个入口）     │
 *  │ │  │  │  │  │  │  ← 竖直入口             │ z=-30
 *  │ └──┴──┴──┴──┴──┘  ← DN150 主支线         │
 *  │        ║                                    │
 *  │  ═════╬═════  ← DN100 支管-北              │ z=-18
 *  │        ║                                    │
 *  │  ═════╬═════  ← DN100 支管-中              │ z=0
 *  │        ║                                    │
 *  │  ═════╬═════  ← DN100 支管-南              │ z=18
 *  │                                              │
 *  │  ├──┤├──┤├──┤  ← DN80/DN65/DN50 分支       │ z=30
 *  └──────────────────────────────────────────┘ z=35
 *
 *  Y 轴：地表 y≈19，管廊层 y≈-5~-8
 */
export function generatePipelineNetwork(): Fracture[] {
  if (cachedPipelines) return cachedPipelines;

  _seed = 42;
  _pipeIdCounter = 0;
  const pipelines: Fracture[] = [];

  // === 参数 ===
  const surfaceY = 19;       // 地表高度
  const pipeLayerY = -6;     // 水平管廊层高度
  const wellZ = -30;         // 检测口排 Z 坐标
  const wellStartX = -38;    // 第一个检测口 X
  const wellSpacing = 14;    // 检测口间距
  const wellCount = 6;

  // ========================================================
  // 1. 检测口立管（6 个竖直入口，从检修口进入管廊层）
  // ========================================================
  const wellheadBottoms: [number, number, number][] = [];
  const trunkZs = [-16, 0, 16]; // 三条干线 Z 坐标
  const trunkNames = ['DN100 支管-北', 'DN100 支管-中', 'DN100 支管-南'];

  for (let i = 0; i < wellCount; i++) {
    const wx = wellStartX + i * wellSpacing;
    const top: [number, number, number] = [wx, surfaceY, wellZ];
    const bottom: [number, number, number] = [wx, pipeLayerY, wellZ];
    wellheadBottoms.push(bottom);
    // 立管朝东（+X方向）弯出
    const path = generateVerticalRiser(top, surfaceY - pipeLayerY, [1, 0, 0]);
    pipelines.push(buildPipeline(nextPipeId(), path, 'trunk', true, null, `检测口-A${i + 1}立管`));
  }

  // ========================================================
  // 2. DN150 主支线（水平，连接所有检测口底部，沿 X 轴）
  // ========================================================
  const headerY = pipeLayerY;
  const headerStart: [number, number, number] = [wellheadBottoms[0][0] + 3, headerY, wellZ];
  const headerEnd: [number, number, number] = [wellheadBottoms[wellCount - 1][0] + 3, headerY, wellZ];
  const headerPath = generateHorizontalPipe(headerStart, headerEnd);
  pipelines.push(buildPipeline(nextPipeId(), headerPath, 'trunk', true, null, 'DN150 主支线'));

  // ========================================================
  // 3. DN100 支管（3 条平行支管，从主支线引出向东延伸）
  // ========================================================
  const trunkEndX = 58;
  // 从 A4 检测口位置引出支管（保证连接到主支线上的已知点）
  const trunkOriginX = wellheadBottoms[3][0] + 3; // A4 riser endpoint x ≈ 7

  for (let t = 0; t < trunkZs.length; t++) {
    const tz = trunkZs[t];
    const trunkY = headerY + t * 1.5; // 管廊分层叠放
    // 显式连接管 — 从 A4 立管弯头终点到支管起点
    const connectStart: [number, number, number] = [trunkOriginX, headerY, wellZ];
    const trunkStart: [number, number, number] = [trunkOriginX + 3, trunkY, tz];
    const connectPath = generateElbowPipe(connectStart, trunkStart, 0);
    // 支管主体 — 用小抖动直线保证分支起点能对齐
    const trunkEnd: [number, number, number] = [trunkEndX, trunkY, tz];
    const trunkPath = generateHorizontalPipe(trunkStart, trunkEnd);

    // 合并连接弯 + 支管主体
    pipelines.push(buildPipeline(nextPipeId(), [...connectPath, ...trunkPath.slice(1)], 'trunk', true, null, trunkNames[t]));
  }

  // ========================================================
  // 4. DN80 分支（从支管引出，向北/南分支）
  // ========================================================
  // 支管范围: trunkOriginX+3 ≈ 10 到 42，分支起点必须在此范围内
  const distributionXs = [14, 22, 30, 38, 46, 54]; // 更长的巡检走廊，增加分支密度
  let distCount = 0;

  for (const dx of distributionXs) {
    for (let ti = 0; ti < trunkZs.length; ti++) {
      if (distCount >= 6) break;
      const tz = trunkZs[ti];
      const trunkY = headerY + ti * 1.5;

      // 分支从支管垂直引出 — 起点精确对齐支管 Y 和 Z
      const branchDir = ti === 1 ? (distCount % 2 === 0 ? 1 : -1) : (ti === 0 ? 1 : -1);
      const branchLen = rand(16, 28);
      const branchStart: [number, number, number] = [+dx.toFixed(1), trunkY, +tz.toFixed(1)];
      const branchEnd: [number, number, number] = [
        +(dx + rand(-2, 2)).toFixed(1),
        trunkY,
        +(tz + branchDir * branchLen).toFixed(1),
      ];
      const branchPath = generateHorizontalPipe(branchStart, branchEnd);
      pipelines.push(buildPipeline(nextPipeId(), branchPath, 'distribution', false, null, cappedStubName('DN80 分支', distCount + 1)));
      distCount++;
    }
  }

  // ========================================================
  // 5. DN65 旁通/阀后支线（在支管远端引出短支管）
  // ========================================================
  const valveXs = [20, 28, 36, 44, 52]; // 末端旁通加长，增强回流/阀后复杂度
  let valveCount = 0;

  for (const vx of valveXs) {
    for (let ti = 0; ti < trunkZs.length; ti++) {
      if (valveCount >= 8) break;
      // 隔一条支管引出
      if ((vx + ti) % 2 === 0) continue;
      const tz = trunkZs[ti];
      const trunkY = headerY + ti * 1.5;

      const valveStart: [number, number, number] = [+vx.toFixed(1), trunkY, +tz.toFixed(1)];
      const valveDir = ti === 1 ? -1 : (ti === 0 ? 1 : -1);
      const valveEnd: [number, number, number] = [
        +(vx + rand(-2, 2)).toFixed(1),
        trunkY,
        +(tz + valveDir * rand(8, 18)).toFixed(1),
      ];
      const valvePath = generateHorizontalPipe(valveStart, valveEnd);
      pipelines.push(buildPipeline(nextPipeId(), valvePath, 'service', false, null, cappedStubName('DN65 旁通', valveCount + 1)));
      valveCount++;
    }
  }

  // ========================================================
  // 6. DN50 阀后盲端（从主支线引出短支管到两侧）
  // ========================================================
  for (let i = 1; i < wellCount; i += 2) {
    const wx = wellStartX + i * wellSpacing;
    const branchStart: [number, number, number] = [wx + 3, headerY, wellZ];
    const branchEnd: [number, number, number] = [
      +(wx + 3 + rand(-2, 2)).toFixed(1),
      headerY,
      +(wellZ + (i % 4 === 1 ? 1 : -1) * rand(8, 14)).toFixed(1),
    ];
    const servicePath = generateHorizontalPipe(branchStart, branchEnd);
    const svcIdx = Math.floor(i / 2) + 1;
    pipelines.push(buildPipeline(nextPipeId(), servicePath, 'service', false, null, `DN50 阀后盲端-V${svcIdx}`));
  }

  // ========================================================
  // 7. 末端检查回路（拉长路径，模拟真实检修中的回流和跨接）
  // ========================================================
  const northTrunkEnd: [number, number, number] = [trunkEndX, pipeLayerY, -16];
  const middleTrunkEnd: [number, number, number] = [trunkEndX, pipeLayerY + 1.5, 0];
  const southTrunkEnd: [number, number, number] = [trunkEndX, pipeLayerY + 3, 16];
  const loopMid: [number, number, number] = [trunkEndX + 10, pipeLayerY + 1.5, 0];
  pipelines.push(buildPipeline(
    nextPipeId(),
    [...generateHorizontalPipe(northTrunkEnd, loopMid), ...generateHorizontalPipe(loopMid, southTrunkEnd).slice(1)],
    'distribution',
    false,
    null,
    'DN80 末端检查回路'
  ));
  pipelines.push(buildPipeline(
    nextPipeId(),
    generateHorizontalPipe(loopMid, middleTrunkEnd),
    'service',
    false,
    null,
    'DN65 末端跨接'
  ));

  // === 分配蛛型机器人到管道节点 ===
  assignRobotsToNodes(pipelines);
  const sanitized = seedScenarioAnomalies(pipelines, 'pipeline');

  // 缓存
  cachedPipelines = sanitized;
  cachedNodePositions = sanitized.flatMap((p) => p.nodes.map((n) => n.position));
  cachedPathPoints = sanitized.flatMap((p) => p.path);

  return sanitized;
}

/** 将机器人 ID 分配到管道节点上 */
function assignRobotsToNodes(pipelines: Fracture[]): void {
  let robotIdx = 0;
  for (const pipeline of pipelines) {
    for (const node of pipeline.nodes) {
      if (robotIdx < 150) {
        // 75% 的节点分配机器人（管线场景机器人密度更高）
        node.robotId = sr() > 0.25
          ? `R-${String(++robotIdx).padStart(3, '0')}`
          : null;
      }
    }
  }
}

/** 获取所有管道节点位置 */
export function getAllPipelineNodePositions(): [number, number, number][] {
  return cachedNodePositions;
}

/** 获取所有管道路径点（供机器人精确部署） */
export function getAllPipelinePathPoints(): [number, number, number][] {
  return cachedPathPoints;
}

/** 获取管网传感器概况（用于 AI prompt） */
export function getPipelineSensorSummary(): string {
  return `当前数据源: 模拟数据二·小口径管道
管道类型: DN150 主支线 + DN80-DN100 支线 + DN50-DN65 旁通/阀后盲端
运行参数:
- 运行压力: 0.3-6.0 MPa (设计压力 1.0-8.0 MPa)
- 流量: 2-1200 m³/h
- 壁厚: 2.9-7.1 mm
- 温度: 5-48 °C
- 腐蚀速率: 0.01-0.80 mm/yr
安全阈值:
- H₂S: 50 ppm (NACE MR0175 酸性服务)
- 可燃气体: 20% LEL
- 壁厚损失: 20% (临界)
- 屈服利用率: 72% (ASME B31.8)
机器人: 微型蛛型/蛇形机器人, 适配 DN50-DN150, 自驱无缆`;
}
