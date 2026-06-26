import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateMockAIResponse } from './mockAI';
import type { Fracture, SensorReading } from '../types';

const reading: SensorReading = {
  ch4_pct: 0.08,
  co_ppm: 820,
  h2s_ppm: 12,
  temperature_c: 96,
  stress_mpa: 16,
  stress_sigma1: 22,
  stress_sigma2: 12,
  stress_sigma3: 8,
  permeability_md: 9200,
  water_pressure_mpa: 9.2,
  microseismic_count: 6,
  acoustic_emission_mv: 300,
  humidity_pct: 96,
  fracture_aperture_um: 4200,
  displacement_mm: 1.2,
  rock_strength_mpa: 45,
  pore_pressure_mpa: 6.8,
  porosity_pct: 0.42,
  fluid_ph: 8.8,
  water_saturation_pct: 98,
};

function channel(id: string): Fracture {
  return {
    id,
    name: `${id} 承压暗流通道`,
    type: 'main',
    path: [[0, -10, 0], [6, -18, 4], [14, -26, 12]],
    length: 76,
    aperture_um: 4200,
    porosity: 0.42,
    fractal_dim: 1.2,
    tortuosity: 1.4,
    dip_angle: 18,
    azimuth_angle: 45,
    roughness_coeff: 0.2,
    connectivity: 3,
    sensorReading: reading,
    nodes: [
      { id: `${id}-N1`, position: [0, -10, 0], sensors: reading, timestamp: 1, robotId: 'R-083' },
      { id: `${id}-N2`, position: [6, -18, 4], sensors: reading, timestamp: 2, robotId: 'R-084' },
    ],
    parentFractureId: null,
  };
}

function undergroundContext() {
  return {
    fractures: [channel('UC-010')],
    scenario: 'underground' as const,
    gasThreshold: 5000,
  };
}

describe('generateMockAIResponse underground semantics', () => {
  it('uses underground channel terms for overview and fallback', () => {
    const overview = generateMockAIResponse('地下暗流通道网络概览', undergroundContext()).message;
    assert.match(overview, /暗流通道/);
    assert.match(overview, /渗透/);
    assert.doesNotMatch(overview, /瓦斯|CH4|CH₄/);

    const fallback = generateMockAIResponse('帮我看看', undergroundContext()).message;
    assert.match(fallback, /地下暗流通道网络/);
    assert.doesNotMatch(fallback, /裂缝分布|瓦斯浓度|F-xxx/);
  });

  it('routes underground pressure, temperature, and dangerous point requests before generic fracture branches', () => {
    const pressure = generateMockAIResponse('水压异常', undergroundContext()).message;
    assert.match(pressure, /地下暗流水压异常分析/);
    assert.match(pressure, /渗透率/);
    assert.doesNotMatch(pressure, /地应力|裂缝/);

    const temperature = generateMockAIResponse('地温梯度', undergroundContext()).message;
    assert.match(temperature, /地温梯度分析/);
    assert.doesNotMatch(temperature, /裂缝/);

    const danger = generateMockAIResponse('找出最危险的点', undergroundContext()).message;
    assert.match(danger, /暗流通道异常分析/);
    assert.match(danger, /渗透率=.*mD/);
    assert.doesNotMatch(danger, /CH₄|瓦斯/);
  });
});
