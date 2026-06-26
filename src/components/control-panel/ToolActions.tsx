import { useRef } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Box, Eye, Ruler, Type, PenLine, type LucideIcon } from 'lucide-react';
import type { AnnotationTool } from '../../types';
import { getPhysicalTruthCopy } from '../../lib/sceneControlCopy';
import { t } from '../../domain/i18nCatalog';

export function ToolActions() {
  const activeTool = useSceneStore((s) => s.activeTool);
  const setActiveTool = useSceneStore((s) => s.setActiveTool);
  const setPhysicalTruthMode = useSceneStore((s) => s.setPhysicalTruthMode);
  const isPhysicalTruth = useSceneStore((s) => s.physicalTruthMode);
  const annotations = useSceneStore((s) => s.annotations);
  const clearAnnotations = useSceneStore((s) => s.clearAnnotations);
  const setLayer = useSceneStore((s) => s.setLayer);
  const layers = useSceneStore((s) => s.layers);
  const clearAIMarkers = useSceneStore((s) => s.clearAIMarkers);
  const scenario = useSceneStore((s) => s.scenario);
  const locale = useSceneStore((s) => s.locale);

  // 保存进入物理真实模式前的图层状态
  const prevLayersRef = useRef<typeof layers | null>(null);

  const handlePhysicalTruth = (enable: boolean) => {
    if (enable) {
      // 保存当前图层状态
      prevLayersRef.current = { ...layers };
      // 物理真实模式：关闭 AI 解译图层，仅保留原始数据
      setLayer('fractures', false);
      setLayer('gasHeatmap', false);
      setLayer('tempHeatmap', false);
      setLayer('poi', false);
      // 确保原始数据可见
      setLayer('pointCloud', true);
      setLayer('rockMass', true);
      setLayer('robots', true);
      // 清除 AI 标记
      clearAIMarkers();
    } else {
      // 恢复之前的图层状态
      if (prevLayersRef.current) {
        (Object.keys(prevLayersRef.current) as (keyof typeof layers)[]).forEach((k) => {
          setLayer(k, prevLayersRef.current![k]);
        });
        prevLayersRef.current = null;
      }
    }
    setPhysicalTruthMode(enable);
  };

  const tools: { key: AnnotationTool; label: string; Icon: LucideIcon; shortcut: string }[] = [
    { key: 'profile', label: t('tool.profile', locale), Icon: Ruler, shortcut: 'F1' },
    { key: 'area', label: t('tool.area', locale), Icon: Box, shortcut: 'F2' },
    { key: 'text', label: t('tool.text', locale), Icon: Type, shortcut: 'F3' },
    { key: 'distance', label: t('tool.distance', locale), Icon: PenLine, shortcut: 'F4' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('panel.measureTools', locale)}</CardTitle>
          {annotations.length > 0 && (
            <button
              onClick={clearAnnotations}
              className="text-[9px] text-[#B42318] hover:underline"
            >
              {t('tool.clear', locale)}({annotations.length})
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {tools.map(({ key, label, Icon, shortcut }) => (
          <Button
            key={key}
            variant={activeTool === key ? 'default' : 'outline'}
            className="w-full justify-start"
            onClick={() => setActiveTool(activeTool === key ? 'none' : key)}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">{label}</span>
            <kbd className="text-[9px] px-1 py-0.5 rounded bg-[#F8FAFC] text-[#667085] border border-[#D9E1EA]">{shortcut}</kbd>
          </Button>
        ))}

        <div className="pt-2 border-t border-[#D9E1EA]">
          <Button
            variant={isPhysicalTruth ? 'destructive' : 'outline'}
            className="w-full justify-start"
            onClick={() => handlePhysicalTruth(!isPhysicalTruth)}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">
              {locale === 'zh-CN'
                ? (isPhysicalTruth ? '退出物理真实模式' : '还原物理真实面貌')
                : (isPhysicalTruth ? 'Exit physical-truth mode' : 'Reveal physical reality')}
            </span>
          </Button>
        </div>

        {isPhysicalTruth && (
          <div className="text-[9px] text-[#B42318]/80 flex items-start gap-1 animate-fade-in pt-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#B42318] animate-pulse mt-0.5 flex-shrink-0" />
            {getPhysicalTruthCopy(scenario, locale)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
