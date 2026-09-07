import type { Monitor, DataSourceType, ScenarioType, MonitorFrame, MonitorDetectionSummary } from '../types';
import type { MonitorFleetStats } from '../types/api';
import { isMockMode } from './config';
import { httpClient } from './httpClient';

const CAMERA_IMAGE_MODULES = import.meta.glob('../../approch/camera/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const CAMERA_IMAGE_POOL = Object.values(CAMERA_IMAGE_MODULES).sort();

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

const DETECTION_CLASS_MAP: Record<string, string> = {
  support_structure: '支护结构',
  cable: '电缆',
  tube: '管道',
  electrical_device: '电气设备',
  indicator: '指示器',
  mining_machine: '采掘机械',
  door: '门',
  rescue_equipment: '救援装备',
  person: '人员',
  rail_track: '轨道',
  container: '容器',
};

function buildSummary(seed: number, imageUrl: string): MonitorDetectionSummary[] {
  const base = `${imageUrl}:${seed}`;
  return Object.entries(DETECTION_CLASS_MAP)
    .map(([labelEn, labelZh], index) => {
      const score = Array.from(base).reduce((sum, ch) => sum + ch.charCodeAt(0), index * 17);
      const count = score % 5 === 0 ? 0 : (score % 3) + 1;
      return { labelEn, labelZh, count };
    })
    .filter((item) => item.count > 0);
}

function createFrameHistory(seed: number, count = 1): MonitorFrame[] {
  const pool = CAMERA_IMAGE_POOL.length > 0 ? CAMERA_IMAGE_POOL : [''];
  return shuffle(pool).slice(0, count).map((imageUrl, index) => {
    const summary = buildSummary(seed + index, imageUrl);
    return {
      index,
      imageUrl,
      capturedAt: Date.now() - seed * 1000 - index * 15000,
      recognizedLabels: summary.map((item) => item.labelZh),
      detectionCounts: summary.reduce<Record<string, number>>((acc, item) => {
        acc[item.labelEn] = item.count;
        return acc;
      }, {}),
    };
  });
}

function aggregateFrameSummary(frames: MonitorFrame[]): MonitorDetectionSummary[] {
  const map = new Map<string, MonitorDetectionSummary>();
  for (const frame of frames) {
    for (const [labelEn, count] of Object.entries(frame.detectionCounts ?? {})) {
      const current = map.get(labelEn) ?? { labelEn, labelZh: DETECTION_CLASS_MAP[labelEn] ?? labelEn, count: 0 };
      current.count += count;
      map.set(labelEn, current);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

async function getMockMonitors(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal'): Promise<Monitor[]> {
  const { buildSceneDataset } = await import('../domain/sceneDataset');
  const monitors = buildSceneDataset(dataSource, scenario).monitors ?? [];
  return monitors.map((monitor, index) => {
    const frameHistory = createFrameHistory(index, 1);
    return {
      ...monitor,
      frameHistory,
      detectionSummary: aggregateFrameSummary(frameHistory),
    };
  });
}

async function getMockMonitorStats(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal'): Promise<MonitorFleetStats> {
  const { buildSceneDataset } = await import('../domain/sceneDataset');
  const monitors = buildSceneDataset(dataSource, scenario).monitors ?? [];
  const online = monitors.filter((m) => m.status === 'online').length;
  const offline = monitors.filter((m) => m.status === 'offline').length;
  const warning = monitors.filter((m) => m.status === 'warning').length;
  const maintenance = monitors.filter((m) => m.status === 'maintenance').length;
  const avgBattery = monitors.length === 0 ? 0 : Math.round(monitors.reduce((sum, monitor) => sum + monitor.battery, 0) / monitors.length);
  return { total: monitors.length, online, offline, warning, maintenance, avgBattery };
}

export async function fetchMonitors(
  _query?: { status?: string; q?: string },
  signal?: AbortSignal,
  dataSource: DataSourceType = 'fracture',
  scenario: ScenarioType = 'coal',
): Promise<Monitor[]> {
  if (isMockMode) {
    return getMockMonitors(dataSource, scenario);
  }
  const raw = await httpClient.get<Record<string, unknown>[]>('/monitors', { signal });
  return raw as Monitor[];
}

export interface MonitorInferencePayload {
  monitorId: string;
  structureId?: string;
  imageUrl: string;
  force?: boolean;
}

export interface MonitorInferenceResult {
  monitorId: string;
  imageUrl: string;
  frameHistory: MonitorFrame[];
  detectionSummary: MonitorDetectionSummary[];
  cachedAt: number;
  backend: 'mock' | 'live';
}

export async function inferMonitorFrame(
  payload: MonitorInferencePayload,
  signal?: AbortSignal,
): Promise<MonitorInferenceResult> {
  if (isMockMode) {
    const frameHistory = createFrameHistory(Math.abs(payload.monitorId.length + payload.imageUrl.length), 1);
    return {
      monitorId: payload.monitorId,
      imageUrl: payload.imageUrl,
      frameHistory,
      detectionSummary: aggregateFrameSummary(frameHistory),
      cachedAt: Date.now(),
      backend: 'mock',
    };
  }

  const res = await httpClient.post<MonitorInferenceResult>('/monitor-infer', payload, { signal });
  return {
    ...res,
    backend: 'live',
  };
}

export async function inferMonitorFleet(
  payload: { monitors: MonitorInferencePayload[] },
  signal?: AbortSignal,
): Promise<MonitorInferenceResult[]> {
  if (isMockMode) {
    return payload.monitors.map((item) => {
      const frameHistory = createFrameHistory(Math.abs(item.monitorId.length + item.imageUrl.length), 1);
      return {
        monitorId: item.monitorId,
        imageUrl: item.imageUrl,
        frameHistory,
        detectionSummary: aggregateFrameSummary(frameHistory),
        cachedAt: Date.now(),
        backend: 'mock',
      };
    });
  }

  const res = await httpClient.post<MonitorInferenceResult[]>('/monitor-infer/batch', payload, { signal });
  return res;
}

export async function fetchMonitorStats(
  signal?: AbortSignal,
  dataSource: DataSourceType = 'fracture',
  scenario: ScenarioType = 'coal',
): Promise<MonitorFleetStats> {
  if (isMockMode) {
    return getMockMonitorStats(dataSource, scenario);
  }
  const raw = await httpClient.get<Record<string, unknown>>('/monitors/stats', { signal });
  return raw as MonitorFleetStats;
}
