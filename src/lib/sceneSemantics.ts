import type { ScenarioType, SensorReading } from '../types';
import type { Locale } from '../domain/i18nCatalog';

export interface SceneMetricConfig {
  key: keyof SensorReading;
  label: string;
  unit: string;
  threshold: number;
  fallbackBase: number[];
}

export interface SceneSemantics {
  objectLabel: string;
  networkLabel: string;
  nodeLabel: string;
  regionPrefix: string;
  status: {
    nodeLabel: string;
    confidenceLabel: string;
    overThresholdLabel: string;
    throughputLabel: string;
  };
  threshold: {
    label: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    defaultValue: number;
    precision: number;
    tooltip: string;
  };
  trend: {
    primary: SceneMetricConfig;
    temperature: SceneMetricConfig;
    aux: SceneMetricConfig;
  };
  robotTelemetry: {
    primary: { label: string; unit: string; threshold: number };
    temperature: { label: string; unit: string };
    aux: { label: string; unit: string };
  };
  export: {
    reportAudience: string;
    objectDescription: string;
    sensorMatrixDescription: string;
  };
}

export const SCENE_SEMANTICS: Record<ScenarioType, SceneSemantics> = {
  coal: {
    objectLabel: '巷道裂隙',
    networkLabel: '煤矿巷道瓦斯巡测网络',
    nodeLabel: '巷道测点',
    regionPrefix: '巷道段',
    status: {
      nodeLabel: '气体传感节点',
      confidenceLabel: '平均置信度',
      overThresholdLabel: 'CH₄ 超标区',
      throughputLabel: '数据吞吐',
    },
    threshold: {
      label: '瓦斯报警红线',
      unit: '%',
      min: 0.5,
      max: 5,
      step: 0.1,
      defaultValue: 1.5,
      precision: 1,
      tooltip: '拖动滑块调整 CH₄ 报警阈值。3D 巷道/裂隙网络会按节点实测浓度重绘，高于阈值的区域显示为风险色。',
    },
    trend: {
      primary: { key: 'ch4_pct', label: 'CH₄ 浓度', unit: '%', threshold: 1.5, fallbackBase: [1.8, 2.6, 0.6, 1.2] },
      temperature: { key: 'temperature_c', label: '巷道温度', unit: '°C', threshold: 40, fallbackBase: [35, 40, 28, 32] },
      aux: { key: 'co_ppm', label: 'CO 浓度', unit: 'ppm', threshold: 50, fallbackBase: [8, 28, 2, 15] },
    },
    robotTelemetry: {
      primary: { label: 'CH₄', unit: '%', threshold: 1.5 },
      temperature: { label: '温度', unit: '°C' },
      aux: { label: '湿度', unit: '%' },
    },
    export: {
      reportAudience: '矿长/安监/投资人',
      objectDescription: '矿井巷道切片、细小裂隙、通风盲区与机器人路径的 3D 模型。',
      sensorMatrixDescription: '巷道测点 CH₄、CO、O₂、温度、机器人状态、Mesh 覆盖与告警事件。',
    },
  },
  gold: {
    objectLabel: '裂缝',
    networkLabel: '金矿裂缝网络',
    nodeLabel: '裂缝测点',
    regionPrefix: '采区',
    status: {
      nodeLabel: '微震/应力测点',
      confidenceLabel: '平均置信度',
      overThresholdLabel: '微震预警区',
      throughputLabel: '数据吞吐',
    },
    threshold: {
      label: '微震报警阈值',
      unit: '次/h',
      min: 5,
      max: 30,
      step: 1,
      defaultValue: 15,
      precision: 0,
      tooltip: '拖动滑块调整微震事件报警阈值。超过阈值的采区需要优先复核岩爆风险。',
    },
    trend: {
      primary: { key: 'microseismic_count', label: '微震频率', unit: '次/h', threshold: 15, fallbackBase: [8, 16, 4, 10] },
      temperature: { key: 'temperature_c', label: '岩温', unit: '°C', threshold: 45, fallbackBase: [32, 38, 26, 30] },
      aux: { key: 'stress_mpa', label: '应力', unit: 'MPa', threshold: 15, fallbackBase: [12, 18, 8, 14] },
    },
    robotTelemetry: {
      primary: { label: '微震', unit: '次/h', threshold: 15 },
      temperature: { label: '温度', unit: '°C' },
      aux: { label: '湿度', unit: '%' },
    },
    export: {
      reportAudience: '矿山调度/安监/工程技术',
      objectDescription: '采区裂缝网络、应力测点与机器人路径的 3D 三角网格模型。',
      sensorMatrixDescription: '裂缝测点微震、应力、岩温、机器人状态与告警事件。',
    },
  },
  oil: {
    objectLabel: '储层裂缝',
    networkLabel: '油气储层裂缝网络',
    nodeLabel: '储层测点',
    regionPrefix: '储层',
    status: {
      nodeLabel: '储层测点',
      confidenceLabel: '平均置信度',
      overThresholdLabel: '孔压预警区',
      throughputLabel: '数据吞吐',
    },
    threshold: {
      label: '孔隙压力阈值',
      unit: 'MPa',
      min: 10,
      max: 35,
      step: 1,
      defaultValue: 30,
      precision: 0,
      tooltip: '拖动滑块调整孔隙压力阈值。超过阈值的储层段需要复核连通性和压裂风险。',
    },
    trend: {
      primary: { key: 'pore_pressure_mpa', label: '孔隙压力', unit: 'MPa', threshold: 30, fallbackBase: [18, 28, 12, 22] },
      temperature: { key: 'temperature_c', label: '地层温度', unit: '°C', threshold: 90, fallbackBase: [65, 80, 50, 70] },
      aux: { key: 'permeability_md', label: '渗透率', unit: 'mD', threshold: 3, fallbackBase: [1.2, 2.8, 0.5, 1.8] },
    },
    robotTelemetry: {
      primary: { label: '孔压', unit: 'MPa', threshold: 30 },
      temperature: { label: '温度', unit: '°C' },
      aux: { label: '湿度', unit: '%' },
    },
    export: {
      reportAudience: '油藏工程/测井解释/项目管理',
      objectDescription: '储层裂缝网络、孔压/渗透率测点与机器人路径的 3D 模型。',
      sensorMatrixDescription: '储层测点孔压、渗透率、地层温度、机器人状态与告警事件。',
    },
  },
  pipeline: {
    objectLabel: '小口径管段',
    networkLabel: 'DN50-DN150 小口径管道',
    nodeLabel: '管段测点',
    regionPrefix: '支线管段',
    status: {
      nodeLabel: '管段测点',
      confidenceLabel: '平均置信度',
      overThresholdLabel: '壁厚预警区',
      throughputLabel: '数据吞吐',
    },
    threshold: {
      label: '壁厚损失阈值',
      unit: '%',
      min: 5,
      max: 60,
      step: 1,
      defaultValue: 20,
      precision: 0,
      tooltip: '拖动滑块调整小口径管道壁厚损失阈值。超过阈值的管段需要优先超声复检、腐蚀评估和可通行性复核。',
    },
    trend: {
      primary: { key: 'rock_strength_mpa', label: '壁厚损失', unit: '%', threshold: 20, fallbackBase: [6, 18, 2, 12] },
      temperature: { key: 'temperature_c', label: '管道温度', unit: '°C', threshold: 50, fallbackBase: [15, 35, 8, 22] },
      aux: { key: 'permeability_md', label: '腐蚀速率', unit: 'mm/yr', threshold: 0.3, fallbackBase: [0.05, 0.22, 0.01, 0.12] },
    },
    robotTelemetry: {
      primary: { label: '泄漏', unit: '%LEL', threshold: 20 },
      temperature: { label: '温度', unit: '°C' },
      aux: { label: '湿度', unit: '%' },
    },
    export: {
      reportAudience: '管线运维/完整性管理/安全监管',
      objectDescription: 'DN50-DN150 管段内腔、壁厚/腐蚀测点与机器人巡检路径的 3D 模型。',
      sensorMatrixDescription: '管段测点壁厚损失、腐蚀速率、H₂S、泄漏、压力、机器人状态与告警事件。',
    },
  },
  nuclear: {
    objectLabel: '管道',
    networkLabel: '核反应堆管道系统',
    nodeLabel: '管道测点',
    regionPrefix: '环路',
    status: {
      nodeLabel: '辐射/管道测点',
      confidenceLabel: '平均置信度',
      overThresholdLabel: '剂量预警区',
      throughputLabel: '数据吞吐',
    },
    threshold: {
      label: '剂量率控制阈值',
      unit: 'mSv/h',
      min: 1,
      max: 100,
      step: 1,
      defaultValue: 25,
      precision: 0,
      tooltip: '拖动滑块调整剂量率控制阈值。超过阈值的管道区域需要限制人员接近并复核屏蔽边界。',
    },
    trend: {
      primary: { key: 'ch4_pct', label: '剂量率', unit: 'mSv/h', threshold: 25, fallbackBase: [0.8, 12, 0.2, 3.5] },
      temperature: { key: 'temperature_c', label: '冷却剂温度', unit: '°C', threshold: 327, fallbackBase: [293, 327, 280, 305] },
      aux: { key: 'stress_mpa', label: '运行压力', unit: 'MPa', threshold: 16, fallbackBase: [15.5, 15.5, 12, 15.5] },
    },
    robotTelemetry: {
      primary: { label: '剂量', unit: 'mSv/h', threshold: 25 },
      temperature: { label: '温度', unit: '°C' },
      aux: { label: '压力', unit: 'MPa' },
    },
    export: {
      reportAudience: '核设施检修/辐射防护/工程管理',
      objectDescription: '反应堆管道、剂量测点、FAC/疲劳测点与机器人路径的 3D 模型。',
      sensorMatrixDescription: '管道测点剂量率、冷却剂温度、压力、FAC、机器人状态与告警事件。',
    },
  },
  refinery: {
    objectLabel: '密闭空间',
    networkLabel: '化工储罐/反应釜内部空间',
    nodeLabel: '空间测点',
    regionPrefix: '罐内区域',
    status: {
      nodeLabel: '气体/壁厚测点',
      confidenceLabel: '平均置信度',
      overThresholdLabel: 'H₂S 预警区',
      throughputLabel: '数据吞吐',
    },
    threshold: {
      label: 'H₂S 报警阈值',
      unit: 'ppm',
      min: 5,
      max: 100,
      step: 5,
      defaultValue: 50,
      precision: 0,
      tooltip: '拖动滑块调整密闭空间 H₂S 报警阈值。超过阈值的罐内区域需要复核通风置换、人员进入许可和气体复测。',
    },
    trend: {
      primary: { key: 'h2s_ppm', label: 'H₂S 浓度', unit: 'ppm', threshold: 50, fallbackBase: [8, 55, 2, 22] },
      temperature: { key: 'temperature_c', label: '空间温度', unit: '°C', threshold: 60, fallbackBase: [24, 48, 18, 35] },
      aux: { key: 'ch4_pct', label: '可燃气体', unit: '%LEL', threshold: 10, fallbackBase: [2, 18, 0, 6] },
    },
    robotTelemetry: {
      primary: { label: 'LEL', unit: '%LEL', threshold: 10 },
      temperature: { label: '温度', unit: '°C' },
      aux: { label: 'O₂', unit: '%' },
    },
    export: {
      reportAudience: '设备完整性/检修/安全环保',
      objectDescription: '储罐/反应釜密闭空间、人孔入口、内壁腐蚀/壁厚测点与机器人路径的 3D 模型。',
      sensorMatrixDescription: '空间测点 H₂S、VOC/LEL、O₂、温度、压力、腐蚀、壁厚、机器人状态与告警事件。',
    },
  },
  underground: {
    objectLabel: '暗流通道',
    networkLabel: '地下暗流通道网络',
    nodeLabel: '通道测点',
    regionPrefix: '暗流通道',
    status: {
      nodeLabel: '水文测点',
      confidenceLabel: '平均置信度',
      overThresholdLabel: '渗透预警区',
      throughputLabel: '数据吞吐',
    },
    threshold: {
      label: '渗透率预警阈值',
      unit: 'mD',
      min: 100,
      max: 10000,
      step: 100,
      defaultValue: 5000,
      precision: 0,
      tooltip: '拖动滑块调整地下暗流通道的渗透率预警阈值。超过阈值的含水层通道需要优先复核水压、地温和连通性。',
    },
    trend: {
      primary: { key: 'permeability_md', label: '渗透率', unit: 'mD', threshold: 5000, fallbackBase: [800, 5200, 450, 2600] },
      temperature: { key: 'temperature_c', label: '地温', unit: '°C', threshold: 90, fallbackBase: [42, 86, 34, 68] },
      aux: { key: 'water_pressure_mpa', label: '水压', unit: 'MPa', threshold: 8, fallbackBase: [2.5, 7.8, 1.2, 5.4] },
    },
    robotTelemetry: {
      primary: { label: '矿化度', unit: 'mg/L', threshold: 50000 },
      temperature: { label: '地温', unit: '°C' },
      aux: { label: '含水率', unit: '%' },
    },
    export: {
      reportAudience: '水文地质/安全评估/工程管理',
      objectDescription: '地下暗流通道、含水层测点与机器人探测路径的 3D 模型。',
      sensorMatrixDescription: '通道测点渗透率、水压、地温、pH、含水饱和度、机器人状态与告警事件。',
    },
  },
};

