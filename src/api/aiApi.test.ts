import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { streamChat } from './aiApi';
import type { Fracture, SensorReading } from '../types';

const originalFetch = globalThis.fetch;
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function installLiveSettings() {
  const settings = {
    provider: 'deepseek',
    baseUrl: 'https://example.test/v1',
    apiKey: 'sk-test',
    model: 'test-model',
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => (key === 'llm-settings' ? JSON.stringify(settings) : null),
      setItem: () => undefined,
      removeItem: () => undefined,
    },
  });
}

function restoreGlobals() {
  globalThis.fetch = originalFetch;
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  } else {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

function sseResponse(content: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

function sensor(overrides: Partial<SensorReading> = {}): SensorReading {
  return {
    ch4_pct: 0,
    co_ppm: 0,
    h2s_ppm: 82,
    temperature_c: 36,
    stress_mpa: 0,
    stress_sigma1: 0,
    stress_sigma2: 0,
    stress_sigma3: 0,
    permeability_md: 0,
    water_pressure_mpa: 2.4,
    microseismic_count: 0,
    acoustic_emission_mv: 0,
    humidity_pct: 70,
    fracture_aperture_um: 0,
    displacement_mm: 0,
    rock_strength_mpa: 0,
    pore_pressure_mpa: 0,
    porosity_pct: 0,
    fluid_ph: 7,
    water_saturation_pct: 0,
    ...overrides,
  };
}

function pipelineContext() {
  const fractures: Fracture[] = [
    {
      id: 'P-001',
      name: 'DN80 酸性气支线',
      type: 'main',
      path: [[0, 0, 0], [4, 0, 0], [8, 0, 0]],
      length: 8,
      aperture_um: 80,
      porosity: 0.1,
      fractal_dim: 1.1,
      tortuosity: 1.05,
      dip_angle: 0,
      azimuth_angle: 90,
      roughness_coeff: 0.1,
      connectivity: 2,
      sensorReading: sensor({ ch4_pct: 24, h2s_ppm: 120, displacement_mm: 3.5 }),
      nodes: [
        { id: 'P-001-N1', position: [0, 0, 0], sensors: sensor({ ch4_pct: 24 }), timestamp: 1, robotId: 'R-101' },
      ],
      parentFractureId: null,
    },
  ];
  return { fractures, scenario: 'pipeline' as const, gasThreshold: 20 };
}

function coalContext() {
  const fractures: Fracture[] = [
    {
      id: 'C-001',
      name: '回风巷交叉口',
      type: 'main',
      path: [[0, -20, 0], [6, -24, 3], [12, -27, 6]],
      length: 42,
      aperture_um: 900,
      porosity: 0.18,
      fractal_dim: 1.2,
      tortuosity: 1.25,
      dip_angle: 8,
      azimuth_angle: 40,
      roughness_coeff: 0.2,
      connectivity: 3,
      sensorReading: sensor({ ch4_pct: 0.42, co_ppm: 64, temperature_c: 46 }),
      nodes: [
        { id: 'C-001-N1', position: [6, -24, 3], sensors: sensor({ ch4_pct: 0.42, co_ppm: 64, temperature_c: 46 }), timestamp: 1, robotId: 'R-031' },
      ],
      parentFractureId: null,
    },
    {
      id: 'C-002',
      name: '运输巷支路',
      type: 'branch',
      path: [[12, -27, 6], [17, -30, 8]],
      length: 20,
      aperture_um: 650,
      porosity: 0.12,
      fractal_dim: 1.1,
      tortuosity: 1.15,
      dip_angle: 5,
      azimuth_angle: 65,
      roughness_coeff: 0.18,
      connectivity: 1,
      sensorReading: sensor({ ch4_pct: 0.21, co_ppm: 14, temperature_c: 30 }),
      nodes: [
        { id: 'C-002-N1', position: [17, -30, 8], sensors: sensor({ ch4_pct: 0.21, co_ppm: 14 }), timestamp: 2, robotId: 'R-032' },
      ],
      parentFractureId: 'C-001',
    },
    {
      id: 'C-003',
      name: '盲巷末端',
      type: 'branch',
      path: [[12, -27, 6], [15, -33, 12]],
      length: 26,
      aperture_um: 700,
      porosity: 0.16,
      fractal_dim: 1.16,
      tortuosity: 1.32,
      dip_angle: 12,
      azimuth_angle: 78,
      roughness_coeff: 0.24,
      connectivity: 1,
      sensorReading: sensor({ ch4_pct: 1.62, co_ppm: 38, temperature_c: 40 }),
      nodes: [
        { id: 'C-003-N1', position: [15, -33, 12], sensors: sensor({ ch4_pct: 1.62, co_ppm: 38, temperature_c: 40 }), timestamp: 3, robotId: 'R-033' },
      ],
      parentFractureId: 'C-001',
    },
    {
      id: 'C-004',
      name: '采空区边界',
      type: 'branch',
      path: [[6, -24, 3], [3, -31, 11]],
      length: 31,
      aperture_um: 1100,
      porosity: 0.22,
      fractal_dim: 1.28,
      tortuosity: 1.41,
      dip_angle: 16,
      azimuth_angle: 20,
      roughness_coeff: 0.3,
      connectivity: 2,
      sensorReading: sensor({ ch4_pct: 1.1, co_ppm: 30, temperature_c: 39 }),
      nodes: [
        { id: 'C-004-N1', position: [3, -31, 11], sensors: sensor({ ch4_pct: 1.1, co_ppm: 30, temperature_c: 39 }), timestamp: 4, robotId: 'R-034' },
      ],
      parentFractureId: 'C-001',
    },
    {
      id: 'C-005',
      name: '回风巷低速段',
      type: 'main',
      path: [[12, -27, 6], [20, -29, 7]],
      length: 36,
      aperture_um: 760,
      porosity: 0.14,
      fractal_dim: 1.12,
      tortuosity: 1.18,
      dip_angle: 6,
      azimuth_angle: 95,
      roughness_coeff: 0.19,
      connectivity: 2,
      sensorReading: sensor({ ch4_pct: 0.84, co_ppm: 22, temperature_c: 37 }),
      nodes: [
        { id: 'C-005-N1', position: [20, -29, 7], sensors: sensor({ ch4_pct: 0.84, co_ppm: 22, temperature_c: 37 }), timestamp: 5, robotId: 'R-035' },
      ],
      parentFractureId: null,
    },
  ];
  return { fractures, scenario: 'coal' as const, gasThreshold: 1.5 };
}

afterEach(restoreGlobals);

describe('streamChat live LLM fallback behavior', () => {
  it('replaces a bare acknowledgement with a scene-aware answer and actions', async () => {
    installLiveSettings();
    globalThis.fetch = async () => sseResponse('好的');

    const response = await streamChat(
      [{ role: 'user', content: '找出危险管段' }],
      () => undefined,
      undefined,
      pipelineContext()
    );

    assert.notEqual(response.message.trim(), '好的');
    assert.match(response.message, /危险管段|高风险|P-001/);
    assert.ok(response.actions?.length);
  });

  it('keeps substantive live replies unchanged', async () => {
    installLiveSettings();
    const liveText = '当前最高风险管段是 P-001，H₂S 与可燃气体均需要复核。';
    globalThis.fetch = async () => sseResponse(liveText);

    const response = await streamChat(
      [{ role: 'user', content: '找出危险管段' }],
      () => undefined,
      undefined,
      pipelineContext()
    );

    assert.equal(response.message, liveText);
  });

  it('turns a live CO heatmap promise without tool calls into CO scene actions', async () => {
    installLiveSettings();
    globalThis.fetch = async () => sseResponse('好的，我来调取CO数据的分布情况。先展开全景视图并开启CO热力图层，以便直观分析。');

    const response = await streamChat(
      [{ role: 'user', content: '分析当前CO浓度' }],
      () => undefined,
      undefined,
      coalContext()
    );

    assert.match(response.message, /CO 浓度分析|CO浓度分析/);
    assert.doesNotMatch(response.message, /CH₄浓度分析|瓦斯浓度分析/);
    assert.ok(response.actions?.some((action) => action.type === 'fitAll'));
    assert.ok(response.actions?.some((action) => action.type === 'markPoints'));
  });

  it('turns a live temperature heatmap promise without tool calls into deterministic heatmap and marker actions', async () => {
    installLiveSettings();
    globalThis.fetch = async () => sseResponse('好的，我为您打开温度热力图图层，并标记高温危险点位。根据实时数据，当前高温区域与瓦斯高浓度区域高度重叠，我们来综合分析。');

    const response = await streamChat(
      [{ role: 'user', content: '打开温度热力图并标记高温危险点位' }],
      () => undefined,
      undefined,
      coalContext()
    );

    assert.match(response.message, /温度场分析/);
    assert.ok(response.actions?.some((action) => action.type === 'fitAll'));
    assert.ok(response.actions?.some((action) => action.type === 'toggleLayer' && action.layer === 'tempHeatmap' && action.visible === true));
    assert.ok(response.actions?.some((action) => action.type === 'markPoints'));
  });

  it('turns a live top-5 danger promise without tool calls into five danger markers', async () => {
    installLiveSettings();
    globalThis.fetch = async () => sseResponse('好的，我来定位并标记当前最危险的TOP5节点。先飞到最危险的点位，然后全部标记。');

    const response = await streamChat(
      [{ role: 'user', content: '找出最危险的TOP5节点并标记' }],
      () => undefined,
      undefined,
      coalContext()
    );

    const markAction = response.actions?.find((action) => action.type === 'markPoints');
    assert.match(response.message, /TOP5|5 个高风险点位|最危险/);
    assert.equal(markAction?.points?.length, 5);
    assert.ok(response.actions?.some((action) => action.type === 'flyTo'));
  });

  it('turns a live ventilation mesh promise without tool calls into mesh coverage actions', async () => {
    installLiveSettings();
    globalThis.fetch = async () => sseResponse('好的，我先查看当前场景的整体布局，然后分析通风盲区和Mesh覆盖情况。让我先飞到全景视角观察整体布局，同时打开相关图层进行分析。');

    const response = await streamChat(
      [{ role: 'user', content: '分析通风盲区和Mesh覆盖' }],
      () => undefined,
      undefined,
      coalContext()
    );

    assert.match(response.message, /通风盲区|Mesh覆盖/);
    assert.ok(response.actions?.some((action) => action.type === 'fitAll'));
    assert.ok(response.actions?.some((action) => action.type === 'toggleLayer' && action.layer === 'mesh' && action.visible === true));
    assert.ok(response.actions?.some((action) => action.type === 'toggleLayer' && action.layer === 'robots' && action.visible === true));
    assert.ok(response.actions?.some((action) => action.type === 'markPoints'));
  });
});
