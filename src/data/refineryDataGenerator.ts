/**
 * 化工储罐/反应釜密闭空间检测数据生成器
 *
 * 核心对象（微型机器人深入内部巡检）：
 * 1. 储罐罐底/罐壁 (Storage Tank)
 * 2. 反应釜内壁/搅拌轴周边 (Reactor Vessel)
 * 3. 人孔、底部沉积物和死角区域
 *
 * 应用场景：密闭空间进入前/替代人工进入检测，关注 H2S、VOC、O2、LEL、壁厚和腐蚀。
 * 机器人类型：蛇形/履带/爬壁小型机器人，允许不可回收或低成本牺牲模式。
 */

import type { Fracture, SensorReading } from '../types';
import { seedScenarioAnomalies } from './anomalySeeding';

let _seed = 99;
function sr(): number { _seed = (_seed * 16807) % 2147483647; return _seed / 2147483647; }
function rand(min: number, max: number): number { return min + sr() * (max - min); }
function randRange(range: readonly [number, number]): number { return rand(range[0], range[1]); }
function randInt(min: number, max: number): number { return Math.floor(rand(min, max + 1)); }
function r1(v: number): number { return Math.round(v * 10) / 10; }

const CHANNEL_SPECS = {
  heater_tube: { diameter_mm: [800, 1800], wall_thickness_mm: [8, 18], operating_temp_c: [18, 55], operating_pressure_mpa: [0.02, 0.6], corrosion_rate_mmyear: [0.05, 0.6], material: ['Q235B', '16MnR', 'SS304'], yield_strength_mpa: [235, 355], design_temp_c: [80, 120] },
  exchanger_tube: { diameter_mm: [1500, 3200], wall_thickness_mm: [10, 24], operating_temp_c: [18, 58], operating_pressure_mpa: [0.05, 1.6], corrosion_rate_mmyear: [0.04, 0.45], material: ['SS304', 'SS316L', 'Q345R'], yield_strength_mpa: [205, 410], design_temp_c: [80, 150] },
  exchanger_shell: { diameter_mm: [4000, 9000], wall_thickness_mm: [12, 30], operating_temp_c: [15, 45], operating_pressure_mpa: [0.0, 0.2], corrosion_rate_mmyear: [0.03, 0.35], material: ['Q235B', 'Q345R', 'SS316L'], yield_strength_mpa: [235, 410], design_temp_c: [60, 120] },
  column_internal: { diameter_mm: [600, 1800], wall_thickness_mm: [6, 16], operating_temp_c: [18, 60], operating_pressure_mpa: [0.02, 1.2], corrosion_rate_mmyear: [0.05, 0.7], material: ['SS304', 'SS316L', 'Q345R'], yield_strength_mpa: [205, 410], design_temp_c: [80, 160] },
  process_pipe: { diameter_mm: [150, 600], wall_thickness_mm: [5, 14], operating_temp_c: [18, 55], operating_pressure_mpa: [0.05, 1.0], corrosion_rate_mmyear: [0.05, 0.5], material: ['20#', 'SS316L', 'Q345R'], yield_strength_mpa: [205, 355], design_temp_c: [80, 140] },
} as const;
type ChannelClass = keyof typeof CHANNEL_SPECS;

