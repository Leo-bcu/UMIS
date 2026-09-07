import type { Robot, RobotModel, RobotStatus, MeshRole, DataSourceType, ScenarioType, Monitor, MonitorStatus, MonitorFrame } from '../types';
import { getAllPathPoints, getCoalMineDeploymentPathPoints, generateFractureNetwork } from './fractureDataGenerator';
import { getAllPipelinePathPoints, generatePipelineNetwork } from './pipelineDataGenerator';
import { getAllNuclearPathPoints, generateNuclearNetwork } from './nuclearDataGenerator';
import { getAllRefineryPathPoints, generateRefineryNetwork } from './refineryDataGenerator';
import { getAllUndergroundPathPoints, generateUndergroundNetwork } from './undergroundDataGenerator';

const MONITOR_IMAGE_MODULES = import.meta.glob('../../approch/camera/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const MONITOR_IMAGE_POOL = Object.entries(MONITOR_IMAGE_MODULES)
  .map(([path, url]) => ({ path, url }))
  .sort((a, b) => a.path.localeCompare(b.path));

function toPublicCameraPath(fileUrl: string): string {
  const fileName = fileUrl.split('/').pop();
  return fileName ? `/approch/camera/${fileName}` : fileUrl;
}

// Seeded random
let seed = 7777;
function sr(): number {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}
function rand(min: number, max: number): number {
  return min + sr() * (max - min);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(sr() * arr.length)];
}

const TOTAL_ROBOTS = 200;
const TOTAL_MONITORS = 32;

function separateRobotMarker(basePos: [number, number, number], index: number): [number, number, number] {
  const dx = ((index % 11) - 5) * 0.015;
  const dz = ((Math.floor(index / 11) % 11) - 5) * 0.015;
  return [
    round(basePos[0] + dx, 2),
    round(basePos[1], 2),
    round(basePos[2] + dz, 2),
  ];
}

// 型号权重分布（煤矿瓦斯巡测：蛇形+履带混合，更像矿井窄巷和交错支巷）
const MODEL_WEIGHTS_FRACTURE: { model: RobotModel; weight: number }[] = [
  { model: 'snake', weight: 62 },
  { model: 'tracked', weight: 28 },
  { model: 'climbing', weight: 10 },
];

// 管线场景：小口径管道内检，主力为蛛型，少量蛇形用于盲端/阀口
const MODEL_WEIGHTS_PIPELINE: { model: RobotModel; weight: number }[] = [
  { model: 'spider', weight: 72 },
  { model: 'snake', weight: 18 },
  { model: 'climbing', weight: 10 },
];

// 核反应堆场景：全部耐辐照蛛型机器人
const MODEL_WEIGHTS_NUCLEAR: { model: RobotModel; weight: number }[] = [
  { model: 'spider', weight: 100 },   // 蛛型（耐辐照设计, 管道内壁爬行）
];

// 化工密闭空间场景：蛇形 + 履带小型机器人，适配储罐/反应釜/人孔
const MODEL_WEIGHTS_REFINERY: { model: RobotModel; weight: number }[] = [
  { model: 'snake', weight: 58 },
  { model: 'tracked', weight: 22 },
  { model: 'climbing', weight: 20 },
];

// 地下暗流场景：全部浮走式(章鱼)机器人 — 水中漂浮蠕动推进
const MODEL_WEIGHTS_UNDERGROUND: { model: RobotModel; weight: number }[] = [
  { model: 'floatwalker', weight: 100 }, // 浮走/章鱼式（水中漂浮蠕动，暗流通道主战）
];

// 任务池（煤矿瓦斯巡测场景）
const TASKS_FRACTURE = [
  '入口投放建图',
  '主运输巷点云建图',
  '采空区边界复核',
  '封堵墙注浆点复核',
  '暗流排水线巡测',
  '瓦斯积聚点定位',
  '巷道切片扫描',
  'CH4巡检',
  'CO巡检',
  'O2巡检',
  '风流/通风盲区排查',
  'Mesh 中继转发',
  '矿压变化巡查',
  '温度梯度测绘',
  '待命中',
  '窄巷爬行',
  '巷道顶板成像',
  '瓦斯局部积聚排查',
  '裂隙扩张监测',
  '声发射信号采集',
  '水文异常探查',
];

const TASKS_GOLD = [
  '微震活动监测',
  '岩爆风险复核',
  '应力异常巡测',
  '采空区稳定性评估',
  '矿脉追踪成像',
  '裂隙扩张监测',
  '岩温梯度测绘',
  '待命中',
  '空区边界扫描',
  '声发射信号采集',
];

