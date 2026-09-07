import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createExportHistoryEntry } from './exportHistory';

describe('createExportHistoryEntry', () => {
  it('records export format, status, and preflight boundary', () => {
    const entry = createExportHistoryEntry({
      format: 'pdf',
      status: 'success',
      preflightStatus: 'warning',
      findingCount: 3,
      includeAIInferred: true,
      timestamp: 100,
    });

    assert.equal(entry.id, 'export-100-pdf');
    assert.equal(entry.label, 'PDF 安全评估报告');
    assert.equal(entry.requiresBoundaryNotice, true);
  });
});
