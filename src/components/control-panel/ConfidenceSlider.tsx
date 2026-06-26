import { useSceneStore } from '../../store/useSceneStore';
import { useSceneStats } from '../../hooks/useSceneStats';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Slider } from '../ui/slider';
import { Progress } from '../ui/progress';
import { t } from '../../domain/i18nCatalog';

export function ConfidenceSlider() {
  const confidenceFilter = useSceneStore((s) => s.confidenceFilter);
  const setConfidenceFilter = useSceneStore((s) => s.setConfidenceFilter);
  const locale = useSceneStore((s) => s.locale);
  const { data: stats } = useSceneStats();
  const totalNodes = stats?.totalNodes ?? 0;
  const filteredCount = Math.round(totalNodes * (confidenceFilter / 100));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('confidence.title', locale)}</CardTitle>
          <div className="text-sm font-mono font-bold text-[#C99A2E]">{confidenceFilter}%</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Slider
          value={[confidenceFilter]}
          onValueChange={(vals) => setConfidenceFilter(vals[0])}
          min={0}
          max={100}
          step={1}
        />
        <div className="flex justify-between text-[9px] text-[#667085]/50 font-mono">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
        <Progress value={confidenceFilter} />
        <div className="flex items-center justify-between text-[9px]">
          <span className="text-[#667085]/70">{t('confidence.stripBlind', locale)}</span>
          {confidenceFilter > 0 && (
            <span className="text-[#B54708] font-mono">
              {locale === 'zh-CN'
                ? `过滤 -${filteredCount.toLocaleString()} 节点`
                : `-${filteredCount.toLocaleString()} ${t('confidence.filteredNodes', locale)}`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
