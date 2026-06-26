import { useEffect, useState } from 'react';
import type { SceneStats } from '../types/api';
import { useSceneStore } from '../store/useSceneStore';

export interface UseSceneStatsResult {
  data: SceneStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSceneStats(): UseSceneStatsResult {
  const scenario = useSceneStore((s) => s.scenario);
  const dataSource = useSceneStore((s) => s.dataSource);
  const [data, setData] = useState<SceneStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void import('../domain/sceneDataset').then(({ buildSceneDataset }) => {
      if (cancelled) return;
      setData(buildSceneDataset(dataSource, scenario).summary.scene);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dataSource, scenario]);

  return {
    data,
    loading,
    error: null,
    refetch: () => {},
  };
}