function genRefinerySensorReading(cc: ChannelClass): SensorReading {
  const s = CHANNEL_SPECS[cc];
  const wt = +randRange(s.wall_thickness_mm).toFixed(1);
  const temp = +randRange(s.operating_temp_c).toFixed(1);
  const pressure = +randRange(s.operating_pressure_mpa).toFixed(2);
  const corr = +randRange(s.corrosion_rate_mmyear).toFixed(3);
  const dtemp = +randRange(s.design_temp_c).toFixed(0);
  const thinning = +(corr * rand(3, 15)).toFixed(1);
  const oxygen = +(sr() > 0.96 ? rand(17.8, 19.0) : rand(19.7, 21.2)).toFixed(1);
  const voc = +(sr() > 0.9 ? rand(180, 760) : rand(0, 110)).toFixed(0);
  const vib = randInt(2, 55);
  const ae = randInt(0, 6000);
  const leak = +(sr() > 0.92 ? rand(10, 24) : rand(0, 7)).toFixed(1);
  const h2s = +(sr() > 0.9 ? rand(22, 48) : rand(0, 18)).toFixed(0);
  const co = +(sr() > 0.75 ? rand(20, 120) : rand(0, 18)).toFixed(0);
  return {
    ch4_pct: leak, co_ppm: co, h2s_ppm: h2s, temperature_c: temp,
    stress_mpa: oxygen, stress_sigma1: +rand(30, 88).toFixed(0), stress_sigma2: thinning, stress_sigma3: dtemp,
    permeability_md: corr, water_pressure_mpa: pressure, microseismic_count: vib,
    acoustic_emission_mv: ae, humidity_pct: +rand(50, 98).toFixed(1), fracture_aperture_um: Math.round(wt * 1000),
    displacement_mm: +rand(0, 12).toFixed(1), rock_strength_mpa: thinning, pore_pressure_mpa: +rand(0.05, 0.3).toFixed(2),
    porosity_pct: +(100 - thinning).toFixed(1), fluid_ph: +rand(4.5, 9.0).toFixed(1), water_saturation_pct: voc,
  };
}

function hPath(s: [number, number, number], e: [number, number, number], segs = 10): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs; const sag = Math.sin(t * Math.PI) * 0.3;
    if (i === 0) { pts.push([...s]); continue; }
    if (i === segs) { pts.push([...e]); continue; }
    pts.push([r1(s[0]+(e[0]-s[0])*t), r1(s[1]+(e[1]-s[1])*t-sag), r1(s[2]+(e[2]-s[2])*t)]); }
  return pts;
}
function vPath(b: [number, number, number], top: [number, number, number], segs = 10): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs; const sw = Math.sin(t * Math.PI * 2) * 0.2;
    if (i === 0) { pts.push([...b]); continue; }
    if (i === segs) { pts.push([...top]); continue; }
    pts.push([r1(b[0]+(top[0]-b[0])*t+sw), r1(b[1]+(top[1]-b[1])*t), r1(b[2]+(top[2]-b[2])*t)]); }
  return pts;
}
function uTube(bA:[number,number,number],tA:[number,number,number],tB:[number,number,number],bB:[number,number,number]): [number,number,number][] {
  const p1 = vPath(bA, tA, 6); const ep: [number,number,number][] = [];
  for (let i=1;i<5;i++){const t=i/5;const a=Math.PI*t;ep.push([r1(tA[0]+(tB[0]-tA[0])*(1-Math.cos(a))/2),r1(tA[1]+2*Math.sin(a)),r1(tA[2]+(tB[2]-tA[2])*(1-Math.cos(a))/2)]);}
  const p2 = vPath(tB, bB, 6); return [...p1, ...ep, ...p2.slice(1)];
}
function spiralPath(c:[number,number,number],rad:number,yS:number,yE:number,turns:number,segs=40): [number,number,number][] {
  const pts:[number,number,number][]=[];const ta=turns*Math.PI*2;
  for(let i=0;i<=segs;i++){const t=i/segs;const a=ta*t;pts.push([r1(c[0]+rad*Math.cos(a)),r1(yS+(yE-yS)*t),r1(c[2]+rad*Math.sin(a))]);}
  return pts;
}
function elbowPath(s:[number,number,number],e:[number,number,number]): [number,number,number][] {
  const c:[number,number,number]=[e[0],s[1],e[2]]; return [...hPath(s,c),...hPath(c,e).slice(1)];
}
function pathLen(p:[number,number,number][]):number{let l=0;for(let i=1;i<p.length;i++){const dx=p[i][0]-p[i-1][0],dy=p[i][1]-p[i-1][1],dz=p[i][2]-p[i-1][2];l+=Math.sqrt(dx*dx+dy*dy+dz*dz);}return l;}

