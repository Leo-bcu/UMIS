import type { Fracture } from '../types';
import type { Finding, TruthBoundary } from './findingTypes';

export interface ExplorationCoverageSummary {
  pathPoints: number;
  measuredNodes: number;
  unknownPathPoints: number;
  measuredPct: number;
  unknownPct: number;
  totalFindings: number;
  aiInferredFindings: number;
  humanVerifiedFindings: number;
  lowConfidenceFindings: number;
  truthBoundaryCounts: Record<TruthBoundary, number>;
}

const emptyBoundaryCounts = (): Record<TruthBoundary, number> => ({
  measured: 0,
  interpolated: 0,
  ai_inferred: 0,
  unknown: 0,
  human_verified: 0,
});

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function summarizeExplorationCoverage(
  fractures: Fracture[],
  findings: Finding[] = []
): ExplorationCoverageSummary {
  const pathPoints = fractures.reduce((sum, fracture) => sum + fracture.path.length, 0);
  const measuredNodes = fractures.reduce(
    (sum, fracture) => sum + Math.min(fracture.nodes.length, fracture.path.length),
    0
  );
  const unknownPathPoints = Math.max(pathPoints - measuredNodes, 0);
  const measuredPct = pathPoints === 0 ? 0 : clamp01(measuredNodes / pathPoints);
  const unknownPct = pathPoints === 0 ? 0 : clamp01(unknownPathPoints / pathPoints);
  const truthBoundaryCounts = emptyBoundaryCounts();

  truthBoundaryCounts.measured += measuredNodes;
  truthBoundaryCounts.unknown += unknownPathPoints;

  for (const finding of findings) {
    truthBoundaryCounts[finding.truthBoundary] += 1;
  }

  return {
    pathPoints,
    measuredNodes,
    unknownPathPoints,
    measuredPct,
    unknownPct,
    totalFindings: findings.length,
    aiInferredFindings: findings.filter((finding) => finding.truthBoundary === 'ai_inferred').length,
    humanVerifiedFindings: findings.filter((finding) => finding.truthBoundary === 'human_verified').length,
    lowConfidenceFindings: findings.filter(
      (finding) => finding.confidence < 0.7 || finding.truthBoundary === 'unknown'
    ).length,
    truthBoundaryCounts,
  };
}
