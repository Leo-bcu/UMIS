import { getTruthBoundaryLabel, type TruthBoundary } from '../../domain/findingTypes';
import { useSceneStore } from '../../store/useSceneStore';

const BOUNDARY_STYLES: Record<TruthBoundary, string> = {
  measured: 'border-[#087443]/30 bg-[#087443]/10 text-[#087443]',
  interpolated: 'border-[#B7C3D0] bg-[#F2F5F9] text-[#344054]',
  ai_inferred: 'border-[#C99A2E]/30 bg-[#C99A2E]/10 text-[#C99A2E]',
  unknown: 'border-[#B42318]/30 bg-[#B42318]/10 text-[#B42318]',
  human_verified: 'border-[#B7E4CB] bg-[#E7F7EF] text-[#087443]',
};

export function TruthBoundaryBadge({ boundary }: { boundary: TruthBoundary }) {
  const locale = useSceneStore((s) => s.locale);
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[9px] shrink-0 ${BOUNDARY_STYLES[boundary]}`}>
      {getTruthBoundaryLabel(boundary, locale)}
    </span>
  );
}
