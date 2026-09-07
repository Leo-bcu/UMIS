/**
 * 裂缝网络 API
 *
 * Mock 模式：从内置 fractureDataGenerator 获取
 * Live 模式：从后端 GET /fractures?scenario= 获取
 *
 * 后端接口定义：
 *   GET /fractures?scenario=coal|gold|oil  → Fracture[]
 *   GET /fractures/:id                     → Fracture
 */

import type { Fracture, ScenarioType } from '../types';
import { isMockMode } from './config';
import { httpClient } from './httpClient';
import { normalizeFractureRecord } from './normalizers';

// Mock 实现：延迟导入，仅 mock 模式加载
async function getMockFractures(scenario: ScenarioType): Promise<Fracture[]> {
  const { buildSceneDataset } = await import('../domain/sceneDataset');
  const dataSource =
    scenario === 'pipeline' || scenario === 'nuclear' || scenario === 'refinery' || scenario === 'underground'
      ? scenario
      : 'fracture';
  return buildSceneDataset(dataSource, scenario).fractures;
}

/**
 * 获取裂缝网络数据
 * GET /fractures?scenario=coal|gold|oil
 */
export async function fetchFractures(
  scenario: ScenarioType = 'coal',
  signal?: AbortSignal
): Promise<Fracture[]> {
  if (isMockMode) {
    return getMockFractures(scenario);
  }
  const raw = await httpClient.get<Record<string, unknown>[]>(`/fractures?scenario=${scenario}`, { signal });
  return raw.map(normalizeFractureRecord);
}

/**
 * 获取单条裂缝详情
 * GET /fractures/:id
 */
export async function fetchFractureById(
  id: string,
  signal?: AbortSignal
): Promise<Fracture | undefined> {
  if (isMockMode) {
    const fractures = await getMockFractures('coal');
    return fractures.find((f) => f.id === id);
  }
  const raw = await httpClient.get<Record<string, unknown>>(`/fractures/${id}`, { signal });
  return normalizeFractureRecord(raw);
}
