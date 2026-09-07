import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { PanelSkeleton } from '../ui/Skeleton';
import { useSensorTrend } from '../../hooks/useSensorTrend';
import type { TrendTimeRange } from '../../hooks/useSensorTrend';
import { useSceneStore } from '../../store/useSceneStore';
import { ChevronDown, MapPin } from 'lucide-react';
import { getLocalizedSceneLabels, getLocalizedTrendLabels } from '../../lib/sceneSemantics';
import { t } from '../../domain/i18nCatalog';

// Mini sparkline chart using SVG
function Sparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length === 0 || data.some((v) => isNaN(v))) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const step = w / (data.length - 1);

  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`);
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `M 0,${h} L ${points.join(' L ')} L ${w},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {/* Last point dot */}
      <circle
        cx={w}
        cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2}
        r="1.5"
        fill={color}
      />
    </svg>
  );
}

function TrendRow({
  label,
  unit,
  data,
  color,
  threshold,
}: {
  label: string;
  unit: string;
  data: number[];
  color: string;
  threshold?: number;
}) {
  const current = data[data.length - 1] ?? 0;
  const prev = data[data.length - 2] ?? current;
  const delta = current - prev;
  const overThreshold = threshold !== undefined && current > threshold;

  return (
    <div className="px-1 py-1 rounded bg-[#F8FAFC]/40">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-[#667085]">{label}</span>
        <div className="flex items-center gap-1">
          <span className={`text-[11px] font-mono font-bold ${overThreshold ? 'text-[#B42318]' : ''}`} style={!overThreshold ? { color } : undefined}>
            {current}{unit}
          </span>
          {delta !== 0 && (
            <span className={`text-[9px] ${delta > 0 ? 'text-[#B42318]' : 'text-[#00FF66]'}`}>
              {delta > 0 ? '▲' : '▼'}{Math.abs(Math.round(delta * 10) / 10)}
            </span>
          )}
        </div>
      </div>
      <Sparkline data={data} color={overThreshold ? '#B42318' : color} />
    </div>
  );
}

export function SensorTrends() {
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<'aggregate' | 'regional'>('aggregate');
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TrendTimeRange>('2.5h');
  const { data: trend, loading, totalNodes } = useSensorTrend(timeRange);
  const flyTo = useSceneStore((s) => s.flyTo);
  const setHighlightedFractureIds = useSceneStore((s) => s.setHighlightedFractureIds);
  const scenario = useSceneStore((s) => s.scenario);
  const locale = useSceneStore((s) => s.locale);
  const labels = getLocalizedTrendLabels(scenario, locale);
  const localizedScene = getLocalizedSceneLabels(scenario, locale);

  type RegionTrend = NonNullable<typeof trend>['regions'][number];

  const handleRegionClick = (r: RegionTrend) => {
    if (activeRegion === r.regionId) {
      // 再次点击取消选择
      setActiveRegion(null);
      setHighlightedFractureIds(null);
    } else {
      setActiveRegion(r.regionId);
      // 直接高亮该区域内的通道对象 — 不用球体
      setHighlightedFractureIds(r.fractureIds);
      flyTo({ position: r.center, region: r.regionName, zoom: 'close' });
    }
  };

  const handleViewChange = (v: 'aggregate' | 'regional') => {
    setView(v);
    setActiveRegion(null);
    if (v === 'aggregate') {
      setHighlightedFractureIds(null);
    }
  };

  return (
    <Card>
      <CardHeader onClick={() => setCollapsed(!collapsed)} className="cursor-pointer">
        <CardTitle className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-[#4DA6FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18M7 14l4-4 4 4 5-5" />
          </svg>
          <span>{t('panel.sensorTrends', locale)}</span>
          <div className="ml-auto flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {(['1h', '2.5h', '6h', '24h'] as TrendTimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-1 py-0.5 text-[8px] rounded transition-all ${
                  timeRange === r
                    ? 'bg-[#C99A2E]/10 text-[#C99A2E] border border-[#C99A2E]/20'
                    : 'text-[#667085]/50 border border-transparent hover:bg-[#F8FAFC]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <ChevronDown className={`w-3 h-3 text-[#667085] transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </CardTitle>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-1.5">
          {/* Source label */}
          {trend && (
            <div className="text-[7px] text-[#667085]/40 text-center pb-0.5">
              {locale === 'zh-CN'
                ? trend.source
                : `${totalNodes} ${localizedScene.status.nodeLabel.toLowerCase()} aggregated across ${trend.regions.length} regions`}
            </div>
          )}

          {/* View toggle */}
          <div className="flex gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); handleViewChange('aggregate'); }}
              className={`flex-1 px-1 py-0.5 text-[9px] rounded transition-all ${
                view === 'aggregate'
                  ? 'bg-[#C99A2E]/10 text-[#C99A2E] border border-[#C99A2E]/20'
                  : 'text-[#667085]/50 border border-transparent hover:bg-[#F8FAFC]'
              }`}
            >
              {locale === 'zh-CN' ? '全局聚合' : 'Aggregate'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleViewChange('regional'); }}
              className={`flex-1 px-1 py-0.5 text-[9px] rounded transition-all ${
                view === 'regional'
                  ? 'bg-[#C99A2E]/10 text-[#C99A2E] border border-[#C99A2E]/20'
                  : 'text-[#667085]/50 border border-transparent hover:bg-[#F8FAFC]'
              }`}
            >
              {locale === 'zh-CN' ? '分区域' : 'Regional'}
            </button>
          </div>

          {loading || !trend ? (
            <PanelSkeleton rows={3} />
          ) : view === 'aggregate' ? (
            <>
              <TrendRow label={locale === 'zh-CN' ? `${labels.primary.label} (聚合)` : `${labels.primary.label} (Aggregate)`} unit={labels.primary.unit} data={trend.ch4} color="#B54708" threshold={labels.primary.threshold} />
              <TrendRow label={locale === 'zh-CN' ? `${labels.temperature.label} (聚合)` : `${labels.temperature.label} (Aggregate)`} unit={labels.temperature.unit} data={trend.temperature} color="#FF6B35" />
              <TrendRow label={locale === 'zh-CN' ? `${labels.aux.label} (聚合)` : `${labels.aux.label} (Aggregate)`} unit={labels.aux.unit} data={trend.pressure} color="#4DA6FF" />
            </>
          ) : (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scroll">
              {trend.regions.map((r) => {
                const ch4Now = r.ch4[r.ch4.length - 1] ?? 0;
                const isActive = activeRegion === r.regionId;
                return (
                  <div
                    key={r.regionId}
                    onClick={(e) => { e.stopPropagation(); handleRegionClick(r); }}
                    className={`px-1 py-1 rounded cursor-pointer transition-all border ${
                      isActive
                        ? 'bg-[#C99A2E]/8 border-[#C99A2E]/30 shadow-[0_0_8px_rgba(255,230,0,0.15)]'
                        : 'bg-[#F8FAFC]/40 border-[#D9E1EA] hover:border-[#C99A2E]/15 hover:bg-[#F8FAFC]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1">
                        <MapPin className={`w-2.5 h-2.5 ${isActive ? 'text-[#C99A2E]' : 'text-[#667085]/40'}`} />
                        <span className={`text-[9px] font-medium ${isActive ? 'text-[#C99A2E]' : 'text-[#182230]'}`}>{r.regionName}</span>
                      </div>
                      <span className="text-[7px] text-[#667085]/40">{locale === 'zh-CN' ? `${r.nodeCount} 节点` : `${r.nodeCount} nodes`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-mono ${ch4Now > labels.primary.threshold ? 'text-[#B42318]' : 'text-[#B54708]'}`}>
                        {labels.primary.label} {ch4Now.toFixed(2)}{labels.primary.unit}
                      </span>
                      <span className="text-[9px] font-mono text-[#FF6B35]">
                        {r.temperature[r.temperature.length - 1]?.toFixed(0)}°C
                      </span>
                    </div>
                    <div className="mt-0.5">
                      <Sparkline data={r.ch4} color={ch4Now > labels.primary.threshold ? '#B42318' : '#B54708'} height={24} />
                    </div>
                    {isActive && (
                      <div className="text-[7px] text-[#C99A2E]/50 text-center mt-0.5 animate-fade-in">
                        {locale === 'zh-CN' ? '已框选 · 再次点击取消' : 'Highlighted · click again to clear'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
