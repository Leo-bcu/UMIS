import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildExportPreflight } from './exportPreflight';
import type { Finding } from './findingTypes';

function finding(id: string, truthBoundary: Finding['truthBoundary'], confidence: number): Finding {
  return {
    id,
    sourceType: 'manual',
    sourceId: id,
    title: id,
    description: id,
    level: 'warning',
    status: 'new',
    position: [0, 0, 0],
    truthBoundary,
    confidence,
    createdAt: 1,
    updatedAt: 1,
    evidence: [],
  };
}

describe('buildExportPreflight', () => {
  it('warns when an export includes AI inferred findings', () => {
    const preflight = buildExportPreflight({
      format: 'pdf',
      pointCount: 100,
      findingCount: 2,
      findings: [finding('ai-1', 'ai_inferred', 0.65), finding('m-1', 'measured', 0.9)],
      includeAIInferred: true,
    });

    assert.equal(preflight.status, 'warning');
    assert.equal(preflight.checks.some((check) => check.id === 'ai-boundary' && check.level === 'warning'), true);
  });

  it('blocks empty export data', () => {
    const preflight = buildExportPreflight({
      format: 'las',
      pointCount: 0,
      findingCount: 0,
      findings: [],
      includeAIInferred: false,
    });

    assert.equal(preflight.status, 'blocked');
  });
});
