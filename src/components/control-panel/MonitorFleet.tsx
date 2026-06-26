import { useState } from 'react';
import { Bell, Search, Wifi, WifiOff, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useMonitorStats, useFilteredMonitors, defaultMonitorFilter, type MonitorFilter } from '../../hooks/useRobots';
import { useSceneStore } from '../../store/useSceneStore';
import type { Monitor, MonitorStatus } from '../../types';

const STATUS_LABELS: Record<MonitorStatus, { zh: string; en: string }> = {
  online: { zh: '在线', en: 'Online' },
  offline: { zh: '离线', en: 'Offline' },
  warning: { zh: '预警', en: 'Warning' },
  maintenance: { zh: '维护中', en: 'Maintenance' },
};

function batteryColor(battery: number): string {
  if (battery < 20) return '#B42318';
  if (battery < 40) return '#B54708';
  return '#00FF66';
}

function localizedAgo(ts: number, locale: 'zh-CN' | 'en-US'): string {
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

function MonitorCard({ monitor, isFocused, onClick, locale }: { monitor: Monitor; isFocused: boolean; onClick: () => void; locale: 'zh-CN' | 'en-US' }) {
  return (
    <div
      onClick={onClick}
      data-testid={`monitor-card-${monitor.id}`}
      className={`group px-2.5 py-2 rounded-md border cursor-pointer transition-all ${
        isFocused ? 'bg-[#2E90FA]/8 border-[#2E90FA]/40' : 'bg-[#FFFFFF]/60 border border-[#D9E1EA] hover:border-[#2E90FA]/30 hover:bg-[#FFFFFF]'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#2E90FA]" />
          <span className="text-[11px] font-mono font-semibold text-[#182230] group-hover:text-[#2E90FA]">{monitor.id}</span>
          <Badge variant="neutral" className="text-[9px] px-1 py-0">{STATUS_LABELS[monitor.status][locale === 'zh-CN' ? 'zh' : 'en']}</Badge>
        </div>
        {monitor.status === 'offline' ? <WifiOff className="w-3 h-3 text-[#B42318]/60" /> : <Wifi className="w-3 h-3 text-[#00FF66]/60" />}
      </div>
      <div className="flex items-center gap-1 mb-1.5">
        <Badge variant="neutral" className="text-[9px] px-1 py-0">{locale === 'zh-CN' ? '当前画面' : 'Frame'}</Badge>
        <span className="text-[9px] text-[#667085]/70 truncate flex-1">{monitor.frameHistory?.[0]?.imageUrl?.split('/').pop() ?? (locale === 'zh-CN' ? '无图片' : 'No image')}</span>
      </div>
      <div className="flex items-center gap-2.5 text-[9px] text-[#667085]/70">
        <span className="font-mono" style={{ color: batteryColor(monitor.battery) }}>{monitor.battery}%</span>
        <span className="font-mono">{monitor.signalStrength}dBm</span>
        <span className="font-mono ml-auto">{monitor.coverageRadius}m</span>
      </div>
    </div>
  );
}

export function MonitorFleet() {
  const [filter, setFilter] = useState<MonitorFilter>(defaultMonitorFilter);
  const [collapsed, setCollapsed] = useState(false);
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const { data: stats } = useMonitorStats(dataSource, scenario);
  const { data: monitors, loading, total } = useFilteredMonitors(filter, dataSource, scenario);
  const locale = useSceneStore((s) => s.locale);

  const STAT_ITEMS = [
    { label: locale === 'zh-CN' ? '在线' : 'Online', value: stats?.online ?? 0, color: '#00FF66' },
    { label: locale === 'zh-CN' ? '离线' : 'Offline', value: stats?.offline ?? 0, color: '#666' },
    { label: locale === 'zh-CN' ? '预警' : 'Warning', value: stats?.warning ?? 0, color: '#F79009' },
    { label: locale === 'zh-CN' ? '维护' : 'Maint.', value: stats?.maintenance ?? 0, color: '#2E90FA' },
  ];

  return (
    <Card>
      <CardHeader onClick={() => setCollapsed(!collapsed)} className="cursor-pointer">
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-[#2E90FA]" />
          <span>{locale === 'zh-CN' ? '监控器' : 'Monitors'}</span>
          {stats && <span className="ml-auto text-[9px] font-mono text-[#667085]">{stats.online}<span className="text-[#00FF66]">●</span> / {stats.total}</span>}
        </CardTitle>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-2">
          <div className="grid grid-cols-4 gap-1">
            {STAT_ITEMS.map((item) => <StatChip key={item.label} {...item} />)}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#667085]/50" />
            <input
              type="text"
              value={filter.q}
              onChange={(e) => setFilter({ ...filter, q: e.target.value })}
              placeholder={locale === 'zh-CN' ? '搜索监控器 J-001...' : 'Search monitor J-001...'}
              className="w-full pl-7 pr-2 py-1.5 text-[10px] bg-[#F8FAFC] border border-[#D9E1EA] rounded-md text-[#182230] placeholder:text-[#667085]/30 focus:outline-none focus:border-[#2E90FA]/30"
            />
          </div>
          <div className="flex gap-1">
            {['all', 'online', 'offline', 'warning', 'maintenance'].map((status) => (
              <button key={status} onClick={() => setFilter({ ...filter, status })} className={`px-2 py-1 text-[9px] rounded border ${filter.status === status ? 'border-[#2E90FA]/40 bg-[#2E90FA]/8' : 'border-[#D9E1EA] bg-[#F8FAFC]'}`}>
                {status === 'all' ? (locale === 'zh-CN' ? '全部' : 'All') : STATUS_LABELS[status as MonitorStatus][locale === 'zh-CN' ? 'zh' : 'en']}
              </button>
            ))}
          </div>
          <div className="text-[9px] text-[#667085]/50 text-center">{loading ? (locale === 'zh-CN' ? '加载中...' : 'Loading...') : (locale === 'zh-CN' ? `显示 ${monitors.length} / ${total} 个` : `Showing ${monitors.length} / ${total}`)}</div>
          <div className="max-h-[240px] overflow-y-auto space-y-1 pr-0.5 custom-scroll">
            {monitors.map((monitor) => <MonitorCard key={monitor.id} monitor={monitor} isFocused={false} onClick={() => undefined} locale={locale} />)}
            {!loading && monitors.length === 0 && <div className="text-[10px] text-[#667085]/40 text-center py-4">{locale === 'zh-CN' ? '无匹配监控器' : 'No matching monitors'}</div>}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="flex flex-col items-center py-1 bg-[#F8FAFC]/60 rounded border border-[#D9E1EA]"><span className="text-[12px] font-mono font-bold" style={{ color }}>{value}</span><span className="text-[7px] text-[#667085]/50">{label}</span></div>;
}
