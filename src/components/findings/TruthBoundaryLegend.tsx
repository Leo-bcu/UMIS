import type { TruthBoundary } from '../../domain/findingTypes';
import { TruthBoundaryBadge } from './TruthBoundaryBadge';
import { useSceneStore } from '../../store/useSceneStore';
import { t } from '../../domain/i18nCatalog';

export function TruthBoundaryLegend() {
  const locale = useSceneStore((s) => s.locale);
  const legendItems: { boundary: TruthBoundary; description: string }[] = locale === 'zh-CN'
    ? [
        { boundary: 'measured', description: '机器人传感器或路径节点直接回传' },
        { boundary: 'interpolated', description: '由相邻实测点插值得到' },
        { boundary: 'ai_inferred', description: 'AI 根据上下文推断，需要复查' },
        { boundary: 'unknown', description: '尚无足够采样或证据' },
        { boundary: 'human_verified', description: '人工复核确认' },
      ]
    : [
        { boundary: 'measured', description: 'Returned directly by robot sensors or sampled path nodes' },
        { boundary: 'interpolated', description: 'Interpolated from nearby measured samples' },
        { boundary: 'ai_inferred', description: 'Inferred by AI from context and requires review' },
        { boundary: 'unknown', description: 'Not enough samples or evidence yet' },
        { boundary: 'human_verified', description: 'Confirmed by human review' },
      ];
  return (
    <div className="rounded-md border border-[#D9E1EA] bg-[#F8FAFC]/70 p-2">
      <div className="mb-2 text-[9px] uppercase tracking-wider text-[#667085]">{t('coverage.truthBoundary', locale)}</div>
      <div className="space-y-1.5">
        {legendItems.map((item) => (
          <div key={item.boundary} className="flex items-start justify-between gap-2">
            <TruthBoundaryBadge boundary={item.boundary} />
            <span className="flex-1 text-right text-[9px] leading-tight text-[#667085]">
              {item.description}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-[#D9E1EA] pt-2 text-[9px] leading-tight text-[#667085]/70">
        {t('coverage.truthNote', locale)}
      </div>
    </div>
  );
}
