/**
 * 兴趣点数据 — 地下岩体地表裂缝入口
 * 岩体范围: x[-50,50], y[-20,20], z[-40,40]
 * 裂缝入口都在顶部地表(Y≈18~20)，向下延伸
 */
import type { POI } from '../types';

export const poiData: POI[] = [
  {
    id: 'POI-001',
    position: [-35, 18, -20],
    label: '1号裂缝入口',
    type: 'crack',
    description: 'F-001 主裂缝地表入口，蛇形机器人 R-005 已从此进入，裂缝开度 45µm',
    sensors: {
      ch4_concentration_pct: 2.1,
      temperature_celsius: 28.5,
      pressure_kpa: 108.5,
    },
  },
  {
    id: 'POI-002',
    position: [10, 19, -15],
    label: '2号裂缝入口',
    type: 'crack',
    description: 'F-002 主裂缝地表入口，检测到微震活动增加，攀爬式机器人驻守中',
    sensors: {
      ch4_concentration_pct: 1.8,
      temperature_celsius: 30.2,
      pressure_kpa: 105.2,
    },
  },
  {
    id: 'POI-003',
    position: [-10, 20, 20],
    label: '3号裂缝入口',
    type: 'crack',
    description: 'F-003 主裂缝地表入口，瓦斯浓度偏高，已部署爆炸性气体传感器',
    sensors: {
      ch4_concentration_pct: 3.2,
      temperature_celsius: 35.6,
      pressure_kpa: 112.8,
    },
  },
  {
    id: 'POI-004',
    position: [30, 18, 5],
    label: '4号裂缝入口',
    type: 'crack',
    description: 'F-004 主裂缝地表入口，裂缝扩展速率监测中',
    sensors: {
      ch4_concentration_pct: 1.2,
      temperature_celsius: 27.8,
      pressure_kpa: 104.0,
    },
  },
  {
    id: 'POI-005',
    position: [-40, 19, 10],
    label: '5号裂缝入口',
    type: 'crack',
    description: 'F-005 主裂缝地表入口，HIVE 群智机器人 R-07 当前驻留探测',
    sensors: {
      ch4_concentration_pct: 0.6,
      temperature_celsius: 26.5,
      pressure_kpa: 103.5,
    },
  },
  {
    id: 'POI-006',
    position: [20, 20, -30],
    label: '6号裂缝入口',
    type: 'crack',
    description: 'F-006 主裂缝地表入口，深层渗透率测量点',
    sensors: {
      ch4_concentration_pct: 2.5,
      temperature_celsius: 32.0,
      pressure_kpa: 108.0,
    },
  },
];
