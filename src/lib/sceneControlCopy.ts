import type { ScenarioType } from '../types';
import type { Locale } from '../domain/i18nCatalog';

export interface StructureLayerCopy {
  label: string;
  desc: string;
}

const STRUCTURE_LAYER_COPY: Record<ScenarioType, StructureLayerCopy | null> = {
  coal: { label: '矿井巷道围岩', desc: '半透明矿井巷道切片与围岩边界' },
  gold: { label: '地质岩体', desc: '半透明金矿地质岩体外壳' },
  oil: { label: '储层岩体', desc: '半透明油气储层岩体外壳' },
  pipeline: { label: '管道介质环境', desc: '半透明小口径管道内液体/气体背景' },
  nuclear: { label: '安全壳厂房', desc: '反应堆安全壳及 RPV/SG/RCP 等设备线框' },
  refinery: { label: '储罐/反应釜壳体', desc: '半透明密闭空间壳体与人孔边界' },
  underground: { label: '含水层背景', desc: '半透明深部含水层与暗流围护背景' },
};

export function getStructureLayerCopy(scenario: ScenarioType): StructureLayerCopy | null {
  return STRUCTURE_LAYER_COPY[scenario];
}

export function getLocalizedStructureLayerCopy(
  scenario: ScenarioType,
  locale: Locale = 'zh-CN',
): StructureLayerCopy | null {
  const base = getStructureLayerCopy(scenario);
  if (!base || locale === 'zh-CN') return base;

  const translations: Record<ScenarioType, StructureLayerCopy | null> = {
    coal: { label: 'Mine Roadway Shell', desc: 'Semi-transparent mine-roadway slice and surrounding rock boundary' },
    gold: { label: 'Geology Shell', desc: 'Semi-transparent gold-mine geology shell' },
    oil: { label: 'Reservoir Shell', desc: 'Semi-transparent reservoir shell' },
    pipeline: { label: 'Pipe Medium Envelope', desc: 'Semi-transparent small-bore pipe fluid/gas envelope' },
    nuclear: { label: 'Containment Building', desc: 'Containment shell and RPV/SG/RCP equipment wireframes' },
    refinery: { label: 'Tank/Reactor Shell', desc: 'Semi-transparent confined-space shell and manway boundary' },
    underground: { label: 'Aquifer Background', desc: 'Semi-transparent deep aquifer background and underground-channel enclosure' },
  };

  return translations[scenario];
}

export function getPhysicalTruthCopy(scenario: ScenarioType, locale: Locale = 'zh-CN'): string {
  const structure = getLocalizedStructureLayerCopy(scenario, locale);
  const structureLabel = structure?.label;
  const objectLabel: Record<ScenarioType, { zh: string; en: string }> = {
    coal: { zh: '巷道/裂隙网络', en: 'roadway and fissure network' },
    gold: { zh: '裂缝网络', en: 'fracture network' },
    oil: { zh: '储层裂缝', en: 'reservoir fractures' },
    pipeline: { zh: '小口径管段', en: 'small-bore pipe segments' },
    nuclear: { zh: '管道系统', en: 'piping system' },
    refinery: { zh: '密闭空间测点', en: 'confined-space checkpoints' },
    underground: { zh: '暗流通道', en: 'underground channels' },
  };

  const visibleLayers = locale === 'zh-CN'
    ? (structureLabel
      ? `原始点云+${structureLabel}+${objectLabel[scenario].zh}+机器人`
      : `原始点云+${objectLabel[scenario].zh}+机器人`)
    : (structureLabel
      ? `raw point cloud + ${structureLabel} + ${objectLabel[scenario].en} + robots`
      : `raw point cloud + ${objectLabel[scenario].en} + robots`);

  return locale === 'zh-CN'
    ? `合规审计模式：已关闭AI解译图层，仅显示${visibleLayers}`
    : `Compliance audit mode: AI interpretation layers are hidden; only ${visibleLayers} remain visible.`;
}
