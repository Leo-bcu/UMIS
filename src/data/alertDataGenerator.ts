/**
 * 实时告警事件 mock 数据生成器
 * 按数据源生成场景特定的告警：瓦斯/剂量率/泄漏/减薄、温度异常、设备离线等
 */

import type { Robot, DataSourceType, ScenarioType, AlertEvent, AlertLevel, AlertType } from '../types';
export type { AlertEvent, AlertLevel, AlertType } from '../types';

/** 场景特定告警配置 */
interface ScenarioAlertCfg {
  primaryLabel: string;     // 主监测指标名称
  primaryUnit: string;      // 单位
  primaryThreshold: number;  // 告警阈值
  primaryTitle: string;      // 告警标题
  tempLabel: string;         // 温度指标名称
  tempThreshold: number;     // 温度告警阈值(°C)
  secondaryLabel?: string;
  secondaryThreshold?: number;
  depthLabel: string;        // 距离/深度标签
  robotCount: number;        // 系统告警中的机器人数量
}

type AlertScenarioKey = DataSourceType | ScenarioType;

const SCENARIO_CFG: Record<AlertScenarioKey, ScenarioAlertCfg> = {
  fracture: {
    primaryLabel: 'CH₄', primaryUnit: '%', primaryThreshold: 1.5,
    primaryTitle: 'CH₄ 浓度超标', tempLabel: '环境温度', tempThreshold: 40,
    secondaryLabel: 'CO', secondaryThreshold: 50,
    depthLabel: 'Z', robotCount: 200,
  },
  coal: {
    primaryLabel: 'CH₄', primaryUnit: '%', primaryThreshold: 1.5,
    primaryTitle: 'CH₄ 浓度超标', tempLabel: '环境温度', tempThreshold: 40,
    depthLabel: 'Z', robotCount: 200,
  },
  gold: {
    primaryLabel: '微震事件', primaryUnit: '次/h', primaryThreshold: 15,
    primaryTitle: '微震活动异常', tempLabel: '岩温', tempThreshold: 45,
    depthLabel: '深度', robotCount: 200,
  },
  oil: {
    primaryLabel: '孔隙压力', primaryUnit: 'MPa', primaryThreshold: 30,
    primaryTitle: '储层孔隙压力异常', tempLabel: '地层温度', tempThreshold: 90,
    depthLabel: '深度', robotCount: 200,
  },
  pipeline: {
    primaryLabel: '泄漏', primaryUnit: '%LEL', primaryThreshold: 20,
    primaryTitle: '小口径管道泄漏超标', tempLabel: '管道温度', tempThreshold: 50,
    secondaryLabel: 'H₂S', secondaryThreshold: 50,
    depthLabel: '行程', robotCount: 150,
  },
  nuclear: {
    primaryLabel: '剂量', primaryUnit: 'mSv/h', primaryThreshold: 25,
    primaryTitle: '剂量率超标', tempLabel: '冷却剂温度', tempThreshold: 325,
    depthLabel: '距RPV', robotCount: 180,
  },
  refinery: {
    primaryLabel: 'H₂S', primaryUnit: 'ppm', primaryThreshold: 50,
    primaryTitle: '密闭空间 H₂S 超标', tempLabel: '操作温度', tempThreshold: 60,
    secondaryLabel: 'LEL', secondaryThreshold: 10,
    depthLabel: '行程', robotCount: 160,
  },
  underground: {
    primaryLabel: '矿化度', primaryUnit: 'mg/L', primaryThreshold: 50000,
    primaryTitle: '矿化度异常', tempLabel: '地温', tempThreshold: 90,
    depthLabel: '深度', robotCount: 160,
  },
};

function systemAlertsFor(cfg: ScenarioAlertCfg): { type: AlertType; level: AlertLevel; title: string; desc: string }[] {
  return [
    {
      type: 'system',
      level: 'info',
      title: '系统启动完成',
      desc: `HIVE 数字孪生主控舱初始化完毕，${cfg.robotCount} 台机器人已注册，Mesh 网络拓扑建立成功`,
    },
    {
      type: 'task_complete',
      level: 'info',
      title: '区域扫描完成',
      desc: `三维扫描任务完成，重建 12,000 个体素节点，点云置信度 60%，当前场景主指标为 ${cfg.primaryLabel}`,
    },
  ];
}

// 按数据源 + 子场景分别缓存，避免 fracture 下煤矿/金矿/油气共用告警语义。
const cache: Record<string, AlertEvent[]> = {};

function resolveAlertScenarioKey(dataSource: DataSourceType, scenario: ScenarioType): AlertScenarioKey {
  return dataSource === 'fracture' ? scenario : dataSource;
}

