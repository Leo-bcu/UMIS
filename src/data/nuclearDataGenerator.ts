/**
 * 核反应堆管网数据生成器 — 基于真实压水堆（PWR）参数
 * 管道位于安全壳内，无岩层。蛛型机器人从维修通道进入巡检。
 *
 * 参考资料（网络检索 2026-06）：
 * - Fushun Special Steel: 热腿ID736mm壁厚70mm, 冷腿ID698mm壁厚63mm, 波动管ID283mm壁厚33mm
 *   材料Z3CN20-09M双相不锈钢(铁素体5-15%)/SS316LN/Inconel 690
 * - NRC PWR: 一回路15.5MPa, 热腿327°C, 冷腿293°C, 每环路~22840m³/h
 * - 二回路: A106 Gr.C DN400-900, 最大280°C/8.6MPa, pH~9, FAC关键风险
 * - ASME Section III: Class 1(一回路)/Class 2(二回路)/Class 3(辅助)
 * - ECCS: 高压安注15.5MPa/低压安注2.5-4MPa/蓄压罐4.2MPa氮气
 */
import type { Fracture, SensorReading } from '../types';
import { seedScenarioAnomalies } from './anomalySeeding';

let _seed = 42;
function sr(): number { _seed = (_seed * 16807) % 2147483647; return _seed / 2147483647; }
function rand(a: number, b: number): number { return a + sr() * (b - a); }
function randInt(a: number, b: number): number { return Math.floor(rand(a, b + 1)); }

type NPC = 'primary' | 'secondary' | 'auxiliary';

const SPECS: Record<NPC, {
  d: [number, number]; wt: [number, number]; mat: string; ys: number;
  op: [number, number]; ot: [number, number]; flow: [number, number]; fac: [number, number];
}> = {
  primary: { d: [283, 737], wt: [33, 80], mat: '双相不锈钢SS316LN', ys: 205, op: [15.5, 15.5], ot: [293, 327], flow: [18000, 25000], fac: [0.001, 0.01] },
  secondary: { d: [250, 900], wt: [12, 50], mat: 'SA-106 Gr.C/P11', ys: 240, op: [5.5, 7.8], ot: [180, 290], flow: [800, 5000], fac: [0.02, 0.15] },
  auxiliary: { d: [50, 350], wt: [4, 25], mat: 'SS316L/SA-106 Gr.B', ys: 205, op: [0.6, 4.2], ot: [35, 95], flow: [20, 800], fac: [0.01, 0.08] },
};

