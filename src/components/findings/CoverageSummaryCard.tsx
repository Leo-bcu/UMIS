import { useMemo } from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useSceneStore } from '../../store/useSceneStore';
import { summarizeExplorationCoverage } from '../../domain/findingCoverage';
import { TruthBoundaryLegend } from './TruthBoundaryLegend';
import { t } from '../../domain/i18nCatalog';

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function CoverageSummaryCard() {
  const fractures = useSceneStore((s) => s.fractures);
  const findings = useSceneStore((s) => s.findings);
  const locale = useSceneStore((s) => s.locale);
  const summary = useMemo(
    () => summarizeExplorationCoverage(fractures, findings),
    [fractures, findings]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#087443]" />
          <span>{t('coverage.title', locale)}</span>
          <span className="ml-auto text-[9px] font-mono text-[#087443]">{pct(summary.measuredPct)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-1.5 overflow-hidden rounded bg-[#E5EAF1]">
          <div
            className="h-full bg-[#087443]"
            style={{ width: pct(summary.measuredPct) }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <Metric label={t('coverage.measuredNodes', locale)} value={`${summary.measuredNodes}/${summary.pathPoints}`} />
          <Metric label={t('coverage.unknownNodes', locale)} value={String(summary.unknownPathPoints)} danger={summary.unknownPathPoints > 0} />
          <Metric label={t('coverage.aiFindings', locale)} value={String(summary.aiInferredFindings)} />
          <Metric label={t('coverage.lowConfidence', locale)} value={String(summary.lowConfidenceFindings)} danger={summary.lowConfidenceFindings > 0} />
        </div>

        {summary.humanVerifiedFindings > 0 && (
          <div className="flex items-center gap-1.5 rounded border border-[#B7E4CB] bg-[#E7F7EF] px-2 py-1 text-[9px] text-[#087443]">
            <ShieldCheck className="w-3 h-3" />
            <span>{locale === 'zh-CN' ? `${summary.humanVerifiedFindings} ${t('coverage.reviewed', locale)}` : `${summary.humanVerifiedFindings} ${t('coverage.reviewed', locale)}`}</span>
          </div>
        )}

        <TruthBoundaryLegend />
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
