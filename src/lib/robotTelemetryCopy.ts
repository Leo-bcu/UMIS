import type { ScenarioType } from '../types';

export interface RobotTelemetryCopy {
  primary: { label: string; unit: string; threshold: number };
  temperature: { label: string; unit: string };
  aux: { label: string; unit: string };
  depthLabel: string;
}

const ROBOT_TELEMETRY_COPY: Record<ScenarioType, RobotTelemetryCopy> = {
  coal: {
    primary: { label: 'CH₄', unit: '%', threshold: 1.5 },
    temperature: { label: '温度', unit: '°C' },
    aux: { label: '湿度', unit: '%' },
    depthLabel: '深度',
  },
  gold: {
    primary: { label: '微震', unit: '次/h', threshold: 15 },
    temperature: { label: '温度', unit: '°C' },
    aux: { label: '湿度', unit: '%' },
    depthLabel: '深度',
  },
  oil: {
    primary: { label: '孔压', unit: 'MPa', threshold: 30 },
    temperature: { label: '温度', unit: '°C' },
    aux: { label: '湿度', unit: '%' },
    depthLabel: '深度',
  },
  pipeline: {
    primary: { label: '泄漏', unit: '%LEL', threshold: 20 },
    temperature: { label: '温度', unit: '°C' },
    aux: { label: '湿度', unit: '%' },
    depthLabel: '行程',
  },
  nuclear: {
    primary: { label: '剂量', unit: 'mSv/h', threshold: 25 },
    temperature: { label: '温度', unit: '°C' },
    aux: { label: '湿度', unit: '%' },
    depthLabel: '距RPV',
  },
  refinery: {
    primary: { label: '减薄', unit: '%', threshold: 3 },
    temperature: { label: '温度', unit: '°C' },
    aux: { label: '湿度', unit: '%' },
    depthLabel: '行程',
  },
  underground: {
    primary: { label: '矿化度', unit: 'mg/L', threshold: 50000 },
    temperature: { label: '地温', unit: '°C' },
    aux: { label: '湿度', unit: '%' },
    depthLabel: '深度',
  },
};

export function getRobotTelemetryCopy(scenario: ScenarioType): RobotTelemetryCopy {
  return ROBOT_TELEMETRY_COPY[scenario];
}