function genSensor(cls: NPC, name: string): SensorReading {
  const s = SPECS[cls];
  const wt = +rand(...s.wt).toFixed(1);
  const op = +rand(...s.op).toFixed(2);
  const temp = +rand(...s.ot).toFixed(1);
  const fac = +rand(...s.fac).toFixed(4);
  const flow = +rand(...s.flow).toFixed(0);

  if (cls === 'primary') {
    const dose = +(sr() > 0.8 ? rand(5, 80) : rand(0.1, 5)).toFixed(2);
    const boron = +rand(300, 1200).toFixed(0);
    const activity = +(sr() > 0.9 ? rand(5, 50) : rand(0.01, 2)).toFixed(2);
    const thermalStress = +(rand(30, 75)).toFixed(1);
    const fatigue = +(rand(0.05, 0.55)).toFixed(3);
    const vib = +(rand(1, 7)).toFixed(2);
    const ph = +rand(6.9, 7.4).toFixed(2);
    const cs137 = +(sr() > 0.85 ? rand(1, 20) : rand(0.01, 0.5)).toFixed(3);
    return {
      ch4_pct: dose, co_ppm: boron / 10, h2s_ppm: activity, temperature_c: temp,
      stress_mpa: op, stress_sigma1: thermalStress, stress_sigma2: flow / 1000, stress_sigma3: s.ys,
      permeability_md: fac, water_pressure_mpa: fatigue * 100, microseismic_count: vib,
      acoustic_emission_mv: randInt(50, 3000), humidity_pct: ph * 10,
      fracture_aperture_um: wt * 1000, displacement_mm: +(rand(0, 20)).toFixed(1),
      rock_strength_mpa: +(rand(0.5, 3)).toFixed(1), pore_pressure_mpa: cs137,
      porosity_pct: +(100 - rand(0.5, 3)).toFixed(1), fluid_ph: ph, water_saturation_pct: +(rand(90, 99.5)).toFixed(1),
    };
  } else if (cls === 'secondary') {
    const facRisk = (name.includes('给水') || name.includes('排水')) ? fac * 2.5 : fac;
    const moisture = +rand(0.1, 1.5).toFixed(2);
    const cond = +(sr() > 0.85 ? rand(0.8, 3) : rand(0.05, 0.4)).toFixed(3);
    const do2 = +(sr() > 0.9 ? rand(50, 500) : rand(1, 10)).toFixed(1);
    const ph = +rand(9.0, 9.6).toFixed(2);
    const thermalStress = +(rand(20, 65)).toFixed(1);
    const fatigue = +(rand(0.05, 0.7)).toFixed(3);
    const vib = +(rand(2, 12)).toFixed(2);
    return {
      ch4_pct: facRisk * 100, co_ppm: do2, h2s_ppm: moisture, temperature_c: temp,
      stress_mpa: op, stress_sigma1: thermalStress, stress_sigma2: flow / 1000, stress_sigma3: s.ys,
      permeability_md: fac, water_pressure_mpa: fatigue * 100, microseismic_count: vib,
      acoustic_emission_mv: randInt(20, 1500), humidity_pct: ph * 10,
      fracture_aperture_um: wt * 1000, displacement_mm: +(rand(0, 30)).toFixed(1),
      rock_strength_mpa: +(rand(1, 8)).toFixed(1), pore_pressure_mpa: +(cond * 0.7).toFixed(3),
      porosity_pct: +(100 - rand(1, 8)).toFixed(1), fluid_ph: ph, water_saturation_pct: +(rand(85, 99)).toFixed(1),
    };
  } else {
    const isEccs = name.includes('安注') || name.includes('蓄压') || name.includes('RHR');
    const dose = +(isEccs ? rand(0.5, 15) : rand(0.01, 1)).toFixed(2);
    const respTime = +(rand(5, 60)).toFixed(1);
    const valveLeak = +(sr() > 0.8 ? rand(2, 15) : rand(0, 0.5)).toFixed(2);
    const ph = +rand(7.0, 9.5).toFixed(2);
    return {
      ch4_pct: dose, co_ppm: respTime, h2s_ppm: valveLeak, temperature_c: temp,
      stress_mpa: op, stress_sigma1: +(rand(15, 50)).toFixed(1), stress_sigma2: flow / 100, stress_sigma3: s.ys,
      permeability_md: +rand(0.01, 0.08).toFixed(3), water_pressure_mpa: +(rand(5, 30)).toFixed(1),
      microseismic_count: +(rand(0.5, 4)).toFixed(2) * 10, acoustic_emission_mv: randInt(10, 500),
      humidity_pct: ph * 10, fracture_aperture_um: wt * 1000, displacement_mm: +(rand(0, 2)).toFixed(2),
      rock_strength_mpa: +(rand(0.5, 5)).toFixed(1), pore_pressure_mpa: +(rand(0.01, 0.5)).toFixed(3),
      porosity_pct: +(100 - rand(0.5, 5)).toFixed(1), fluid_ph: ph, water_saturation_pct: +(rand(88, 99)).toFixed(1),
    };
  }
}

// ==================== 几何布局 ====================
const RPV_HOT_Y = -7, RPV_COLD_Y = -10, NOZ_R = 3.5;
const SG_DIST = 16, RCP_DIST = 9;
const PRZ: [number, number, number] = [8, -2, 8];
const DIRS = [
  { n: '环路1', dx: 0, dz: 1 }, { n: '环路2', dx: 1, dz: 0 },
  { n: '环路3', dx: 0, dz: -1 }, { n: '环路4', dx: -1, dz: 0 },
];

function pipePath(pts: [number, number, number][]): [number, number, number][] {
  const controls = pts.filter((pt, index) => {
    if (index === 0) return true;
    const prev = pts[index - 1];
    return Math.hypot(pt[0] - prev[0], pt[1] - prev[1], pt[2] - prev[2]) > 0.05;
  });
  const result: [number, number, number][] = [controls[0]];
  for (let i = 0; i < controls.length - 1; i++) {
    const [x0, y0, z0] = controls[i], [x1, y1, z1] = controls[i + 1];
    const dist = Math.sqrt((x1-x0)**2 + (y1-y0)**2 + (z1-z0)**2);
    const segs = Math.max(4, Math.floor(dist / 2));
    for (let j = 1; j <= segs; j++) {
      const t = j / segs;
      result.push([
        +(x0 + (x1-x0)*t).toFixed(1),
        +(y0 + (y1-y0)*t).toFixed(1),
        +(z0 + (z1-z0)*t).toFixed(1),
      ]);
    }
  }
  return result.filter((pt, index) => {
    if (index === 0) return true;
    const prev = result[index - 1];
    return Math.hypot(pt[0] - prev[0], pt[1] - prev[1], pt[2] - prev[2]) > 0.05;
  });
}

