/**
 * 场景数据 API
 *
 * Mock 模式：从内置 mockDataGenerator 获取
 * Live 模式：从后端 GET /scene/* 获取
 *
 * 后端接口定义：
 *   GET /scene/nodes     → SceneNode[]
 *   GET /scene/geometry  → FlatGeometryData (JSON 序列化)
 *   GET /scene/stats     → SceneStats
 */

import type { DataSourceType, ScenarioType, SceneNode } from '../types';
import type { SceneStats, FlatGeometryData } from '../types/api';
import { isMockMode } from './config';
import { httpClient, ApiError } from './httpClient';
import { normalizeFlatGeometryRecord, normalizeSceneNodeRecord, normalizeSceneStatsRecord } from './normalizers';

// Mock 实现延迟导入，仅在 mock 模式下加载
async function getMockNodes(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal'): Promise<SceneNode[]> {
  if (dataSource !== 'fracture') {
    const { buildSceneDataset } = await import('../domain/sceneDataset');
    return buildSceneDataset(dataSource, scenario).fractures.flatMap((fracture) =>
      fracture.nodes.map((node) => ({
        node_id: node.id,
        timestamp: node.timestamp,
        confidence_score: 0.6,
        geometry: {
          center: { x: node.position[0], y: node.position[1], z: node.position[2] },
          mesh_vertices: [],
          raw_points: [],
        },
        sensors: {
          ch4_concentration_pct: node.sensors.ch4_pct,
          temperature_celsius: node.sensors.temperature_c,
          pressure_kpa: node.sensors.water_pressure_mpa * 1000,
        },
      })),
    );
  }
  const { generateMockNodes } = await import('../data/mockDataGenerator');
  return generateMockNodes();
}

async function getMockFlatGeometry(): Promise<FlatGeometryData> {
  const { getFlatGeometryData } = await import('../data/mockDataGenerator');
  return getFlatGeometryData();
}

async function getMockStats(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal'): Promise<SceneStats> {
  const { buildSceneDataset } = await import('../domain/sceneDataset');
  return buildSceneDataset(dataSource, scenario).summary.scene;
}

/**
 * 获取全部场景节点
 * GET /scene/nodes
 */
export async function fetchSceneNodes(
  signal?: AbortSignal,
  dataSource: DataSourceType = 'fracture',
  scenario: ScenarioType = 'coal',
): Promise<SceneNode[]> {
  if (isMockMode) {
    return getMockNodes(dataSource, scenario);
  }
  const raw = await httpClient.get<Record<string, unknown>[]>('/scene/nodes', { signal });
  return raw.map(normalizeSceneNodeRecord);
}

/**
 * 获取预计算的扁平几何数据（用于 Three.js BufferGeometry）
 * GET /scene/geometry
 *
 * Live 模式下后端返回 JSON，前端需将 number[] 转为 Float32Array
 */
export async function fetchFlatGeometry(signal?: AbortSignal): Promise<FlatGeometryData> {
  if (isMockMode) {
    return getMockFlatGeometry();
  }

  // 后端返回 JSON 格式（Float32Array 无法直接 JSON 序列化）
  const raw = await httpClient.get<{
    [key: string]: unknown;
  }>('/scene/geometry', { signal });
  return normalizeFlatGeometryRecord(raw);
}

/**
 * 获取场景统计信息
 * GET /scene/stats
 */
export async function fetchSceneStats(
  signal?: AbortSignal,
  dataSource: DataSourceType = 'fracture',
  scenario: ScenarioType = 'coal',
): Promise<SceneStats> {
  if (isMockMode) {
    return getMockStats(dataSource, scenario);
  }
  const raw = await httpClient.get<Record<string, unknown>>('/scene/stats', { signal });
  return normalizeSceneStatsRecord(raw);
}

export { ApiError };
