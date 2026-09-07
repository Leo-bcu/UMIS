import { useMemo } from 'react';
import { Archive, CheckCircle2, ClipboardList, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useAlerts } from '../../hooks/useAlerts';
import { useAllRobots } from '../../hooks/useRobots';
import { useSceneStore } from '../../store/useSceneStore';
import { buildRoleDashboard } from '../../domain/roleDashboard';
import { createMissionSnapshot, type MissionStatus } from '../../domain/missionHistory';
import { t } from '../../domain/i18nCatalog';

const STATUS_STYLE: Record<MissionStatus, { labelKey: Parameters<typeof t>[0]; className: string; Icon: typeof ClipboardList }> = {
  active: { labelKey: 'mission.active', className: 'text-[#9A6700] border-[#EFD39B] bg-[#FFFAF0]', Icon: ClipboardList },
  needs_review: { labelKey: 'mission.needsReview', className: 'text-[#B42318] border-[#F3B8B0] bg-[#FFF7F5]', Icon: ShieldAlert },
  ready_for_export: { labelKey: 'mission.readyForExport', className: 'text-[#087443] border-[#B7E4CB] bg-[#E7F7EF]', Icon: CheckCircle2 },
  closed: { labelKey: 'mission.closed', className: 'text-[#667085] border-[#D9E1EA] bg-[#F8FAFC]', Icon: Archive },
};

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function MissionSnapshotPanel() {
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const locale = useSceneStore((s) => s.locale);
  const fractures = useSceneStore((s) => s.fractures);
  const findings = useSceneStore((s) => s.findings);
  const setRoleDashboardTab = useSceneStore((s) => s.setRoleDashboardTab);
  const { data: robots } = useAllRobots(dataSource, scenario);
  const { data: alerts } = useAlerts(dataSource, scenario);

  const snapshot = useMemo(() => {
    const dashboard = buildRoleDashboard({
      robots: robots ?? [],
      alerts: alerts ?? [],
      findings,
      fractures,
    });

    return createMissionSnapshot({
      projectName: projectNameFor(dataSource, scenario, locale),
      scenario,
      locale,
      startedAt: missionStartedAt(fractures, findings),
      finishedAt: dashboard.manager.exportReadinessPct >= 0.75 ? Date.now() : undefined,
      coveragePct: dashboard.manager.coveragePct,
      findingCount: dashboard.manager.activeFindingCount,
      criticalCount: dashboard.manager.openCriticalCount,
      exportReadinessPct: dashboard.manager.exportReadinessPct,
    });
  }, [alerts, dataSource, findings, fractures, locale, robots, scenario]);

  const status = STATUS_STYLE[snapshot.status];
  const StatusIcon = status.Icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-[#1F2937]" />
          <span data-testid="mission-snapshot-title">{t('mission.snapshot', locale)}</span>
          <span data-testid="mission-snapshot-status" className={`ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] ${status.className}`}>
            <StatusIcon className="w-2.5 h-2.5" />
            {t(status.labelKey, locale)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <div data-testid="mission-project-name" className="text-[11px] font-semibold text-[#182230]">{snapshot.projectName}</div>
          <div data-testid="mission-project-summary" className="mt-0.5 text-[9px] leading-relaxed text-[#667085]">{snapshot.summary}</div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label={t('mission.coverage', locale)} value={pct(snapshot.coveragePct)} danger={snapshot.coveragePct < 0.6} />
          <Metric label={t('mission.findings', locale)} value={String(snapshot.findingCount)} />
          <Metric label={t('mission.export', locale)} value={pct(snapshot.exportReadinessPct)} danger={snapshot.exportReadinessPct < 0.6} />
        </div>
        {snapshot.criticalCount > 0 && (
          <button
            onClick={() => setRoleDashboardTab('safety')}
            data-testid="mission-review-jump"
            className="flex w-full items-center justify-center gap-1 rounded border border-[#B42318]/30 bg-[#FFF7F5] px-2 py-1.5 text-[10px] text-[#B42318] transition-colors hover:bg-[#B42318]/10"
          >
            <ShieldAlert className="h-3 w-3" />
            {locale === 'zh-CN'
              ? `${snapshot.criticalCount} 项高危待复查 · 点击进入安全队列`
              : `${snapshot.criticalCount} critical to review · Open Safety queue`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function projectNameFor(
  dataSource: ReturnType<typeof useSceneStore.getState>['dataSource'],
  scenario: ReturnType<typeof useSceneStore.getState>['scenario'],
  locale: ReturnType<typeof useSceneStore.getState>['locale']
): string {
  if (dataSource === 'fracture') {
    const names: Record<'coal' | 'gold' | 'oil', Record<'zh-CN' | 'en-US', string>> = {
      coal: { 'zh-CN': '煤矿瓦斯与裂缝分析任务', 'en-US': 'Coal Mine Gas and Fracture Mission' },
      gold: { 'zh-CN': '金矿微震与裂缝分析任务', 'en-US': 'Gold Mine Microseismic and Fracture Mission' },
      oil: { 'zh-CN': '油气储层孔压与裂缝分析任务', 'en-US': 'Reservoir Pore Pressure and Fracture Mission' },
    };
    return names[scenario as 'coal' | 'gold' | 'oil'][locale];
  }
  const names: Record<'pipeline' | 'nuclear' | 'refinery' | 'underground', Record<'zh-CN' | 'en-US', string>> = {
    pipeline: { 'zh-CN': '管廊巡检任务', 'en-US': 'Pipeline Corridor Inspection Mission' },
    nuclear: { 'zh-CN': '核设施受限区巡检', 'en-US': 'Nuclear Restricted-Zone Inspection Mission' },
    refinery: { 'zh-CN': '炼化装置巡检任务', 'en-US': 'Refinery Equipment Inspection Mission' },
    underground: { 'zh-CN': '地下流体探测任务', 'en-US': 'Underground Fluid Exploration Mission' },
  };
  return names[dataSource][locale];
}

function missionStartedAt(
  fractures: ReturnType<typeof useSceneStore.getState>['fractures'],
  findings: ReturnType<typeof useSceneStore.getState>['findings']
): number {
  const timestamps = [
    ...fractures.flatMap((fracture) => fracture.nodes.map((node) => node.timestamp)),
    ...findings.map((finding) => finding.createdAt),
  ].filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);

  return timestamps.length > 0 ? Math.min(...timestamps) : 1;
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded border border-[#D9E1EA] bg-[#F8FAFC] px-2 py-1.5">
      <div className="text-[9px] text-[#667085]">{label}</div>
      <div className={`mt-0.5 font-mono text-xs ${danger ? 'text-[#B42318]' : 'text-[#182230]'}`}>
        {value}
      </div>
    </div>
  );
}