function sgUTubePath(
  sgIn: [number, number, number],
  sgOut: [number, number, number],
  dx: number,
  dz: number
): [number, number, number][] {
  const side: [number, number, number] = [+(sgIn[0] + dx * 1.8).toFixed(1), -1, +(sgIn[2] + dz * 1.8).toFixed(1)];
  const returnSide: [number, number, number] = [+(sgOut[0] + dx * 1.8).toFixed(1), -8, +(sgOut[2] + dz * 1.8).toFixed(1)];
  return pipePath([sgIn, side, returnSide, sgOut]);
}

function pathLen(p: [number, number, number][]): number {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.sqrt((p[i][0]-p[i-1][0])**2+(p[i][1]-p[i-1][1])**2+(p[i][2]-p[i-1][2])**2);
  return l;
}

function buildPipe(id: number, name: string, path: [number, number, number][], cls: NPC, isMain: boolean): Fracture {
  const s = SPECS[cls];
  const dia = +rand(...s.d).toFixed(0), wt = +rand(...s.wt).toFixed(1);
  const f: Fracture = {
    id: `N-${String(id).padStart(3, '0')}`, name, type: isMain ? 'main' : 'branch', path,
    length: +pathLen(path).toFixed(1), aperture_um: wt * 1000, porosity: +(dia / 1000).toFixed(3),
    fractal_dim: +(rand(2.01, 2.10)).toFixed(4), tortuosity: +(rand(1.01, 1.08)).toFixed(4),
    dip_angle: +rand(0, 90).toFixed(1), azimuth_angle: +rand(0, 360).toFixed(1),
    roughness_coeff: +rand(0.002, 0.02).toFixed(4), connectivity: randInt(2, 5),
    sensorReading: genSensor(cls, name), nodes: [], parentFractureId: null,
  };
  const nc = Math.max(3, Math.floor(path.length / 2.5));
  for (let i = 0; i < nc; i++) {
    const pi = Math.floor((i / nc) * (path.length - 1));
    f.nodes.push({ id: `${f.id}-N${i}`, position: path[pi], sensors: genSensor(cls, name), timestamp: Date.now() - randInt(0, 300000), robotId: null });
  }
  return f;
}

// ==================== 管网生成 ====================
let cached: Fracture[] | null = null;
let cachedPaths: [number, number, number][] = [];

