import type { ScenarioType } from '../types';
import type { Locale } from './i18nCatalog';

export type MissionStatus = 'active' | 'needs_review' | 'ready_for_export' | 'closed';

export interface MissionSnapshotInput {
  projectName: string;
  scenario: ScenarioType;
  projectLabel?: string;
  locale?: Locale;
  startedAt: number;
  finishedAt?: number;
  coveragePct: number;
  findingCount: number;
  criticalCount: number;
  exportReadinessPct: number;
}

export interface MissionSnapshot extends MissionSnapshotInput {
  id: string;
  status: MissionStatus;
  summary: string;
}

const REVIEW_COVERAGE_THRESHOLD = 0.6;
const EXPORT_READY_THRESHOLD = 0.75;

function clampPct(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function pct(value: number): string {
  return `${Math.round(clampPct(value) * 100)}%`;
}

function missionStatus(input: MissionSnapshotInput): MissionStatus {
  if (input.criticalCount > 0 || input.coveragePct < REVIEW_COVERAGE_THRESHOLD) return 'needs_review';
  if (input.finishedAt && input.exportReadinessPct >= EXPORT_READY_THRESHOLD) return 'ready_for_export';
  if (input.finishedAt) return 'closed';
  return 'active';
}

function buildSummary(input: MissionSnapshotInput, status: MissionStatus): string {
  const locale = input.locale ?? 'zh-CN';
  if (status === 'needs_review') {
    return locale === 'zh-CN'
      ? `需复查：覆盖 ${pct(input.coveragePct)}，高优先级 ${input.criticalCount} 项，导出就绪 ${pct(input.exportReadinessPct)}。`
      : `Needs review: coverage ${pct(input.coveragePct)}, ${input.criticalCount} critical items, delivery readiness ${pct(input.exportReadinessPct)}.`;
  }
  if (status === 'ready_for_export') {
    return locale === 'zh-CN'
      ? `可交付：覆盖 ${pct(input.coveragePct)}，发现 ${input.findingCount} 项，导出就绪 ${pct(input.exportReadinessPct)}。`
      : `Ready for delivery: coverage ${pct(input.coveragePct)}, ${input.findingCount} findings, delivery readiness ${pct(input.exportReadinessPct)}.`;
  }
  if (status === 'closed') {
    return locale === 'zh-CN'
      ? `已收束：覆盖 ${pct(input.coveragePct)}，发现 ${input.findingCount} 项，建议补充复核后归档。`
      : `Closed: coverage ${pct(input.coveragePct)}, ${input.findingCount} findings, archive after final review.`;
  }
  return locale === 'zh-CN'
    ? `进行中：覆盖 ${pct(input.coveragePct)}，发现 ${input.findingCount} 项，导出就绪 ${pct(input.exportReadinessPct)}。`
    : `Active: coverage ${pct(input.coveragePct)}, ${input.findingCount} findings, delivery readiness ${pct(input.exportReadinessPct)}.`;
}

export function createMissionSnapshot(input: MissionSnapshotInput): MissionSnapshot {
  const status = missionStatus(input);
  return {
    ...input,
    coveragePct: clampPct(input.coveragePct),
    exportReadinessPct: clampPct(input.exportReadinessPct),
    id: `${input.scenario}-${input.startedAt}`,
    status,
    summary: buildSummary(input, status),
  };
}

export function missionNeedsReview(snapshot: MissionSnapshot): boolean {
  return snapshot.status === 'needs_review';
}
