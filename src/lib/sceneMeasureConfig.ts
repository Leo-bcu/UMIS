/**
 * 测量工具场景化配置 — 按场景提供正确的标题、传感器字段和标签
 *
 * 解决问题：区域框选/剖面线/测距等工具之前写死煤矿地质术语，
 * 核反应堆场景还在显示"孔压""渗透率""RQD岩质"等错误参数。
 */

export type MeasureScenarioType =
  | 'coal' | 'gold' | 'oil'
  | 'pipeline' | 'nuclear' | 'refinery'
  | 'underground';

export interface SceneMeasureConfig {
  /** 框选面板标题 */
  areaTitle: string;
  /** 剖面面板标题 */
  profileTitle: string;
  /** 区域内测点称谓 */
  pointLabel: string;       // "裂缝测点" / "管段测点" / "设备测点"
  /** 密度标签 */
  densityLabel: string;     // "裂缝密度" / "管段密度" / "通道密度"

  /** 主传感器 */
  primaryKey: string;       // SensorReading 字段名
  primaryLabel: string;     // "CH₄" / "剂量率" / "壁厚减薄"
  primaryUnit: string;      // "%" / "mSv/h"
  primaryThreshold: number | ((gasThreshold: number) => number);

  /** 次传感器（框选第二行、剖面第六列） */
  secondaryKey: string;
  secondaryLabel: string;
  secondaryUnit: string;

  /** 温度标签（剖面用） */
  tempLabel: string;        // "温度(均)" / "操作温度(均)" / "冷却剂温度(均)"

  /** 是否显示 RQD + 岩质等级（地质场景 true，工业场景 false） */
  showRockGrade: boolean;

  /** 测距"坡角"的替代标签 */
  slopeAngleLabel: string;  // "坡角" / "倾斜角"
}

export interface LocalizedSceneMeasureCopy {
  areaTitle: string;
  profileTitle: string;
  pointLabel: string;
  densityLabel: string;
  primaryLabel: string;
  secondaryLabel: string;
  tempLabel: string;
  slopeAngleLabel: string;
}

export const SCENE_MEASURE_CONFIG: Record<MeasureScenarioType, SceneMeasureConfig> = {
  coal: {
    areaTitle: '煤矿瓦斯分析',
    profileTitle: '巷道剖面分析',
    pointLabel: '巷道测点',
    densityLabel: '巷道密度',
    primaryKey: 'ch4_pct',
    primaryLabel: 'CH₄',
    primaryUnit: '%',
    primaryThreshold: (gt) => gt,
    secondaryKey: 'co_ppm',
    secondaryLabel: 'CO(均)',
    secondaryUnit: 'ppm',
    tempLabel: '巷道温度(均)',
    showRockGrade: true,
    slopeAngleLabel: '坡角',
  },
  gold: {
    areaTitle: '区域应力分析',
    profileTitle: '剖面截面分析',
    pointLabel: '裂缝测点',
    densityLabel: '裂缝密度',
    primaryKey: 'stress_mpa',
    primaryLabel: '应力',
    primaryUnit: 'MPa',
    primaryThreshold: () => 15,
    secondaryKey: 'microseismic_count',
    secondaryLabel: '微震(均)',
    secondaryUnit: '次/h',
    tempLabel: '岩温(均)',
    showRockGrade: true,
    slopeAngleLabel: '坡角',
  },
  oil: {
    areaTitle: '区域储层分析',
    profileTitle: '剖面截面分析',
    pointLabel: '裂缝测点',
    densityLabel: '裂缝密度',
    primaryKey: 'pore_pressure_mpa',
    primaryLabel: '孔隙压力',
    primaryUnit: 'MPa',
    primaryThreshold: () => 30,
    secondaryKey: 'permeability_md',
    secondaryLabel: '渗透率(均)',
    secondaryUnit: 'mD',
    tempLabel: '地层温度(均)',
    showRockGrade: false,
    slopeAngleLabel: '坡角',
  },
  pipeline: {
    areaTitle: '小口径管道分析',
    profileTitle: '管段截面分析',
    pointLabel: '管段测点',
    densityLabel: '管段密度',
    primaryKey: 'rock_strength_mpa',
    primaryLabel: '壁厚损失',
    primaryUnit: '%',
    primaryThreshold: () => 20,
    secondaryKey: 'permeability_md',
    secondaryLabel: '腐蚀速率(均)',
    secondaryUnit: 'mm/yr',
    tempLabel: '管内温度(均)',
    showRockGrade: false,
    slopeAngleLabel: '倾斜角',
  },
  nuclear: {
    areaTitle: '区域辐射分析',
    profileTitle: '管道截面分析',
    pointLabel: '管道测点',
    densityLabel: '管道密度',
    primaryKey: 'ch4_pct',
    primaryLabel: '剂量率',
    primaryUnit: 'mSv/h',
    primaryThreshold: () => 25,
    secondaryKey: 'permeability_md',
    secondaryLabel: 'FAC速率(均)',
    secondaryUnit: 'mm/yr',
    tempLabel: '冷却剂温度(均)',
    showRockGrade: false,
    slopeAngleLabel: '倾斜角',
  },
  refinery: {
    areaTitle: '化工密闭空间分析',
    profileTitle: '储罐截面分析',
    pointLabel: '空间测点',
    densityLabel: '空间密度',
    primaryKey: 'h2s_ppm',
    primaryLabel: 'H₂S',
    primaryUnit: 'ppm',
    primaryThreshold: () => 50,
    secondaryKey: 'ch4_pct',
    secondaryLabel: 'LEL(均)',
    secondaryUnit: '%LEL',
    tempLabel: '空间温度(均)',
    showRockGrade: false,
    slopeAngleLabel: '倾斜角',
  },
  underground: {
    areaTitle: '区域暗流分析',
    profileTitle: '通道截面分析',
    pointLabel: '通道测点',
    densityLabel: '通道密度',
    primaryKey: 'permeability_md',
    primaryLabel: '渗透率(均)',
    primaryUnit: 'mD',
    primaryThreshold: () => 5000,
    secondaryKey: 'temperature_c',
    secondaryLabel: '地温(均)',
    secondaryUnit: '°C',
    tempLabel: '地温(均)',
    showRockGrade: false,
    slopeAngleLabel: '通道倾角',
  },
};