export function generateNuclearNetwork(): Fracture[] {
  if (cached) return cached;
  _seed = 42;
  const pipes: Fracture[] = [];
  let id = 0;

  // 4环路 × (热腿+冷腿+SG传热管+主蒸汽+给水+SG连接) = 24条主管
  for (let l = 0; l < 4; l++) {
    const { dx, dz, n } = DIRS[l];
    const hotNoz: [number, number, number] = [+(NOZ_R*dx).toFixed(1), RPV_HOT_Y, +(NOZ_R*dz).toFixed(1)];
    const coldNoz: [number, number, number] = [+(NOZ_R*dx).toFixed(1), RPV_COLD_Y, +(NOZ_R*dz).toFixed(1)];
    const sgC: [number, number, number] = [+(SG_DIST*dx).toFixed(1), -5, +(SG_DIST*dz).toFixed(1)];
    const sgIn: [number, number, number] = [+((SG_DIST-2)*dx).toFixed(1), -3, +((SG_DIST-2)*dz).toFixed(1)];
    const sgOut: [number, number, number] = [+((SG_DIST-2)*dx).toFixed(1), -12, +((SG_DIST-2)*dz).toFixed(1)];

    // 热腿
    pipes.push(buildPipe(id++, `${n}-热腿`, pipePath([hotNoz, [+(RCP_DIST*dx).toFixed(1), RPV_HOT_Y, +(RCP_DIST*dz).toFixed(1)], [+((SG_DIST-4)*dx).toFixed(1), RPV_HOT_Y+1, +((SG_DIST-4)*dz).toFixed(1)], sgIn]), 'primary', true));
    // 冷腿
    pipes.push(buildPipe(id++, `${n}-冷腿`, pipePath([sgOut, [+((RCP_DIST+1)*dx).toFixed(1), -13, +((RCP_DIST+1)*dz).toFixed(1)], [+(RCP_DIST*dx).toFixed(1), -14, +(RCP_DIST*dz).toFixed(1)], [+((RCP_DIST-3)*dx).toFixed(1), -11, +((RCP_DIST-3)*dz).toFixed(1)], coldNoz]), 'primary', true));
    // SG传热管 — 连接热腿出口到冷腿入口，使一回路环路闭合
    pipes.push(buildPipe(id++, `${n}-SG传热管`, sgUTubePath(sgIn, sgOut, dx, dz), 'primary', true));
    // 主蒸汽 — 从SG顶部引出
    pipes.push(buildPipe(id++, `${n}-主蒸汽`, pipePath([[sgC[0], 4, sgC[2]], [sgC[0], 6, sgC[2]], [sgC[0]+dx*8, 8, sgC[2]+dz*8]]), 'secondary', true));
    // SG顶部到主蒸汽连接
    pipes.push(buildPipe(id++, `${n}-SG汽侧出口`, pipePath([[+((SG_DIST-2)*dx).toFixed(1), 0, +((SG_DIST-2)*dz).toFixed(1)], [sgC[0], 2, sgC[2]], [sgC[0], 4, sgC[2]]]), 'secondary', false));
    // 主给水 — 从外部进入SG
    pipes.push(buildPipe(id++, `${n}-主给水`, pipePath([[sgC[0]+dx*8, -8, sgC[2]+dz*8], [sgC[0]+dx*4, -8, sgC[2]+dz*4], sgC]), 'secondary', true));
    // 给水到SG冷侧连接
    pipes.push(buildPipe(id++, `${n}-给水→SG冷侧`, pipePath([sgC, [+((SG_DIST-2)*dx).toFixed(1), -8, +((SG_DIST-2)*dz).toFixed(1)]]), 'secondary', false));
  }

  // RPV堆芯 — 连接所有4环路的热腿/冷腿喷嘴
  // 热腿环管（半径=NOZ_R的圆环，连接所有热腿喷嘴）
  const rpvRingHot: [number, number, number][] = [];
  for (let a = 0; a <= 360; a += 15) {
    const rad = a * Math.PI / 180;
    rpvRingHot.push([+(NOZ_R * Math.cos(rad)).toFixed(1), RPV_HOT_Y, +(NOZ_R * Math.sin(rad)).toFixed(1)]);
  }
  pipes.push(buildPipe(id++, 'RPV热腿分配环管', rpvRingHot, 'primary', true));
  // 冷腿环管
  const rpvRingCold: [number, number, number][] = [];
  for (let a = 0; a <= 360; a += 15) {
    const rad = a * Math.PI / 180;
    rpvRingCold.push([+(NOZ_R * Math.cos(rad)).toFixed(1), RPV_COLD_Y, +(NOZ_R * Math.sin(rad)).toFixed(1)]);
  }
  pipes.push(buildPipe(id++, 'RPV冷腿分配环管', rpvRingCold, 'primary', true));
  // RPV堆芯竖管 — 连接热腿环和冷腿环（从环上一点到对侧环上一点）
  pipes.push(buildPipe(id++, 'RPV堆芯下降段', pipePath([[NOZ_R, RPV_HOT_Y, 0], [NOZ_R, RPV_COLD_Y, 0]]), 'primary', true));

  // 波动管
  pipes.push(buildPipe(id++, '稳压器波动管', pipePath([[0, RPV_HOT_Y, 10], [4, -5, 9], PRZ]), 'primary', false));
  // 稳压器卸压管
  pipes.push(buildPipe(id++, '稳压器卸压管', pipePath([[PRZ[0], 2, PRZ[2]], [PRZ[0], 0, PRZ[2]], [PRZ[0], -18, PRZ[2]]]), 'auxiliary', false));
  // 稳压器喷雾管
  pipes.push(buildPipe(id++, '稳压器喷雾管', pipePath([[-3.5, RPV_COLD_Y, 0], [-4, -8, 2], [PRZ[0]-2, 0, PRZ[2]-2]]), 'auxiliary', false));

  // ECCS高压安注管 ×4
  for (let l = 0; l < 4; l++) {
    const { dx, dz, n } = DIRS[l];
    pipes.push(buildPipe(id++, `${n}-高压安注管`, pipePath([[+(dx*(SG_DIST+4)).toFixed(1), -16, +(dz*(SG_DIST+4)).toFixed(1)], [+(dx*(SG_DIST+4)).toFixed(1), -16, +(dz*RCP_DIST).toFixed(1)], [+(dx*RCP_DIST).toFixed(1), -12, +(dz*RCP_DIST).toFixed(1)]]), 'auxiliary', false));
  }

  // RHR余热排出
  pipes.push(buildPipe(id++, 'RHR余热排出-热段注入', pipePath([[6, -16, -6], [3, -14, -4], [0, RPV_HOT_Y, -3.5]]), 'auxiliary', false));
  pipes.push(buildPipe(id++, 'RHR余热排出-冷段注入', pipePath([[-6, -16, 6], [-3, -14, 4], [-3.5, RPV_COLD_Y, 0]]), 'auxiliary', false));

  // 蓄压罐注射管
  pipes.push(buildPipe(id++, '蓄压罐注射管-1', pipePath([[4, -16, 4], [2, -15, 5], [0, -12, 6]]), 'auxiliary', false));
  pipes.push(buildPipe(id++, '蓄压罐注射管-3', pipePath([[-4, -16, -4], [-2, -15, -5], [0, -12, -6]]), 'auxiliary', false));

  // CVCS化容系统
  pipes.push(buildPipe(id++, 'CVCS下泄管', pipePath([[3, RPV_COLD_Y, 2], [6, -12, 3], [10, -16, 4]]), 'auxiliary', false));
  pipes.push(buildPipe(id++, 'CVCS上充管', pipePath([[10, -16, -4], [6, -12, -3], [3, RPV_COLD_Y, -2]]), 'auxiliary', false));

  // CCWS设备冷却水
  pipes.push(buildPipe(id++, 'CCWS冷却供水-环路1', pipePath([[20, -16, 10], [10, -15, 10], [0, -14, 9]]), 'auxiliary', false));
  pipes.push(buildPipe(id++, 'CCWS冷却回水-环路1', pipePath([[0, -14, 9], [10, -15, 12], [22, -16, 12]]), 'auxiliary', false));
  pipes.push(buildPipe(id++, 'CCWS冷却供水-环路3', pipePath([[-20, -16, -10], [-10, -15, -10], [0, -14, -9]]), 'auxiliary', false));

  // 蒸汽发生器排污管 — 从环路1/3的SG冷侧出口引出
  pipes.push(buildPipe(id++, 'SG排污管-环路1', pipePath([[0, -12, 14], [0, -12, 22], [4, -14, 24]]), 'secondary', false));
  pipes.push(buildPipe(id++, 'SG排污管-环路3', pipePath([[0, -12, -14], [0, -12, -22], [-4, -14, -24]]), 'secondary', false));

  // 分配机器人到节点
  assignRobots(pipes);
  const sanitized = seedScenarioAnomalies(pipes, 'nuclear');

  cached = sanitized;
  cachedPaths = sanitized.flatMap(p => p.path);
  return sanitized;
}