let _id = 0;
function buildChannel(path: [number,number,number][], cc: ChannelClass, isMain: boolean, name: string): Fracture {
  const s = CHANNEL_SPECS[cc]; const id = _id++; const dia = Math.round(randRange(s.diameter_mm)); const wt = +randRange(s.wall_thickness_mm).toFixed(1);
  const f: Fracture = {
    id: `R-${String(id).padStart(3,'0')}`, name, type: isMain?'main':'branch', path, length:+pathLen(path).toFixed(1),
    aperture_um: Math.round(wt*1000), porosity: +(dia/1000).toFixed(3), fractal_dim:+(rand(2.01,2.30)).toFixed(4),
    tortuosity:+(rand(1.02,1.25)).toFixed(4), dip_angle:+(rand(0,25)).toFixed(1), azimuth_angle:+(rand(0,360)).toFixed(1),
    roughness_coeff:+(rand(0.01,0.08)).toFixed(3), connectivity: randInt(2,5),
    sensorReading: genRefinerySensorReading(cc), nodes: [], parentFractureId: null,
  };
  const nc = Math.max(3, Math.floor(path.length/3));
  for (let i=0;i<nc;i++){const pi=Math.floor((i/nc)*(path.length-1));
    f.nodes.push({id:`${f.id}-N${i}`,position:path[pi],sensors:genRefinerySensorReading(cc),timestamp:Date.now()-randInt(0,300000),robotId:null});}
  return f;
}

function assignSnakes(channels: Fracture[]) {
  const nodes = channels.flatMap(c => c.nodes); const count = Math.floor(nodes.length * 0.3);
  for (let i=0;i<count;i++){const idx=randInt(0,nodes.length-1);if(!nodes[idx].robotId) nodes[idx].robotId=`SNAKE-${String(randInt(1,120)).padStart(3,'0')}`;}
}

let cachedChannels: Fracture[] | null = null;
let cachedPathPoints: [number,number,number][] = [];
export function getAllRefineryPathPoints(): [number,number,number][] { if(!cachedChannels) generateRefineryNetwork(); return cachedPathPoints; }

