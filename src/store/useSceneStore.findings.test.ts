import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useSceneStore } from './useSceneStore';
import type { Finding } from '../domain/findingTypes';

function sampleFinding(id: string): Finding {
  return {
    id,
    sourceType: 'manual',
    sourceId: id,
    title: '测试风险',
    description: '测试描述',
    level: 'warning',
    status: 'new',
    position: [0, 0, 0],
    truthBoundary: 'measured',
    confidence: 0.8,
    createdAt: 1,
    updatedAt: 1,
    evidence: [],
  };
}

describe('useSceneStore findings', () => {
  it('adds and updates a finding status', () => {
    const store = useSceneStore.getState();
    store.clearFindings();
    store.addFinding(sampleFinding('finding-1'));
    store.updateFindingStatus('finding-1', 'acknowledged');

    const finding = useSceneStore.getState().findings[0];
    assert.equal(finding.id, 'finding-1');
    assert.equal(finding.status, 'acknowledged');
  });
});
