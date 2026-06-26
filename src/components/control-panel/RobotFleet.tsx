import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useRobotStats, useFilteredRobots, defaultFilter, type RobotFilter } from '../../hooks/useRobots';
import { useSceneStore } from '../../store/useSceneStore';
import type { Robot, RobotModel, RobotStatus, MeshRole } from '../../types';
import { Search, Bot, Battery, Signal, Wifi, WifiOff } from 'lucide-react';
import { ROBOT_STATUS } from '../../lib/sceneColors';
import { localizeTask } from '../../lib/taskLocale';

const MODEL_LABELS: Record<RobotModel, { zh: string; en: string }> = {
  snake: { zh: '蛇形', en: 'Snake' },
  tracked: { zh: '履带式', en: 'Tracked' },
  wheeled: { zh: '轮式', en: 'Wheeled' },
  climbing: { zh: '攀爬式', en: 'Climbing' },
  aerial: { zh: '飞行', en: 'Aerial' },
  spider: { zh: '蛛型', en: 'Spider' },
  floatwalker: { zh: '浮走式', en: 'Floatwalker' },
};

const STATUS_LABELS: Record<RobotStatus, { zh: string; en: string }> = {
  online: { zh: '在线', en: 'Online' },
  offline: { zh: '离线', en: 'Offline' },
  low_battery: { zh: '低电量', en: 'Low Battery' },
  error: { zh: '故障', en: 'Fault' },
  maintenance: { zh: '维护中', en: 'Maintenance' },
};

const STATUS_COLORS: Record<RobotStatus, string> = ROBOT_STATUS;

