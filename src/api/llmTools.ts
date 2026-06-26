/**
 * LLM Function Calling — 3D 场景控制工具集
 *
 * 定义 LLM 可调用的"函数"（OpenAI-compatible tools），
 * 让 LLM 通过 tool_calls 操控 3D 孪生场景：飞到位置、标记危险点、激活测量工具等。
 *
 * "言出法随"：用户说自然语言 → LLM 理解意图 → 调用对应 tool → 场景执行
 */

import type { SceneAction, Fracture, ScenarioType, SensorReading } from '../types';

// ===================================================================
// 1. OpenAI-compatible Tool Schema（传给 LLM 的函数定义）
// ===================================================================

export const SCENE_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'fly_to_location',
      description: '控制3D相机飞到指定坐标位置，用于定位/聚焦到某个区域。可附带区域名称。',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X坐标' },
          y: { type: 'number', description: 'Y坐标（上下），正为上' },
          z: { type: 'number', description: 'Z坐标（深度），负为地下深处' },
          region: { type: 'string', description: '区域名称标签，如"F-003危险区"' },
        },
        required: ['x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mark_dangerous_points',
      description: '在3D场景中标记一个或多个危险/关键点位，以彩色脉冲标记+文字标签的形式展示。用于"找出最危险的点"、"标记异常区域"等指令。',
      parameters: {
        type: 'object',
        properties: {
          points: {
            type: 'array',
            description: '要标记的点位列表',
            items: {
              type: 'object',
              properties: {
                x: { type: 'number', description: 'X坐标' },
                y: { type: 'number', description: 'Y坐标' },
                z: { type: 'number', description: 'Z坐标' },
                label: { type: 'string', description: '标签文字，如"F-003 CH4超标 3.5%"' },
                level: { type: 'string', enum: ['danger', 'warning', 'info'], description: '危险等级：danger(红)/warning(黄)/info(蓝)' },
              },
              required: ['x', 'y', 'z', 'label', 'level'],
            },
          },
        },
        required: ['points'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'highlight_region',
      description: '高亮一个球形区域，以脉冲光圈形式在3D场景中展示。',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X坐标' },
          y: { type: 'number', description: 'Y坐标' },
          z: { type: 'number', description: 'Z坐标' },
          radius: { type: 'number', description: '高亮球半径（米），默认12' },
        },
        required: ['x', 'y', 'z'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'activate_measurement_tool',
      description: '激活一个测量/标注工具，进入交互模式。用于"帮我测距"、"画剖面线"、"框选区域分析"等指令。',
      parameters: {
        type: 'object',
        properties: {
          tool: {
            type: 'string',
            enum: ['distance', 'profile', 'area', 'text'],
            description: '工具类型：distance(测距)/profile(剖面线)/area(区域框选)/text(文字标注)',
          },
        },
        required: ['tool'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'select_fracture',
      description: '选中某个场景对象，在右侧面板展示其详细信息。',
      parameters: {
        type: 'object',
        properties: {
          fracture_id: { type: 'string', description: '对象ID，如"R-003"或"P-003"' },
        },
        required: ['fracture_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'toggle_layer',
      description: '开启或关闭某个3D图层。',
      parameters: {
        type: 'object',
        properties: {
          layer: {
            type: 'string',
            enum: ['mesh', 'pointCloud', 'gasHeatmap', 'tempHeatmap', 'robots', 'fractures', 'rockMass', 'poi'],
            description: '图层名称',
          },
          visible: { type: 'boolean', description: 'true=显示, false=隐藏' },
        },
        required: ['layer', 'visible'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_gas_threshold',
      description: '调整瓦斯报警阈值。',
      parameters: {
        type: 'object',
        properties: {
          threshold: { type: 'number', description: '瓦斯阈值百分比，如1.0表示1.0%' },
        },
        required: ['threshold'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'switch_scenario',
      description: '切换行业场景（煤矿瓦斯/金矿/油气储层/小口径管道/核反应堆/化工密闭空间/地下暗流）。',
      parameters: {
        type: 'object',
        properties: {
          scenario: { type: 'string', enum: ['coal', 'gold', 'oil', 'pipeline', 'nuclear', 'refinery', 'underground'], description: '场景类型' },
        },
        required: ['scenario'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'fit_all_view',
      description: '重置相机到全景视角，查看整个3D场景。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'clear_markers',
      description: '清除3D场景中所有AI标记的危险点。',
      parameters: { type: 'object', properties: {} },
    },
  },
];

interface ToolPointArg {
  x: number;
  y: number;
  z: number;
  label: string;
  level?: 'danger' | 'warning' | 'info';
  detail?: string;
  source?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseToolPoint(value: unknown): ToolPointArg | null {
  if (!isRecord(value)) return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  const level = value.level === 'danger' || value.level === 'warning' || value.level === 'info'
    ? value.level
    : 'info';
  return {
    x,
    y,
    z,
    label: String(value.label ?? 'AI 标记'),
    level,
    detail: typeof value.detail === 'string' ? value.detail : undefined,
    source: typeof value.source === 'string' ? value.source : undefined,
  };
}

function sensorValue(sensors: SensorReading, key: keyof SensorReading): number {
  return sensors[key];
}

// ===================================================================
// 2. Tool Call → SceneAction 转换
// ===================================================================

export function parseToolCall(
  functionName: string,
  args: Record<string, unknown>
): SceneAction | null {
  switch (functionName) {
    case 'fly_to_location':
      return {
        type: 'flyTo',
        position: [Number(args.x), Number(args.y), Number(args.z)],
        region: args.region as string | undefined,
      };

    case 'mark_dangerous_points': {
      const pts = Array.isArray(args.points)
        ? args.points.map(parseToolPoint).filter((point): point is ToolPointArg => point !== null)
        : [];
      return {
        type: 'markPoints',
        points: pts.map((p) => ({
          position: [p.x, p.y, p.z],
          label: p.label,
          level: p.level,
          detail: p.detail,
          source: p.source,
        })),
      };
    }

    case 'highlight_region':
      return {
        type: 'highlight',
        position: [Number(args.x), Number(args.y), Number(args.z)],
        radius: Number(args.radius) || 12,
      };

    case 'activate_measurement_tool':
      return {
        type: 'activateTool',
        tool: args.tool as SceneAction['tool'],
      };

    case 'select_fracture':
      return {
        type: 'selectFracture',
        fractureId: args.fracture_id as string,
      };

    case 'toggle_layer':
      return {
        type: 'toggleLayer',
        layer: args.layer as string,
        visible: typeof args.visible === 'boolean' ? args.visible : undefined,
      };

    case 'set_gas_threshold':
      return {
        type: 'setGasThreshold',
        threshold: Number(args.threshold),
      };

    case 'switch_scenario':
      return {
        type: 'switchScenario',
        scenario: args.scenario as ScenarioType,
      };

    case 'fit_all_view':
      return { type: 'fitAll' };

    case 'clear_markers':
      return { type: 'clearMarkers' };

    default:
      return null;
  }
}

// ===================================================================
// 3. 场景上下文注入（让 LLM 知道当前场景数据）
// ===================================================================

export function buildSceneContext(
  fractures: Fracture[],
  scenario: ScenarioType,
  gasThreshold: number
): string {
  const scenarioNames: Record<ScenarioType, string> = {
    coal: '煤矿',
    gold: '金矿',
    oil: '油气',
    pipeline: '小口径管道',
    nuclear: '核反应堆',
    refinery: '化工密闭空间',
    underground: '地下暗流',
  };

  const sensorKey: Record<ScenarioType, keyof SensorReading> = {
    coal: 'ch4_pct',
    gold: 'stress_mpa',
    oil: 'permeability_md',
    pipeline: 'rock_strength_mpa',
    nuclear: 'ch4_pct',
    refinery: 'h2s_ppm',
    underground: 'permeability_md',
  };

  const sensorLabel: Record<ScenarioType, string> = {
    coal: 'CH4浓度(%)',
    gold: '应力(MPa)',
    oil: '渗透率(mD)',
    pipeline: '壁厚损失(%)',
    nuclear: '剂量率(mSv/h)',
    refinery: 'H2S浓度(ppm)',
    underground: '流速(m/s)',
  };

  const key = sensorKey[scenario];
  const label = sensorLabel[scenario];

  // 场景特定的报警阈值标签
  const thresholdLabelMap: Record<ScenarioType, string> = {
    coal: `瓦斯报警阈值：${gasThreshold}%`,
    gold: `微震预警阈值：15 次/h`,
    oil: `孔隙压力预警：30 MPa`,
    pipeline: `壁厚损失阈值：20%`,
    nuclear: `剂量率控制阈值：25 mSv/h`,
    refinery: `H2S 报警阈值：50 ppm`,
    underground: `流速异常阈值：3.0 m/s`,
  };

  // 找出最危险的节点（按场景关键传感器排序）
  const allNodes = fractures.flatMap((f) =>
    f.nodes.map((n) => ({
      fractureId: f.id,
      fractureName: f.name,
      nodeId: n.id,
      position: n.position,
      value: sensorValue(n.sensors, key),
      ch4: n.sensors.ch4_pct,
      temp: n.sensors.temperature_c,
      stress: n.sensors.stress_mpa,
      permeability: n.sensors.permeability_md,
      waterPressure: n.sensors.water_pressure_mpa,
      microseismic: n.sensors.microseismic_count,
    }))
  );

  // 按危险度排序
  const sorted = [...allNodes].sort((a, b) => {
    if (scenario === 'coal') return b.ch4 - a.ch4;
    if (scenario === 'gold') return b.stress - a.stress;
    if (scenario === 'pipeline') return b.value - a.value;
    if (scenario === 'nuclear') return b.ch4 - a.ch4;
    if (scenario === 'refinery') return b.value - a.value; // 按 H2S 排序
    // oil / underground 按渗透率/流速排序
    return b.permeability - a.permeability;
  });

  const top5 = sorted.slice(0, 5);
  const overThreshold = allNodes.filter((n) => {
    if (scenario === 'coal') return n.ch4 > gasThreshold;
    if (scenario === 'gold') return n.stress > 15;
    if (scenario === 'pipeline') return n.value > 20;
    if (scenario === 'nuclear') return n.ch4 > 25;
    if (scenario === 'refinery') return n.value > 50; // H2S >50ppm
    if (scenario === 'underground') return n.permeability > 3.0; // 流速 >3.0 m/s
    return n.permeability > 1.0; // oil
  });

  const fractureSummary = fractures
    .slice(0, 8)
    .map((f) => {
      const avgSensor =
        f.nodes.length > 0
          ? (f.nodes.reduce((sum, n) => sum + sensorValue(n.sensors, key), 0) / f.nodes.length).toFixed(2)
          : 'N/A';
      const isPipeMode = scenario === 'pipeline' || scenario === 'nuclear' || scenario === 'refinery';
  const geomLabel = isPipeMode ? '壁厚' : '开度';
  const geomUnit = isPipeMode ? 'mm' : 'µm';
  const geomVal = isPipeMode ? (f.aperture_um / 1000).toFixed(1) : f.aperture_um.toString();
  return `  - ${f.id} (${f.name}): 类型=${f.type}, 长度=${f.length.toFixed(1)}m, ${geomLabel}=${geomVal}${geomUnit}, 节点${f.nodes.length}个, 均值${label}=${avgSensor}`;
    })
    .join('\n');

  // 场景特定的 TOP5 节点辅助参数描述
  const auxDescMap: Record<ScenarioType, (n: typeof top5[0]) => string> = {
    coal: (n) => `CH₄=${n.ch4}%, CO=${n.ch4}ppm, 温度=${n.temp}°C, 井下压力=${n.stress}MPa, 风流=${n.waterPressure}MPa, 采样密度=${n.permeability}mD`,
    gold: (n) => `微震=${n.microseismic}次/h, 温度=${n.temp}°C, 应力=${n.stress}MPa, 渗透率=${n.permeability}mD`,
    oil: (n) => `孔隙压力=${n.waterPressure}MPa, 温度=${n.temp}°C, 渗透率=${n.permeability}mD`,
    pipeline: (n) => `壁厚损失=${n.value.toFixed(1)}%, 温度=${n.temp}°C, 压力=${n.stress}MPa, 腐蚀=${n.permeability.toFixed(2)}mm/yr`,
    nuclear: (n) => `剂量率=${n.ch4}mSv/h, 疲劳=${(n.waterPressure).toFixed(0)}%, FAC=${n.permeability}mm/yr, 振动=${n.microseismic}mm/s, 温度=${n.temp}°C`,
    refinery: (n) => `H2S=${n.value.toFixed(0)}ppm, LEL=${n.ch4.toFixed(1)}%LEL, 温度=${n.temp}°C, O2=${n.stress}MPa`,
    underground: (n) => `流速=${n.permeability}m/s, 温度=${n.temp}°C, 水压=${n.waterPressure}MPa, 渗透率=${n.permeability}mD`,
  };

  const topPoints = top5
    .map(
      (n, i) =>
        `  ${i + 1}. [${n.position[0].toFixed(1)}, ${n.position[1].toFixed(1)}, ${n.position[2].toFixed(1)}] ${n.fractureId} ${n.fractureName} — ${label}=${n.value.toFixed(2)}, ${auxDescMap[scenario](n)}`
    )
    .join('\n');

  return `## 当前3D场景实时数据（供你分析和操作使用）

### 场景：${scenarioNames[scenario]}
### ${thresholdLabelMap[scenario]}
### 裂缝/管道总数：${fractures.length} 条
### 超阈值节点：${overThreshold.length} 个

### 裂缝概览（前8条）
${fractureSummary}

### 最危险 TOP5 节点（按${label}排序）
${topPoints}

### 坐标范围
- X: -50 ~ 50
- Y: -20 ~ 20（正为上）
- Z: -40 ~ 40（负为地下深处）

你可以使用工具在3D场景中操作：
- fly_to_location: 飞到某坐标
- mark_dangerous_points: 标记危险点（红色脉冲标记+标签）
- highlight_region: 高亮区域
- activate_measurement_tool: 激活测量工具(distance/profile/area)
- select_fracture: 选中裂缝
- toggle_layer: 开关图层
- set_gas_threshold / switch_scenario / fit_all_view / clear_markers`;
}