const TASKS_OIL = [
  '孔隙压力监测',
  '储层连通性评估',
  '渗透率原位测试',
  '含水率巡检',
  '地层温度测绘',
  '压裂风险复核',
  '储层裂缝扫描',
  '待命中',
  '压差异常排查',
  '采收率辅助分析',
];

// 任务池（管线场景）
const TASKS_PIPELINE = [
  'DN50-DN150 壁厚超声检测',
  '腐蚀减薄标记',
  '焊缝探伤扫查',
  '泄漏点精确定位',
  '小口径管道内腔扫描',
  'Mesh 中继转发',
  '阴极保护电位测量',
  '待命中',
  '支管入口巡检',
  'H₂S浓度监测',
  '流量计校验',
  '管道沉降监测',
  '阀门密封检测',
  '管壁高清晰度成像',
];

// 任务池（核反应堆场景）
const TASKS_NUCLEAR = [
  '主管道焊缝超声检测',
  '一回路剂量率巡测',
  'SG传热管涡流探伤',
  '壁厚超声测厚',
  'FAC敏感区监测',
  'Mesh 中继转发',
  '阀门动作可靠性测试',
  '待命中',
  '主泵密封泄漏检测',
  '稳压器波动管巡检',
  '安注管路畅通性验证',
  '辐射热点三维成像',
  '疲劳累积在线监测',
  '冷态/热态功能试验辅助',
];

// 任务池（地下暗流场景 — 浮走/蛇形/履带/蛛形协作探测）
const TASKS_UNDERGROUND = [
  '暗流通道三维扫描',
  '水质取样分析',
  '溶洞沉积物探测',
  'Mesh 中继转发',
  '狭窄瓶颈穿行',
  '水文参数探查',
  '暗流漂浮巡游',
  '待命中',
  '盲端溶洞成像',
  '岩壁裂缝巡检',
  '流量速率测量',
  '温度梯度测绘',
  '矿化度检测',
  '渗透率原位测试',
];

// 任务池（化工密闭空间场景 — 储罐/反应釜内部巡检）
const TASKS_REFINERY = [
  '储罐人孔进入巡检',
  '反应釜内部气体巡测',
  'H₂S/VOC/O₂ 复合检测',
  '壁厚减薄超声测量',
  '结垢厚度成像',
  'Mesh 中继转发',
  '焊缝裂纹探伤',
  '待命中',
  '人孔边界扫描',
  '密闭空间气体积聚复核',
  '内壁腐蚀评估',
  '法兰密封检测',
  '差压异常排查',
  '内壁局部热点监测',
];

// 状态权重（地下恶劣环境，故障率偏高）
const STATUS_WEIGHTS: { status: RobotStatus; weight: number }[] = [
  { status: 'online', weight: 60 },
  { status: 'low_battery', weight: 15 },
  { status: 'offline', weight: 12 },
  { status: 'maintenance', weight: 8 },
  { status: 'error', weight: 5 },
];

const MONITOR_STATUS_WEIGHTS: { status: MonitorStatus; weight: number }[] = [
  { status: 'online', weight: 72 },
  { status: 'warning', weight: 12 },
  { status: 'offline', weight: 10 },
  { status: 'maintenance', weight: 6 },
];

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = sr() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[0];
}

/**
 * 获取机器人在裂缝/管线/核反应堆网络中的部署位置
 * - 使用路径点（密集），确保机器人始终在管道/裂缝线上
 * - 偏移 ±0.5 以内，视觉上紧贴
 */
