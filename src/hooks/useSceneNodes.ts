/**
 * useSceneNodes — 场景节点数据 Hook
 *
 * 调用 API 获取 SceneNode[]，内部缓存。
 * 被 MeshLayer 和需要原始节点数据的组件共享。
 */

import { useEffect, useState } from 'react';
import { fetchSceneNodes } from '../api/sceneApi';
import type { SceneNode } from '../types';

let cached: SceneNode[] | null = null;
let fetching: Promise<SceneNode[]> | null = null;

export interface UseSceneNodesResult {
  data: SceneNode[] | null;
  loading: boolean;
  error: string | null;
}

export function useSceneNodes(): UseSceneNodesResult {
  const [data, setData] = useState<SceneNode[] | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;

    let cancelled = false;

    if (!fetching) {
      fetching = fetchSceneNodes();
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
        setError(e.message || '加载场景数据失败');
        setLoading(false);
        fetching = null;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
