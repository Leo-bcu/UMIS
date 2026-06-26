import type { Locale } from './i18nCatalog';
import { t } from './i18nCatalog';

export type TruthBoundary = 'measured' | 'interpolated' | 'ai_inferred' | 'unknown' | 'human_verified';

export const TRUTH_BOUNDARY_LABELS: Record<TruthBoundary, string> = {
  measured: '实测',
  interpolated: '插值',
  ai_inferred: 'AI 推断',
  unknown: '未探明',
  human_verified: '人工确认',
};

export function getTruthBoundaryLabel(boundary: TruthBoundary, locale: Locale = 'zh-CN'): string {
  const keyMap: Record<TruthBoundary, Parameters<typeof t>[0]> = {
    measured: 'truth.measured',
    interpolated: 'truth.interpolated',
    ai_inferred: 'truth.aiInferred',
    unknown: 'truth.unknown',
    human_verified: 'truth.humanVerified',
  };
  return t(keyMap[boundary], locale);
}

export type FindingLevel = 'danger' | 'warning' | 'info';
export type FindingStatus = 'new' | 'acknowledged' | 'assigned' | 'reviewed' | 'closed';
export type FindingSourceType = 'alert' | 'ai_marker' | 'annotation' | 'manual';
export type EvidenceType = 'sensor' | 'robot' | 'pointcloud' | 'ai_reasoning' | 'operator_note' | 'export';

export interface FindingEvidence {
  id: string;
  type: EvidenceType;
  label: string;
  value: string;
  truthBoundary: TruthBoundary;
  timestamp: number;
  robotId?: string;
  confidence?: number;
}

export interface Finding {
  id: string;
  sourceType: FindingSourceType;
  sourceId: string;
  title: string;
  description: string;
  level: FindingLevel;
  status: FindingStatus;
  position: [number, number, number];
  truthBoundary: TruthBoundary;
  confidence: number;
  createdAt: number;
  updatedAt: number;
  assignee?: string;
  evidence: FindingEvidence[];
}
