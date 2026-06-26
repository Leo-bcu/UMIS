import jsPDF from 'jspdf';
import type { Robot, Fracture, POI, Annotation, ChatMessage, LayerState, ScenarioType } from '../types';
import type { SceneStats, RobotFleetStats } from '../types/api';
import type { AlertEvent } from '../data/alertDataGenerator';
import type { Finding } from '../domain/findingTypes';
import { TRUTH_BOUNDARY_LABELS } from '../domain/findingTypes';
import { getSceneSemantics } from './sceneSemantics';
import { buildSceneMetricSummary } from '../domain/sceneMetricSummary';

export interface ReportData {
  gasThreshold: number;
  confidenceFilter: number;
  layers: LayerState;
  scenario: ScenarioType;
  stats: SceneStats | null;
  robots: Robot[] | null;
  robotStats: RobotFleetStats | null;
  alerts: AlertEvent[] | null;
  fractures: Fracture[];
  pois: POI[];
  annotations: Annotation[];
  findings: Finding[];
  messages: ChatMessage[];
  cameraInfo: { x: number; y: number; z: number; dist: number };
}

// ── 布局常量 ──
const PW = 210, PH = 297, MG = 15, CW = PW - MG * 2, BTM = 25;

// ── 颜色 ──
type RGB = [number, number, number];

const C: Record<string, RGB> = {
  bg: [8, 8, 18], panel: [20, 20, 32], yellow: [255, 230, 0], orange: [255, 165, 0],
  red: [255, 51, 51], green: [0, 255, 102], blue: [77, 166, 255],
  text: [224, 224, 232], muted: [160, 160, 176], dim: [100, 100, 120], line: [40, 40, 55],
};
const SC: Record<Robot['status'], RGB> = { online: C.green, offline: C.dim, low_battery: C.orange, error: C.red, maintenance: C.blue };
const SL = { online: '在线', offline: '离线', low_battery: '低电量', error: '故障', maintenance: '维护中' };
const ML = { tracked: '履带', wheeled: '轮式', climbing: '攀爬', snake: '蛇形', aerial: '飞行', spider: '蛛型', floatwalker: '浮走' };
const MS = { gateway: '网关', relay: '中继', edge: '边缘', leaf: '叶节点' };
const SG: Record<ScenarioType, string> = {
  coal: '煤矿',
  gold: '金矿',
  oil: '油气',
  pipeline: '小口径管道',
  nuclear: '核反应堆',
  refinery: '化工密闭空间',
  underground: '地下暗流',
};

