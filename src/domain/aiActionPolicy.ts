import type { SceneAction } from '../types';

export interface AIActionPolicyResult {
  allowed: boolean;
  requiresHumanReview: boolean;
  reason: string;
  undoable: boolean;
}

export interface AIActionAuditEntry {
  id: string;
  actionType: SceneAction['type'];
  action: SceneAction;
  summary: string;
  result: AIActionPolicyResult;
  undoable: boolean;
  before?: AIActionSnapshot;
  undoneAt?: number;
  createdAt: number;
}

export interface AIActionSnapshot {
  gasThreshold: number;
}

const UNDOABLE_ACTIONS = new Set<SceneAction['type']>([
  'highlight',
  'toggleLayer',
  'markPoints',
  'activateTool',
  'setGasThreshold',
  'setColorMode',
]);

export function evaluateAIAction(action: SceneAction): AIActionPolicyResult {
  if (action.type === 'setGasThreshold') {
    const threshold = action.threshold ?? 0;
    if (threshold <= 0 || threshold > 10) {
      return {
        allowed: false,
        requiresHumanReview: true,
        reason: 'AI 不允许设置超出安全边界的报警阈值',
        undoable: true,
      };
    }
  }

  if (action.type === 'markPoints') {
    const hasDanger = action.points?.some((point) => point.level === 'danger') ?? false;
    return {
      allowed: true,
      requiresHumanReview: hasDanger,
      reason: hasDanger ? '危险标记属于 AI 推断，需要人工复核' : 'AI 标记可执行并进入证据链',
      undoable: true,
    };
  }

  if (action.type === 'clearMarkers') {
    return {
      allowed: true,
      requiresHumanReview: false,
      reason: '清除 AI 标记会移除当前临时标记',
      undoable: false,
    };
  }

  return {
    allowed: true,
    requiresHumanReview: false,
    reason: '视图或工具辅助动作允许执行',
    undoable: UNDOABLE_ACTIONS.has(action.type),
  };
}

export function createAIActionAuditEntry(
  action: SceneAction,
  summary: string,
  timestamp = Date.now(),
  before?: AIActionSnapshot
): AIActionAuditEntry {
  const result = evaluateAIAction(action);
  return {
    id: `ai-action-${timestamp}-${action.type}`,
    actionType: action.type,
    action,
    summary,
    result,
    undoable: result.undoable,
    before,
    createdAt: timestamp,
  };
}

export function createUndoAction(action: SceneAction, before: AIActionSnapshot): SceneAction | null {
  if (action.type === 'setGasThreshold') {
    return { type: 'setGasThreshold', threshold: before.gasThreshold };
  }
  if (action.type === 'clearMarkers') {
    return null;
  }
  if (action.type === 'markPoints') {
    return { type: 'clearMarkers' };
  }
  if (action.type === 'highlight') {
    return { type: 'highlight', position: [0, 0, 0], radius: 0 };
  }
  return null;
}
