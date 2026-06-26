import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRisk } from './riskSummary';
import type { SensorReading, ScenarioType } from '../types';

const EMPTY: SensorReading = {
  ch4_pct: 0, co_ppm: 0, h2s_ppm: 0, temperature_c: 0,
  stress_mpa: 0, stress_sigma1: 0, stress_sigma2: 0, stress_sigma3: 0,
  permeability_md: 0, water_pressure_mpa: 0, microseismic_count: 0,
  acoustic_emission_mv: 0, humidity_pct: 0, fracture_aperture_um: 0,
  displacement_mm: 0, rock_strength_mpa: 0, pore_pressure_mpa: 0,
  porosity_pct: 0, fluid_ph: 0, water_saturation_pct: 0,
};

describe('summarizeRisk', () => {
  it('空读数判定为 safe 且评分接近 100', () => {
    const r = summarizeRisk(EMPTY, 'coal');
    assert.equal(r.level, 'safe');
    assert.ok(r.score >= 95);
    assert.equal(r.primaryMetrics.length, 3);
  });

  it('coal CH₄ 严重超标判定为 danger 并给出原因', () => {
    const r = summarizeRisk({ ...EMPTY, ch4_pct: 3.5, microseismic_count: 16 }, 'coal');
    assert.equal(r.level, 'danger');
    assert.ok(r.reason.includes('CH₄'));
    assert.ok(r.primaryMetrics.some((m) => m.over));
  });

  it('gold 微震偏高+应力超限判定为非 safe', () => {
    const r = summarizeRisk({ ...EMPTY, microseismic_count: 12, stress_sigma1: 26 }, 'gold');
    assert.notEqual(r.level, 'safe');
    assert.ok(r.score < 80);
  });

  it('oil 孔压正常判定非 danger', () => {
    const r = summarizeRisk({ ...EMPTY, pore_pressure_mpa: 15, permeability_md: 1, temperature_c: 60 }, 'oil');
    assert.notEqual(r.level, 'danger');
    assert.ok(r.score >= 60);
  });

  it('pipeline 泄漏超标判定为 danger', () => {
    const r = summarizeRisk({ ...EMPTY, ch4_pct: 25, h2s_ppm: 60 }, 'pipeline');
    assert.equal(r.level, 'danger');
    assert.ok(r.reason.includes('可燃气体'));
  });

  it('nuclear 剂量率超标判定为 danger', () => {
    const r = summarizeRisk({ ...EMPTY, ch4_pct: 30 }, 'nuclear');
    assert.equal(r.level, 'danger');
    assert.ok(r.reason.includes('剂量'));
  });

  it('refinery 壁厚严重损失判定为 danger', () => {
    const r = summarizeRisk({ ...EMPTY, rock_strength_mpa: 6 }, 'refinery');
    assert.equal(r.level, 'danger');
    assert.ok(r.reason.includes('壁厚'));
  });

  it('underground 渗透率极高判定为 danger', () => {
    const r = summarizeRisk({ ...EMPTY, permeability_md: 12000, water_pressure_mpa: 9 }, 'underground');
    assert.equal(r.level, 'danger');
    assert.ok(r.reason.includes('渗透'));
  });

  it('每个场景核心指标都返回 3 项', () => {
    const scenarios: ScenarioType[] = ['coal', 'gold', 'oil', 'pipeline', 'nuclear', 'refinery', 'underground'];
    for (const sc of scenarios) {
      const r = summarizeRisk(EMPTY, sc);
      assert.equal(r.primaryMetrics.length, 3, `${sc} 应返回 3 个核心指标`);
      assert.ok(r.primaryMetrics.every((m) => m.label && m.unit), `${sc} 指标缺 label/unit`);
    }
  });

  it('returns English risk reason and metric labels in English locale', () => {
    const r = summarizeRisk({ ...EMPTY, ch4_pct: 25, h2s_ppm: 60 }, 'pipeline', 'en-US');

    assert.equal(r.reason, 'Combustible gas is high; leak risk');
    assert.deepEqual(r.primaryMetrics.map((m) => m.label), ['Combustible Gas', 'Wall Loss', 'H2S']);
    assert.ok(!/[\u4e00-\u9fff]/.test(r.reason));
    assert.ok(r.primaryMetrics.every((m) => !/[\u4e00-\u9fff]/.test(m.label)));
  });

  it('评分始终在 0-100 且 level 与 score 一致', () => {
    const r1 = summarizeRisk({ ...EMPTY, ch4_pct: 5, microseismic_count: 20 }, 'coal');
    assert.ok(r1.score >= 0 && r1.score <= 100);
    if (r1.score < 40) assert.equal(r1.level, 'danger');
    const r2 = summarizeRisk(EMPTY, 'pipeline');
    if (r2.score >= 80) assert.equal(r2.level, 'safe');
  });
});
