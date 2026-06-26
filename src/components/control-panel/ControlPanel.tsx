import { TooltipProvider } from '../ui/tooltip';
import { GasThresholdSlider } from './GasThresholdSlider';
import { LayerToggle } from './LayerToggle';
import { ToolActions } from './ToolActions';
import { SystemStatus } from './SystemStatus';
import { RoleDashboard } from './RoleDashboard';
import { MissionSnapshotPanel } from './MissionSnapshotPanel';
import { RobotFleet } from './RobotFleet';
import { MonitorFleet } from './MonitorFleet';
import { AlertFeed } from './AlertFeed';
import { AIActionAuditPanel } from './AIActionAuditPanel';
import { SensorTrends } from './SensorTrends';
import { CoverageSummaryCard } from '../findings/CoverageSummaryCard';
import { FindingList } from '../findings/FindingList';
import { ConfidenceSlider } from './ConfidenceSlider';
import { useSceneStore } from '../../store/useSceneStore';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { t } from '../../domain/i18nCatalog';

export function ControlPanel() {
  const physicalTruthMode = useSceneStore((s) => s.physicalTruthMode);
  const locale = useSceneStore((s) => s.locale);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full bg-[#F8FAFC] border-r border-[#D9E1EA] flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[#D9E1EA] bg-white flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#087443] animate-pulse" />
          <h2 className="text-sm font-semibold text-[#182230] tracking-wide">{t('control.console', locale)}</h2>
          <span className="ml-auto text-[9px] text-[#087443] font-mono flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-[#087443] animate-pulse" />
            {t('status.current', locale)}
          </span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            <SystemStatus />
            <Separator />
            <MissionSnapshotPanel />
            <Separator />
            <RoleDashboard />
            <Separator />
            <AlertFeed />
            <Separator />
            <CoverageSummaryCard />
            <Separator />
            <FindingList />
            <Separator />
            <AIActionAuditPanel />
            <Separator />
            <RobotFleet />
            <Separator />
            <MonitorFleet />
            <Separator />
            <SensorTrends />
            <Separator />
            <LayerToggle />
            <Separator />
            <ConfidenceSlider />
            <Separator />
            {!physicalTruthMode && (
              <GasThresholdSlider />
            )}
            <ToolActions />
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