export function getSceneSemantics(scenario: ScenarioType | string): SceneSemantics {
  return SCENE_SEMANTICS[scenario as ScenarioType] ?? SCENE_SEMANTICS.coal;
}

export function getLocalizedSceneLabels(scenario: ScenarioType | string, locale: Locale = 'zh-CN') {
  const semantics = getSceneSemantics(scenario);
  if (locale === 'zh-CN') {
    return {
      status: semantics.status,
      trend: {
        primaryLabel: `平均${semantics.trend.primary.label}`,
      },
    };
  }

  const labelMap: Record<ScenarioType, {
    nodeLabel: string;
    confidenceLabel: string;
    overThresholdLabel: string;
    throughputLabel: string;
    primaryLabel: string;
  }> = {
    coal: {
      nodeLabel: 'Sensor Nodes',
      confidenceLabel: 'Avg Confidence',
      overThresholdLabel: 'CH4 Risk Zones',
      throughputLabel: 'Data Throughput',
      primaryLabel: 'Avg CH4',
    },
    gold: {
      nodeLabel: 'Microseismic/Stress Nodes',
      confidenceLabel: 'Avg Confidence',
      overThresholdLabel: 'Microseismic Risk Zones',
      throughputLabel: 'Data Throughput',
      primaryLabel: 'Avg Microseismic',
    },
    oil: {
      nodeLabel: 'Reservoir Nodes',
      confidenceLabel: 'Avg Confidence',
      overThresholdLabel: 'Pore Pressure Risk Zones',
      throughputLabel: 'Data Throughput',
      primaryLabel: 'Avg Pore Pressure',
    },
    pipeline: {
      nodeLabel: 'Pipe Segment Nodes',
      confidenceLabel: 'Avg Confidence',
      overThresholdLabel: 'Wall-Loss Risk Zones',
      throughputLabel: 'Data Throughput',
      primaryLabel: 'Avg Wall Loss',
    },
    nuclear: {
      nodeLabel: 'Radiation/Pipe Nodes',
      confidenceLabel: 'Avg Confidence',
      overThresholdLabel: 'Dose Risk Zones',
      throughputLabel: 'Data Throughput',
      primaryLabel: 'Avg Dose Rate',
    },
    refinery: {
      nodeLabel: 'Confined-Space Nodes',
      confidenceLabel: 'Avg Confidence',
      overThresholdLabel: 'H2S Risk Zones',
      throughputLabel: 'Data Throughput',
      primaryLabel: 'Avg H2S',
    },
    underground: {
      nodeLabel: 'Hydrology Nodes',
      confidenceLabel: 'Avg Confidence',
      overThresholdLabel: 'Permeability Risk Zones',
      throughputLabel: 'Data Throughput',
      primaryLabel: 'Avg Permeability',
    },
  };

  const localized = labelMap[scenario as ScenarioType] ?? labelMap.coal;
  return {
    status: {
      nodeLabel: localized.nodeLabel,
      confidenceLabel: localized.confidenceLabel,
      overThresholdLabel: localized.overThresholdLabel,
      throughputLabel: localized.throughputLabel,
    },
    trend: {
      primaryLabel: localized.primaryLabel,
    },
  };
}

