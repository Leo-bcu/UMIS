import { useSceneStore } from '../../store/useSceneStore';
import type { ScenarioType, DataSourceType } from '../../types';
import { fetchFractures } from '../../api/fractureApi';
import { useCallback, useEffect, useState, useRef } from 'react';
import { getSceneSemantics } from '../../lib/sceneSemantics';
import { clearRobotCache } from '../../hooks/useRobots';
import { clearAlertCache } from '../../hooks/useAlerts';
import type { Locale } from '../../domain/i18nCatalog';
import { getDataSourceCopy, getFractureScenarioLabel } from '../../lib/scenarioSelectorCopy';

function getWelcomeMessage(mode: ScenarioType, locale: Locale) {
  const welcomeMap: Record<Locale, Record<string, string>> = {
    'zh-CN': {
      coal: '## 系统就绪\n\n煤矿瓦斯集群巡测AI助手已上线。\n\n当前展示矿井巷道切片内的微型机器人集群，可使用快捷指令分析 CH₄、CO、O₂、温度、通风盲区与 Mesh 覆盖。',
      gold: '## 系统就绪\n\n金矿安全AI助手已上线。\n\n当前监测金矿井下裂缝网络，可使用快捷指令分析微震、岩爆风险、应力集中等数据。',
      oil: '## 系统就绪\n\n油气储层AI助手已上线。\n\n当前监测油气储层裂缝网络，可使用快捷指令分析孔隙压力、渗透率、含油饱和度等数据。',
      pipeline: '## 系统就绪\n\n小口径管道内检AI助手已上线。\n\n当前监测 DN50-DN150 支线/满管管段，可使用快捷指令分析超声壁厚、腐蚀减薄、堵塞、压力、H₂S 与可通行性。',
      nuclear: '## 系统就绪\n\n核反应堆检修AI助手已上线。\n\n当前监测压水堆(PWR)管道系统，可使用快捷指令分析剂量率、疲劳、FAC、振动等数据。',
      underground: '## 系统就绪\n\n地下暗流探测AI助手已上线。\n\n当前监测地下岩溶暗河/承压含水层通道网络，浮走式(章鱼)机器人协同探测。可使用快捷指令分析水流流速、渗透率、矿化度、地温梯度等数据。',
      refinery: '## 系统就绪\n\n化工密闭空间检测AI助手已上线。\n\n当前展示储罐/反应釜内部局部切片，微型软体/蛇形机器人已从人孔释放并回传 H₂S、VOC、O₂、可燃气体、温度、压力、腐蚀与壁厚数据。',
    },
    'en-US': {
      coal: '## System Ready\n\nThe Coal Gas Swarm AI is online.\n\nThe current view shows a mine-roadway slice with micro-robots surveying CH4, CO, O2, temperature, ventilation blind spots, and mesh coverage.',
      gold: '## System Ready\n\nThe Gold Mine Safety AI is online.\n\nThe current view monitors the underground fracture network in the gold mine. Use quick commands for microseismic, burst risk, and stress concentration analysis.',
      oil: '## System Ready\n\nThe Reservoir Analysis AI is online.\n\nThe current view monitors the reservoir fracture network. Use quick commands for pore pressure, permeability, and saturation analysis.',
      pipeline: '## System Ready\n\nThe Small-Bore Pipe ILI AI is online.\n\nThe current view monitors DN50-DN150 branch pipes. Use quick commands for ultrasonic wall thickness, corrosion loss, blockage, pressure, H2S, and passability.',
      nuclear: '## System Ready\n\nThe Reactor Maintenance AI is online.\n\nThe current view monitors the PWR piping system. Use quick commands for dose rate, fatigue usage, FAC, and vibration analysis.',
      underground: '## System Ready\n\nThe Underground Flow Detection AI is online.\n\nThe current view monitors karst channels and confined aquifer passages. Floatwalker robots are surveying flow velocity, permeability, salinity, and geothermal gradients.',
      refinery: '## System Ready\n\nThe Chemical Confined-Space AI is online.\n\nThe current view shows a local slice inside a storage tank/reactor. Soft and snake micro-robots are returning H2S, VOC, O2, flammable gas, temperature, pressure, corrosion, and wall data.',
    },
  };

  return welcomeMap[locale][mode] || welcomeMap[locale].coal;
}

