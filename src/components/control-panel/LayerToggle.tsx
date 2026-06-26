import { useSceneStore } from '../../store/useSceneStore';
import type { LayerState, ScenarioType } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Switch } from '../ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Bot, Mountain, GitBranch, MapPin, Boxes, Atom } from 'lucide-react';
import { getLocalizedNetworkLabel, getSceneSemantics } from '../../lib/sceneSemantics';
import { getLocalizedStructureLayerCopy } from '../../lib/sceneControlCopy';
import { t } from '../../domain/i18nCatalog';

const STRUCTURE_ICON: Record<ScenarioType, React.ComponentType<{ className?: string }>> = {
  coal: Mountain,
  gold: Mountain,
  oil: Mountain,
  pipeline: Mountain,
  nuclear: Atom,
  refinery: Mountain,
  underground: Mountain,
};

export function LayerToggle() {
  const layers = useSceneStore((s) => s.layers);
  const setLayer = useSceneStore((s) => s.setLayer);
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const locale = useSceneStore((s) => s.locale);
  const semantics = getSceneSemantics(scenario);

  const effectiveScenario: ScenarioType = dataSource === 'fracture' ? scenario : dataSource;
  const structureCopy = getLocalizedStructureLayerCopy(effectiveScenario, locale);

  const layerItems: {
    key: keyof LayerState;
    label: string;
    desc: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [];

  if (structureCopy) {
    layerItems.push({
      key: 'rockMass',
      label: structureCopy.label,
      desc: structureCopy.desc,
      Icon: STRUCTURE_ICON[effectiveScenario],
    });
  }
  layerItems.push(
    {
      key: 'fractures',
      label: getLocalizedNetworkLabel(effectiveScenario, locale),
      desc: locale === 'zh-CN'
        ? `${semantics.networkLabel}可视化`
        : 'Show the primary inspection network geometry',
      Icon: GitBranch,
    },
    {
      key: 'pointCloud',
      label: locale === 'zh-CN' ? '点云数据' : 'Point Cloud',
      desc: locale === 'zh-CN' ? '原始扫描点云渲染（Potree LOD）' : 'Raw scan point cloud rendering (Potree LOD)',
      Icon: Boxes,
    },
    {
      key: 'robots',
      label: locale === 'zh-CN' ? '机器人集群' : 'Robot Fleet',
      desc: locale === 'zh-CN' ? '探测机器人实时位置' : 'Live positions of inspection robots',
      Icon: Bot,
    },
    {
      key: 'poi',
      label: locale === 'zh-CN' ? '兴趣点标注' : 'Points of Interest',
      desc: locale === 'zh-CN' ? `${semantics.objectLabel}入口、传感器站点、危险区域` : 'Entrances, sensor stations, and hazard markers',
      Icon: MapPin,
    },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('panel.layerControl', locale)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {layerItems.map(({ key, label, desc, Icon }) => {
          const isEnabled = layers[key];
          const isDisabled = false;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <div
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-md transition-all cursor-pointer ${
                    isDisabled
                      ? 'opacity-30 cursor-not-allowed'
                      : isEnabled
                      ? 'bg-[#C99A2E]/8 border border-[#C99A2E]/20'
                      : 'border border-transparent hover:bg-[#F8FAFC]'
                  }`}
                  onClick={() => !isDisabled && setLayer(key, !isEnabled)}
                >
                  <div className={`w-7 h-7 rounded flex items-center justify-center ${
                    isEnabled && !isDisabled ? 'bg-[#C99A2E]/15 text-[#C99A2E]' : 'bg-[#E5EAF1] text-[#667085]'
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className={`text-xs font-medium ${isEnabled && !isDisabled ? 'text-[#182230]' : 'text-[#667085]'}`}>
                      {label}
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled && !isDisabled}
                    disabled={isDisabled}
                    onCheckedChange={() => setLayer(key, !isEnabled)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{desc}</TooltipContent>
            </Tooltip>
          );
        })}
      </CardContent>
    </Card>
  );
}
