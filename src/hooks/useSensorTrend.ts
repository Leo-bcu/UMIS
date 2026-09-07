import { useState, useEffect } from 'react';
import type { SensorTrend } from '../data/sensorTrendGenerator';
import { useSceneStore } from '../store/useSceneStore';

export type TrendTimeRange = '1h' | '2.5h' | '6h' | '24h';

/** 时间窗 → 数据点数（5 分钟间隔） */
export const RANGE_POINTS: Record<TrendTimeRange, number> = {
  '1h': 12,
  '2.5h': 30,
  '6h': 72,
  '24h': 96,
};

let cachedTrend: SensorTrend | null = null;
let cachedFractureKey = '';
let cachedScenario = '';
let cachedDataSource = '';
let cachedRange: TrendTimeRange = '2.5h';

export function useSensorTrend(range: TrendTimeRange = '2.5h') {
  const [data, setData] = useState<SensorTrend | null>(range === cachedRange ? cachedTrend : null);
  const [loading, setLoading] = useState(range === cachedRange ? !cachedTrend : true);
  const fractures = useSceneStore((s) => s.fractures);
  const scenario = useSceneStore((s) => s.scenario);
  const dataSource = useSceneStore((s) => s.dataSource);

  useEffect(() => {
    const fractureKey = fractures.map((f) => f.id).join(',');
    const totalNodes = fractures.reduce((sum, fracture) => sum + fracture.nodes.length, 0);
    if (
      cachedTrend &&
      fractureKey === cachedFractureKey &&
      scenario === cachedScenario &&
      dataSource === cachedDataSource &&
      range === cachedRange
    ) return;

    let cancelled = false;
    setLoading(true);
    import('../data/sensorTrendGenerator')
      .then(({ generateMockSensorTrend }) => {
        if (!cancelled) {
          cachedTrend = generateMockSensorTrend(totalNodes, fractures, scenario, RANGE_POINTS[range]);
          cachedFractureKey = fractureKey;
          cachedScenario = scenario;
          cachedDataSource = dataSource;
          cachedRange = range;
          setData(cachedTrend);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dataSource, fractures, scenario, range]);

  const totalNodes = fractures.reduce((sum, fracture) => sum + fracture.nodes.length, 0);
  return { data: data ?? cachedTrend, loading, totalNodes };
}
