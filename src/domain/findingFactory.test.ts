import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFindingFromAIMarker, createFindingFromAlert, createFindingFromAnnotation } from './findingFactory';
import type { AlertEvent } from '../data/alertDataGenerator';
import type { AIMarker, Annotation } from '../types';

describe('createFindingFromAlert', () => {
  it('converts a danger alert into a measured finding', () => {
    const alert: AlertEvent = {
      id: 'alert-0001',
      level: 'danger',
      type: 'gas_overload',
      title: 'CH4 超限',
      description: 'R-001 检测到 CH4 超限',
      robotId: 'R-001',
      position: [1, 2, 3],
      timestamp: 1710000000000,
      acknowledged: false,
    };

    const finding = createFindingFromAlert(alert);

    assert.equal(finding.id, 'finding-alert-alert-0001');
    assert.equal(finding.level, 'danger');
    assert.equal(finding.status, 'new');
    assert.equal(finding.truthBoundary, 'measured');
    assert.deepEqual(finding.position, [1, 2, 3]);
    assert.equal(finding.evidence[0].type, 'sensor');
    assert.equal(finding.evidence[0].robotId, 'R-001');
    assert.equal(finding.evidence[0].truthBoundary, 'measured');
  });
});

describe('createFindingFromAIMarker', () => {
  it('converts an AI marker into an inferred finding', () => {
    const marker: AIMarker = {
      id: 'ai-1',
      position: [3, 2, 1],
      label: '疑似涌水风险',
      level: 'warning',
      createdAt: 1710000000000,
      detail: '渗透率异常升高',
      source: 'LLM 多维推理',
    };

    const finding = createFindingFromAIMarker(marker, 1710000000001);

    assert.equal(finding.id, 'finding-ai-ai-1');
    assert.equal(finding.truthBoundary, 'ai_inferred');
    assert.equal(finding.evidence[0].type, 'ai_reasoning');
    assert.equal(finding.evidence[0].truthBoundary, 'ai_inferred');
  });
});

describe('createFindingFromAnnotation', () => {
  it('converts a text annotation into a human verified finding', () => {
    const annotation: Annotation = {
      id: 'anno-1',
      type: 'text',
      points: [[10, 2, 3]],
      label: '这里需要复查',
      createdAt: 1710000000000,
    };

    const finding = createFindingFromAnnotation(annotation, 1710000000002);

    assert.equal(finding.sourceType, 'annotation');
    assert.equal(finding.truthBoundary, 'human_verified');
    assert.equal(finding.position[0], 10);
    assert.equal(finding.evidence[0].type, 'operator_note');
  });
});
