import type { Monitor, MonitorDetectionSummary, MonitorFrame } from '../types';
import { isMockMode } from '../api/config';
import { inferMineBatch, inferMineFrame, type MineInferenceResponse } from '../api/mineClient';

export const MONITOR_CLASS_MAP: Record<string, string> = {
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

export interface MonitorInferenceRequest {
  monitorId: string;
  imageUrl: string;
  force?: boolean;
}

export interface MonitorInferenceResponse {
  monitorId: string;
  imageUrl: string;
  cachedAt: number;
  backend: 'mock' | 'live';
  frameHistory: MonitorFrame[];
  detectionSummary: MonitorDetectionSummary[];
}

const monitorInferenceCache = new Map<string, MonitorInferenceResponse>();

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildMockSummary(imageUrl: string, monitorId: string, seed: number): MonitorDetectionSummary[] {
  return Object.entries(MONITOR_CLASS_MAP)
    .map(([labelEn, labelZh], index) => {
      const score = hashString(`${monitorId}:${imageUrl}:${seed}:${index}`);
      const count = score % 4 === 0 ? 0 : (score % 3) + 1;
      return { labelEn, labelZh, count };
    })
    .filter((item) => item.count > 0);
}

function buildFrame(imageUrl: string, detectionSummary: MonitorDetectionSummary[], startAt = Date.now() - 12.34): MonitorFrame {
  const detectedAt = Date.now();
  return {
    index: 0,
    imageUrl,
    capturedAt: startAt,
    recognizedLabels: detectionSummary.map((item) => item.labelZh),
    detectionCounts: detectionSummary.reduce<Record<string, number>>((acc, item) => {
      acc[item.labelEn] = item.count;
      return acc;
    }, {}),
    detectionStatus: detectionSummary.length > 0 ? 'detected' : 'undetected',
    detectedAt,
    detectionDurationMs: Math.max(0, detectedAt - startAt),
  };
}

function aggregateDetectionSummary(summaries: MonitorDetectionSummary[]): MonitorDetectionSummary[] {
  const map = new Map<string, MonitorDetectionSummary>();
  for (const item of summaries) {
    const current = map.get(item.labelEn) ?? { ...item, count: 0 };
    current.count += item.count;
    map.set(item.labelEn, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function cacheKey(monitorId: string, imageUrl: string): string {
  return `${monitorId}::${imageUrl}`;
}

export function getCachedMonitorInference(monitorId: string, imageUrl: string): MonitorInferenceResponse | null {
  return monitorInferenceCache.get(cacheKey(monitorId, imageUrl)) ?? null;
}

export function setCachedMonitorInference(response: MonitorInferenceResponse): void {
  monitorInferenceCache.set(cacheKey(response.monitorId, response.imageUrl), response);
}

export function clearMonitorInferenceCache(): void {
  monitorInferenceCache.clear();
}

function normalizeLiveResponse(response: MineInferenceResponse, request: MonitorInferenceRequest): MonitorInferenceResponse {
  const capturedAt = Date.now();
  const detectedAt = capturedAt + 1;

  return {
    monitorId: request.monitorId,
    imageUrl: request.imageUrl,
    cachedAt: detectedAt,
    backend: 'live',
    frameHistory: [{
      index: 0,
      imageUrl: request.imageUrl,
      capturedAt,
      recognizedLabels: response.detections.map((item) => item.label_zh),
      detectionCounts: response.detections.reduce<Record<string, number>>((acc, item) => {
        acc[item.label_en] = item.count;
        return acc;
      }, {}),
      detectionStatus: response.detections.length > 0 ? 'detected' : 'undetected',
      detectedAt,
      detectionDurationMs: Math.max(0, detectedAt - capturedAt),
    }],
    detectionSummary: response.detections.map((item) => ({
      labelEn: item.label_en,
      labelZh: item.label_zh,
      count: item.count,
    })),
  };
}

export async function inferMonitorFrame(request: MonitorInferenceRequest): Promise<MonitorInferenceResponse> {
  const cached = !request.force ? getCachedMonitorInference(request.monitorId, request.imageUrl) : null;
  if (cached) return cached;

  try {
    const live = await inferMineFrame(request);
    const response = normalizeLiveResponse(live, request);
    setCachedMonitorInference(response);
    return response;
  } catch (error) {
    if (!isMockMode) {
      throw error;
    }

    const seed = hashString(`${request.monitorId}:${request.imageUrl}:${request.force ? 'force' : 'normal'}`);
    const summary = buildMockSummary(request.imageUrl, request.monitorId, seed);
    const response: MonitorInferenceResponse = {
      monitorId: request.monitorId,
      imageUrl: request.imageUrl,
      cachedAt: Date.now(),
      backend: 'mock',
      frameHistory: [buildFrame(request.imageUrl, summary, Date.now() - (seed % 2500) / 100)],
      detectionSummary: summary,
    };
    setCachedMonitorInference(response);
    return response;
  }
}

export async function inferMonitorBatch(requests: MonitorInferenceRequest[]): Promise<MonitorInferenceResponse[]> {
  if (isMockMode) {
    return Promise.all(requests.map((request) => inferMonitorFrame(request)));
  }

  const live = await inferMineBatch(requests);
  const results = live.map((item, index) => normalizeLiveResponse(item, requests[index]));
  results.forEach(setCachedMonitorInference);
  return results;
}

export function summarizeFrames(frames: MonitorFrame[] | undefined): MonitorDetectionSummary[] {
  if (!frames?.length) return [];
  const map = new Map<string, MonitorDetectionSummary>();
  for (const frame of frames) {
    for (const [labelEn, count] of Object.entries(frame.detectionCounts ?? {})) {
      const current = map.get(labelEn) ?? { labelEn, labelZh: MONITOR_CLASS_MAP[labelEn] ?? labelEn, count: 0 };
      current.count += count;
      map.set(labelEn, current);
    }
  }
  return aggregateDetectionSummary([...map.values()]);
}

export function bootstrapMonitorDetections(monitors: Monitor[], imageResolver: (monitor: Monitor, index: number) => string): Monitor[] {
  return monitors.map((monitor, index) => {
    const imageUrl = imageResolver(monitor, index);
    const cached = getCachedMonitorInference(monitor.id, imageUrl);
    const frameHistory = cached?.frameHistory ?? [];
    const detectionSummary = cached?.detectionSummary ?? summarizeFrames(frameHistory);
    return {
      ...monitor,
      frameHistory: frameHistory.length > 0 ? frameHistory : monitor.frameHistory,
      detectionSummary: detectionSummary.length > 0 ? detectionSummary : monitor.detectionSummary,
    };
  });
}

export function getMonitorPrimaryImage(monitor: Monitor): string {
  return monitor.frameHistory?.[0]?.imageUrl ?? '';
}
