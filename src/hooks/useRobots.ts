import { useState, useEffect, useMemo } from 'react';
import { fetchRobots, fetchRobotStats } from '../api/robotApi';
import type { Robot, Monitor, MonitorFrame, DataSourceType, ScenarioType, MonitorDetectionSummary } from '../types';
import type { RobotFleetStats, MonitorFleetStats } from '../types/api';
import { useSceneStore } from '../store/useSceneStore';
import { bootstrapMonitorDetections, inferMonitorFrame, inferMonitorBatch, summarizeFrames, getMonitorPrimaryImage } from '../domain/monitorInference';

const CAMERA_IMAGE_MODULES = import.meta.glob('../../approch/camera/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const CAMERA_FRAME_POOL = Object.values(CAMERA_IMAGE_MODULES).sort();

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildFrameHistory(seed: number): MonitorFrame[] {
  const pool = CAMERA_FRAME_POOL.length > 0 ? CAMERA_FRAME_POOL : [''];
  const imageUrl = shuffle(pool)[0] ?? '';
  return [{ index: 0, imageUrl, capturedAt: Date.now() - seed * 1000, recognizedLabels: [], detectionCounts: {} }];
}

function summarizeFrame(frame?: MonitorFrame | null): MonitorDetectionSummary[] {
  return summarizeFrames(frame ? [frame] : []);
}

const monitorInferenceCache = new Map<string, MonitorFrame>();

function inferenceKey(monitorId: string, imageUrl: string): string {
  return `${monitorId}::${imageUrl}`;
}

function getCachedFrame(monitorId: string, imageUrl: string): MonitorFrame | null {
  return monitorInferenceCache.get(inferenceKey(monitorId, imageUrl)) ?? null;
}

function setCachedFrame(monitorId: string, imageUrl: string, frame: MonitorFrame): void {
  monitorInferenceCache.set(inferenceKey(monitorId, imageUrl), frame);
}

async function inferFrameForMonitor(monitorId: string, imageUrl: string, force = false): Promise<MonitorFrame> {
  const cached = !force ? getCachedFrame(monitorId, imageUrl) : null;
  if (cached) return cached;
  const res = await inferMonitorFrame({ monitorId, imageUrl, force });
  const frame = res.frameHistory[0] ?? { index: 0, imageUrl, capturedAt: res.cachedAt, recognizedLabels: [], detectionCounts: {} };
  setCachedFrame(monitorId, imageUrl, frame);
  return frame;
}

async function primeMonitorDetectionCache(monitors: Monitor[]): Promise<void> {
  const requests = monitors.map((monitor, index) => ({
    monitorId: monitor.id,
    imageUrl: getMonitorPrimaryImage(monitor) || CAMERA_FRAME_POOL[index % CAMERA_FRAME_POOL.length] || '',
  })).filter((item) => item.imageUrl);
  if (requests.length === 0) return;
  const results = await inferMonitorBatch(requests);
  results.forEach((result) => {
    const frame = result.frameHistory[0];
    if (frame) setCachedFrame(result.monitorId, result.imageUrl, frame);
  });
  useSceneStore.setState((state) => ({
    monitorFrameMap: results.reduce<Record<string, MonitorFrame>>((acc, result) => {
      const frame = result.frameHistory[0];
      if (frame) acc[result.monitorId] = frame;
      return acc;
    }, { ...state.monitorFrameMap }),
  }));
}

// 模块级缓存（按数据源分别缓存）
const robotCache: Record<string, Robot[] | null> = {};
const statsCache: Record<string, RobotFleetStats | null> = {};
const monitorCache: Record<string, Monitor[] | null> = {};
const monitorStatsCache: Record<string, MonitorFleetStats | null> = {};

function cacheKey(dataSource: DataSourceType, scenario: ScenarioType): string {
  return dataSource === 'fracture' ? `${dataSource}:${scenario}` : dataSource;
}

/** 清除指定数据源的缓存（切换数据源时调用） */
export function clearRobotCache(dataSource: DataSourceType) {
  for (const key of Object.keys(robotCache)) {
    if (key === dataSource || key.startsWith(`${dataSource}:`)) robotCache[key] = null;
  }
  for (const key of Object.keys(statsCache)) {
    if (key === dataSource || key.startsWith(`${dataSource}:`)) statsCache[key] = null;
  }
  for (const key of Object.keys(monitorCache)) {
    if (key === dataSource || key.startsWith(`${dataSource}:`)) monitorCache[key] = null;
  }
  for (const key of Object.keys(monitorStatsCache)) {
    if (key === dataSource || key.startsWith(`${dataSource}:`)) monitorStatsCache[key] = null;
  }
}

export interface RobotFilter {
  status: string;
  model: string;
  meshRole: string;
  q: string;
}

export const defaultFilter: RobotFilter = {
  status: 'all',
  model: 'all',
  meshRole: 'all',
  q: '',
};

/**
 * 获取全部机器人列表（带模块缓存，按数据源区分）
 */
export function useAllRobots(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const key = cacheKey(dataSource, scenario);
  const [data, setData] = useState<Robot[] | null>(robotCache[key]);
  const [loading, setLoading] = useState(!robotCache[key]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (robotCache[key]) { setData(robotCache[key]); return; }
    const ctrl = new AbortController();
    setLoading(true);
    fetchRobots(undefined, ctrl.signal, dataSource, scenario)
      .then((robots) => {
        robotCache[key] = robots;
        setData(robots);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [dataSource, key, scenario]);

  return { data, loading, error };
}

/**
 * 获取集群统计（带模块缓存，按数据源区分）
 */
export function useRobotStats(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const key = cacheKey(dataSource, scenario);
  const [data, setData] = useState<RobotFleetStats | null>(statsCache[key]);
  const [loading, setLoading] = useState(!statsCache[key]);

  useEffect(() => {
    if (statsCache[key]) { setData(statsCache[key]); return; }
    const ctrl = new AbortController();
    setLoading(true);
    fetchRobotStats(ctrl.signal, dataSource, scenario)
      .then((stats) => {
        statsCache[key] = stats;
        setData(stats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [dataSource, key, scenario]);

  return { data, loading };
}

/**
 * 带过滤的机器人列表 Hook
 */
export function useFilteredRobots(filter: RobotFilter, dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const { data: allRobots, loading } = useAllRobots(dataSource, scenario);

  const filtered = useMemo(() => {
    if (!allRobots) return [];
    return allRobots.filter((r) => {
      if (filter.q && !r.id.toLowerCase().includes(filter.q.toLowerCase())) return false;
      if (filter.status !== 'all' && r.status !== filter.status) return false;
      if (filter.model !== 'all' && r.model !== filter.model) return false;
      if (filter.meshRole !== 'all' && r.meshRole !== filter.meshRole) return false;
      return true;
    });
  }, [allRobots, filter]);

  return { data: filtered, loading, total: allRobots?.length ?? 0 };
}

export interface MonitorFilter {
  status: string;
  q: string;
}

export const defaultMonitorFilter: MonitorFilter = {
  status: 'all',
  q: '',
};

export function useAllMonitors(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const key = cacheKey(dataSource, scenario);
  const [data, setData] = useState<Monitor[] | null>(monitorCache[key]);
  const [loading, setLoading] = useState(!monitorCache[key]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (monitorCache[key]) { setData(monitorCache[key]); return; }
    const ctrl = new AbortController();
    setLoading(true);
    import('../api/monitorApi').then(({ fetchMonitors }) => {
      fetchMonitors(undefined, ctrl.signal, dataSource, scenario)
        .then((items) => {
          monitorCache[key] = items;
          setData(items);
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e);
        })
        .finally(() => setLoading(false));
    });
    return () => ctrl.abort();
  }, [dataSource, key, scenario]);

  return { data, loading, error };
}

export function useMonitorStats(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const key = cacheKey(dataSource, scenario);
  const [data, setData] = useState<MonitorFleetStats | null>(monitorStatsCache[key]);
  const [loading, setLoading] = useState(!monitorStatsCache[key]);

  useEffect(() => {
    if (monitorStatsCache[key]) { setData(monitorStatsCache[key]); return; }
    const ctrl = new AbortController();
    setLoading(true);
    import('../api/monitorApi').then(({ fetchMonitorStats }) => {
      fetchMonitorStats(ctrl.signal, dataSource, scenario)
        .then((stats) => {
          monitorStatsCache[key] = stats;
          setData(stats);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
    return () => ctrl.abort();
  }, [dataSource, key, scenario]);

  return { data, loading };
}

export function useFilteredMonitors(filter: MonitorFilter, dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const { data: allMonitors, loading } = useAllMonitors(dataSource, scenario);
  const monitorRefreshToken = useSceneStore((s) => s.monitorRefreshToken);
  const monitorFrameMap = useSceneStore((s) => s.monitorFrameMap);

  useEffect(() => {
    if (!allMonitors || Object.keys(monitorFrameMap).length > 0) return;
    const seedMap = Object.fromEntries(
      allMonitors.map((monitor, index) => [monitor.id, buildFrameHistory(index)[0] ?? { index, imageUrl: CAMERA_FRAME_POOL[index % CAMERA_FRAME_POOL.length] ?? '', capturedAt: Date.now(), recognizedLabels: [], detectionCounts: {} }]),
    );
    useSceneStore.setState({ monitorFrameMap: seedMap as Record<string, MonitorFrame> });
    void primeMonitorDetectionCache(allMonitors);
  }, [allMonitors, monitorFrameMap]);

  const filtered = useMemo(() => {
    if (!allMonitors) return [];
    return allMonitors
      .map((monitor) => {
        const frame = monitorFrameMap[monitor.id];
        return frame ? { ...monitor, frameHistory: [frame], detectionSummary: summarizeFrame(frame) } : monitor;
      })
      .filter((m) => {
        if (filter.q && !m.id.toLowerCase().includes(filter.q.toLowerCase())) return false;
        if (filter.status !== 'all' && m.status !== filter.status) return false;
        return true;
      });
  }, [allMonitors, filter, monitorFrameMap, monitorRefreshToken]);
  return { data: filtered, loading, total: allMonitors?.length ?? 0 };
}