export function getLocalizedSceneObjectLabel(scenario: ScenarioType | string, locale: Locale = 'zh-CN') {
  const semantics = getSceneSemantics(scenario);
  if (locale === 'zh-CN') return semantics.objectLabel;

  const labelMap: Record<ScenarioType, string> = {
    coal: 'Mine Roadway',
    gold: 'Fracture',
    oil: 'Reservoir Fracture',
    pipeline: 'Pipe Segment',
    nuclear: 'Reactor Pipe',
    refinery: 'Confined Space',
    underground: 'Underground Channel',
  };

  return labelMap[scenario as ScenarioType] ?? labelMap.coal;
}

export function getLocalizedNetworkLabel(scenario: ScenarioType | string, locale: Locale = 'zh-CN') {
  const semantics = getSceneSemantics(scenario);
  if (locale === 'zh-CN') return semantics.networkLabel;

  const labelMap: Record<ScenarioType, string> = {
    coal: 'Coal-Gas Roadway Network',
    gold: 'Gold-Mine Fracture Network',
    oil: 'Reservoir Fracture Network',
    pipeline: 'Small-Bore Pipe Network',
    nuclear: 'Reactor Piping System',
    refinery: 'Chemical Confined-Space Network',
    underground: 'Underground Channel Network',
  };

  return labelMap[scenario as ScenarioType] ?? labelMap.coal;
}