/** 切换数据源时重置聊天消息 */
function updateWelcomeMessage(mode: ScenarioType, locale: Locale) {
  const nextContent = getWelcomeMessage(mode, locale);
  const currentMessages = useSceneStore.getState().messages;
  if (
    currentMessages.length === 1 &&
    currentMessages[0]?.role === 'assistant' &&
    currentMessages[0]?.content === nextContent
  ) {
    return;
  }

  useSceneStore.setState({
    messages: [{
      id: `msg-${Date.now()}`,
      role: 'assistant' as const,
      content: nextContent,
      timestamp: Date.now(),
    }],
  });
  // 清除旧标记
  useSceneStore.getState().clearAIMarkers();
}

const SCENARIOS_FRACTURE: { key: ScenarioType; icon: string }[] = [
  { key: 'coal', icon: '⛏' },
  { key: 'gold', icon: '🪨' },
  { key: 'oil', icon: '🛢' },
];

interface DataSourceOption {
  key: DataSourceType;
  label: string;
  shortLabel: string;
  icon: string;
  desc: string;
  scenario: ScenarioType;
}

const DATA_SOURCES: DataSourceOption[] = [
  { key: 'fracture', label: '模拟数据一·煤矿瓦斯巡测', shortLabel: '煤矿瓦斯', icon: '⛏', desc: '矿井巷道切片·微型集群检测瓦斯/CO/O₂巡测', scenario: 'coal' },
  // { key: 'pipeline', label: '模拟数据二·小口径管道内检', shortLabel: '小口径管道', icon: '🛢', desc: 'DN50-DN150 满管/支线管道腐蚀与壁厚检测', scenario: 'pipeline' },
  // { key: 'nuclear', label: '模拟数据三·核反应堆', shortLabel: '核反应堆', icon: '☢', desc: '压水堆一/二回路管道系统', scenario: 'nuclear' },
  // { key: 'refinery', label: '模拟数据四·化工密闭空间', shortLabel: '化工密闭', icon: '🏭', desc: '储罐/反应釜内部 H₂S/VOC/O₂/壁厚检测', scenario: 'refinery' },
  // { key: 'underground', label: '模拟数据五·地下暗流', shortLabel: '地下暗流', icon: '🌊', desc: '地下岩溶暗河/深层渗流通道·管径变化', scenario: 'underground' },
];