function getRobotPosition(index: number, dataSource: DataSourceType, scenario: ScenarioType = 'coal'): [number, number, number] {
  const pathPoints =
    dataSource === 'pipeline' ? getAllPipelinePathPoints() :
    dataSource === 'nuclear' ? getAllNuclearPathPoints() :
    dataSource === 'refinery' ? getAllRefineryPathPoints() :
    dataSource === 'underground' ? getAllUndergroundPathPoints() :
    scenario === 'coal' ? getCoalMineDeploymentPathPoints() :
    getAllPathPoints();

  if (pathPoints.length > 0) {
    if (dataSource === 'fracture' && scenario === 'coal') {
      const progress = Math.min(1, index / (TOTAL_ROBOTS - 1));
      const idx = Math.min(pathPoints.length - 1, Math.floor(progress * (pathPoints.length - 1)));
      const basePos = pathPoints[idx];
      const lateral = (index % 5 - 2) * 0.06;
      return [
        Math.round((basePos[0] + lateral) * 10) / 10,
        Math.round(basePos[1] * 10) / 10,
        Math.round((basePos[2] - lateral) * 10) / 10,
      ];
    }
    // 沿路径均匀分布（加少量抖动避免完全重叠）
    const idx = index % pathPoints.length;
    const jitter = Math.floor(index / pathPoints.length); // 循环时叠加偏移
    const basePos = pathPoints[(idx + jitter * 7) % pathPoints.length];
    if (dataSource === 'pipeline' || dataSource === 'nuclear' || dataSource === 'refinery') {
      return separateRobotMarker(basePos, index);
    }
    // 极小偏移 — 机器人贴着管壁/裂缝壁
    return [
      Math.round((basePos[0] + rand(-0.5, 0.5)) * 10) / 10,
      Math.round((basePos[1] + rand(-0.3, 0.3)) * 10) / 10,
      Math.round((basePos[2] + rand(-0.5, 0.5)) * 10) / 10,
    ];
  }

  // 兜底
  return [
    Math.round(rand(-45, 45) * 10) / 10,
    Math.round(rand(-15, 15) * 10) / 10,
    Math.round(rand(-35, 35) * 10) / 10,
  ];
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function generateMonitorPosition(index: number, dataSource: DataSourceType, scenario: ScenarioType = 'coal'): [number, number, number] {
  const pathPoints =
    dataSource === 'pipeline' ? getAllPipelinePathPoints() :
    dataSource === 'nuclear' ? getAllNuclearPathPoints() :
    dataSource === 'refinery' ? getAllRefineryPathPoints() :
    dataSource === 'underground' ? getAllUndergroundPathPoints() :
    scenario === 'coal' ? getCoalMineDeploymentPathPoints() :
    getAllPathPoints();

  if (pathPoints.length === 0) return [0, 0, 0];
  const coalStructureIds = ['G-000', 'G-001', 'G-002', 'G-003', 'G-004'];
  const structureId = coalStructureIds[index % coalStructureIds.length];
  const pathAnchors: Record<string, [number, number, number][]> = {
    'G-000': [[-46, 11, -25], [-44, 5, -23], [-40, 0, -21], [-36, -5, -19], [-30, -12, -16], [-24, -19, -13]],
    'G-001': [[-20, -22, -12], [-10, -24, -10], [0, -25, -9], [10, -26, -7], [22, -29, -4], [34, -31, 2], [46, -34, 8]],
    'G-002': [[-24, -18, 4], [-12, -21, 6], [0, -24, 8], [12, -27, 12], [24, -31, 18], [36, -35, 24], [46, -38, 30]],
    'G-003': [[0, -26, -8], [-3, -33, 0], [-6, -40, 10], [-8, -47, 20], [-4, -52, 27], [0, -56, 34], [4, -59, 38]],
    'G-004': [[18, -36, 18], [24, -42, 24], [30, -48, 30], [38, -52, 36], [46, -56, 36]],
  };
  const anchors = pathAnchors[structureId];
  const anchor = anchors[index % anchors.length];
  const lateral = ((index % 5) - 2) * 0.22;
  const vertical = ((index % 3) - 1) * 0.08;
  return [
    round(anchor[0] + lateral, 2),
    round(anchor[1] + vertical, 2),
    round(anchor[2] - lateral * 0.3, 2),
  ];
}

function generateRobot(index: number, dataSource: DataSourceType, scenario: ScenarioType = 'coal'): Robot {
  const position = getRobotPosition(index, dataSource, scenario);
  const modelWeights =
    dataSource === 'pipeline' ? MODEL_WEIGHTS_PIPELINE :
    dataSource === 'nuclear' ? MODEL_WEIGHTS_NUCLEAR :
    dataSource === 'refinery' ? MODEL_WEIGHTS_REFINERY :
    dataSource === 'underground' ? MODEL_WEIGHTS_UNDERGROUND :
    MODEL_WEIGHTS_FRACTURE;
  const tasks =
    dataSource === 'pipeline' ? TASKS_PIPELINE :
    dataSource === 'nuclear' ? TASKS_NUCLEAR :
    dataSource === 'refinery' ? TASKS_REFINERY :
    dataSource === 'underground' ? TASKS_UNDERGROUND :
    scenario === 'gold' ? TASKS_GOLD :
    scenario === 'oil' ? TASKS_OIL :
    TASKS_FRACTURE;
  const model = weightedPick(modelWeights).model;
  const status = weightedPick(STATUS_WEIGHTS).status;

  const meshRole: MeshRole = dataSource === 'fracture' && scenario === 'coal'
    ? index < 8 ? 'gateway' : index < 46 ? 'relay' : index < 118 ? 'edge' : 'leaf'
    : (() => {
      const meshRoll = sr();
      return meshRoll < 0.05 ? 'gateway' :
        meshRoll < 0.20 ? 'relay' :
        meshRoll < 0.55 ? 'edge' : 'leaf';
    })();

  const meshConnected = status === 'online' || status === 'low_battery'
    ? sr() > 0.05
    : sr() > 0.7;

  let battery: number;
  if (status === 'low_battery') battery = Math.floor(rand(3, 20));
  else if (status === 'offline') battery = Math.floor(rand(0, 15));
  else if (status === 'maintenance') battery = Math.floor(rand(50, 100));
  else battery = Math.floor(rand(25, 100));

  // 深度/距离 — 按场景计算不同物理含义
  let depth: number;
  if (dataSource === 'nuclear') {
    // 距反应堆压力容器中心[0,-14,0]的距离(m)
    depth = Math.round(Math.sqrt(position[0] ** 2 + (position[1] + 14) ** 2 + position[2] ** 2) * 10) / 10;
  } else if (dataSource === 'refinery') {
    // 距设备区入口的距离(m)
    depth = Math.round(Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2) * 10) / 10;
  } else if (dataSource === 'pipeline') {
    // 距管道入口的距离(m)
    depth = Math.round(Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2) * 10) / 10;
  } else if (dataSource === 'underground') {
    // 地下深度(m) — y 轴负方向，每单位 = 10m 实际深度
    depth = Math.max(0, Math.round(-Math.min(position[1], 0) * 10));
  } else if (scenario === 'coal') {
    // 煤矿：地表投放点 y≈18，实际深度按井下垂深折算，越深入巷道越大。
    depth = Math.max(0, Math.round((18 - position[1]) * 10));
  } else {
    // 地下裂缝：距岩体表面深度(m)
    const distFromSurface = Math.min(
      Math.abs(position[0] - 50), Math.abs(position[0] + 50),
      Math.abs(position[2] - 40), Math.abs(position[2] + 40),
    );
    depth = Math.round(distFromSurface * 10) / 10;
  }

  // 信号强度 — 非裂缝场景金属/混凝土环境衰减更大
  const signalBase = dataSource === 'nuclear' ? -65 : dataSource === 'refinery' ? -60 : dataSource === 'pipeline' ? -55 : dataSource === 'underground' ? -50 : -40;
  const signalStrength = Math.round(signalBase - depth * 0.3 + rand(-8, 8));

  // 传感器读数 — 按数据源使用不同物理量，值域符合行业实际
  let ch4: number, temperature: number, humidity: number;

  if (dataSource === 'nuclear') {
    // 核反应堆：剂量率(mSv/h) / 冷却剂温度(°C) / 运行压力(MPa)
    const doseRoll = sr();
    ch4 = doseRoll > 0.8 ? round(rand(15, 50), 2) : round(rand(0.1, 8), 2);
    temperature = round(rand(280, 330), 1);
    humidity = round(rand(14.8, 15.6), 1);
  } else if (dataSource === 'refinery') {
    // 化工密闭空间：H2S / VOC / O2 / 可燃气体环境
    const gasRoll = sr();
    ch4 = gasRoll > 0.82 ? round(rand(10, 40), 1) : round(rand(0, 12), 1);
    temperature = round(rand(18, 58), 1);
    humidity = round(rand(10, 22), 1);
  } else if (dataSource === 'pipeline') {
    // 小口径管道：泄漏 / 壁厚 / 腐蚀环境
    const leakRoll = sr();
    ch4 = leakRoll > 0.82 ? round(rand(8, 32), 1) : round(rand(0, 6), 1);
    temperature = round(rand(5, 48), 1);
    humidity = round(rand(35, 88), 1);
  } else if (dataSource === 'underground') {
    // 地下暗流：矿化度(mg/L) / 地温(°C) / 含水率(%)
    const mineralRoll = sr();
    ch4 = mineralRoll > 0.8 ? Math.round(rand(48_000, 72_000)) : Math.round(rand(12_000, 42_000));
    temperature = round(rand(35, 110), 1);
    humidity = round(rand(95, 100), 1);
  } else {
    // 煤矿瓦斯子场景：主指标 / 温度 / 辅助读数
    if (scenario === 'gold') {
      ch4 = Math.round(rand(4, 22));
      temperature = round(rand(26, 42), 1);
      humidity = round(rand(8, 22), 1);
    } else if (scenario === 'oil') {
      ch4 = round(rand(14, 36), 1);
      temperature = round(rand(52, 92), 1);
      humidity = round(rand(0.4, 3.6), 2);
    } else {
      ch4 = round(rand(0.1, 4.5), 2);
      temperature = round(22 + depth * 0.15 + rand(-3, 8), 1);
      humidity = Math.round(rand(45, 95));
    }
  }

  return {
    id: `R-${String(index + 1).padStart(3, '0')}`,
    model,
    status,
    position,
    battery,
    meshRole,
    meshConnected,
    task: pick(tasks),
    depth,
    signalStrength,
    sensors: { ch4, temperature, humidity },
    lastUpdate: Date.now() - Math.floor(rand(0, 300000)),
  };
}

