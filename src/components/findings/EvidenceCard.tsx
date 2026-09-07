import type { Finding } from '../../domain/findingTypes';
import { TRUTH_BOUNDARY_LABELS } from '../../domain/findingTypes';
import { TruthBoundaryBadge } from './TruthBoundaryBadge';
import { useSceneStore } from '../../store/useSceneStore';
import { getTruthBoundaryLabel } from '../../domain/findingTypes';
import { t } from '../../domain/i18nCatalog';

export function EvidenceCard({ finding }: { finding: Finding }) {
  const locale = useSceneStore((s) => s.locale);
  const levelLabel = {
    danger: t('finding.levelDanger', locale),
    warning: t('finding.levelWarning', locale),
    info: t('finding.levelInfo', locale),
  }[finding.level];

  return (
    <div className="rounded-md border border-[#D9E1EA] bg-[#F8FAFC] p-2 text-[10px] text-[#182230]">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold truncate">{finding.title}</div>
        <span className="rounded border border-[#EFD39B] bg-[#FFFAF0] px-1.5 py-0.5 text-[9px] text-[#9A6700] shrink-0">
          {levelLabel}
        </span>
      </div>
      <p className="mt-1 text-[#667085] leading-tight line-clamp-2">{finding.description}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[#667085]">
        <span>{t('finding.truthBoundary', locale)}</span>
        <span className="flex justify-end">
          <TruthBoundaryBadge boundary={finding.truthBoundary} />
        </span>
        <span>{t('finding.confidence', locale)}</span>
        <span className="text-right text-[#182230]">{Math.round(finding.confidence * 100)}%</span>
      </div>
      {finding.evidence.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-[#D9E1EA] pt-2">
          {finding.evidence.slice(0, 2).map((evidence) => (
            <div key={evidence.id} className="flex justify-between gap-2">
              <span className="text-[#667085] truncate">{evidence.label}</span>
              <span className="text-right truncate">
                {evidence.value}
                <span className="ml-1 text-[#98A2B3]">
                  {locale === 'zh-CN' ? TRUTH_BOUNDARY_LABELS[evidence.truthBoundary] : getTruthBoundaryLabel(evidence.truthBoundary, locale)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
