/**
 * 告警事件 API
 *
 * Mock 模式：从内置 alertDataGenerator 获取
 * Live 模式：从后端 GET /alerts 获取
 *
 * 后端接口定义：
 *   GET /alerts          → AlertEvent[]
 *   GET /alerts?level=   → AlertEvent[]（按级别过滤）
 */

import type { AlertEvent, AlertLevel } from '../data/alertDataGenerator';
import type { DataSourceType, ScenarioType } from '../types';
import { isMockMode } from './config';
import { httpClient } from './httpClient';
import { normalizeAlertRecord } from './normalizers';

// Mock 实现：延迟导入
async function getMockAlerts(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal'): Promise<AlertEvent[]> {
  const { buildSceneDataset } = await import('../domain/sceneDataset');
  return buildSceneDataset(dataSource, scenario).alerts;
}

/**
 * 获取告警事件列表
 * GET /alerts
 */
export async function fetchAlerts(
  signal?: AbortSignal,
  dataSource: DataSourceType = 'fracture',
  scenario: ScenarioType = 'coal',
): Promise<AlertEvent[]> {
  if (isMockMode) {
    return getMockAlerts(dataSource, scenario);
  }
  const raw = await httpClient.get<Record<string, unknown>[]>('/alerts', { signal });
  return raw.map(normalizeAlertRecord);
}

/**
 * 按级别过滤告警
 * GET /alerts?level=critical
 */
export async function fetchAlertsByLevel(
  level: AlertLevel,
  signal?: AbortSignal,
  dataSource: DataSourceType = 'fracture',
  scenario: ScenarioType = 'coal',
): Promise<AlertEvent[]> {
  if (isMockMode) {
    const all = await getMockAlerts(dataSource, scenario);
    return all.filter((a) => a.level === level);
  }
  const raw = await httpClient.get<Record<string, unknown>[]>(`/alerts?level=${level}`, { signal });
  return raw.map(normalizeAlertRecord);
}
