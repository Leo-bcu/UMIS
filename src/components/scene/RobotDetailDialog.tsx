import type { Robot, RobotModel, RobotStatus, MeshRole } from '../../types';
import { Battery, Signal, Wifi, WifiOff, Activity, MapPin, X } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import { ROBOT_STATUS } from '../../lib/sceneColors';
import { getRobotTelemetryCopy } from '../../lib/robotTelemetryCopy';
import { localizeTask } from '../../lib/taskLocale';
import type { Locale } from '../../domain/i18nCatalog';

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

/**
 * 机器人悬浮信息卡 — 紧凑、半透明、不遮挡 3D 场景
 * 点击左侧列表或 3D 光点后，相机飞向机器人位置，同时显示此小卡片
 */
export function RobotDetailDialog({ robot, open, onClose }: { robot: Robot | null; open: boolean; onClose: () => void }) {
  const scenario = useSceneStore((s) => s.scenario);
  const locale = useSceneStore((s) => s.locale);
  if (!robot || !open) return null;

  const statusColor = STATUS_COLORS[robot.status];
  const batteryColor = robot.battery < 20 ? ROBOT_STATUS.error : robot.battery < 40 ? ROBOT_STATUS.low_battery : ROBOT_STATUS.online;
  const sc = getRobotTelemetryCopy(scenario);
  const primaryOver = robot.sensors.ch4 > sc.primary.threshold;

  return (
    <div
      className="fixed z-50"
      style={{
        bottom: 'calc(30% + 12px)',
        right: 'calc(20% + 12px)',
        maxWidth: '220px',
      }}
    >
      <div
        className="rounded-lg border border-white/10 shadow-2xl backdrop-blur-md overflow-hidden"
        style={{ background: 'rgba(10,10,18,0.88)' }}
      >
        {/* Header: ID + status + close */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/5">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor, boxShadow: `0 0 4px ${statusColor}` }} />
          <span className="text-[10px] font-mono font-semibold text-[#E0E0E8] truncate">{robot.id}</span>
          <span className="text-[9px] text-[#A0A0B0] flex-shrink-0">{MODEL_LABELS[robot.model][locale === 'zh-CN' ? 'zh' : 'en']}</span>
          <span className="text-[9px] flex-shrink-0" style={{ color: statusColor }}>{STATUS_LABELS[robot.status][locale === 'zh-CN' ? 'zh' : 'en']}</span>
          <button
            onClick={onClose}
            className="ml-auto w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-2.5 h-2.5 text-[#A0A0B0]" />
          </button>
        </div>

        {/* Body: compact info grid */}
        <div className="px-2.5 py-2 space-y-1">
          {/* Task */}
          <div className="text-[9px] text-[#FFE600] truncate">{localizeTask(robot.task, locale)}</div>

          {/* Battery + signal row */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-0.5">
              <Battery className="w-2.5 h-2.5" style={{ color: batteryColor }} />
              <span className="text-[9px] font-mono" style={{ color: batteryColor }}>{robot.battery}%</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Signal className="w-2.5 h-2.5 text-[#A0A0B0]/50" />
              <span className="text-[9px] font-mono text-[#A0A0B0]/70">{robot.signalStrength}dBm</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Activity className="w-2.5 h-2.5 text-[#A0A0B0]/50" />
              <span className="text-[9px] font-mono text-[#A0A0B0]/70">{sc.depthLabel} {robot.depth}m</span>
            </div>
          </div>

          {/* Position */}
          <div className="flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5 text-[#A0A0B0]/40" />
            <span className="text-[9px] font-mono text-[#A0A0B0]/50">
              [{robot.position[0].toFixed(1)}, {robot.position[1].toFixed(1)}, {robot.position[2].toFixed(1)}]
            </span>
            <span className="text-[9px] text-[#A0A0B0]/30 ml-auto">{timeAgo(robot.lastUpdate, locale)}</span>
          </div>

          {/* Mesh + sensors in one row */}
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-white/5">
            <div className="flex items-center gap-0.5">
              {robot.meshConnected
                ? <Wifi className="w-2.5 h-2.5" style={{ color: ROBOT_STATUS.online, opacity: 0.6 }} />
                : <WifiOff className="w-2.5 h-2.5" style={{ color: ROBOT_STATUS.error, opacity: 0.6 }} />}
              <span className="text-[9px] text-[#A0A0B0]/60">{MESH_LABELS[robot.meshRole][locale === 'zh-CN' ? 'zh' : 'en']}</span>
            </div>
            <span className="text-[9px] font-mono ml-auto" style={{ color: primaryOver ? ROBOT_STATUS.error : ROBOT_STATUS.low_battery }}>
              {sc.primary.label} {robot.sensors.ch4}{sc.primary.unit}
            </span>
            <span className="text-[9px] font-mono text-[#FF6B35]">{sc.temperature.label} {robot.sensors.temperature}{sc.temperature.unit}</span>
            <span className="text-[9px] font-mono text-[#4DA6FF]">{sc.aux.label} {robot.sensors.humidity}{sc.aux.unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
