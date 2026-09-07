import { useSceneStore } from '../../store/useSceneStore';
import { EvidenceCard } from './EvidenceCard';
import { t } from '../../domain/i18nCatalog';

export function FindingList() {
  const findings = useSceneStore((s) => s.findings);
  const locale = useSceneStore((s) => s.locale);

  if (findings.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-[#667085]">
        <span>{t('finding.title', locale)}</span>
        <span>{findings.length}</span>
      </div>
      {findings.slice(0, 5).map((finding) => (
        <EvidenceCard key={finding.id} finding={finding} />
      ))}
    </div>
  );
}