let cachedRobots: Robot[] | null = null;
let cachedGoldRobots: Robot[] | null = null;
let cachedOilRobots: Robot[] | null = null;
let cachedPipelineRobots: Robot[] | null = null;
let cachedNuclearRobots: Robot[] | null = null;
let cachedRefineryRobots: Robot[] | null = null;
let cachedUndergroundRobots: Robot[] | null = null;
let cachedMonitors: Monitor[] | null = null;
let monitorFrameCursor = 0;

function pickMonitorImage(index: number): string {
  if (MONITOR_IMAGE_POOL.length === 0) return `/api/monitors/${index + 1}/frame/1`;
  const item = MONITOR_IMAGE_POOL[index % MONITOR_IMAGE_POOL.length] ?? null;
  return item ? toPublicCameraPath(item.url) : `/api/monitors/${index + 1}/frame/1`;
}

function buildMonitorFrames(monitorId: string, labels: string[], baseIndex: number): MonitorFrame[] {
  const now = Date.now();
  const primaryImage = pickMonitorImage(baseIndex);
  return Array.from({ length: 4 }, (_, i) => ({
    index: i + 1,
    imageUrl: i === 0 ? primaryImage : primaryImage,
    capturedAt: now - i * 1000,
    recognizedLabels: i === 0 ? labels : [],
  }));
}

