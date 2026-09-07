import type { Locale } from './i18nCatalog';
import type { ScenarioType, SensorReading } from '../types';

// 4 色语义体系 — 与 FractureDetailPanel RISK_COLORS 对齐
export type RiskLevel = 'safe' | 'caution' | 'warning' | 'danger';

export interface PrimaryMetric {
  label: string;
  value: number;
  unit: string;
  /** 该指标是否已超阈值（决定是否标红） */
  over: boolean;
}

export interface RiskSummary {
  /** 0-100 综合安全评分 */
  score: number;
  level: RiskLevel;
  /** 一句话人话解释，场景化 */
  reason: string;
  /** 该场景下最该关注的 3 个核心指标 */
  primaryMetrics: PrimaryMetric[];
}

interface ScenarioRiskRule {
  evaluate: (sr: SensorReading) => { deductions: number; reasons: string[]; dangerHit: boolean };
  primaryMetrics: (sr: SensorReading) => PrimaryMetric[];
}

const RULES: Record<ScenarioType, ScenarioRiskRule> = {
  coal: {
    evaluate: (sr) => {
      const deductions: number[] = [];
      const reasons: string[] = [];
      let dangerHit = false;
      if (sr.ch4_pct > 3.0) { deductions.push(40); reasons.push('CH₄ 严重超标，存在爆炸风险'); dangerHit = true; }
      else if (sr.ch4_pct > 1.5) { deductions.push(25); reasons.push('CH₄ 浓度超标，建议加强通风'); }
      else if (sr.ch4_pct > 1.0) deductions.push(10);
      if (sr.co_ppm > 24) { deductions.push(15); reasons.push('CO 浓度偏高，警惕阴燃'); }
      if (sr.h2s_ppm > 10) { deductions.push(15); reasons.push('H₂S 超标，有毒有害'); }
      if (sr.water_pressure_mpa > 5) { deductions.push(20); reasons.push('水压偏高，警惕突水'); }
      if (sr.microseismic_count > 15) { deductions.push(20); reasons.push('微震活动剧烈，岩爆风险'); dangerHit = true; }
      else if (sr.microseismic_count > 10) deductions.push(10);
      if (sr.temperature_c > 35) deductions.push(5);
      return { deductions: deductions.reduce((a, b) => a + b, 0), reasons, dangerHit };
    },
    primaryMetrics: (sr) => [
      { label: 'CH₄', value: sr.ch4_pct, unit: '%', over: sr.ch4_pct > 1.5 },
      { label: '温度', value: sr.temperature_c, unit: '°C', over: sr.temperature_c > 35 },
      { label: '微震', value: sr.microseismic_count, unit: '次/h', over: sr.microseismic_count > 15 },
    ],
  },
  gold: {
    evaluate: (sr) => {
      const deductions: number[] = [];
      const reasons: string[] = [];
      let dangerHit = false;
      if (sr.microseismic_count > 15) { deductions.push(35); reasons.push('微震活动剧烈，岩爆风险'); dangerHit = true; }
      else if (sr.microseismic_count > 8) { deductions.push(15); reasons.push('微震活动偏高，建议复核'); }
      if (sr.stress_sigma1 > 25) { deductions.push(25); reasons.push('最大主应力超限'); }
      if (sr.displacement_mm > 5) { deductions.push(15); reasons.push('位移超限，围岩不稳'); }
      if (sr.acoustic_emission_mv > 5000) deductions.push(10);
      return { deductions: deductions.reduce((a, b) => a + b, 0), reasons, dangerHit };
    },
    primaryMetrics: (sr) => [
      { label: '微震', value: sr.microseismic_count, unit: '次/h', over: sr.microseismic_count > 15 },
      { label: 'σ₁应力', value: sr.stress_sigma1, unit: 'MPa', over: sr.stress_sigma1 > 25 },
      { label: '位移', value: sr.displacement_mm, unit: 'mm', over: sr.displacement_mm > 5 },
    ],
  },
  oil: {
    evaluate: (sr) => {
      const deductions: number[] = [];
      const reasons: string[] = [];
      let dangerHit = false;
      if (sr.pore_pressure_mpa > 30) { deductions.push(35); reasons.push('孔隙压力过高，压裂风险'); dangerHit = true; }
      else if (sr.pore_pressure_mpa > 20) { deductions.push(15); reasons.push('孔隙压力偏高'); }
      if (sr.permeability_md < 0.01) deductions.push(20);
      if (sr.temperature_c > 80) deductions.push(10);
      return { deductions: deductions.reduce((a, b) => a + b, 0), reasons, dangerHit };
    },
    primaryMetrics: (sr) => [
      { label: '孔压', value: sr.pore_pressure_mpa, unit: 'MPa', over: sr.pore_pressure_mpa > 30 },
      { label: '渗透率', value: sr.permeability_md, unit: 'mD', over: sr.permeability_md < 0.01 },
      { label: '温度', value: sr.temperature_c, unit: '°C', over: sr.temperature_c > 80 },
    ],
  },
  pipeline: {
    evaluate: (sr) => {
      const deductions: number[] = [];
      const reasons: string[] = [];
      let dangerHit = false;
      if (sr.ch4_pct > 20) { deductions.push(40); reasons.push('可燃气体浓度高，泄漏风险'); dangerHit = true; }
      else if (sr.ch4_pct > 10) deductions.push(20);
      if (sr.h2s_ppm > 50) { deductions.push(30); reasons.push('H₂S 严重超标，酸性腐蚀'); }
      else if (sr.h2s_ppm > 20) deductions.push(15);
      if (sr.rock_strength_mpa > 40) { deductions.push(25); reasons.push('壁厚损失严重，需超声复检'); }
      else if (sr.rock_strength_mpa > 20) deductions.push(12);
      if (sr.stress_sigma1 > 72) deductions.push(20);
      if (sr.permeability_md > 0.25) deductions.push(10);
      return { deductions: deductions.reduce((a, b) => a + b, 0), reasons, dangerHit };
    },
    primaryMetrics: (sr) => [
      { label: '可燃气', value: sr.ch4_pct, unit: '%LEL', over: sr.ch4_pct > 20 },
      { label: '壁厚损失', value: sr.rock_strength_mpa, unit: '%', over: sr.rock_strength_mpa > 40 },
      { label: 'H₂S', value: sr.h2s_ppm, unit: 'ppm', over: sr.h2s_ppm > 50 },
    ],
  },
  nuclear: {
    evaluate: (sr) => {
      const deductions: number[] = [];
      const reasons: string[] = [];
      let dangerHit = false;
      if (sr.ch4_pct > 25) { deductions.push(40); reasons.push('剂量率严重超标，限制人员接近'); dangerHit = true; }
      else if (sr.ch4_pct > 10) deductions.push(20);
      if (sr.water_pressure_mpa > 60) { deductions.push(25); reasons.push('疲劳使用因子偏高'); }
      else if (sr.water_pressure_mpa > 40) deductions.push(12);
      if (sr.h2s_ppm > 5) { deductions.push(30); reasons.push('冷却剂活度异常，警惕包壳破损'); }
      else if (sr.h2s_ppm > 2) deductions.push(15);
      if (sr.permeability_md > 0.1) deductions.push(15);
      if (sr.microseismic_count > 7) deductions.push(10);
      return { deductions: deductions.reduce((a, b) => a + b, 0), reasons, dangerHit };
    },
    primaryMetrics: (sr) => [
      { label: '剂量率', value: sr.ch4_pct, unit: 'mSv/h', over: sr.ch4_pct > 25 },
      { label: '疲劳', value: sr.water_pressure_mpa, unit: '%', over: sr.water_pressure_mpa > 60 },
      { label: '活度', value: sr.h2s_ppm, unit: 'Bq/mL', over: sr.h2s_ppm > 5 },
    ],
  },
  refinery: {
    evaluate: (sr) => {
      const deductions: number[] = [];
      const reasons: string[] = [];
      let dangerHit = false;
      if (sr.rock_strength_mpa > 5) { deductions.push(30); reasons.push('壁厚损失严重，需检修'); dangerHit = true; }
      else if (sr.rock_strength_mpa > 3) deductions.push(15);
      if (sr.permeability_md > 0.3) { deductions.push(20); reasons.push('腐蚀速率偏高'); }
      else if (sr.permeability_md > 0.15) deductions.push(10);
      if (sr.h2s_ppm > 100) { deductions.push(25); reasons.push('H₂S 严重超标'); }
      else if (sr.h2s_ppm > 50) deductions.push(12);
      if (sr.stress_mpa < 19.5 || sr.stress_mpa > 23.5) deductions.push(15);
      if (sr.ch4_pct > 20) deductions.push(10);
      return { deductions: deductions.reduce((a, b) => a + b, 0), reasons, dangerHit };
    },
    primaryMetrics: (sr) => [
      { label: '壁厚损失', value: sr.rock_strength_mpa, unit: '%', over: sr.rock_strength_mpa > 5 },
      { label: 'H₂S', value: sr.h2s_ppm, unit: 'ppm', over: sr.h2s_ppm > 100 },
      { label: '腐蚀', value: sr.permeability_md, unit: 'mm/yr', over: sr.permeability_md > 0.3 },
    ],
  },
  underground: {
    evaluate: (sr) => {
      const deductions: number[] = [];
      const reasons: string[] = [];
      let dangerHit = false;
      if (sr.permeability_md > 10000) { deductions.push(35); reasons.push('渗透率极高，突水风险'); dangerHit = true; }
      else if (sr.permeability_md > 5000) { deductions.push(18); reasons.push('渗透率偏高，复核连通性'); }
      if (sr.water_pressure_mpa > 8) { deductions.push(25); reasons.push('水压过高'); }
      else if (sr.water_pressure_mpa > 5) deductions.push(12);
      if (sr.temperature_c > 90) { deductions.push(20); reasons.push('地温异常'); }
      else if (sr.temperature_c > 70) deductions.push(8);
      if (sr.h2s_ppm > 10) deductions.push(12);
      if (sr.fluid_ph < 5.5 || sr.fluid_ph > 8.5) deductions.push(10);
      return { deductions: deductions.reduce((a, b) => a + b, 0), reasons, dangerHit };
    },
    primaryMetrics: (sr) => [
      { label: '渗透率', value: sr.permeability_md, unit: 'mD', over: sr.permeability_md > 5000 },
      { label: '水压', value: sr.water_pressure_mpa, unit: 'MPa', over: sr.water_pressure_mpa > 8 },
      { label: '地温', value: sr.temperature_c, unit: '°C', over: sr.temperature_c > 90 },
    ],
  },
};

