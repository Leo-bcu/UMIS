import { useEffect, useMemo, useState } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Camera, RefreshCw, Wifi, X } from 'lucide-react';
import type { Locale } from '../../domain/i18nCatalog';
import type { MonitorDetectionSummary, MonitorFrame } from '../../types';
import { summarizeFrames } from '../../domain/monitorInference';

function timeAgo(ts: number, locale: Locale): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (locale === 'zh-CN') {
    if (s < 60) return `${s}s前`;
    if (s < 3600) return `${Math.floor(s / 60)}m前`;
    return `${Math.floor(s / 3600)}h前`;
  }
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function MonitorDetailPanel() {
  const monitor = useSceneStore((s) => s.selectedMonitor);
  const locale = useSceneStore((s) => s.locale);
  const closeMonitorDetail = useSceneStore((s) => s.closeMonitorDetail);
  const monitorFrameMap = useSceneStore((s) => s.monitorFrameMap);
  const refreshMonitorFrame = useSceneStore((s) => s.refreshMonitorFrame);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currentFrame = useMemo(() => (monitor ? monitorFrameMap[monitor.id] ?? monitor.frameHistory?.[0] ?? null : null), [monitor, monitorFrameMap]);
  const manualRefresh = async () => {
    if (!monitor || !currentFrame?.imageUrl || isRefreshing) return;
    setIsRefreshing(true);
    setAnalysisError(null);
    try {
      await refreshMonitorFrame(monitor.id, currentFrame.imageUrl, true);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
    }
  };
  const detectionSummary = useMemo(() => {
    if (!monitor) return [];
    if (monitor.detectionSummary?.length) return monitor.detectionSummary;
    const sourceFrames: MonitorFrame[] = [];
    if (currentFrame) sourceFrames.push(currentFrame);
    if (monitor.frameHistory?.length) sourceFrames.push(...monitor.frameHistory);
    return summarizeFrames(sourceFrames);
  }, [currentFrame, monitor]);
  const detectionStatus = currentFrame?.detectionStatus ?? (detectionSummary.length > 0 ? 'detected' : 'undetected');
  const detectedAt = currentFrame?.detectedAt ?? currentFrame?.capturedAt ?? monitor?.lastUpdate ?? Date.now();
  const detectionDurationMs = currentFrame?.detectionDurationMs ?? (currentFrame && monitor ? Math.max(0, detectedAt - currentFrame.capturedAt) : 0);


  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#2E90FA]" />
              <span className="text-sm font-semibold text-[#182230]">{monitor.id}</span>
              <Badge variant="neutral" className="text-[9px]">{monitor.status}</Badge>
            </div>
            <div className="mt-1 text-[10px] text-[#667085]">
              {locale === 'zh-CN' ? '监控器画面预留区' : 'Monitor preview area'}
            </div>
          </div>
          <button onClick={closeMonitorDetail} className="p-1 rounded hover:bg-[#F2F4F7]">
            <X className="w-4 h-4 text-[#667085]" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Metric label={locale === 'zh-CN' ? '电量' : 'Battery'} value={`${monitor.battery}%`} />
          <Metric label={locale === 'zh-CN' ? '信号' : 'Signal'} value={`${monitor.signalStrength}dBm`} />
          <Metric label={locale === 'zh-CN' ? '覆盖半径' : 'Coverage'} value={`${monitor.coverageRadius}m`} />
          <Metric label={locale === 'zh-CN' ? '更新时间' : 'Updated'} value={timeAgo(monitor.lastUpdate, locale)} />
        </div>

        <div className="rounded border border-[#D9E1EA] bg-white p-2">
          <div className="flex items-center justify-between gap-2 text-[10px] text-[#667085] mb-2">
            <div className="flex items-center gap-2">
              <Wifi className="w-3 h-3" />
              <span>{locale === 'zh-CN' ? '当前监控画面' : 'Current monitor frame'}</span>
            </div>
            <button
              type="button"
              onClick={manualRefresh}
              disabled={isRefreshing || !currentFrame?.imageUrl}
              className="inline-flex items-center gap-1 rounded border border-[#D9E1EA] bg-[#F8FAFC] px-2 py-1 text-[9px] text-[#667085] hover:text-[#182230] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {locale === 'zh-CN' ? '刷新' : 'Refresh'}
            </button>
          </div>
          {currentFrame ? (
            <div className="overflow-hidden rounded border border-[#C9D5E5] bg-[#F8FAFC]">
              <img
                src={`${currentFrame.imageUrl}${currentFrame.imageUrl.includes('?') ? '&' : '?'}t=${useSceneStore.getState().monitorRefreshToken}`}
                alt={monitor.id}
                className="h-48 w-full object-cover"
              />
              <div className="border-t border-[#E4E7EC] bg-[#F8FAFC] px-2 py-1 text-[9px] text-[#667085] font-mono truncate">
                {currentFrame.imageUrl}
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded border border-dashed border-[#C9D5E5] bg-[#F8FAFC] text-[10px] text-[#98A2B3]">
              {locale === 'zh-CN' ? '暂无画面' : 'No frame available'}
            </div>
          )}
        </div>

        <div className="rounded border border-[#D9E1EA] bg-white p-2">
          <div className="flex items-center justify-between gap-2 text-[10px] text-[#667085]">
            <span>{locale === 'zh-CN' ? '识别结果' : 'Detection results'}</span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${detectionStatus === 'detected' ? 'bg-[#ECFDF3] text-[#027A48]' : detectionStatus === 'detecting' ? 'bg-[#EFF8FF] text-[#175CD3]' : 'bg-[#F2F4F7] text-[#667085]'}`}>
              {locale === 'zh-CN'
                ? (detectionStatus === 'detected' ? '已检测' : detectionStatus === 'detecting' ? '检测中' : '未监测')
                : (detectionStatus === 'detected' ? 'Detected' : detectionStatus === 'detecting' ? 'Detecting' : 'Undetected')}
            </span>
          </div>
          {analysisError && <div className="mt-1 text-[9px] text-[#B42318]">{analysisError}</div>}
          <div className="mt-1 text-[9px] text-[#98A2B3]">{locale === 'zh-CN' ? '按当前监控器画面实时汇总' : 'Live summary for the current monitor frames'}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {detectionSummary.length > 0 ? detectionSummary.map((item) => <DetectionChip key={item.labelEn} item={item} locale={locale} />) : <div className="col-span-2 text-[10px] text-[#98A2B3]">{locale === 'zh-CN' ? '暂无识别结果' : 'No detections yet'}</div>}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-[#667085]">
            <div>
              {locale === 'zh-CN' ? '检测时间' : 'Detected at'}: {new Date(detectedAt).toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-GB')}
            </div>
            <div>
              {locale === 'zh-CN' ? '检测总耗时' : 'Total duration'}: {detectionDurationMs > 0 ? `${detectionDurationMs.toFixed(2)}ms` : '0.00ms'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] text-[#667085]">
          <div className="rounded border border-[#D9E1EA] bg-white p-2">{locale === 'zh-CN' ? '位置' : 'Position'}: {monitor.position.map((v) => v.toFixed(1)).join(', ')}</div>
          <div className="rounded border border-[#D9E1EA] bg-white p-2">{locale === 'zh-CN' ? '任务' : 'Task'}: {monitor.task}</div>
        </div>
        <div className="rounded border border-[#D9E1EA] bg-white p-2">
          <div className="text-[10px] text-[#667085]">{locale === 'zh-CN' ? '关联 G 结构' : 'Related G structure'}</div>
          <div className="mt-1 text-[11px] font-medium text-[#182230]">{monitor.relatedCoalStructureId ?? '—'}</div>
        </div>
      </div>
    </ScrollArea>
  );
}

function aggregateSummary(frames: { detectionCounts?: Record<string, number> }[]): MonitorDetectionSummary[] {
  const map = new Map<string, MonitorDetectionSummary>();
  for (const frame of frames) {
    for (const [labelEn, count] of Object.entries(frame.detectionCounts ?? {})) {
      const current = map.get(labelEn) ?? { labelEn, labelZh: labelEn, count: 0 };
      current.count += count;
      map.set(labelEn, current);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function DetectionChip({ item, locale }: { item: MonitorDetectionSummary; locale: Locale }) {
  return (
    <div className="rounded border border-[#D9E1EA] bg-[#F8FAFC] px-2 py-1">
      <div className="text-[10px] font-medium text-[#182230] truncate">{locale === 'zh-CN' ? item.labelZh : item.labelEn}</div>
      <div className="text-[9px] text-[#667085]">{item.count}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#D9E1EA] bg-white p-2">
      <div className="text-[9px] text-[#667085]">{label}</div>
      <div className="mt-1 text-[11px] font-mono text-[#182230] truncate">{value}</div>
    </div>
  );
}
