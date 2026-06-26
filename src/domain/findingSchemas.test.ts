import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findingSchema } from './findingSchemas';

describe('findingSchema', () => {
  it('accepts a measured danger finding with evidence', () => {
    const result = findingSchema.safeParse({
      id: 'finding-alert-0001',
      sourceType: 'alert',
      sourceId: 'alert-0001',
      title: 'CH4 超限',
      description: 'R-001 回传 CH4=2.4%',
      level: 'danger',
      status: 'new',
      position: [1, 2, 3],
      truthBoundary: 'measured',
      confidence: 0.92,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      evidence: [
        {
          id: 'ev-1',
          type: 'sensor',
          label: 'CH4',
          value: '2.4%',
          truthBoundary: 'measured',
          timestamp: 1710000000000,
        },
      ],
    });

    assert.equal(result.success, true);
  });
});
