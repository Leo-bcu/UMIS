import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canPerformAction } from './accessControl';

describe('canPerformAction', () => {
  it('allows engineers to export data but blocks unsafe threshold edits', () => {
    assert.equal(canPerformAction('engineer', 'export_data'), true);
    assert.equal(canPerformAction('engineer', 'change_safety_threshold'), false);
  });

  it('allows safety officers to review findings', () => {
    assert.equal(canPerformAction('safety', 'review_finding'), true);
  });
});