const REASON_EN: Record<string, string> = {
  'CH₄ 严重超标，存在爆炸风险': 'CH4 is critically high; explosion risk',
  'CH₄ 浓度超标，建议加强通风': 'CH4 exceeds the limit; increase ventilation',
  'CO 浓度偏高，警惕阴燃': 'CO is elevated; watch for smoldering',
  'H₂S 超标，有毒有害': 'H2S exceeds the limit; toxic hazard',
  '水压偏高，警惕突水': 'Water pressure is high; inrush risk',
  '微震活动剧烈，岩爆风险': 'Microseismic activity is intense; rockburst risk',
  '微震活动偏高，建议复核': 'Microseismic activity is elevated; review required',
  '最大主应力超限': 'Maximum principal stress exceeds the limit',
  '位移超限，围岩不稳': 'Displacement exceeds the limit; surrounding rock is unstable',
  '孔隙压力过高，压裂风险': 'Pore pressure is high; fracturing risk',
  '孔隙压力偏高': 'Pore pressure is elevated',
  '可燃气体浓度高，泄漏风险': 'Combustible gas is high; leak risk',
  'H₂S 严重超标，酸性腐蚀': 'H2S is critically high; sour corrosion risk',
  '壁厚损失严重，需超声复检': 'Wall loss is severe; ultrasonic recheck required',
  '剂量率严重超标，限制人员接近': 'Dose rate is critically high; restrict personnel access',
  '疲劳使用因子偏高': 'Fatigue usage factor is elevated',
  '冷却剂活度异常，警惕包壳破损': 'Coolant activity is abnormal; watch for cladding damage',
  '壁厚损失严重，需检修': 'Wall loss is severe; maintenance required',
  '腐蚀速率偏高': 'Corrosion rate is elevated',
  'H₂S 严重超标': 'H2S is critically high',
  '渗透率极高，突水风险': 'Permeability is extremely high; water inrush risk',
  '渗透率偏高，复核连通性': 'Permeability is elevated; verify connectivity',
  '水压过高': 'Water pressure is too high',
  '地温异常': 'Ground temperature is abnormal',
  '各项指标在安全范围内': 'All indicators are within the safe range',
};

