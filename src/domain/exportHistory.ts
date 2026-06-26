import type { ExportFormat, ExportPreflightLevel } from './exportPreflight';

export type ExportHistoryStatus = 'success' | 'failed';

export interface ExportHistoryInput {
  format: ExportFormat;
  status: ExportHistoryStatus;
  preflightStatus: ExportPreflightLevel;
  findingCount: number;
  includeAIInferred: boolean;
  errorMessage?: string;
  timestamp?: number;
}

export interface ExportHistoryEntry extends Required<Omit<ExportHistoryInput, 'errorMessage' | 'timestamp'>> {
  id: string;
  label: string;
  timestamp: number;
  errorMessage?: string;
  requiresBoundaryNotice: boolean;
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: 'PDF 安全评估报告',
  las: 'LAS 点云文件',
  obj: 'OBJ 3D 网格模型',
  csv: 'CSV 传感器数据表',
};

export function createExportHistoryEntry(input: ExportHistoryInput): ExportHistoryEntry {
  const timestamp = input.timestamp ?? Date.now();
  return {
    id: `export-${timestamp}-${input.format}`,
    format: input.format,
    status: input.status,
    preflightStatus: input.preflightStatus,
    findingCount: input.findingCount,
    includeAIInferred: input.includeAIInferred,
    errorMessage: input.errorMessage,
    label: FORMAT_LABELS[input.format],
    timestamp,
    requiresBoundaryNotice: input.includeAIInferred || input.preflightStatus !== 'pass',
  };
}