const MESH_LABELS: Record<MeshRole, { zh: string; en: string }> = {
  gateway: { zh: '网关', en: 'Gateway' },
  relay: { zh: '中继', en: 'Relay' },
  edge: { zh: '边缘', en: 'Edge' },
  leaf: { zh: '终端', en: 'Leaf' },
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

function RobotCard({ robot, isFocused, onClick, depthLabel, locale }: { robot: Robot; isFocused: boolean; onClick: () => void; depthLabel: string; locale: 'zh-CN' | 'en-US' }) {
  const color = STATUS_COLORS[robot.status];

  return (
    <div
      onClick={onClick}
      data-testid={`robot-card-${robot.id}`}
      className={`group px-2.5 py-2 rounded-md border cursor-pointer transition-all ${
        isFocused
          ? 'bg-[#C99A2E]/8 border-[#C99A2E]/40 shadow-[0_0_10px_rgba(255,230,0,0.15)]'
          : 'bg-[#FFFFFF]/60 border border-[#D9E1EA] hover:border-[#C99A2E]/30 hover:bg-[#FFFFFF]'
      }`}
    >
      {/* Row 1: ID + status */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
          <span className="text-[11px] font-mono font-semibold text-[#182230] group-hover:text-[#C99A2E]">{robot.id}</span>
          <span className="text-[9px] text-[#667085]">{MODEL_LABELS[robot.model][locale === 'zh-CN' ? 'zh' : 'en']}</span>
        </div>
        {robot.meshConnected ? (
          <Wifi className="w-3 h-3 text-[#00FF66]/60" />
        ) : (
          <WifiOff className="w-3 h-3 text-[#B42318]/60" />
        )}
      </div>

      {/* Row 2: task + mesh role */}
      <div className="flex items-center gap-1 mb-1.5">
        <Badge variant="neutral" className="text-[9px] px-1 py-0">{STATUS_LABELS[robot.status][locale === 'zh-CN' ? 'zh' : 'en']}</Badge>
        <Badge variant="neutral" className="text-[9px] px-1 py-0">{MESH_LABELS[robot.meshRole][locale === 'zh-CN' ? 'zh' : 'en']}</Badge>
        <span data-testid={`robot-card-task-${robot.id}`} className="text-[9px] text-[#667085]/70 truncate flex-1">{localizeTask(robot.task, locale)}</span>
      </div>

      {/* Row 3: battery + signal + depth */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-0.5">
          <Battery className="w-2.5 h-2.5" style={{ color: batteryColor(robot.battery) }} />
          <span className="text-[9px] font-mono" style={{ color: batteryColor(robot.battery) }}>{robot.battery}%</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Signal className="w-2.5 h-2.5 text-[#667085]/50" />
          <span className="text-[9px] font-mono text-[#667085]/70">{robot.signalStrength}dBm</span>
        </div>
        <span className="text-[9px] font-mono text-[#667085]/50 ml-auto">{depthLabel}={robot.depth}m</span>
        <span className="text-[9px] text-[#667085]/40">{localizedAgo(robot.lastUpdate, locale)}</span>
      </div>
    </div>
  );
}

export function RobotFleet() {
  const [filter, setFilter] = useState<RobotFilter>(defaultFilter);
  const [collapsed, setCollapsed] = useState(false);
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const { data: stats } = useRobotStats(dataSource, scenario);
  const { data: robots, loading, total } = useFilteredRobots(filter, dataSource, scenario);
  const flyTo = useSceneStore((s) => s.flyTo);
  const openRobotDetail = useSceneStore((s) => s.openRobotDetail);
  const focusedRobotId = useSceneStore((s) => s.focusedRobotId);
  const locale = useSceneStore((s) => s.locale);

  const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: locale === 'zh-CN' ? '全部' : 'All' },
    { value: 'online', label: STATUS_LABELS.online[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'offline', label: STATUS_LABELS.offline[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'low_battery', label: STATUS_LABELS.low_battery[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'error', label: STATUS_LABELS.error[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'maintenance', label: locale === 'zh-CN' ? '维护' : 'Maintenance' },
  ];

  const MODEL_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: locale === 'zh-CN' ? '全部型号' : 'All Models' },
    { value: 'snake', label: MODEL_LABELS.snake[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'spider', label: MODEL_LABELS.spider[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'tracked', label: MODEL_LABELS.tracked[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'wheeled', label: MODEL_LABELS.wheeled[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'climbing', label: MODEL_LABELS.climbing[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'aerial', label: MODEL_LABELS.aerial[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'floatwalker', label: MODEL_LABELS.floatwalker[locale === 'zh-CN' ? 'zh' : 'en'] },
  ];

  const MESH_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: locale === 'zh-CN' ? '全部角色' : 'All Roles' },
    { value: 'gateway', label: MESH_LABELS.gateway[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'relay', label: MESH_LABELS.relay[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'edge', label: MESH_LABELS.edge[locale === 'zh-CN' ? 'zh' : 'en'] },
    { value: 'leaf', label: MESH_LABELS.leaf[locale === 'zh-CN' ? 'zh' : 'en'] },
  ];

  const handleRobotClick = (robot: Parameters<typeof openRobotDetail>[0]) => {
    // 放大聚焦到该机器人，不用大球高亮
    flyTo({ position: robot.position, region: `robot-${robot.id}`, zoom: 'close' });
    openRobotDetail(robot);
  };

  const depthLabel = locale === 'zh-CN'
    ? (scenario === 'nuclear' ? '距RPV' : (scenario === 'pipeline' || scenario === 'refinery') ? '行程' : scenario === 'underground' ? '深度' : 'Z')
    : (scenario === 'nuclear' ? 'RPV Dist' : (scenario === 'pipeline' || scenario === 'refinery') ? 'Travel' : scenario === 'underground' ? 'Depth' : 'Z');

  return (
    <>
    <Card>
      <CardHeader onClick={() => setCollapsed(!collapsed)} className="cursor-pointer">
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-[#C99A2E]" />
          <span>{locale === 'zh-CN' ? '集群机器人' : 'Robot Fleet'}</span>
          {stats && (
            <span className="ml-auto text-[9px] font-mono text-[#667085]">
              {stats.online}<span className="text-[#00FF66]">●</span> / {stats.total}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-2">
          {/* Summary stats bar */}
          {stats && (
            <div className="grid grid-cols-5 gap-1">
              <StatChip label={locale === 'zh-CN' ? '在线' : 'Online'} value={stats.online} color="#00FF66" />
              <StatChip label={locale === 'zh-CN' ? '离线' : 'Offline'} value={stats.offline} color="#666" />
              <StatChip label={locale === 'zh-CN' ? '低电量' : 'Low Battery'} value={stats.lowBattery} color="#B54708" />
              <StatChip label={locale === 'zh-CN' ? '故障' : 'Fault'} value={stats.error} color="#B42318" />
              <StatChip label="Mesh" value={stats.meshConnected} color="#4DA6FF" />
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#667085]/50" />
            <input
              type="text"
              value={filter.q}
              onChange={(e) => setFilter({ ...filter, q: e.target.value })}
              placeholder={locale === 'zh-CN' ? '搜索编号 R-001...' : 'Search robot ID R-001...'}
              className="w-full pl-7 pr-2 py-1.5 text-[10px] bg-[#F8FAFC] border border-[#D9E1EA] rounded-md text-[#182230] placeholder:text-[#667085]/30 focus:outline-none focus:border-[#C99A2E]/30"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="grid grid-cols-3 gap-1">
            <FilterSelect
              value={filter.status}
              options={STATUS_OPTIONS}
              onChange={(v) => setFilter({ ...filter, status: v })}
            />
            <FilterSelect
              value={filter.model}
              options={MODEL_OPTIONS}
              onChange={(v) => setFilter({ ...filter, model: v })}
            />
            <FilterSelect
              value={filter.meshRole}
              options={MESH_OPTIONS}
              onChange={(v) => setFilter({ ...filter, meshRole: v })}
            />
          </div>

          {/* Result count */}
          <div className="text-[9px] text-[#667085]/50 text-center">
            {loading ? (locale === 'zh-CN' ? '加载中...' : 'Loading...') : (locale === 'zh-CN' ? `显示 ${robots.length} / ${total} 台` : `Showing ${robots.length} / ${total}`)}
          </div>

          {/* Robot list */}
          <div className="max-h-[300px] overflow-y-auto space-y-1 pr-0.5 custom-scroll">
            {robots.map((robot) => (
              <RobotCard key={robot.id} robot={robot} isFocused={focusedRobotId === robot.id} onClick={() => handleRobotClick(robot)} depthLabel={depthLabel} locale={locale} />
            ))}
            {!loading && robots.length === 0 && (
              <div className="text-[10px] text-[#667085]/40 text-center py-4">
                {filter.model !== 'all'
                  ? locale === 'zh-CN'
                    ? `${MODEL_LABELS[filter.model as RobotModel]?.zh || filter.model} 机器人在当前场景未部署`
                    : `${MODEL_LABELS[filter.model as RobotModel]?.en || filter.model} robots are not deployed in this scene`
                  : locale === 'zh-CN' ? '无匹配机器人' : 'No matching robots'}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
    </>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center py-1 bg-[#F8FAFC]/60 rounded border border-[#D9E1EA]">
      <span className="text-[12px] font-mono font-bold" style={{ color }}>{value}</span>
      <span className="text-[7px] text-[#667085]/50">{label}</span>
    </div>
  );
}

function FilterSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-1 py-1 text-[9px] bg-[#F8FAFC] border border-[#D9E1EA] rounded text-[#667085] focus:outline-none focus:border-[#C99A2E]/30 cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
