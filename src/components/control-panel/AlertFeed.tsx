import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useAlerts } from '../../hooks/useAlerts';
import { useSceneStore } from '../../store/useSceneStore';
import type { AlertEvent, AlertLevel } from '../../types';
import { AlertTriangle, AlertOctagon, Info, ChevronDown, Check } from 'lucide-react';
import { createFindingFromAlert } from '../../domain/findingFactory';
import { localizeAlertCopy } from '../../lib/alertLocale';
import { PanelSkeleton } from '../ui/Skeleton';

type WebAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const LEVEL_CONFIG: Record<AlertLevel, { color: string; bg: string; Icon: typeof Info }> = {
  danger: { color: '#B42318', bg: 'rgba(255,51,51,0.08)', Icon: AlertOctagon },
  warning: { color: '#B54708', bg: 'rgba(255,165,0,0.08)', Icon: AlertTriangle },
  info: { color: '#4DA6FF', bg: 'rgba(77,166,255,0.06)', Icon: Info },
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  const locale = useSceneStore.getState().locale;
  if (locale === 'en-US') {
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }
  if (s < 60) return `${s}秒前`;
  if (s < 3600) return `${Math.floor(s / 60)}分钟前`;
  return `${Math.floor(s / 3600)}小时前`;
}

/** C5: 播放告警提示音 — 仅 danger 级别 */
function playAlertSound() {
  try {
    const AudioContextCtor = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Browsers may block WebAudio before user interaction.
  }
}

