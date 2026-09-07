/**
 * usePOIs — POI 兴趣点数据 Hook
 */

import { useEffect, useState } from 'react';
import { fetchPOIs } from '../api/poiApi';
import type { POI } from '../types';

let cached: POI[] | null = null;
let fetching: Promise<POI[]> | null = null;

export interface UsePOIsResult {
  data: POI[];
  loading: boolean;
  error: string | null;
}

export function usePOIs(): UsePOIsResult {
  const [data, setData] = useState<POI[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;

    let cancelled = false;

    if (!fetching) {
      fetching = fetchPOIs();
    }

    fetching
      .then((d) => {
        if (cancelled) return;
        cached = d;
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || '加载 POI 数据失败');
        setLoading(false);
        fetching = null;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
