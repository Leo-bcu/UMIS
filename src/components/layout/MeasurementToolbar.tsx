import { useSceneStore } from '../../store/useSceneStore';
import type { AnnotationTool } from '../../types';
import { useEffect } from 'react';
import { getLocalizedMeasureCopy } from '../../lib/sceneMeasureConfig';
import { t, tf } from '../../domain/i18nCatalog';

const TOOLS: { key: AnnotationTool; icon: string; shortcut: string }[] = [
  { key: 'profile', icon: '📏', shortcut: 'F1' },
  { key: 'area', icon: '⬜', shortcut: 'F2' },
  { key: 'text', icon: '🏷', shortcut: 'F3' },
  { key: 'distance', icon: '📐', shortcut: 'F4' },
];

const SHORTCUT_MAP: Record<string, AnnotationTool> = {
  F1: 'profile',
  F2: 'area',
  F3: 'text',
  F4: 'distance',
};

export function MeasurementToolbar() {
  const activeTool = useSceneStore((s) => s.activeTool);
  const setActiveTool = useSceneStore((s) => s.setActiveTool);
  const annotations = useSceneStore((s) => s.annotations);
  const clearAnnotations = useSceneStore((s) => s.clearAnnotations);
  const scenario = useSceneStore((s) => s.scenario);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const locale = useSceneStore((s) => s.locale);
  const measureCopy = getLocalizedMeasureCopy(scenario, locale, gasThreshold);
  const tools = TOOLS.map((tool) => {
    const labelKey = tool.key === 'profile'
      ? 'tool.profile'
      : tool.key === 'area'
        ? 'tool.area'
        : tool.key === 'text'
          ? 'tool.text'
          : 'tool.distance';
    const label = t(labelKey, locale);
    const guide = tool.key === 'area'
      ? tf('tool.guideArea', locale, { densityLabel: measureCopy.densityLabel })
      : tool.key === 'profile'
        ? tf('tool.guideProfile', locale, { profileTitle: measureCopy.profileTitle })
        : tool.key === 'text'
          ? t('tool.guideText', locale)
          : t('tool.guideDistance', locale);
    return { ...tool, label, guide };
  });

  const activeToolInfo = tools.find(t => t.key === activeTool);

  // 全局键盘快捷键 F1-F4
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tool = SHORTCUT_MAP[e.key];
      if (!tool) return;
      // 忽略输入框中的按键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      setActiveTool(activeTool === tool ? 'none' : tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTool, setActiveTool]);

  return (
    <div className="flex items-center gap-1">
      {tools.map(({ key, icon, shortcut, guide }) => {
        const labelKey = key === 'profile'
          ? 'tool.profile'
          : key === 'area'
            ? 'tool.area'
            : key === 'text'
              ? 'tool.text'
              : 'tool.distance';
        const label = t(labelKey, locale);
        return (
          <button
            key={key}
            onClick={() => setActiveTool(activeTool === key ? 'none' : key)}
            data-testid={`measure-tool-${key}`}
            className={`group flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all relative ${
              activeTool === key
                ? 'bg-[#1F2937] text-white border border-[#1F2937]'
                : 'text-[#667085] border border-transparent hover:bg-[#EEF2F6] hover:text-[#182230]'
            }`}
            title={`${label} (${shortcut}) — ${guide}`}
          >
            <span>{icon}</span>
            <span className="hidden sm:inline">{label}</span>
            <span className={`text-[9px] px-0.5 rounded ${
              activeTool === key ? 'bg-white/15 text-white/80' : 'bg-[#EEF2F6] text-[#667085]'
            }`}>{shortcut}</span>
          </button>
        );
      })}
      {annotations.length > 0 && (
        <button
          onClick={clearAnnotations}
          className="ml-2 px-2 py-1 rounded text-[10px] text-[#B42318] hover:bg-[#FFF7F5] transition-all"
          title={t('tool.clear', locale)}
        >
          {t('tool.clear', locale)}({annotations.length})
        </button>
      )}

      {/* C3: 操作指引提示 — 工具激活时显示 */}
      {activeToolInfo && (
        <div data-testid="measurement-guide" className="ml-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#FFFAF0] border border-[#EFD39B] text-[#9A6700] animate-fade-in">
          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span className="text-[9px] leading-tight">{activeToolInfo.guide}</span>
          <button
            onClick={() => setActiveTool('none')}
            data-testid="measurement-guide-exit"
            className="text-[9px] text-[#667085] hover:text-[#182230] ml-1 underline"
          >
            {t('tool.exit', locale)}
          </button>
        </div>
      )}
    </div>
  );
}