// ── 图片压缩 PNG → JPEG ──
async function compressImg(dataUrl: string, maxW = 1600, q = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const ctx = c.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.fillStyle = '#08081A'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ── SHA-256 ──
async function sha256(data: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ── 绘制辅助 ──
function fillR(p: jsPDF, x: number, y: number, w: number, h: number, c: RGB) { p.setFillColor(...c); p.rect(x, y, w, h, 'F'); }
function line(p: jsPDF, x1: number, y1: number, x2: number, y2: number, c: RGB) { p.setDrawColor(...c); p.setLineWidth(0.2); p.line(x1, y1, x2, y2); }

class PDFDoc {
  p: jsPDF; y: number;
  constructor() { this.p = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); this.y = MG; }
  newPage() { this.p.addPage(); fillR(this.p, 0, 0, PW, PH, C.bg); this.y = MG; }
  ensure(space: number) { if (this.y + space > PH - BTM) this.newPage(); }
  section(title: string) {
    this.ensure(12);
    fillR(this.p, MG, this.y, CW, 0.6, C.yellow);
    this.p.setTextColor(...C.yellow); this.p.setFontSize(11); this.p.setFont('helvetica', 'bold');
    this.p.text(title, MG, this.y + 5); this.y += 9;
  }
  kv(label: string, val: string, vc?: RGB) {
    this.ensure(8);
    this.p.setFontSize(9); this.p.setFont('helvetica', 'normal'); this.p.setTextColor(...C.muted);
    this.p.text(label, MG + 2, this.y);
    this.p.setTextColor(...(vc ?? C.text)); this.p.setFont('helvetica', 'bold');
    this.p.text(val, MG + 60, this.y); this.y += 5.5;
  }
  tableHeader(cols: { t: string; w: number }[]) {
    this.ensure(8);
    fillR(this.p, MG, this.y - 4, CW, 7, [30, 30, 45]);
    let x = MG + 2;
    this.p.setFontSize(8); this.p.setFont('helvetica', 'bold'); this.p.setTextColor(...C.yellow);
    for (const c of cols) { this.p.text(c.t, x, this.y); x += c.w; }
    this.y += 6;
  }
  row(cols: { t: string; w: number; c?: RGB; b?: boolean }[], bg?: RGB) {
    this.ensure(7);
    if (bg) fillR(this.p, MG, this.y - 4, CW, 6, bg);
    let x = MG + 2; this.p.setFontSize(8);
    for (const c of cols) {
      this.p.setTextColor(...(c.c ?? C.text)); this.p.setFont('helvetica', c.b ? 'bold' : 'normal');
      this.p.text(c.t, x, this.y); x += c.w;
    }
    this.y += 6;
  }
}

// ── 主函数 ──
export async function exportPDF(screenshotFn: (() => string | null) | null, d: ReportData) {
  const doc = new PDFDoc();
  const p = doc.p;
  const semantics = getSceneSemantics(d.scenario);
  const robotTelemetry = semantics.robotTelemetry;
  const metricSummary = buildSceneMetricSummary(d.fractures, d.scenario, d.gasThreshold);

  // ── 封面 ──
  fillR(p, 0, 0, PW, PH, C.bg);
  fillR(p, 0, 0, PW, 5, C.yellow);
  fillR(p, MG, 18, 12, 12, C.yellow);
  p.setTextColor(...C.bg); p.setFontSize(14); p.setFont('helvetica', 'bold'); p.text('H', MG + 3, 27);
  p.setTextColor(...C.yellow); p.setFontSize(26); p.text('HIVE', MG + 17, 27);
  p.setFontSize(10); p.setTextColor(...C.muted); p.setFont('helvetica', 'normal');
  p.text('群智数字孪生主控舱 | DIGITAL TWIN CONTROL CABIN', MG + 17, 33);
  line(p, MG, 40, PW - MG, 40, C.line);

  p.setTextColor(...C.text); p.setFontSize(20); p.setFont('helvetica', 'bold');
  p.text('安全巡检报告', MG, 55);
  p.setFontSize(10); p.setFont('helvetica', 'normal'); p.setTextColor(...C.muted);
  p.text('Safety Inspection Report', MG, 61);

  fillR(p, MG, 68, CW, 42, C.panel);
  doc.y = 76;
  doc.kv('生成时间', new Date().toLocaleString('zh-CN'));
  doc.kv('行业场景', SG[d.scenario] ?? d.scenario);
  doc.kv('数据模式', d.stats?.onlineSensors != null ? '实时 (Live)' : '仿真 (Mock)');
  doc.kv('场景节点', String(d.stats?.totalNodes ?? '-'));
  doc.kv('在线机器人', `${d.robotStats?.online ?? '-'}/${d.robotStats?.total ?? '-'}`);
  doc.kv('活跃告警', String(d.alerts?.filter((a) => !a.acknowledged).length ?? '-'),
    (d.alerts?.filter((a) => a.level === 'danger' && !a.acknowledged).length ?? 0) > 0 ? C.red : C.green);

  // ── 截图 ──
  doc.y = 120;
  doc.section('3D 场景快照');
  if (screenshotFn) {
    const raw = screenshotFn();
    if (raw) {
      try {
        const compressed = await compressImg(raw, 1600, 0.6);
        const imgW = CW, imgH = imgW * 0.5625;
        const maxH = 100;
        const fH = Math.min(imgH, maxH), fW = fH === maxH ? maxH / 0.5625 : imgW;
        p.addImage(compressed, 'JPEG', MG, doc.y, fW, fH, undefined, 'FAST');
        doc.y += fH + 5;
      } catch {
        p.setTextColor(...C.red); p.setFontSize(9); p.text('[截图加载失败]', MG, doc.y + 5); doc.y += 12;
      }
    } else {
      p.setTextColor(...C.muted); p.setFontSize(9); p.text('[3D 场景未就绪]', MG, doc.y + 5); doc.y += 10;
    }
  }

  // ── 场景统计 ──
  doc.section('场景统计概览');
  const st = d.stats;
  if (st) {
    doc.ensure(36);
    fillR(p, MG, doc.y, CW, 26, C.panel);
    const cw = CW / 4;
    const cards = [
      { l: '总节点', v: String(metricSummary.totalNodes || st.totalNodes), c: C.text },
      { l: `平均${metricSummary.primaryLabel}`, v: `${metricSummary.avgPrimary}${metricSummary.primaryUnit}`, c: metricSummary.avgPrimary > d.gasThreshold ? C.red : C.text },
      { l: '平均温度', v: `${metricSummary.avgTemperature}°C`, c: metricSummary.avgTemperature > 35 ? C.orange : C.text },
      { l: semantics.status.overThresholdLabel, v: String(metricSummary.overThreshold), c: metricSummary.overThreshold > 0 ? C.red : C.green },
    ];
    cards.forEach((card, i) => {
      const cx = MG + i * cw;
      p.setTextColor(...C.muted); p.setFontSize(7); p.setFont('helvetica', 'normal'); p.text(card.l, cx + 4, doc.y + 7);
      p.setTextColor(...card.c); p.setFontSize(14); p.setFont('helvetica', 'bold'); p.text(card.v, cx + 4, doc.y + 16);
      if (i < 3) line(p, cx + cw - 2, doc.y + 3, cx + cw - 2, doc.y + 23, C.line);
    });
    doc.y += 30;
    doc.kv('平均置信度', `${st.avgConf.toFixed(1)}%`);
    if (st.onlineSensors != null) doc.kv('在线传感器', String(st.onlineSensors));
    doc.kv('相机位置', `X=${d.cameraInfo.x.toFixed(1)}, Y=${d.cameraInfo.y.toFixed(1)}, Z=${d.cameraInfo.z.toFixed(1)}`);
  }
  doc.y += 3;

  // ── 机器人集群 ──
  doc.section('集群机器人状态');
  const rs = d.robotStats;
  if (rs) {
    doc.kv('总数', String(rs.total));
    doc.kv('在线/离线', `${rs.online} / ${rs.offline}`, rs.offline > 0 ? C.orange : C.green);
    doc.kv('低电量/故障', `${rs.lowBattery} / ${rs.error}`, rs.error > 0 ? C.red : C.text);
    doc.kv('Mesh 连接', `${rs.meshConnected}/${rs.total}`, rs.meshConnected < rs.total ? C.orange : C.green);
    doc.kv('平均电量', `${rs.avgBattery.toFixed(1)}%`, rs.avgBattery < 30 ? C.red : rs.avgBattery < 50 ? C.orange : C.green);
  }
  const robots = d.robots;
  if (robots && robots.length > 0) {
    doc.tableHeader([
      { t: '编号', w: 22 }, { t: '型号', w: 18 }, { t: '状态', w: 18 }, { t: 'Mesh', w: 18 },
      { t: '电量', w: 18 }, { t: robotTelemetry.primary.label, w: 16 }, { t: '深度', w: 16 }, { t: '任务', w: 36 },
    ]);
    for (let i = 0; i < Math.min(robots.length, 30); i++) {
      const r = robots[i];
      doc.row([
        { t: r.id, w: 22 },
        { t: ML[r.model] ?? r.model, w: 18, c: C.muted },
        { t: SL[r.status] ?? r.status, w: 18, c: SC[r.status] ?? C.text, b: true },
        { t: MS[r.meshRole] ?? r.meshRole, w: 18, c: r.meshConnected ? C.green : C.dim },
        { t: `${r.battery}%`, w: 18, c: r.battery < 20 ? C.red : r.battery < 40 ? C.orange : C.green },
        { t: r.sensors.ch4.toFixed(2), w: 16, c: r.sensors.ch4 > d.gasThreshold ? C.red : C.text },
        { t: `${r.depth.toFixed(0)}m`, w: 16, c: C.muted },
        { t: (r.task || '-').slice(0, 18), w: 36, c: C.muted },
      ], i % 2 === 0 ? [16, 16, 24] : undefined);
    }
    if (robots.length > 30) { doc.ensure(6); p.setTextColor(...C.dim); p.setFontSize(7); p.text(`... 共 ${robots.length} 台，仅显示前 30 台`, MG, doc.y); doc.y += 5; }
  }

  // ── 告警 ──
  doc.section('实时告警事件');
  const al = d.alerts;
  if (al && al.length > 0) {
    const dg = al.filter((a) => a.level === 'danger').length;
    const wn = al.filter((a) => a.level === 'warning').length;
    doc.kv('告警总数', String(al.length));
    doc.kv('紧急/警告/通知', `${dg} / ${wn} / ${al.length - dg - wn}`, dg > 0 ? C.red : wn > 0 ? C.orange : C.text);
    doc.tableHeader([
      { t: '级别', w: 16 }, { t: '标题', w: 52 }, { t: '描述', w: 75 }, { t: '时间', w: 27 },
    ]);
    for (let i = 0; i < Math.min(al.length, 20); i++) {
      const a = al[i];
      const lc = a.level === 'danger' ? C.red : a.level === 'warning' ? C.orange : C.blue;
      const ll = a.level === 'danger' ? '紧急' : a.level === 'warning' ? '警告' : '通知';
      const ts = new Date(a.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const desc = p.splitTextToSize(a.description || '-', 68)[0] as string;
      doc.row([
        { t: ll, w: 16, c: lc, b: true },
        { t: (a.title || '').slice(0, 26), w: 52 },
        { t: desc, w: 75, c: C.muted },
        { t: ts, w: 27, c: C.dim },
      ], i % 2 === 0 ? [16, 16, 24] : undefined);
    }
  } else {
    doc.ensure(6); p.setTextColor(...C.green); p.setFontSize(9); p.setFont('helvetica', 'bold'); p.text('当前无告警', MG, doc.y); doc.y += 6;
  }

  // ── 场景对象网络 ──
  if (d.fractures.length > 0) {
    doc.section(`${semantics.networkLabel}分析`);
    const fr = d.fractures;
    doc.kv(`${semantics.objectLabel}总数`, String(fr.length));
    doc.kv('主干/分支', `${fr.filter((f) => f.type === 'main').length} / ${fr.filter((f) => f.type !== 'main').length}`);
    doc.tableHeader([
      { t: '编号', w: 22 }, { t: '名称', w: 35 }, { t: '类型', w: 16 }, { t: '长度m', w: 22 },
      { t: '开面μm', w: 24 }, { t: '倾角°', w: 20 }, { t: '连通性', w: 20 },
    ]);
    for (let i = 0; i < Math.min(fr.length, 15); i++) {
      const f = fr[i];
      doc.row([
        { t: f.id, w: 22 },
        { t: (f.name || '-').slice(0, 18), w: 35, c: C.muted },
        { t: f.type === 'main' ? '主干' : '分支', w: 16, c: f.type === 'main' ? C.orange : C.muted },
        { t: f.length.toFixed(1), w: 22 },
        { t: f.aperture_um.toFixed(0), w: 24 },
        { t: f.dip_angle.toFixed(0), w: 20 },
        { t: f.connectivity.toFixed(2), w: 20, c: f.connectivity > 0.7 ? C.orange : C.text },
      ], i % 2 === 0 ? [16, 16, 24] : undefined);
    }
  }

  // ── 风险发现 ──
  if (d.findings.length > 0) {
    doc.section('风险发现与可信边界');
    const findings = d.findings.slice(0, 12);
    const measured = findings.filter((finding) => finding.truthBoundary === 'measured').length;
    const inferred = findings.filter((finding) => finding.truthBoundary === 'ai_inferred').length;
    const verified = findings.filter((finding) => finding.truthBoundary === 'human_verified').length;
    doc.kv('发现总数', String(d.findings.length));
    doc.kv('实测/AI/人工确认', `${measured} / ${inferred} / ${verified}`);
    doc.tableHeader([
      { t: '边界', w: 20 }, { t: '级别', w: 14 }, { t: '标题', w: 48 }, { t: '描述', w: 70 }, { t: '证据', w: 18 },
    ]);
    for (let i = 0; i < findings.length; i++) {
      const finding = findings[i];
      const level = finding.level === 'danger' ? '高危' : finding.level === 'warning' ? '警告' : '信息';
      const desc = p.splitTextToSize(finding.description || '-', 60)[0] as string;
      doc.row([
        { t: TRUTH_BOUNDARY_LABELS[finding.truthBoundary], w: 20, c: finding.truthBoundary === 'ai_inferred' ? C.yellow : finding.truthBoundary === 'measured' ? C.green : C.text },
        { t: level, w: 14, c: finding.level === 'danger' ? C.red : finding.level === 'warning' ? C.orange : C.blue, b: true },
        { t: finding.title.slice(0, 18), w: 48 },
        { t: desc, w: 70, c: C.muted },
        { t: String(finding.evidence.length), w: 18, c: C.dim },
      ], i % 2 === 0 ? [16, 16, 24] : undefined);
    }
  }

  // ── POI ──
  if (d.pois.length > 0) {
    doc.section('兴趣点 (POI)');
    doc.kv('POI 总数', String(d.pois.length));
    const tl: Record<string, string> = { crack: '裂缝', gas: '瓦斯', collapse: '坍塌', sensor: '传感器' };
    const tc: Record<string, RGB> = { crack: C.orange, gas: C.red, collapse: C.red, sensor: C.blue };
    for (let i = 0; i < Math.min(d.pois.length, 10); i++) {
      const poi = d.pois[i];
      doc.ensure(7); fillR(p, MG, doc.y - 4, CW, 6, i % 2 === 0 ? [16, 16, 24] : C.panel);
      p.setFontSize(8); p.setFont('helvetica', 'bold'); p.setTextColor(...(tc[poi.type] ?? C.text));
      p.text(`[${tl[poi.type] ?? poi.type}]`, MG + 2, doc.y);
      p.setTextColor(...C.text); p.text(poi.label, MG + 25, doc.y);
      p.setTextColor(...C.muted); p.setFont('helvetica', 'normal');
      p.text(`CH4:${poi.sensors.ch4_concentration_pct.toFixed(2)}% 温度:${poi.sensors.temperature_celsius.toFixed(1)}°C`, MG + 70, doc.y);
      doc.y += 6;
    }
  }

  // ── AI 对话 ──
  if (d.messages.length > 1) {
    doc.section('AI 对话记录');
    const recent = d.messages.slice(-12);
    for (const m of recent) {
      doc.ensure(16);
      const rc = m.role === 'user' ? C.blue : C.green, rl = m.role === 'user' ? '用户' : 'AI';
      fillR(p, MG, doc.y - 4, 9, 5, rc);
      p.setTextColor(...C.bg); p.setFontSize(6); p.setFont('helvetica', 'bold'); p.text(rl, MG + 1, doc.y - 0.5);
      const clean = m.content.replace(/#{1,6}\s*/g, '').replace(/\*\*/g, '').replace(/```[\s\S]*?```/g, '[code]').replace(/\n{2,}/g, '\n').trim();
      const lines = p.splitTextToSize(clean, CW - 5) as string[];
      p.setTextColor(...C.text); p.setFontSize(8); p.setFont('helvetica', 'normal');
      let ly = doc.y + 2;
      for (const ln of lines.slice(0, 3)) { doc.ensure(5); p.text(ln, MG + 2, ly); ly += 4; }
      doc.y = ly + 2;
    }
  }

  // ── 参数 & 完整性 ──
  doc.section('系统参数与数据完整性');
  doc.kv(semantics.threshold.label, `${d.gasThreshold.toFixed(semantics.threshold.precision)}${semantics.threshold.unit}`);
  doc.kv('置信度过滤', `${d.confidenceFilter}%`);
  doc.ensure(8);
  const ll: Record<string, string> = { mesh: '网格', pointCloud: '点云', gasHeatmap: `${semantics.trend.primary.label}热力图`, tempHeatmap: '温度热力图', robots: '机器人', fractures: semantics.objectLabel, rockMass: '结构/围岩', poi: '兴趣点' };
  let lx = MG + 2, ly2 = doc.y;
  for (const [k, v] of Object.entries(d.layers)) {
    if (lx > PW - MG - 40) { lx = MG + 2; ly2 += 5; }
    p.setFontSize(8); p.setFont('helvetica', 'normal'); p.setTextColor(...(v ? C.green : C.dim));
    p.text(`${v ? '●' : '○'} ${ll[k] ?? k}`, lx, ly2); lx += 42;
  }
  doc.y = ly2 + 8;

  doc.ensure(20);
  p.setTextColor(...C.yellow); p.setFontSize(9); p.setFont('helvetica', 'bold');
  p.text('数据完整性哈希 (SHA-256):', MG, doc.y); doc.y += 5;
  const hash = await sha256(JSON.stringify({ t: Date.now(), stats: d.stats, rc: d.robots?.length, ac: d.alerts?.length, fc: d.fractures.length }));
  p.setTextColor(...C.muted); p.setFont('helvetica', 'normal'); p.setFontSize(7);
  for (let i = 0; i < hash.length; i += 40) { doc.ensure(5); p.text(hash.substring(i, i + 40), MG, doc.y); doc.y += 4; }

  // ── 免责声明（每页底部） ──
  const pc = p.getNumberOfPages();
  const disc = '免责声明: 本系统基于有限条件感知融合，所有三维建模和参数预测仅供工程参考，绝不可作为井下作业的唯一安全依据。';
  for (let i = 1; i <= pc; i++) {
    p.setPage(i);
    fillR(p, 0, PH - 18, PW, 18, [40, 10, 10]);
    p.setTextColor(255, 200, 200); p.setFontSize(7); p.setFont('helvetica', 'bold');
    const lines = p.splitTextToSize(disc, CW) as string[];
    let dy = PH - 12;
    for (const ln of lines.slice(0, 2)) { p.text(ln, MG, dy); dy += 4; }
    p.setTextColor(...C.dim); p.setFont('helvetica', 'normal'); p.setFontSize(6);
    p.text(`HIVE Digital Twin | Page ${i}/${pc}`, PW - MG - 35, PH - 5);
  }

  p.save(`HIVE-Report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`);
}
