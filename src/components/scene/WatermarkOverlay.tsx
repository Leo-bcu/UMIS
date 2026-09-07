import { useSceneStore } from '../../store/useSceneStore';
import { t } from '../../domain/i18nCatalog';

export function WatermarkOverlay() {
  const physicalTruthMode = useSceneStore((s) => s.physicalTruthMode);
  const locale = useSceneStore((s) => s.locale);

  if (!physicalTruthMode) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {/* M10: 极轻量灰色遮罩 — 不遮挡画面内容 */}
      <div className="absolute inset-0 bg-black/10" />

      {/* 右上角状态标签 */}
      <div className="absolute top-3 right-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A1D2A]/90 border border-[#FFE600]/20 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FFE600] animate-pulse" />
          <span className="text-[10px] text-[#FFE600] font-semibold">{t('watermark.physicalEcho', locale)}</span>
          <span className="text-[9px] text-[#A0A0B0]/60">COMPLIANCE AUDIT</span>
        </div>
      </div>

      {/* 轻量对角线水印 — 极低透明度，不遮挡操作 */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 200px,
            rgba(255, 230, 0, 0.015) 200px,
            rgba(255, 230, 0, 0.015) 400px
          )`,
        }}
      />
    </div>
  );
}
