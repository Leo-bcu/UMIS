import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useSceneStats } from '../../hooks/useSceneStats';
import { isMockMode } from '../../api/config';
import { useSceneStore } from '../../store/useSceneStore';
import { getLocalizedSceneLabels, getLocalizedTrendLabels } from '../../lib/sceneSemantics';
import { buildSceneMetricSummary } from '../../domain/sceneMetricSummary';
import { t } from '../../domain/i18nCatalog';

export function SystemStatus() {
  const { data: stats, loading } = useSceneStats();
  const scenario = useSceneStore((s) => s.scenario);
  const locale = useSceneStore((s) => s.locale);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const fractures = useSceneStore((s) => s.fractures);
  const localized = getLocalizedSceneLabels(scenario, locale);
  const trendLabels = getLocalizedTrendLabels(scenario, locale);
  const metricSummary = buildSceneMetricSummary(fractures, scenario, gasThreshold);
  const auxPrefix = locale === 'zh-CN' ? '平均' : 'Avg ';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('status.system', locale)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading || !stats ? (
          <div className="text-xs text-[#667085]/50 text-center py-2">{t('status.loading', locale)}</div>
        ) : (
          <>
            <StatusRow
              label={t('status.dataSource', locale)}
              value={isMockMode ? t('status.mock', locale) : t('status.live', locale)}
              dotColor={isMockMode ? 'bg-[#B54708]' : 'bg-[#00FF66]'}
              badge={<Badge variant={isMockMode ? 'danger' : 'default'}>{isMockMode ? 'MOCK' : 'LIVE'}</Badge>}
            />
            <StatusRow label={localized.status.nodeLabel} value={(metricSummary.totalNodes || stats.totalNodes).toLocaleString()} dotColor="bg-[#C99A2E]" />
            <StatusRow label={localized.status.confidenceLabel} value={`${stats.avgConf}%`} dotColor="bg-[#1E3A5F]" />
            <StatusRow label={localized.trend.primaryLabel} value={`${metricSummary.avgPrimary}${trendLabels.primary.unit}`} dotColor="bg-[#087443]" />
            <StatusRow label={`${auxPrefix}${trendLabels.aux.label}`} value={`${metricSummary.avgAux}${trendLabels.aux.unit}`} dotColor="bg-[#4DA6FF]" />
            <StatusRow label={t('status.avgTemperature', locale)} value={`${metricSummary.avgTemperature}${trendLabels.temperature.unit}`} dotColor="bg-[#B54708]" />
            <StatusRow label={localized.status.overThresholdLabel} value={`${metricSummary.overThreshold}`} dotColor="bg-[#B42318]" valueClass="text-[#B42318]" />
            <StatusRow label={localized.status.throughputLabel} value={isMockMode ? '—' : '2.4 MB/s'} dotColor="bg-[#C99A2E]" />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  value,
  dotColor,
  valueClass = 'text-[#182230]',
  badge,
}: {
  label: string;
  value: string;
  dotColor: string;
  valueClass?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
        <span className="text-[#667085]">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`font-mono ${valueClass}`}>{value}</span>
        {badge}
      </div>
    </div>
  );
}
