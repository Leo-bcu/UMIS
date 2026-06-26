import { useSceneStore } from '../../store/useSceneStore';

export function ComplianceBar() {
  const locale = useSceneStore((s) => s.locale);

  return (
    <div className="h-10 bg-white border-t border-[#D9E1EA] flex items-center justify-center px-4 gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-3 h-3 rounded-full bg-[#B42318]/15 animate-ping" />
          <svg className="w-4 h-4 text-[#B42318] relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </div>
      </div>
      <p className="text-[10px] text-[#667085] text-center tracking-wide">
        <span className="text-[#B42318] font-semibold">{locale === 'zh-CN' ? '合规声明：' : 'Compliance Notice:'}</span>
        {locale === 'zh-CN'
          ? '本系统基于受限条件感知融合，所有3D建模与参数预测仅作工程参考，绝对禁止作为下井作业的唯一安全决策依据。'
          : 'This system operates on constrained sensing and fused estimates. All 3D models and predicted values are for engineering reference only and must never be the sole safety basis for field entry or underground operations.'}
      </p>
    </div>
  );
}