function AlertItem({ alert, isAcked, onClick, onAck }: {
  alert: AlertEvent;
  isAcked: boolean;
  onClick: () => void;
  onAck: (e: React.MouseEvent) => void;
}) {
  const { color, bg, Icon } = LEVEL_CONFIG[alert.level];
  const locale = useSceneStore((s) => s.locale);
  const scenario = useSceneStore((s) => s.scenario);
  const display = localizeAlertCopy(alert, locale, scenario);

  return (
    <div
      onClick={onClick}
      className={`relative px-2 py-1.5 rounded-md border border-[#D9E1EA] cursor-pointer transition-all hover:border-[#D9E1EA] ${isAcked ? 'opacity-40' : ''}`}
      style={{ backgroundColor: bg }}
    >
      {alert.level === 'danger' && !isAcked && (
        <span
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full animate-pulse"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
      )}
      <div className="flex items-start gap-1.5">
        <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold truncate" style={{ color }}>{display.title}</span>
            {!isAcked && (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: color }} />
            )}
          </div>
          <p className="text-[9px] text-[#667085]/70 leading-tight line-clamp-2">{display.description}</p>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[9px] text-[#667085]/40">{timeAgo(alert.timestamp)}</span>
            <button
              onClick={onAck}
              disabled={isAcked}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-all ${
                isAcked
                  ? 'text-[#667085]/30 cursor-default'
                  : 'text-[#087443] hover:bg-[#087443]/10 border border-[#087443]/20'
              }`}
            >
              {isAcked ? (locale === 'zh-CN' ? '已确认' : 'Acked') : (locale === 'zh-CN' ? '确认' : 'Acknowledge')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertFeed() {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<'all' | 'danger' | 'warning' | 'unack'>('all');
  const locale = useSceneStore((s) => s.locale);
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const { data: alerts, loading } = useAlerts(dataSource, scenario);
  const flyTo = useSceneStore((s) => s.flyTo);
  const highlightWithTimer = useSceneStore((s) => s.highlightWithTimer);
  const acknowledgedAlertIds = useSceneStore((s) => s.acknowledgedAlertIds);
  const acknowledgeAlert = useSceneStore((s) => s.acknowledgeAlert);
  const acknowledgeAllAlerts = useSceneStore((s) => s.acknowledgeAllAlerts);
  const addFinding = useSceneStore((s) => s.addFinding);

  const prevDangerCountRef = useRef(0);

  // 判断告警是否已确认（先看 alert.acknowledged，再看 store 中的手动确认）
  const isAcknowledged = useMemo(
    () => (alert: AlertEvent) => alert.acknowledged || acknowledgedAlertIds.includes(alert.id),
    [acknowledgedAlertIds]
  );

  const filtered = useMemo(() => {
    if (!alerts) return [];
    const result = filter === 'all' ? alerts
      : filter === 'unack' ? alerts.filter(a => !isAcknowledged(a))
      : alerts.filter(a => a.level === filter);
    return result;
  }, [alerts, filter, isAcknowledged]);

  const dangerCount = alerts?.filter(a => a.level === 'danger' && !isAcknowledged(a)).length ?? 0;
  const warningCount = alerts?.filter(a => a.level === 'warning' && !isAcknowledged(a)).length ?? 0;
  const unackCount = alerts?.filter(a => !isAcknowledged(a)).length ?? 0;

  // C5: 新增 danger 告警时播放提示音
  useEffect(() => {
    if (dangerCount > prevDangerCountRef.current && dangerCount > 0) {
      playAlertSound();
    }
    prevDangerCountRef.current = dangerCount;
  }, [dangerCount]);

  const handleAlertClick = (alert: AlertEvent) => {
    if (alert.position) {
      const pos = alert.position;
      flyTo({ position: pos, region: `alert-${alert.id}`, zoom: 'close' });
      highlightWithTimer(pos, 1.6, 5000);
    }
    addFinding(createFindingFromAlert(alert));
  };

  const handleAck = (e: React.MouseEvent, alert: AlertEvent) => {
    e.stopPropagation();
    acknowledgeAlert(alert.id);
  };

  const handleAckAll = () => {
    if (!alerts) return;
    const unackIds = alerts.filter(a => !isAcknowledged(a)).map(a => a.id);
    if (unackIds.length > 0) acknowledgeAllAlerts(unackIds);
  };

  return (
    <Card>
      <CardHeader onClick={() => setCollapsed(!collapsed)} className="cursor-pointer">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[#B42318]" />
          <span>{locale === 'zh-CN' ? '实时告警' : 'Live Alerts'}</span>
          {dangerCount > 0 && <Badge variant="danger" className="text-[9px] !px-1.5">{dangerCount} {locale === 'zh-CN' ? '紧急' : 'Critical'}</Badge>}
          {warningCount > 0 && <Badge className="text-[9px] bg-[#B54708]/10 border-[#B54708]/30 text-[#B54708] !px-1.5">{warningCount} {locale === 'zh-CN' ? '警告' : 'Warning'}</Badge>}
          {unackCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAckAll(); }}
              className="ml-auto mr-1 flex items-center gap-0.5 text-[9px] text-[#087443] hover:bg-[#087443]/10 px-1.5 py-0.5 rounded border border-[#087443]/20 transition-all"
            >
              <Check className="w-2.5 h-2.5" />
              {locale === 'zh-CN' ? '全部确认' : 'Ack All'}
            </button>
          )}
          {unackCount === 0 && (
            <ChevronDown className={`w-3 h-3 ml-auto text-[#667085] transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          )}
        </CardTitle>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-2">
          {/* Filter tabs */}
          <div className="flex gap-1">
            {([
              { v: 'all', label: locale === 'zh-CN' ? '全部' : 'All', count: alerts?.length ?? 0 },
              { v: 'danger', label: locale === 'zh-CN' ? '紧急' : 'Critical', count: dangerCount },
              { v: 'warning', label: locale === 'zh-CN' ? '警告' : 'Warning', count: warningCount },
              { v: 'unack', label: locale === 'zh-CN' ? '未处理' : 'Unacked', count: unackCount },
            ] as const).map(tab => (
              <button
                key={tab.v}
                onClick={() => setFilter(tab.v)}
                className={`flex-1 px-1 py-1 text-[9px] rounded transition-all ${
                  filter === tab.v
                    ? 'bg-[#C99A2E]/10 text-[#C99A2E] border border-[#C99A2E]/20'
                    : 'text-[#667085]/50 border border-transparent hover:bg-[#F8FAFC]'
                }`}
              >
                {tab.label} <span className="font-mono">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Alert list */}
          <div className="max-h-[200px] overflow-y-auto space-y-1 pr-0.5 custom-scroll">
            {loading ? (
              <PanelSkeleton rows={3} />
            ) : (
              filtered.slice(0, 30).map(alert => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  isAcked={isAcknowledged(alert)}
                  onClick={() => handleAlertClick(alert)}
                  onAck={(e) => handleAck(e, alert)}
                />
              ))
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-[10px] text-[#00FF66]/50 text-center py-3">
                {filter === 'unack' ? (locale === 'zh-CN' ? '所有告警已处理' : 'All alerts acknowledged') : (locale === 'zh-CN' ? '暂无告警' : 'No alerts')}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
