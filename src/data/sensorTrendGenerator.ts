/**
 * 传感器时序趋势 mock 数据生成器
 * 从裂缝节点传感器聚合多个区域的趋势数据
 * 每个区域包含 主指标 / 温度 / 辅助指标时序，体现不同位置的差异
 * 区域坐标从实际裂缝数据动态计算
 */

import type { Fracture, ScenarioType } from '../types';
import { getSceneSemantics, type SceneMetricConfig } from '../lib/sceneSemantics';

export interface RegionTrend {
  regionId: string;
  regionName: string;
  timestamps: number[];
  ch4: number[];
  temperature: number[];
  pressure: number[];
  /** 该区域包含的机器人/节点数 */
  nodeCount: number;
  /** 3D 场景中心坐标，用于点击区域时相机飞过去 */
  center: [number, number, number];
  /** 区域包围球半径 */
  radius: number;
  /** 该区域包含的裂缝 ID 列表 — 点击区域时高亮这些裂缝 */
  fractureIds: string[];
}

export interface SensorTrend {
  timestamps: number[];
  ch4: number[];
  temperature: number[];
  pressure: number[];
  /** 各区域分项趋势 */
  regions: RegionTrend[];
  /** 数据来源说明 */
  source: string;
}

interface RegionConfig {
  id: string;
  name: string;
  center: [number, number, number];
  radius: number;
  basePrimary: number;
  baseTemp: number;
  baseAux: number;
  nodeRatio: number;
  fractureIds: string[];
}

const REGION_DIRS = ['north', 'central', 'south', 'east'];
const REGION_NAMES = ['北部', '中央', '南部', '东部'];

/** 计算裂缝群的中心点和包围球半径 */
function computeFractureCluster(
  fractures: Fracture[]
): { center: [number, number, number]; radius: number } {
  if (fractures.length === 0) {
    return { center: [0, 0, 0], radius: 4 };
  }
  const allPoints = fractures.flatMap((f) => f.path);
  if (allPoints.length === 0) return { center: [0, 0, 0], radius: 4 };

  const cx = allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length;
  const cy = allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length;
  const cz = allPoints.reduce((s, p) => s + p[2], 0) / allPoints.length;

  // 半径 = 最远点到中心，但上限 5（传感器区域是局部概念，不应覆盖全场景）
  let maxDist = 0;
  for (const p of allPoints) {
    const d = Math.sqrt((p[0]-cx)**2 + (p[1]-cy)**2 + (p[2]-cz)**2);
    if (d > maxDist) maxDist = d;
  }

  return {
    center: [+cx.toFixed(1), +cy.toFixed(1), +cz.toFixed(1)],
    radius: Math.min(5, Math.max(3, +(maxDist * 0.3).toFixed(1))),
  };
}

/** 按象限将裂缝分为4个区域，每个区域计算实际中心 + 记录裂缝ID */
function averageMetric(fractures: Fracture[], metric: SceneMetricConfig, fallback: number): number {
  const readings = fractures.flatMap((fracture) => [
    fracture.sensorReading,
    ...fracture.nodes.map((node) => node.sensors),
  ]);
  const values = readings
    .map((reading) => reading[metric.key])
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) return fallback;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 100) / 100;
}

/** 按象限将通道对象分为4个区域，每个区域计算实际中心 + 记录对象ID */
function divideFracturesIntoRegions(fractures: Fracture[], scenario: ScenarioType): RegionConfig[] {
  const semantics = getSceneSemantics(scenario);
  const trend = semantics.trend;
  if (fractures.length === 0) {
    // 无数据时用默认坐标
    return REGION_DIRS.map((id, i) => ({
      id,
      name: `${REGION_NAMES[i]}${semantics.regionPrefix}`,
      basePrimary: trend.primary.fallbackBase[i],
      baseTemp: trend.temperature.fallbackBase[i],
      baseAux: trend.aux.fallbackBase[i],
      nodeRatio: [0.3, 0.25, 0.25, 0.2][i],
      center: [[-25, 0, -25], [0, 0, 0], [25, -10, 25], [35, 0, -10]][i] as [number, number, number],
      radius: 15,
      fractureIds: [] as string[],
    }));
  }

  // 计算全局中心
  const allPoints = fractures.flatMap((f) => f.path);
  const cx = allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length;
  const cz = allPoints.reduce((s, p) => s + p[2], 0) / allPoints.length;

  // 按象限分组
  const groups: { fractures: Fracture[]; ids: string[] }[] = [
    { fractures: [], ids: [] },
    { fractures: [], ids: [] },
    { fractures: [], ids: [] },
    { fractures: [], ids: [] },
  ];
  for (const f of fractures) {
    const fCenter = f.path.reduce((a, p) => [a[0]+p[0], a[1]+p[1], a[2]+p[2]], [0,0,0]);
    const fx = fCenter[0] / f.path.length;
    const fz = fCenter[2] / f.path.length;
    const dx = fx - cx;
    const dz = fz - cz;
    const dist = Math.sqrt(dx*dx + dz*dz);

    if (dist < 15) {
      groups[1].fractures.push(f); groups[1].ids.push(f.id);
    } else if (dz < -5) {
      groups[0].fractures.push(f); groups[0].ids.push(f.id);
    } else if (dx > 10) {
      groups[3].fractures.push(f); groups[3].ids.push(f.id);
    } else {
      groups[2].fractures.push(f); groups[2].ids.push(f.id);
    }
  }

  return REGION_DIRS.map((id, i) => {
    const groupFractures = groups[i].fractures;
    const cluster = computeFractureCluster(groupFractures);
    return {
      id,
      name: `${REGION_NAMES[i]}${semantics.regionPrefix}`,
      basePrimary: averageMetric(groupFractures, trend.primary, trend.primary.fallbackBase[i]),
      baseTemp: averageMetric(groupFractures, trend.temperature, trend.temperature.fallbackBase[i]),
      baseAux: averageMetric(groupFractures, trend.aux, trend.aux.fallbackBase[i]),
      nodeRatio: [0.3, 0.25, 0.25, 0.2][i],
      ...cluster,
      fractureIds: groups[i].ids,
    };
  });
}

