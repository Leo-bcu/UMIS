import { useSceneStore } from '../../store/useSceneStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Slider } from '../ui/slider';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Info } from 'lucide-react';
import { getLocalizedThresholdCopy } from '../../lib/sceneSemantics';

export function GasThresholdSlider() {
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const setGasThreshold = useSceneStore((s) => s.setGasThreshold);
  const scenario = useSceneStore((s) => s.scenario);
  const locale = useSceneStore((s) => s.locale);

  const threshold = getLocalizedThresholdCopy(scenario, locale);

  const isOverThreshold = gasThreshold < threshold.defaultValue;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CardTitle>{threshold.label}</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-[#667085] cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px]">
                {threshold.tooltip}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className={`text-sm font-mono font-bold ${isOverThreshold ? 'text-[#B42318] animate-pulse' : 'text-[#C99A2E]'}`}>
            {gasThreshold.toFixed(threshold.precision)}{threshold.unit}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Slider
          value={[gasThreshold]}
          onValueChange={(vals) => setGasThreshold(vals[0])}
          min={threshold.min}
          max={threshold.max}
          step={threshold.step}
        />
        <div className="flex justify-between text-[9px] text-[#667085]/50 font-mono">
          <span>{threshold.min}{threshold.unit}</span>
          <span className="text-[#C99A2E]/50">{threshold.defaultValue}{threshold.unit}</span>
          <span>{threshold.max}{threshold.unit}</span>
        </div>
        {/* 色标图例 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-sm" style={{
            background: 'linear-gradient(to right, #1A80E0, #44DDAA, #DDCC22, #FF6622, #FF2222)'
          }} />
          <span className="text-[9px] text-[#667085]">{locale === 'zh-CN' ? '安全 → 危险' : 'Safe → Danger'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