function assignRobots(pipes: Fracture[]): void {
  let ri = 0;
  for (const p of pipes) {
    for (const n of p.nodes) {
      if (ri < 180 && sr() > 0.2) n.robotId = `R-${String(++ri).padStart(3, '0')}`;
    }
  }
}

export function getAllNuclearPathPoints(): [number, number, number][] { return cachedPaths; }

export function getNuclearSensorSummary(): string {
  return `当前数据源: 模拟数据三·核反应堆
堆型: 压水堆(PWR) 四环路 1000MWe
一回路(Class 1): 15.5MPa, 热腿327°C/冷腿293°C, DN698-737mm, 双相不锈钢SS316LN, 每环路~22840m³/h
二回路(Class 2): 主蒸汽5.5-7.8MPa/280°C DN250-900, A106 Gr.C, FAC关键风险
辅助系统(Class 2/3): ECCS安注/CVCS化容/CCWS设备冷却
安全阈值:
- 剂量率: 25 mSv/h (控制区管理目标)
- 疲劳使用因子: 0.6 (ASME 要求 <1.0)
- FAC速率: 0.1 mm/yr (EPRI 关注阈值)
- 振动: 7.1 mm/s (ISO 10816 C级报警)
- 冷却剂活度: 5 Bq/mL (包壳破损判据)
机器人: 蛛型(Spider), 耐辐照设计, 管道内壁爬行巡检`;
}