export function getLocalizedThresholdCopy(scenario: ScenarioType | string, locale: Locale = 'zh-CN') {
  const semantics = getSceneSemantics(scenario);
  if (locale === 'zh-CN') {
    return semantics.threshold;
  }

  const copyMap: Record<ScenarioType, { label: string; tooltip: string; unit?: string }> = {
    coal: {
      label: 'CH4 Alarm Threshold',
      tooltip: 'Adjust the CH4 alarm threshold. The 3D roadway and fissure network is recolored from measured node values, and regions above the threshold are highlighted as risk zones.',
    },
    gold: {
      label: 'Microseismic Alarm Threshold',
      unit: 'events/h',
      tooltip: 'Adjust the microseismic event threshold. Stopes above the threshold should be reviewed first for rockburst risk.',
    },
    oil: {
      label: 'Pore Pressure Threshold',
      tooltip: 'Adjust the pore-pressure threshold. Reservoir segments above the threshold should be reviewed for connectivity and stimulation risk.',
    },
    pipeline: {
      label: 'Wall-Loss Threshold',
      tooltip: 'Adjust the small-bore pipe wall-loss threshold. Segments above the threshold should be prioritized for ultrasonic recheck, corrosion review, and passability validation.',
    },
    nuclear: {
      label: 'Dose-Rate Control Threshold',
      tooltip: 'Adjust the dose-rate control threshold. Pipe regions above the threshold require restricted human access and shielding-boundary review.',
    },
    refinery: {
      label: 'H2S Alarm Threshold',
      tooltip: 'Adjust the confined-space H2S threshold. Areas above the threshold require ventilation, gas re-test, and entry-permit review.',
    },
    underground: {
      label: 'Permeability Warning Threshold',
      tooltip: 'Adjust the underground-channel permeability threshold. Channels above the threshold should be reviewed together with water pressure, geothermal gradient, and connectivity.',
    },
  };

  return {
    ...semantics.threshold,
    ...copyMap[scenario as ScenarioType],
  };
}

