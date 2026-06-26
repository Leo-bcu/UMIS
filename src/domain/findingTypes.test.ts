import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TRUTH_BOUNDARY_LABELS, getTruthBoundaryLabel } from './findingTypes';

describe('findingTypes', () => {
  it('defines human-readable truth boundary labels', () => {
    assert.equal(TRUTH_BOUNDARY_LABELS.measured, '实测');
    assert.equal(TRUTH_BOUNDARY_LABELS.ai_inferred, 'AI 推断');
  });

  it('returns localized truth boundary labels', () => {
    assert.equal(getTruthBoundaryLabel('human_verified', 'en-US'), 'Human Verified');
    assert.equal(getTruthBoundaryLabel('unknown', 'zh-CN'), '未探明');
  });
});