export function generateMockSensorTrend(totalNodes: number = 100, fractures?: Fracture[], scenario: ScenarioType = 'coal', points = 30): SensorTrend {
  const semantics = getSceneSemantics(scenario);
  const trend = semantics.trend;

  const now = Date.now();
  const timestamps: number[] = [];

  // points 个数据点，5 分钟 apart（points=30 → 2.5h，points=12 → 1h）
  for (let i = points - 1; i >= 0; i--) {
    timestamps.push(now - i * 5 * 60 * 1000);
  }

  // 动态计算区域边界
  const regionConfigs = divideFracturesIntoRegions(fractures || [], scenario);

  // 为每个区域生成趋势
  const regions: RegionTrend[] = regionConfigs.map((cfg_r) => {
    const rCh4: number[] = [];
    const rTemp: number[] = [];
    const rPressure: number[] = [];

    const last = points - 1;
    for (let i = last; i >= 0; i--) {
      const phase = i * 0.3;
      const spikeStart = Math.round(points * 0.6);
      const spikeEnd = Math.round(points * 0.8);
      const spike = cfg_r.basePrimary > trend.primary.threshold * 0.6 && i > spikeStart && i < spikeEnd ? cfg_r.basePrimary * 0.5 : 0;
      rCh4.push(Math.max(0.01, Math.round((cfg_r.basePrimary + Math.sin(phase) * cfg_r.basePrimary * 0.15 + spike + (Math.random() - 0.5) * cfg_r.basePrimary * 0.1) * 100) / 100));

      rTemp.push(Math.round((cfg_r.baseTemp + (last - i) * 0.2 + Math.sin(i * 0.5) * cfg_r.baseTemp * 0.03 + (Math.random() - 0.5) * 0.8) * 10) / 10);

      rPressure.push(Math.round((cfg_r.baseAux + Math.sin(i * 0.4) * cfg_r.baseAux * 0.02 + (Math.random() - 0.5) * cfg_r.baseAux * 0.08) * 10) / 10);
    }

    return {
      regionId: cfg_r.id,
      regionName: cfg_r.name,
      timestamps,
      ch4: rCh4,
      temperature: rTemp,
      pressure: rPressure,
      nodeCount: 0,
      center: cfg_r.center,
      radius: cfg_r.radius,
      fractureIds: cfg_r.fractureIds,
    };
  });

  for (let i = 0; i < regions.length - 1; i++) {
    regions[i].nodeCount = Math.max(0, Math.floor(totalNodes * regionConfigs[i].nodeRatio));
  }
  const remainder = Math.max(0, totalNodes - regions.slice(0, -1).reduce((sum, region) => sum + region.nodeCount, 0));
  regions[regions.length - 1].nodeCount = remainder;

  // 加权聚合为全局趋势
  const aggCh4: number[] = [];
  const aggTemp: number[] = [];
  const aggPressure: number[] = [];

  for (let i = 0; i < 30; i++) {
    let weightedCh4 = 0, weightedTemp = 0, weightedPressure = 0, totalWeight = 0;
    for (const r of regions) {
      const w = r.nodeCount;
      weightedCh4 += r.ch4[i] * w;
      weightedTemp += r.temperature[i] * w;
      weightedPressure += r.pressure[i] * w;
      totalWeight += w;
    }
    if (totalWeight === 0) {
      aggCh4.push(0);
      aggTemp.push(0);
      aggPressure.push(0);
    } else {
      aggCh4.push(Math.round((weightedCh4 / totalWeight) * 100) / 100);
      aggTemp.push(Math.round((weightedTemp / totalWeight) * 10) / 10);
      aggPressure.push(Math.round((weightedPressure / totalWeight) * 10) / 10);
    }
  }

  return {
    timestamps,
    ch4: aggCh4,
    temperature: aggTemp,
    pressure: aggPressure,
    regions,
    source: `${totalNodes} 个${semantics.nodeLabel}加权聚合 · 4 个${semantics.regionPrefix}`,
  };
}
