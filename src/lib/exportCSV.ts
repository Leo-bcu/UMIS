/**
 * CSV 传感器数据导出器
 * 兼容 Excel / WPS / SCADA / GIS / 工程数据平台
 *
 * 导出内容:
 * 1. 传感器矩阵: 每行 = [时间戳, 对象ID, 节点ID, X, Y, Z, 当前场景主指标, 温度, 辅助指标, ...]
 * 2. 机器人状态: 每行 = [机器人ID, 型号, 状态, X, Y, Z, 电量, 场景主指标, 温度, 辅助指标, ...]
 * 3. 告警事件: 每行 = [时间, 级别, 标题, 描述]
 *
 * 遵循 RFC 4180 标准 (逗号分隔, 双引号转义, UTF-8 BOM 兼容中文)
 */

import type { Fracture, Robot, SensorReading } from '../types';
import type { AlertEvent } from '../data/alertDataGenerator';
import { getSceneSemantics } from './sceneSemantics';

/**
 * CSV 字段转义 (RFC 4180)
 */
function csvEscape(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(csvEscape).join(',');
}

/**
 * 导出全量传感器数据 CSV
 */
export function exportCSV(
  fractures: Fracture[],
  robots: Robot[] | null,
  alerts: AlertEvent[] | null,
  scenario: string,
): void {
  const sections: string[] = [];
  const semantics = getSceneSemantics(scenario);
  const primary = semantics.trend.primary;
  const temp = semantics.trend.temperature;
  const aux = semantics.trend.aux;
  const robotTelemetry = semantics.robotTelemetry;
  const metric = (reading: SensorReading, key: keyof SensorReading) => reading[key];

  // === Section 1: 场景测点传感器矩阵 ===
  sections.push(`# === ${semantics.nodeLabel}传感器矩阵 / Scene Node Sensor Matrix ===`);
  sections.push(`# 导出时间: ${new Date().toISOString()}`);
  sections.push(`# 场景: ${scenario}`);
  sections.push(`# 格式: 时间戳,${semantics.objectLabel}ID,节点ID,节点类型,X,Y,Z,${primary.label}(${primary.unit}),${temp.label}(${temp.unit}),${aux.label}(${aux.unit}),H2S(ppm),应力(MPa),水压(MPa),微震次数,声发射(mV),湿度(%),开度/管径(μm),位移(mm),岩石强度/壁厚损失,孔隙压力(MPa),孔隙度/管径,流体pH,含水饱和度(%)`);
  sections.push('');

  for (const frac of fractures) {
    for (const node of frac.nodes) {
      const [x, y, z] = node.position;
      const s = node.sensors;
      sections.push(csvRow([
        new Date(node.timestamp).toISOString(),
        frac.id,
        node.id,
        frac.type,
        x.toFixed(3), y.toFixed(3), z.toFixed(3),
        metric(s, primary.key),
        metric(s, temp.key),
        metric(s, aux.key),
        s.h2s_ppm,
        s.stress_mpa,
        s.water_pressure_mpa,
        s.microseismic_count, s.acoustic_emission_mv,
        s.humidity_pct, s.fracture_aperture_um,
        s.displacement_mm, s.rock_strength_mpa,
        s.pore_pressure_mpa, s.porosity_pct,
        s.fluid_ph, s.water_saturation_pct,
      ]));
    }
  }
  sections.push('');

  // === Section 2: 机器人状态矩阵 ===
  if (robots && robots.length > 0) {
    sections.push('# === 机器人状态矩阵 / Robot Status Matrix ===');
    sections.push(`# 格式: 机器人ID,型号,状态,X,Y,Z,深度(m),电量(%),Mesh角色,Mesh连接,信号强度(dBm),${robotTelemetry.primary.label}(${robotTelemetry.primary.unit}),${robotTelemetry.temperature.label}(${robotTelemetry.temperature.unit}),${robotTelemetry.aux.label}(${robotTelemetry.aux.unit}),最后回传,当前任务`);
    sections.push('');

    for (const r of robots) {
      const [x, y, z] = r.position;
      sections.push(csvRow([
        r.id, r.model, r.status,
        x.toFixed(3), y.toFixed(3), z.toFixed(3),
        r.depth.toFixed(1), r.battery,
        r.meshRole, r.meshConnected ? 'YES' : 'NO',
        r.signalStrength,
        r.sensors.ch4, r.sensors.temperature, r.sensors.humidity,
        new Date(r.lastUpdate).toISOString(),
        r.task,
      ]));
    }
    sections.push('');
  }

  // === Section 3: 告警事件 ===
  if (alerts && alerts.length > 0) {
    sections.push('# === 告警事件 / Alert Events ===');
    sections.push('# 格式: 时间,级别,标题,描述,机器人ID,确认');
    sections.push('');

    for (const a of alerts) {
      sections.push(csvRow([
        new Date(a.timestamp).toISOString(),
        a.level,
        a.title,
        a.description,
        a.robotId ?? '-',
        a.acknowledged ? 'YES' : 'NO',
      ]));
    }
    sections.push('');
  }

  // === Section 4: 场景对象几何参数 ===
  sections.push(`# === ${semantics.objectLabel}几何参数 / Scene Object Geometry Parameters ===`);
  sections.push(`# 格式: ${semantics.objectLabel}ID,名称,类型,长度(m),开度/管径(μm),孔隙度/管径,分形维数,曲折度,倾角(°),方位角(°),粗糙度系数,连通性,父级${semantics.objectLabel}ID`);
  sections.push('');

  for (const frac of fractures) {
    sections.push(csvRow([
      frac.id, frac.name, frac.type,
      frac.length.toFixed(2), frac.aperture_um,
      frac.porosity, frac.fractal_dim, frac.tortuosity,
      frac.dip_angle, frac.azimuth_angle,
      frac.roughness_coeff, frac.connectivity,
      frac.parentFractureId ?? '-',
    ]));
  }

  // ── Download ──
  // UTF-8 BOM 确保中文在 Excel 中正确显示
  const csv = '\uFEFF' + sections.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.download = `HIVE-Sensors-${scenario}-${ts}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 导出统计信息（用于 UI 展示）
 */
export function getCSVStats(
  fractures: Fracture[],
  robots: Robot[] | null,
  alerts: AlertEvent[] | null,
): { sensorRows: number; robotRows: number; alertRows: number; estimatedSizeKB: number } {
  const sensorRows = fractures.reduce((s, f) => s + f.nodes.length, 0);
  const robotRows = robots?.length ?? 0;
  const alertRows = alerts?.length ?? 0;
  // Average ~150 bytes per row
  const totalRows = sensorRows + robotRows + alertRows + fractures.length;
  const sizeKB = Math.round(totalRows * 0.15);
  return { sensorRows, robotRows, alertRows, estimatedSizeKB: sizeKB };
}
