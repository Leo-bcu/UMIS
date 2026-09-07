import type { ScenarioType, DataSourceType } from '../types';
import type { Locale } from '../domain/i18nCatalog';

interface DataSourceOptionLike {
  key: DataSourceType;
  icon?: string;
  scenario?: ScenarioType;
}

export function getFractureScenarioLabel(key: ScenarioType, locale: Locale) {
  const labels: Record<'coal' | 'gold' | 'oil', { zh: string; en: string }> = {
    coal: { zh: '煤矿瓦斯', en: 'Coal Gas' },
    gold: { zh: '金矿', en: 'Gold' },
    oil: { zh: '油气', en: 'Oil & Gas' },
  };

  return labels[key as 'coal' | 'gold' | 'oil']?.[locale === 'zh-CN' ? 'zh' : 'en'] ?? key;
}

export function getDataSourceCopy(option: DataSourceOptionLike, locale: Locale) {
  const map: Record<DataSourceType, { label: string; desc: string; shortLabel: string }> = {
    fracture: {
      label: locale === 'zh-CN' ? '模拟数据一·煤矿瓦斯巡测' : 'Mock Scene 1 · Coal Gas Swarm',
      shortLabel: locale === 'zh-CN' ? '煤矿瓦斯' : 'Coal Gas',
      desc: locale === 'zh-CN' ? '矿井巷道切片·微型集群瓦斯/CO/O₂巡测' : 'Mine roadway slice with micro-swarm CH4/CO/O2 patrol',
    },
    pipeline: {
      label: locale === 'zh-CN' ? '模拟数据二·小口径管道内检' : 'Mock Scene 2 · Small-Bore Pipe ILI',
      shortLabel: locale === 'zh-CN' ? '小口径管道' : 'Small-Bore Pipe',
      desc: locale === 'zh-CN' ? 'DN50-DN150 满管/支线管道腐蚀与壁厚检测' : 'DN50-DN150 in-line corrosion and wall-thickness inspection',
    },
    nuclear: {
      label: locale === 'zh-CN' ? '模拟数据三·核反应堆' : 'Mock Scene 3 · Reactor Loop',
      shortLabel: locale === 'zh-CN' ? '核反应堆' : 'Reactor',
      desc: locale === 'zh-CN' ? '压水堆一/二回路管道系统' : 'PWR primary and secondary loop piping',
    },
    refinery: {
      label: locale === 'zh-CN' ? '模拟数据四·化工密闭空间' : 'Mock Scene 4 · Chemical Confined Space',
      shortLabel: locale === 'zh-CN' ? '化工密闭' : 'Confined Space',
      desc: locale === 'zh-CN' ? '储罐/反应釜内部 H₂S/VOC/O₂/壁厚检测' : 'Tank and reactor internal H2S/VOC/O2/wall inspection',
    },
    underground: {
      label: locale === 'zh-CN' ? '模拟数据五·地下暗流' : 'Mock Scene 5 · Underground Flow',
      shortLabel: locale === 'zh-CN' ? '地下暗流' : 'Underground Flow',
      desc: locale === 'zh-CN' ? '地下岩溶暗河/深层渗流通道·管径变化' : 'Karst channels, deep seepage passages, and diameter changes',
    },
  };

  return {
    ...option,
    ...map[option.key],
  };
}