function generateMonitor(index: number, dataSource: DataSourceType, scenario: ScenarioType = 'coal'): Monitor {
  const position = generateMonitorPosition(index, dataSource, scenario);
  const status = weightedPick(MONITOR_STATUS_WEIGHTS).status;
  const battery = status === 'offline' ? Math.floor(rand(0, 20)) : Math.floor(rand(20, 100));
  const tasks = ['巷道温湿度监测', '瓦斯扩散监测', '风流状态采集', '结构位移预警', '设备振动监听', '边界环境巡查'];
  const coalStructureIds = ['G-000', 'G-001', 'G-002', 'G-003', 'G-004'];
  const relatedCoalStructureId = coalStructureIds[index % coalStructureIds.length];
  const labelPools: Record<string, string[]> = {
    'G-000': ['支护结构', '电缆', '管路'],
    'G-001': ['采掘机械', '轨道', '容器'],
    'G-002': ['电气设备', '指示装置', '门'],
    'G-003': ['人员', '救援装备', '电缆'],
    'G-004': ['支护结构', '管路', '采掘机械'],
  };
  const recognizedLabels = labelPools[relatedCoalStructureId];
  return {
    id: `J-${String(index + 1).padStart(3, '0')}`,
    status,
    position,
    battery,
    task: pick(tasks),
    depth: Math.max(0, Math.round((18 - position[1]) * 10)),
    signalStrength: Math.round(-35 - index * 0.4 + rand(-4, 4)),
    coverageRadius: round(rand(6, 14), 1),
    relatedCoalStructureId,
    recognizedLabels,
    frameHistory: buildMonitorFrames(`J-${String(index + 1).padStart(3, '0')}`, recognizedLabels, index),
    sensors: { ch4: round(rand(0.1, 4.2), 2), temperature: round(rand(18, 34), 1), humidity: round(rand(45, 92), 1) },
    lastUpdate: Date.now() - Math.floor(rand(0, 180000)),
  };
}