export function getLocalizedTrendLabels(scenario: ScenarioType | string, locale: Locale = 'zh-CN') {
  const semantics = getSceneSemantics(scenario);
  if (locale === 'zh-CN') {
    return semantics.trend;
  }

  const labelMap: Record<ScenarioType, { primary: string; temperature: string; aux: string; primaryUnit?: string; auxUnit?: string; temperatureUnit?: string }> = {
    coal: { primary: 'CH4 Concentration', temperature: 'Roadway Temperature', aux: 'CO Concentration' },
    gold: { primary: 'Microseismic Rate', temperature: 'Rock Temperature', aux: 'Stress', primaryUnit: 'events/h' },
    oil: { primary: 'Pore Pressure', temperature: 'Formation Temperature', aux: 'Permeability' },
    pipeline: { primary: 'Wall Loss', temperature: 'Pipe Temperature', aux: 'Corrosion Rate' },
    nuclear: { primary: 'Dose Rate', temperature: 'Coolant Temperature', aux: 'Operating Pressure' },
    refinery: { primary: 'H2S Concentration', temperature: 'Space Temperature', aux: 'Flammable Gas' },
    underground: { primary: 'Permeability', temperature: 'Geothermal Temperature', aux: 'Water Pressure' },
  };

  const localized = labelMap[scenario as ScenarioType] ?? labelMap.coal;
  return {
    ...semantics.trend,
    primary: { ...semantics.trend.primary, label: localized.primary, unit: localized.primaryUnit ?? semantics.trend.primary.unit },
    temperature: { ...semantics.trend.temperature, label: localized.temperature, unit: localized.temperatureUnit ?? semantics.trend.temperature.unit },
    aux: { ...semantics.trend.aux, label: localized.aux, unit: localized.auxUnit ?? semantics.trend.aux.unit },
  };
}