export function ScenarioSelector() {
  const scenario = useSceneStore((s) => s.scenario);
  const setScenario = useSceneStore((s) => s.setScenario);
  const setGasThreshold = useSceneStore((s) => s.setGasThreshold);
  const setFractures = useSceneStore((s) => s.setFractures);
  const dataSource = useSceneStore((s) => s.dataSource);
  const setDataSource = useSceneStore((s) => s.setDataSource);
  const locale = useSceneStore((s) => s.locale);
  const messages = useSceneStore((s) => s.messages);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const loadScenarioFractures = useCallback(async (nextScenario: ScenarioType) => {
    const requestId = ++requestIdRef.current;
    const fractures = await fetchFractures(nextScenario);
    if (requestId !== requestIdRef.current) return;
    setFractures(fractures);
  }, [setFractures]);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = async (key: ScenarioType) => {
    clearRobotCache('fracture');
    clearAlertCache('fracture', key);
    setScenario(key);
    setGasThreshold(getSceneSemantics(key).threshold.defaultValue);
    await loadScenarioFractures(key);
    updateWelcomeMessage(key, locale);
  };

  const handleSwitchDataSource = async (ds: DataSourceType) => {
    setDropdownOpen(false);
    const option = DATA_SOURCES.find((d) => d.key === ds);
    if (!option) return;
    clearRobotCache(ds);
    clearAlertCache(ds, option.scenario);
    setDataSource(ds);

    if (ds === 'fracture') {
      if (scenario === 'pipeline' || scenario === 'nuclear' || scenario === 'refinery' || scenario === 'underground') {
        await handleSwitch('coal');
      } else {
        setScenario('coal');
        setGasThreshold(getSceneSemantics('coal').threshold.defaultValue);
        await loadScenarioFractures('coal');
        updateWelcomeMessage('coal', locale);
      }
    } else {
      setScenario(option.scenario);
      setGasThreshold(getSceneSemantics(option.scenario).threshold.defaultValue);
      await loadScenarioFractures(option.scenario);
      updateWelcomeMessage(option.scenario, locale);
    }
  };

  // 初始化时通过 API 加载数据
  useEffect(() => {
    loadScenarioFractures(scenario);
  }, [loadScenarioFractures, scenario]);

  useEffect(() => {
    if (messages.length === 1 && messages[0]?.role === 'assistant') {
      const nextContent = getWelcomeMessage(scenario, locale);
      if (messages[0].content !== nextContent) {
        updateWelcomeMessage(scenario, locale);
      }
    }
  }, [locale, messages, scenario]);

  const isPipelineMode = dataSource !== 'fracture';
  const currentSource = getDataSourceCopy(DATA_SOURCES.find((d) => d.key === dataSource) || DATA_SOURCES[0], locale);
  const currentFractureScenario = SCENARIOS_FRACTURE.find((item) => item.key === scenario) || SCENARIOS_FRACTURE[0];
  const currentFractureLabel = getFractureScenarioLabel(scenario, locale);
  const currentTopIcon = dataSource === 'fracture' ? currentFractureScenario.icon : currentSource.icon;
  const currentTopLabel = dataSource === 'fracture'
    ? currentFractureLabel
    : currentSource.label;

  // return (
  //   <div data-tour="scenario-selector" className="flex items-center gap-2">
  //     {/* 数据源下拉菜单 */}
  //     <div className="relative" ref={dropdownRef}>
  //       <button
  //         onClick={() => setDropdownOpen((v) => !v)}
  //         className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap bg-[#E7F7EF] text-[#087443] border border-[#B7E4CB] hover:bg-[#DDF3E8]"
  //       >
  //         <span className="text-sm">{currentTopIcon}</span>
  //         <span>{currentTopLabel}</span>
  //         <svg
  //           className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
  //           fill="none" stroke="currentColor" viewBox="0 0 24 24"
  //         >
  //           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  //         </svg>
  //       </button>

  //       {/* 下拉面板 */}
  //       {dropdownOpen && (
  //         <div className="absolute top-full left-0 mt-1 w-72 rounded-lg border border-[#D9E1EA] bg-white/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
  //           {DATA_SOURCES.map((ds) => {
  //             const localizedSource = getDataSourceCopy(ds, locale);
  //             return (
  //             <button
  //               key={ds.key}
  //               onClick={() => handleSwitchDataSource(ds.key)}
  //               className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-all border-b border-[#EEF2F6] last:border-b-0 ${
  //                 dataSource === ds.key
  //                   ? 'bg-[#E7F7EF] text-[#087443]'
  //                   : 'text-[#667085] hover:bg-[#F8FAFC] hover:text-[#182230]'
  //               }`}
  //             >
  //               <span className="text-base mt-0.5">{ds.icon}</span>
  //               <div className="flex-1 min-w-0">
  //                 <div className="text-[11px] font-semibold whitespace-nowrap">{localizedSource.label}</div>
  //                 <div className="text-[9px] text-[#667085] mt-0.5">{localizedSource.desc}</div>
  //               </div>
  //               {dataSource === ds.key && (
  //                 <span className="text-[#087443] text-xs mt-0.5">✓</span>
  //               )}
  //             </button>
  //             );
  //           })}
  //         </div>
  //       )}
  //     </div>

  //     {/* 分隔线 */}
  //     <div className="w-px h-4 bg-[#D9E1EA]" />

  //     {/* 子场景（仅裂缝模式显示煤矿/金矿/油气） */}
  //     {!isPipelineMode && SCENARIOS_FRACTURE.map(({ key, icon }) => (
  //       <button
  //         key={key}
  //         onClick={() => handleSwitch(key)}
  //         className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
  //           scenario === key
  //             ? 'bg-[#1F2937] text-white border border-[#1F2937]'
  //             : 'text-[#667085] border border-transparent hover:bg-[#EEF2F6] hover:text-[#182230]'
  //         }`}
  //       >
  //         <span className="text-xs">{icon}</span>
  //         {getFractureScenarioLabel(key, locale)}
  //       </button>
  //     ))}
  //   </div>
  // );
}
