import { useMemo } from 'react';
import { ClipboardCheck, Gauge, ShieldAlert, Wrench, Clock3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useAlerts } from '../../hooks/useAlerts';
import { useAllRobots } from '../../hooks/useRobots';
import { useSceneStore } from '../../store/useSceneStore';
import { buildRoleDashboard } from '../../domain/roleDashboard';
import { t } from '../../domain/i18nCatalog';

type RoleTab = 'manager' | 'safety' | 'engineer' | 'timeline';

const TABS: { key: RoleTab; labelKey: Parameters<typeof t>[0]; Icon: typeof Gauge }[] = [
  { key: 'manager', labelKey: 'role.manager', Icon: Gauge },
  { key: 'safety', labelKey: 'role.safety', Icon: ShieldAlert },
  { key: 'engineer', labelKey: 'role.engineer', Icon: Wrench },
  { key: 'timeline', labelKey: 'role.timeline', Icon: Clock3 },
];

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function RoleDashboard() {
  const activeTab = useSceneStore((s) => s.roleDashboardTab);
  const setActiveTab = useSceneStore((s) => s.setRoleDashboardTab);
  const locale = useSceneStore((s) => s.locale);
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const fractures = useSceneStore((s) => s.fractures);
  const findings = useSceneStore((s) => s.findings);
  const { data: robots } = useAllRobots(dataSource, scenario);
  const { data: alerts } = useAlerts(dataSource, scenario);
  const dashboard = useMemo(
    () => buildRoleDashboard({
      robots: robots ?? [],
      alerts: alerts ?? [],
      findings,
      fractures,
    }),
    [alerts, findings, fractures, robots]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="w-3.5 h-3.5 text-[#1F2937]" />
          <span>{t('role.workbench', locale)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-4 gap-1">
          {TABS.map(({ key, labelKey, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center justify-center gap-1 rounded border px-1 py-1 text-[9px] transition-all ${
                activeTab === key
                  ? 'border-[#1F2937] bg-[#1F2937] text-white'
                  : 'border-[#D9E1EA] bg-[#F8FAFC] text-[#667085] hover:text-[#182230]'
              }`}
            >
              <Icon className="w-3 h-3" />
              {t(labelKey, locale)}
            </button>
          ))}
        </div>

        {activeTab === 'manager' && (
          <div className="grid grid-cols-2 gap-2">
            <Metric label={locale === 'zh-CN' ? '高优先级' : 'Critical'} value={String(dashboard.manager.openCriticalCount)} danger={dashboard.manager.openCriticalCount > 0} />
            <Metric label={locale === 'zh-CN' ? '活跃发现' : 'Active Findings'} value={String(dashboard.manager.activeFindingCount)} />
            <Metric label={locale === 'zh-CN' ? '机器人在线' : 'Robots Online'} value={pct(dashboard.manager.onlineRobotPct)} />
            <Metric label={locale === 'zh-CN' ? '交付就绪' : 'Delivery Ready'} value={pct(dashboard.manager.exportReadinessPct)} danger={dashboard.manager.exportReadinessPct < 0.6} />
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="max-h-[170px] space-y-1 overflow-y-auto pr-0.5 custom-scroll">
            {dashboard.safetyQueue.slice(0, 6).map((item) => (
              <button
                key={`${item.source}-${item.id}`}
                className="w-full rounded border border-[#D9E1EA] bg-[#F8FAFC] px-2 py-1.5 text-left hover:border-[#B7C3D0]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-semibold ${item.level === 'danger' ? 'text-[#B42318]' : 'text-[#9A6700]'}`}>{item.title}</span>
                  <span className="text-[9px] text-[#667085]">{item.source === 'alert' ? t('queue.alert', locale) : t('queue.finding', locale)}</span>
                </div>
                <div className="mt-0.5 text-[9px] text-[#667085]">
                  {item.needsReview ? t('queue.reviewNeeded', locale) : t('queue.humanBoundary', locale)}
                </div>
              </button>
            ))}
            {dashboard.safetyQueue.length === 0 && (
              <div className="py-3 text-center text-[10px] text-[#087443]">{t('queue.empty', locale)}</div>
            )}
          </div>
        )}

        {activeTab === 'engineer' && (
          <div className="grid grid-cols-2 gap-2">
            <Metric label={t('engineer.measured', locale)} value={pct(dashboard.engineerDataQuality.measuredPct)} />
            <Metric label={t('engineer.unknown', locale)} value={pct(dashboard.engineerDataQuality.unknownPct)} danger={dashboard.engineerDataQuality.unknownPct > 0.35} />
            <Metric label={t('engineer.ai', locale)} value={String(dashboard.engineerDataQuality.aiInferredFindings)} />
            <Metric label={t('engineer.lowConfidence', locale)} value={String(dashboard.engineerDataQuality.lowConfidenceFindings)} danger={dashboard.engineerDataQuality.lowConfidenceFindings > 0} />
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="max-h-[170px] space-y-1 overflow-y-auto pr-0.5 custom-scroll">
            {dashboard.missionTimeline.slice(0, 7).map((item) => (
              <div key={`${item.kind}-${item.id}`} className="flex items-center gap-2 rounded border border-[#D9E1EA] bg-[#F8FAFC] px-2 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C99A2E]" />
                <span className="flex-1 truncate text-[10px] text-[#182230]">{item.label}</span>
                <span className="text-[9px] text-[#667085]">{item.kind === 'alert' ? t('timeline.alert', locale) : item.kind === 'finding' ? t('timeline.finding', locale) : item.kind === 'robot' ? t('timeline.robot', locale) : t('timeline.coverage', locale)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded border border-[#D9E1EA] bg-[#F8FAFC] px-2 py-1.5">
      <div className="text-[9px] text-[#667085]">{label}</div>
      <div className={`mt-0.5 font-mono text-sm ${danger ? 'text-[#B42318]' : 'text-[#182230]'}`}>
        {value}
      </div>
    </div>
  );
}
