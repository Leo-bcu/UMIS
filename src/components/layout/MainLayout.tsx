import { TopBar } from './TopBar';
import { ComplianceBar } from './ComplianceBar';
import { SceneSwitchProgress } from './SceneSwitchProgress';
import { FractureDetailPanel } from '../control-panel/FractureDetailPanel';
import { MonitorDetailPanel } from '../control-panel/MonitorDetailPanel';
import { useSceneStore } from '../../store/useSceneStore';
import { getLocalizedSceneObjectLabel, getSceneSemantics } from '../../lib/sceneSemantics';
import { t } from '../../domain/i18nCatalog';

interface MainLayoutProps {
  controlPanel: React.ReactNode;
  scene3D: React.ReactNode;
  chatPanel: React.ReactNode;
  watermark?: React.ReactNode;
}

export function MainLayout({ controlPanel, scene3D, chatPanel, watermark }: MainLayoutProps) {
  const cameraInfo = useSceneStore((s) => s.cameraInfo);
  const scenario = useSceneStore((s) => s.scenario);
  const dataSource = useSceneStore((s) => s.dataSource);
  const locale = useSceneStore((s) => s.locale);
  const selectedRobot = useSceneStore((s) => s.selectedRobot);
  const selectedMonitor = useSceneStore((s) => s.selectedMonitor);
  const selectedFracture = useSceneStore((s) => s.selectedFracture);
  const semantics = getSceneSemantics(scenario);

  // M3: 根据相机方位角旋转指南针
  // cameraInfo.x/z 可用于估算方位角（atan2）
  const compassAngle = Math.atan2(cameraInfo.x, cameraInfo.z) * (180 / Math.PI);

  // 场景标签随数据源变化
  const sceneLabels: Record<string, { name: string; en: string }> = {
    coal: { name: '煤矿瓦斯', en: 'COAL GAS' },
    gold: { name: '金矿裂缝体', en: 'GOLD-FRACTURE' },
    oil: { name: '油气裂缝体', en: 'OIL-FRACTURE' },
    pipeline: { name: '小口径管道', en: 'SMALL-BORE PIPE' },
    nuclear: { name: '核反应堆', en: 'REACTOR' },
    refinery: { name: '化工密闭', en: 'CONFINED SPACE' },
    underground: { name: '地下暗流', en: 'UNDERGROUND' },
  };
  const ds = dataSource === 'fracture' ? scenario : dataSource;
  const sceneLabel = sceneLabels[ds] || sceneLabels.coal;
  const detailTitle = locale === 'zh-CN'
    ? `${semantics.objectLabel}${t('panel.objectDetails', locale)}`
    : `${getLocalizedSceneObjectLabel(scenario, locale)} Details`;
  const detailSubtitle = selectedMonitor
    ? selectedMonitor.id
    : selectedRobot
      ? selectedRobot.id
      : selectedFracture
        ? selectedFracture.name
        : locale === 'zh-CN'
          ? `等待选择${semantics.objectLabel}`
          : `Waiting for ${getLocalizedSceneObjectLabel(scenario, locale).toLowerCase()} selection`;

  return (
    <div className="w-full h-full flex flex-col bg-background overflow-hidden">
      <SceneSwitchProgress />
      <TopBar />

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left panel - 控制台 */}
        <div className="w-[18%] min-w-[240px] max-w-[320px] flex-shrink-0 border-r border-[#D9E1EA] bg-[#F8FAFC]">
          {controlPanel}
        </div>

        {/* Center: 3D scene + bottom chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 3D Scene - 70% height */}
          <div data-tour="scene-3d" className="flex-[7] relative overflow-hidden">
            {scene3D}
            {watermark}

            {/* M3: 动态指南针 — 跟随相机旋转 */}
            <div className="absolute top-3 left-3 glass-panel px-2 py-1.5 z-20 pointer-events-none">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full border border-primary-yellow/20 flex items-center justify-center relative">
                  <span className="text-[9px] text-primary-yellow absolute top-0">N</span>
                  <span className="text-[9px] text-text-muted absolute bottom-0">S</span>
                  <div
                    className="w-0.5 h-3 bg-primary-yellow absolute top-1 left-1/2 -translate-x-1/2 origin-bottom transition-transform duration-100"
                    style={{ transform: `translateX(-50%) rotate(${compassAngle}deg)` }}
                  />
                </div>
                <div>
                  <div className="text-[9px] text-primary-yellow font-semibold">{locale === 'zh-CN' ? sceneLabel.name : sceneLabel.en}</div>
                  <div className="text-[9px] text-text-muted">{sceneLabel.en}</div>
                </div>
              </div>
            </div>

            <div className="scan-overlay" />
          </div>

          {/* Bottom: Chat panel - 30% height */}
          <div className="flex-[3] border-t border-[#D9E1EA] overflow-hidden min-h-[120px] bg-white">
            {chatPanel}
          </div>
        </div>

        {/* Right panel - scene object detail */}
        <div data-tour="detail-panel" className="w-[20%] min-w-[260px] max-w-[360px] flex-shrink-0 border-l border-[#D9E1EA] bg-[#F8FAFC]">
          <div data-testid="detail-panel-header" className="p-3 border-b border-[#D9E1EA] bg-white">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#087443] animate-pulse" />
              <span data-testid="detail-panel-title" className="text-xs font-semibold text-[#182230] tracking-normal">
                {detailTitle}
              </span>
            </div>
            <div data-testid="detail-panel-subtitle" className="mt-1 pl-4 text-[10px] leading-4 text-[#667085] truncate">
              {detailSubtitle}
            </div>
          </div>
          {selectedMonitor ? <MonitorDetailPanel /> : <FractureDetailPanel />}
        </div>
      </div>

      <ComplianceBar />
    </div>
  );
}