const METRIC_LABEL_EN: Record<string, string> = {
  '温度': 'Temperature',
  '微震': 'Microseismic',
  'σ₁应力': 'σ1 Stress',
  '位移': 'Displacement',
  '孔压': 'Pore Pressure',
  '渗透率': 'Permeability',
  '可燃气': 'Combustible Gas',
  '壁厚损失': 'Wall Loss',
  'H₂S': 'H2S',
  '剂量率': 'Dose Rate',
  '疲劳': 'Fatigue',
  '活度': 'Activity',
  '腐蚀': 'Corrosion',
  '水压': 'Water Pressure',
  '地温': 'Ground Temperature',
};

function localizeSummary(summary: RiskSummary, locale: Locale): RiskSummary {
  if (locale === 'zh-CN') return summary;
  return {
    ...summary,
    reason: REASON_EN[summary.reason] ?? summary.reason,
    primaryMetrics: summary.primaryMetrics.map((metric) => ({
      ...metric,
      label: METRIC_LABEL_EN[metric.label] ?? metric.label,
    })),
  };
}

export function summarizeRisk(sr: SensorReading, scenario: ScenarioType, locale: Locale = 'zh-CN'): RiskSummary {
  const rule = RULES[scenario] ?? RULES.coal;
  const { deductions, reasons, dangerHit } = rule.evaluate(sr);
  const score = Math.max(0, Math.min(100, Math.round(100 - deductions)));
  const level: RiskLevel = dangerHit || score < 40 ? 'danger' : score < 60 ? 'warning' : score < 80 ? 'caution' : 'safe';
  // 取最关键的一条原因；无问题时给正常文案
  const reason = reasons[0] ?? (scenario === 'coal'
    ? '各项指标在安全范围内'
    : '各项指标在安全范围内');
  return localizeSummary({ score, level, reason, primaryMetrics: rule.primaryMetrics(sr) }, locale);
}