export function generateMockRobots(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal'): Robot[] {
  if (dataSource === 'pipeline') {
    if (cachedPipelineRobots) return cachedPipelineRobots;
    generatePipelineNetwork();
    seed = 7777;
    cachedPipelineRobots = [];
    for (let i = 0; i < 150; i++) cachedPipelineRobots.push(generateRobot(i, 'pipeline'));
    return cachedPipelineRobots;
  }

  if (dataSource === 'nuclear') {
    if (cachedNuclearRobots) return cachedNuclearRobots;
    generateNuclearNetwork();
    seed = 7777;
    cachedNuclearRobots = [];
    for (let i = 0; i < 180; i++) cachedNuclearRobots.push(generateRobot(i, 'nuclear'));
    return cachedNuclearRobots;
  }

  if (dataSource === 'refinery') {
    if (cachedRefineryRobots) return cachedRefineryRobots;
    generateRefineryNetwork();
    seed = 7777;
    cachedRefineryRobots = [];
    for (let i = 0; i < 160; i++) cachedRefineryRobots.push(generateRobot(i, 'refinery'));
    return cachedRefineryRobots;
  }

  if (dataSource === 'underground') {
    if (cachedUndergroundRobots) return cachedUndergroundRobots;
    generateUndergroundNetwork();
    seed = 7777;
    cachedUndergroundRobots = [];
    for (let i = 0; i < 160; i++) cachedUndergroundRobots.push(generateRobot(i, 'underground'));
    return cachedUndergroundRobots;
  }

  if (scenario === 'gold') {
    if (cachedGoldRobots) return cachedGoldRobots;
    generateFractureNetwork('gold');
    seed = 7777;
    cachedGoldRobots = [];
    for (let i = 0; i < TOTAL_ROBOTS; i++) cachedGoldRobots.push(generateRobot(i, 'fracture', 'gold'));
    return cachedGoldRobots;
  }

  if (scenario === 'oil') {
    if (cachedOilRobots) return cachedOilRobots;
    generateFractureNetwork('oil');
    seed = 7777;
    cachedOilRobots = [];
    for (let i = 0; i < TOTAL_ROBOTS; i++) cachedOilRobots.push(generateRobot(i, 'fracture', 'oil'));
    return cachedOilRobots;
  }

  if (cachedRobots) return cachedRobots;
  generateFractureNetwork('coal');
  seed = 7777;
  cachedRobots = [];
  for (let i = 0; i < TOTAL_ROBOTS; i++) cachedRobots.push(generateRobot(i, 'fracture', 'coal'));
  return cachedRobots;
}

export function generateMockMonitors(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal'): Monitor[] {
  if (cachedMonitors) return cachedMonitors;
  if (dataSource === 'pipeline') generatePipelineNetwork();
  else if (dataSource === 'nuclear') generateNuclearNetwork();
  else if (dataSource === 'refinery') generateRefineryNetwork();
  else if (dataSource === 'underground') generateUndergroundNetwork();
  else generateFractureNetwork(scenario);
  seed = 9127;
  cachedMonitors = [];
  for (let i = 0; i < TOTAL_MONITORS; i++) cachedMonitors.push(generateMonitor(i, dataSource, scenario));
  return cachedMonitors;
}

export function getMockRobotStats(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const robots = generateMockRobots(dataSource, scenario);
  const online = robots.filter(r => r.status === 'online').length;
  const offline = robots.filter(r => r.status === 'offline').length;
  const lowBattery = robots.filter(r => r.status === 'low_battery').length;
  const error = robots.filter(r => r.status === 'error').length;
  const maintenance = robots.filter(r => r.status === 'maintenance').length;
  const meshConnected = robots.filter(r => r.meshConnected).length;
  const avgBattery = Math.round(robots.reduce((s, r) => s + r.battery, 0) / robots.length);
  return { total: robots.length, online, offline, lowBattery, error, maintenance, meshConnected, avgBattery };
}

export function getMockMonitorStats(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const monitors = generateMockMonitors(dataSource, scenario);
  const online = monitors.filter((m) => m.status === 'online').length;
  const offline = monitors.filter((m) => m.status === 'offline').length;
  const warning = monitors.filter((m) => m.status === 'warning').length;
  const maintenance = monitors.filter((m) => m.status === 'maintenance').length;
  const avgBattery = Math.round(monitors.reduce((sum, monitor) => sum + monitor.battery, 0) / monitors.length);
  return { total: monitors.length, online, offline, warning, maintenance, avgBattery };
}
