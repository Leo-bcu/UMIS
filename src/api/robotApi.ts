/**
 * 集群机器人 API
 *
 * Mock 模式：从内置 robotDataGenerator 获取
 * Live 模式：从后端 GET /robots 获取
 *
 * 后端接口定义：
 *   GET /robots              → Robot[]（支持 query 参数过滤）
 *   GET /robots/:id          → Robot
 *   GET /robots/stats        → RobotFleetStats
 */

import type { Robot, DataSourceType, ScenarioType } from '../types';
import type { RobotQuery, RobotFleetStats } from '../types/api';
import { isMockMode } from './config';
import { httpClient } from './httpClient';
import { normalizeRobotFleetStatsRecord, normalizeRobotRecord } from './normalizers';

async function getMockRobots(query?: RobotQuery, dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal'): Promise<Robot[]> {
  const { buildSceneDataset } = await import('../domain/sceneDataset');
  let robots = buildSceneDataset(dataSource, scenario).robots;

  if (query?.q) {
    const q = query.q.toLowerCase();
    robots = robots.filter(r => r.id.toLowerCase().includes(q));
  }
  if (query?.status && query.status !== 'all') {
    robots = robots.filter(r => r.status === query.status);
  }
  if (query?.model && query.model !== 'all') {
    robots = robots.filter(r => r.model === query.model);
  }
  if (query?.meshRole && query.meshRole !== 'all') {
    robots = robots.filter(r => r.meshRole === query.meshRole);
  }
  return robots;
}

async function getMockRobotStats(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal'): Promise<RobotFleetStats> {
  const { buildSceneDataset } = await import('../domain/sceneDataset');
  return buildSceneDataset(dataSource, scenario).summary.robotFleet;
}

/**
 * 获取机器人列表（支持过滤）
 * GET /robots?status=&model=&mesh_role=&q=
 */
export async function fetchRobots(
  query?: RobotQuery,
  signal?: AbortSignal,
  dataSource: DataSourceType = 'fracture',
  scenario: ScenarioType = 'coal',
): Promise<Robot[]> {
  if (isMockMode) {
    return getMockRobots(query, dataSource, scenario);
  }

  const params = new URLSearchParams();
  if (query?.status && query.status !== 'all') params.set('status', query.status);
  if (query?.model && query.model !== 'all') params.set('model', query.model);
  if (query?.meshRole && query.meshRole !== 'all') params.set('mesh_role', query.meshRole);
  if (query?.q) params.set('q', query.q);

  const qs = params.toString();
  const raw = await httpClient.get<Record<string, unknown>[]>(`/robots${qs ? `?${qs}` : ''}`, { signal });
  return raw.map(normalizeRobotRecord);
}

/**
 * 获取单个机器人详情
 * GET /robots/:id
 */
export async function fetchRobotById(
  id: string,
  signal?: AbortSignal,
  dataSource: DataSourceType = 'fracture',
  scenario: ScenarioType = 'coal',
): Promise<Robot> {
  if (isMockMode) {
    const { buildSceneDataset } = await import('../domain/sceneDataset');
    return buildSceneDataset(dataSource, scenario).robots.find(r => r.id === id)!;
  }
  const raw = await httpClient.get<Record<string, unknown>>(`/robots/${id}`, { signal });
  return normalizeRobotRecord(raw);
}

/**
 * 获取机器人集群统计
 * GET /robots/stats
 */
export async function fetchRobotStats(
  signal?: AbortSignal,
  dataSource: DataSourceType = 'fracture',
  scenario: ScenarioType = 'coal',
): Promise<RobotFleetStats> {
  if (isMockMode) {
    return getMockRobotStats(dataSource, scenario);
  }
  const raw = await httpClient.get<Record<string, unknown>>('/robots/stats', { signal });
  return normalizeRobotFleetStatsRecord(raw);
}
