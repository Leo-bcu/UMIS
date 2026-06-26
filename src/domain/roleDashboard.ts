import type { AlertEvent } from '../data/alertDataGenerator';
import type { Fracture, Robot } from '../types';
import { summarizeExplorationCoverage, type ExplorationCoverageSummary } from './findingCoverage';
import type { Finding } from './findingTypes';

export interface RoleDashboardInput {
  robots: Robot[];
  alerts: AlertEvent[];
  findings: Finding[];
  fractures: Fracture[];
}

export interface ManagerDashboardSummary {
  openCriticalCount: number;
  activeFindingCount: number;
  onlineRobotPct: number;
  coveragePct: number;
  exportReadinessPct: number;
}

export interface SafetyQueueItem {
  id: string;
  title: string;
  level: 'danger' | 'warning' | 'info';
  source: 'alert' | 'finding';
  timestamp: number;
  needsReview: boolean;
}

export interface EngineerDataQualitySummary {
  measuredPct: number;
  unknownPct: number;
  lowConfidenceFindings: number;
  aiInferredFindings: number;
  sampledNodes: number;
  pathPoints: number;
}

export interface MissionTimelineItem {
  id: string;
  timestamp: number;
  label: string;
  kind: 'alert' | 'finding' | 'robot' | 'coverage';
}

export interface RoleDashboard {
  manager: ManagerDashboardSummary;
  safetyQueue: SafetyQueueItem[];
  engineerDataQuality: EngineerDataQualitySummary;
  missionTimeline: MissionTimelineItem[];
  coverage: ExplorationCoverageSummary;
}

function activeRobotPct(robots: Robot[]): number {
  if (robots.length === 0) return 0;
  return robots.filter((robot) => robot.status === 'online').length / robots.length;
}

function exportReadiness(coverage: ExplorationCoverageSummary, findings: Finding[]): number {
  const hasCriticalUnreviewed = findings.some(
    (finding) => finding.level === 'danger' && finding.status !== 'reviewed' && finding.status !== 'closed'
  );
  const confidencePenalty = coverage.lowConfidenceFindings > 0 ? 0.15 : 0;
  const criticalPenalty = hasCriticalUnreviewed ? 0.25 : 0;
  return Math.max(0, Math.min(1, coverage.measuredPct - confidencePenalty - criticalPenalty));
}

export function buildRoleDashboard(input: RoleDashboardInput): RoleDashboard {
  const coverage = summarizeExplorationCoverage(input.fractures, input.findings);
  const dangerAlerts = input.alerts.filter((alert) => alert.level === 'danger' && !alert.acknowledged);
  const dangerFindings = input.findings.filter(
    (finding) => finding.level === 'danger' && finding.status !== 'closed'
  );

  const safetyQueue: SafetyQueueItem[] = [
    ...dangerAlerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      level: alert.level,
      source: 'alert' as const,
      timestamp: alert.timestamp,
      needsReview: true,
    })),
    ...input.findings
      .filter((finding) => finding.level !== 'info' && finding.status !== 'closed')
      .map((finding) => ({
        id: finding.id,
        title: finding.title,
        level: finding.level,
        source: 'finding' as const,
        timestamp: finding.createdAt,
        needsReview: finding.truthBoundary !== 'human_verified' || finding.confidence < 0.8,
      })),
  ].sort((a, b) => {
    const levelRank = { danger: 0, warning: 1, info: 2 };
    return levelRank[a.level] - levelRank[b.level] || b.timestamp - a.timestamp;
  });

  const robotRiskItems = input.robots
    .filter((robot) => robot.status === 'offline' || robot.status === 'error' || robot.status === 'low_battery')
    .map((robot) => ({
      id: `robot-${robot.id}`,
      timestamp: robot.lastUpdate,
      label: `${robot.id} ${robot.status}`,
      kind: 'robot' as const,
    }));

  const missionTimeline: MissionTimelineItem[] = [
    ...input.alerts.map((alert) => ({
      id: alert.id,
      timestamp: alert.timestamp,
      label: alert.title,
      kind: 'alert' as const,
    })),
    ...input.findings.map((finding) => ({
      id: finding.id,
      timestamp: finding.createdAt,
      label: finding.title,
      kind: 'finding' as const,
    })),
    ...robotRiskItems,
    {
      id: 'coverage-current',
      timestamp: Date.now(),
      label: `探索覆盖 ${Math.round(coverage.measuredPct * 100)}%`,
      kind: 'coverage' as const,
    },
  ].sort((a, b) => b.timestamp - a.timestamp);

  return {
    manager: {
      openCriticalCount: dangerAlerts.length + dangerFindings.length,
      activeFindingCount: input.findings.filter((finding) => finding.status !== 'closed').length,
      onlineRobotPct: activeRobotPct(input.robots),
      coveragePct: coverage.measuredPct,
      exportReadinessPct: exportReadiness(coverage, input.findings),
    },
    safetyQueue,
    engineerDataQuality: {
      measuredPct: coverage.measuredPct,
      unknownPct: coverage.unknownPct,
      lowConfidenceFindings: coverage.lowConfidenceFindings,
      aiInferredFindings: coverage.aiInferredFindings,
      sampledNodes: coverage.measuredNodes,
      pathPoints: coverage.pathPoints,
    },
    missionTimeline,
    coverage,
  };
}
