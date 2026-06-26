/**
 * useQuickCommands — 快捷指令 Hook（按场景动态切换）
 */

import { useMemo } from 'react';
import { getQuickCommands } from '../lib/mockAI';
import type { QuickCommand } from '../types/api';
import { useSceneStore } from '../store/useSceneStore';

export interface UseQuickCommandsResult {
  data: QuickCommand[];
  loading: boolean;
}

export function useQuickCommands(): UseQuickCommandsResult {
  const scenario = useSceneStore((s) => s.scenario);
  const locale = useSceneStore((s) => s.locale);

  const data = useMemo(() => getQuickCommands(scenario, locale), [scenario, locale]);

  return { data, loading: false };
}