export function generateRefineryNetwork(): Fracture[] {
  if (cachedChannels) return cachedChannels;
  _seed = 99; _id = 0; const ch: Fracture[] = [];

  // === 1. 储罐/反应釜组 ===
  const exZ = [-12,-4,4,12]; const exY = -10;
  for (let ei=0; ei<exZ.length; ei++) {
    const z=exZ[ei]; const n=`E-${101+ei}`;
    const laneOffset = (ei - 1.5) * 0.35;
    ch.push(buildChannel(hPath([-30,exY+1.5+laneOffset,z],[-28,exY+1.5+laneOffset,z],4),'exchanger_shell',false,`${n}入口集合管`));
    const tc = 2+ei;
    for (let ti=0;ti<tc;ti++){const ty=exY+ti*0.8;const tz=z+(ti-tc/2)*0.3;
      ch.push(buildChannel(hPath([-28,ty,tz],[-8,ty,tz],14),'exchanger_tube',false,`${n}内壁段-${String.fromCharCode(65+ti)}`));}
    ch.push(buildChannel(hPath([-28,exY+2.5,z],[-8,exY+2.5,z],14),'exchanger_shell',false,`${n}罐内空间`));
    ch.push(buildChannel(hPath([-8,exY,z],[-6,exY,z],3),'process_pipe',false,`${n}排放/人孔出口`));
  }

  // === 1b. 人孔/入口集合 + 机器人入口 ===
  // 机器人检修入口总管 — 从场景外部接入
  ch.push(buildChannel(hPath([-36,exY+1.5,0],[-30,exY+1.5,0],4),'process_pipe',true,'机器人检修入口总管'));
  ch.push(buildChannel(hPath([-30,exY+1.5,-12],[-30,exY+1.5,12],14),'process_pipe',true,'人孔入口集合总管'));
  ch.push(buildChannel(hPath([-6,exY,-12],[-6,exY,12],14),'process_pipe',true,'出口/排放集合总管'));

  // === 2. 反应釜/罐体内部区 ===
  const hx=-2, hby=-8, hry=2, cy1=4, cy2=6, cy3=8;
  // 立管 — 从入口集合管进入罐内
  ch.push(buildChannel(vPath([-6,exY,0],[-6,hby,0],5),'process_pipe',true,'人孔→罐体入口立管'));
  // 入口分配管 — 连接罐内不同区域
  ch.push(buildChannel(hPath([-6,hby,0],[hx-5,hby,0],4),'process_pipe',true,'罐内入口分配管'));
  // 罐内多段通道/盘管
  ch.push(buildChannel(hPath([hx-7,hby,-6],[hx+5,hby,-6],10),'heater_tube',true,'罐内通道-北'));
  ch.push(buildChannel(hPath([hx-7,hby,6],[hx+5,hby,6],10),'heater_tube',true,'罐内通道-南'));
  ch.push(buildChannel(hPath([4,hby,-6],[4,hby,6],10),'heater_tube',true,'罐内通道-东'));
  ch.push(buildChannel(hPath([-8,hby,-6],[-8,hby,6],10),'heater_tube',true,'罐内通道-西'));
  ch.push(buildChannel(hPath([hx-5,hby,0],[hx-5,hby,-6],3),'heater_tube',true,'罐内入口汇集-北'));
  ch.push(buildChannel(hPath([hx-5,hby,0],[hx-5,hby,6],3),'heater_tube',true,'罐内入口汇集-南'));
  const rads = [['北墙',null,-6],['南墙',null,6],['东墙',4,null],['西墙',-8,null]] as const;
  for (const [wall,x,z] of rads) {
    for (let ui=0;ui<2;ui++) {
      if (z!==null) {
        const xs=hx-5+ui*3;
        ch.push(buildChannel(uTube([xs,hby,z],[xs,hry,z],[xs+1.5,hry,z],[xs+1.5,hby,z]),'heater_tube',true,`${wall}-通道-${ui+1}`));
      } else {
        const zs=-4+ui*3;
        ch.push(buildChannel(uTube([x!,hby,zs],[x!,hry,zs],[x!,hry,zs+1.5],[x!,hby,zs+1.5]),'heater_tube',true,`${wall}-通道-${ui+1}`));
      }
    }
  }
  // 罐内顶部回流/排气集合
  ch.push(buildChannel(hPath([hx-7,hry,-6],[hx+5,hry,-6],10),'heater_tube',true,'罐内顶部集合-北'));
  ch.push(buildChannel(hPath([hx-7,hry,6],[hx+5,hry,6],10),'heater_tube',true,'罐内顶部集合-南'));
  ch.push(buildChannel(hPath([4,hry,-6],[4,hry,6],10),'heater_tube',true,'罐内顶部集合-东'));
  ch.push(buildChannel(hPath([-8,hry,-6],[-8,hry,6],10),'heater_tube',true,'罐内顶部集合-西'));
  ch.push(buildChannel(vPath([hx-7,hry,0],[hx-7,cy1,0],4),'heater_tube',true,'罐内跨层通道'));
  // 竖向连接区
  for (let ci=0;ci<3;ci++){const cy=[cy1,cy2,cy3][ci];
    ch.push(buildChannel(hPath([hx-7,cy,-4],[hx+3,cy,4],14),'heater_tube',true,`罐内通道-第${ci+1}层`));
    if (ci<2) ch.push(buildChannel(vPath([hx+3,cy,4],[hx+3,[cy2,cy3][ci],4],3),'heater_tube',true,`罐内跨层-${ci+1}→${ci+2}`));}
  // 顶部回收/出口
  ch.push(buildChannel(hPath([hx+3,cy3,4],[hx+3,cy3,0],3),'process_pipe',true,'罐内顶部出口弯管'));
  ch.push(buildChannel(hPath([hx+3,cy3,0],[10,cy3,0],6),'process_pipe',true,'罐体出口总管'));

  // === 3. 储罐/反应釜另一舱 ===
  const cx=18, cby=-5, cty=35, cr=4, tr=3.2;
  ch.push(buildChannel(elbowPath([10,cy3,0],[cx-cr,12,0]),'process_pipe',true,'罐体连通管'));
  // 进料分配器 — 从进料管终点连接到螺旋通道底部
  ch.push(buildChannel(hPath([cx-cr,12,0],[cx-tr,12,0],3),'column_internal',true,'反应釜入口分配器'));
  ch.push(buildChannel(vPath([cx-tr,12,0],[cx-tr,14,0],3),'column_internal',true,'反应釜竖向通道'));
  ch.push(buildChannel(spiralPath([cx,0,0],tr,14,cty-2,4,40),'column_internal',true,'反应釜螺旋通道-A'));
  ch.push(buildChannel(spiralPath([cx,0,0],tr*0.85,cby+2,12,3,30),'column_internal',true,'反应釜螺旋通道-B'));
  // 螺旋通道→降液管 连接（精馏段顶部到降液管A顶，汽提段到降液管B底）
  ch.push(buildChannel(hPath([cx+tr,cty-2,0],[cx-2,cty-2,0],3),'column_internal',true,'反应釜上部连通段-A'));
  ch.push(buildChannel(hPath([cx+tr*0.85,12,0],[cx+1.5,12,0],3),'column_internal',true,'反应釜上部连通段-B'));
  ch.push(buildChannel(hPath([cx+cr,cty,0],[cx,cty-3,0],6),'column_internal',true,'反应釜回流管'));
  ch.push(buildChannel(hPath([cx,cty,0],[cx+tr,cty,0],3),'column_internal',true,'反应釜顶部内连接'));
  ch.push(buildChannel(hPath([cx,cty,0],[cx+8,cty,0],6),'column_internal',false,'反应釜顶部出口'));
  // 侧线抽出从螺旋通道引出（连接管）
  ch.push(buildChannel(hPath([cx+tr,18,1.2],[cx+cr,18,1.2],2),'column_internal',false,'反应釜侧线-A'));
  ch.push(buildChannel(hPath([cx+cr,18,1.2],[cx+8,18,3.6],5),'column_internal',false,'反应釜侧线-B'));
  ch.push(buildChannel(hPath([cx+tr,8,-1.4],[cx+cr,8,-1.4],2),'column_internal',false,'反应釜侧线-C'));
  ch.push(buildChannel(hPath([cx+cr,8,-1.4],[cx+8,8,-3.8],5),'column_internal',false,'反应釜侧线-D'));
  // 汽提段底部→塔底抽出
  ch.push(buildChannel(vPath([cx-tr*0.85,12,0],[cx-tr*0.85,cby,0],4),'column_internal',false,'反应釜底部连通段'));
  ch.push(buildChannel(hPath([cx,cby,0],[cx+8,cby,0],5),'column_internal',false,'反应釜底部出口'));
  ch.push(buildChannel(vPath([cx-2.6,22,2.2],[cx-2.6,10,2.2],8),'column_internal',false,'反应釜竖向通道-A'));
  ch.push(buildChannel(vPath([cx+2.2,16,-2.6],[cx+2.2,4,-2.6],8),'column_internal',false,'反应釜竖向通道-B'));

  // === 4. 闭合回路 ===
  ch.push(buildChannel(hPath([cx+8,cby,0],[cx+8,cby,-9],4),'process_pipe',true,'罐底回流汇集管'));
  ch.push(buildChannel(hPath([cx+8,cby,-9],[-30,cby,-9],20),'process_pipe',true,'罐体回流总管'));
  ch.push(buildChannel(elbowPath([-30,cby,-9],[-30,exY+2.5,-12]),'process_pipe',true,'回流管→罐体入口'));

  assignSnakes(ch);
  const sanitized = seedScenarioAnomalies(ch, 'refinery');
  cachedChannels = sanitized;
  cachedPathPoints = sanitized.flatMap(c => c.path);
  return sanitized;
}
