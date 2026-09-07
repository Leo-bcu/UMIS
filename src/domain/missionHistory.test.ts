import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMissionSnapshot, missionNeedsReview } from './missionHistory';

describe('createMissionSnapshot', () => {
  it('marks critical or low-coverage missions as needing review', () => {
    const snapshot = createMissionSnapshot({
      projectName: '北翼回风巷',
      scenario: 'coal',
      startedAt: 100,
      coveragePct: 0.42,
      findingCount: 5,
      criticalCount: 1,
      exportReadinessPct: 0.3,
    });

    assert.equal(snapshot.status, 'needs_review');
    assert.equal(snapshotNeedsReadableWarning(snapshot.summary), true);
    assert.equal(missionNeedsReview(snapshot), true);
  });

  it('marks well-covered missions as export ready', () => {
    const snapshot = createMissionSnapshot({
      projectName: '核岛安全壳',
      scenario: 'nuclear',
      startedAt: 100,
      finishedAt: 200,
      coveragePct: 0.86,
      findingCount: 2,
      criticalCount: 0,
      exportReadinessPct: 0.82,
    });

    assert.equal(snapshot.status, 'ready_for_export');
    assert.equal(snapshot.summary.includes('可交付'), true);
    assert.equal(missionNeedsReview(snapshot), false);
  });
});

function snapshotNeedsReadableWarning(summary: string): boolean {
  return summary.includes('需复查') && summary.includes('覆盖');
}