function cacheKeyFor(dataSource: DataSourceType, scenario: ScenarioType): string {
  return dataSource === 'fracture' ? `fracture:${scenario}` : dataSource;
}

function primaryReadingFor(robot: Robot, key: AlertScenarioKey): number {
  if (key === 'gold') return robot.sensors.ch4;
  if (key === 'oil') return robot.sensors.ch4;
  if (key === 'underground') return robot.sensors.ch4;
  return robot.sensors.ch4;
}

export function generateMockAlerts(
  robots?: Robot[],
  dataSource: DataSourceType = 'fracture',
  scenario: ScenarioType = 'coal',
): AlertEvent[] {
  const cacheKey = cacheKeyFor(dataSource, scenario);
  if (cache[cacheKey]) return cache[cacheKey]!;
  if (!robots) return [];

  const scenarioKey = resolveAlertScenarioKey(dataSource, scenario);
  const cfg = SCENARIO_CFG[scenarioKey];
  const alerts: AlertEvent[] = [];
  let counter = 0;

  // System alerts
  for (const sys of systemAlertsFor(cfg)) {
    alerts.push({
      id: `alert-${String(++counter).padStart(4, '0')}`,
      level: sys.level,
      type: sys.type,
      title: sys.title,
      description: sys.desc,
      timestamp: Date.now() - Math.floor(Math.random() * 3600000 * 2),
      acknowledged: false,
    });
  }

  // Robot-based alerts
  for (const r of robots) {
    let triggered = false;
    let level: AlertLevel = 'warning';
    let title = '';
    let desc = '';
    let type: AlertType = 'system';

    if (r.status === 'error') {
      triggered = true; level = 'danger'; type = 'robot_error';
      title = `设备故障 — ${r.id}`;
      desc = `${r.id} 报告硬件异常，型号 ${r.model}，需要人工介入检查`;
    } else if (r.status === 'offline') {
      triggered = true; level = 'warning'; type = 'robot_offline';
      title = `机器人离线 — ${r.id}`;
      desc = `${r.id} 已失联，最后位置 [${r.position.map(v => v.toFixed(1)).join(', ')}]，${cfg.depthLabel}=${r.depth}m`;
    } else if (r.status === 'low_battery') {
      triggered = true; level = 'warning'; type = 'battery_low';
      title = `电量告警 — ${r.id}`;
      desc = `${r.id} 电量仅剩 ${r.battery}%，建议尽快返回充电桩，当前任务: ${r.task}`;
    } else if (!r.meshConnected && r.status !== 'maintenance') {
      triggered = true; level = 'warning'; type = 'mesh_disconnect';
      title = `Mesh 组网中断 — ${r.id}`;
      desc = `${r.id} 从 Mesh 网络掉线，角色 ${r.meshRole}，影响区域 ${cfg.depthLabel}=${r.depth}m 通信链路`;
    } else if (primaryReadingFor(r, scenarioKey) > cfg.primaryThreshold) {
      const primaryReading = primaryReadingFor(r, scenarioKey);
      triggered = true; level = 'danger'; type = 'gas_overload';
      title = `${cfg.primaryTitle} — ${r.id}`;
      desc = `${r.id} 检测到 ${cfg.primaryLabel} ${primaryReading}${cfg.primaryUnit}，超过安全阈值 ${cfg.primaryThreshold}${cfg.primaryUnit}，位置 ${cfg.depthLabel}=${r.depth}m`;
    } else if (cfg.secondaryLabel && cfg.secondaryThreshold !== undefined && r.sensors.humidity > cfg.secondaryThreshold) {
      triggered = true; level = 'warning'; type = 'temp_anomaly';
      title = `${cfg.secondaryLabel} 异常 — ${r.id}`;
      desc = `${r.id} 检测到 ${cfg.secondaryLabel} 超过 ${cfg.secondaryThreshold}，位置 ${cfg.depthLabel}=${r.depth}m`;
    } else if (r.sensors.temperature > cfg.tempThreshold) {
      triggered = true; level = 'danger'; type = 'temp_anomaly';
      title = `${cfg.tempLabel}异常 — ${r.id}`;
      desc = `${r.id} ${cfg.tempLabel} ${r.sensors.temperature}°C，超出正常范围，位置 ${cfg.depthLabel}=${r.depth}m`;
    }

    if (triggered && Math.random() > 0.3) {
      alerts.push({
        id: `alert-${String(++counter).padStart(4, '0')}`,
        level, type, title, description: desc,
        robotId: r.id, position: r.position,
        timestamp: Date.now() - Math.floor(Math.random() * 1800000),
        acknowledged: Math.random() > 0.6,
      });
    }
  }

  alerts.sort((a, b) => b.timestamp - a.timestamp);
  cache[cacheKey] = alerts;
  return alerts;
}