/** 根据场景字符串获取测量配置（兼容 store 的 scenario 字段类型） */
export function getMeasureConfig(scenario: string, gasThreshold: number): SceneMeasureConfig {
  const cfg = SCENE_MEASURE_CONFIG[scenario as MeasureScenarioType] ?? SCENE_MEASURE_CONFIG.coal;
  return {
    ...cfg,
    primaryThreshold:
      typeof cfg.primaryThreshold === 'function'
        ? cfg.primaryThreshold(gasThreshold)
        : cfg.primaryThreshold,
  };
}

const ENGLISH_MEASURE_COPY: Record<MeasureScenarioType, LocalizedSceneMeasureCopy> = {
  coal: {
    areaTitle: 'Coal gas patrol analysis',
    profileTitle: 'Roadway cross-section',
    pointLabel: 'roadway checkpoints',
    densityLabel: 'roadway density',
    primaryLabel: 'CH4',
    secondaryLabel: 'avg CO',
    tempLabel: 'avg roadway temperature',
    slopeAngleLabel: 'slope angle',
  },
  gold: {
    areaTitle: 'Regional stress analysis',
    profileTitle: 'Cross-section profile',
    pointLabel: 'fracture points',
    densityLabel: 'fracture density',
    primaryLabel: 'stress',
    secondaryLabel: 'avg microseismic rate',
    tempLabel: 'avg rock temperature',
    slopeAngleLabel: 'slope angle',
  },
  oil: {
    areaTitle: 'Reservoir zone analysis',
    profileTitle: 'Cross-section profile',
    pointLabel: 'fracture points',
    densityLabel: 'fracture density',
    primaryLabel: 'pore pressure',
    secondaryLabel: 'avg permeability',
    tempLabel: 'avg formation temperature',
    slopeAngleLabel: 'slope angle',
  },
  pipeline: {
    areaTitle: 'Small-bore pipe analysis',
    profileTitle: 'Pipe cross-section',
    pointLabel: 'segment checkpoints',
    densityLabel: 'pipe segment density',
    primaryLabel: 'wall loss',
    secondaryLabel: 'avg corrosion rate',
    tempLabel: 'avg internal temperature',
    slopeAngleLabel: 'inclination',
  },
  nuclear: {
    areaTitle: 'Radiation zone analysis',
    profileTitle: 'Pipe cross-section',
    pointLabel: 'pipe checkpoints',
    densityLabel: 'pipe density',
    primaryLabel: 'dose rate',
    secondaryLabel: 'avg FAC rate',
    tempLabel: 'avg coolant temperature',
    slopeAngleLabel: 'inclination',
  },
  refinery: {
    areaTitle: 'Chemical confined-space analysis',
    profileTitle: 'Tank cross-section',
    pointLabel: 'space checkpoints',
    densityLabel: 'space checkpoint density',
    primaryLabel: 'H2S',
    secondaryLabel: 'avg LEL',
    tempLabel: 'avg space temperature',
    slopeAngleLabel: 'inclination',
  },
  underground: {
    areaTitle: 'Underground-flow zone analysis',
    profileTitle: 'Channel cross-section',
    pointLabel: 'channel checkpoints',
    densityLabel: 'channel density',
    primaryLabel: 'avg permeability',
    secondaryLabel: 'avg ground temperature',
    tempLabel: 'avg ground temperature',
    slopeAngleLabel: 'channel dip',
  },
};

export function getLocalizedMeasureCopy(
  scenario: string,
  locale: 'zh-CN' | 'en-US',
  gasThreshold: number,
): LocalizedSceneMeasureCopy {
  const cfg = getMeasureConfig(scenario, gasThreshold);
  if (locale === 'zh-CN') {
    return {
      areaTitle: cfg.areaTitle,
      profileTitle: cfg.profileTitle,
      pointLabel: cfg.pointLabel,
      densityLabel: cfg.densityLabel,
      primaryLabel: cfg.primaryLabel,
      secondaryLabel: cfg.secondaryLabel,
      tempLabel: cfg.tempLabel,
      slopeAngleLabel: cfg.slopeAngleLabel,
    };
  }

  return ENGLISH_MEASURE_COPY[scenario as MeasureScenarioType] ?? ENGLISH_MEASURE_COPY.coal;
}
