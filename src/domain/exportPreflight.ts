import type { Finding } from './findingTypes';

export type ExportFormat = 'pdf' | 'las' | 'obj' | 'csv';
export type ExportPreflightLevel = 'pass' | 'warning' | 'blocked';

export interface ExportPreflightInput {
  format: ExportFormat;
  pointCount: number;
  findingCount: number;
  findings: Finding[];
  includeAIInferred: boolean;
}

export interface ExportPreflightCheck {
  id: string;
  label: string;
  level: ExportPreflightLevel;
  message: string;
}

export interface ExportPreflightResult {
  status: ExportPreflightLevel;
  checks: ExportPreflightCheck[];
}

function worstLevel(checks: ExportPreflightCheck[]): ExportPreflightLevel {
  if (checks.some((check) => check.level === 'blocked')) return 'blocked';
  if (checks.some((check) => check.level === 'warning')) return 'warning';
  return 'pass';
}

export function buildExportPreflight(input: ExportPreflightInput): ExportPreflightResult {
  const aiInferredCount = input.findings.filter((finding) => finding.truthBoundary === 'ai_inferred').length;
  const lowConfidenceCount = input.findings.filter((finding) => finding.confidence < 0.7).length;
  const checks: ExportPreflightCheck[] = [];

  checks.push({
    id: 'data-volume',
    label: '数据量',
    level: input.pointCount > 0 || input.findingCount > 0 ? 'pass' : 'blocked',
    message: input.pointCount > 0 || input.findingCount > 0
      ? `${input.pointCount.toLocaleString()} 点 / ${input.findingCount} 条发现`
      : '没有可导出的空间点或风险发现',
  });

  checks.push({
    id: 'ai-boundary',
    label: 'AI 推断边界',
    level: aiInferredCount === 0 ? 'pass' : input.includeAIInferred ? 'warning' : 'pass',
    message: aiInferredCount === 0
      ? '不包含 AI 推断发现'
      : input.includeAIInferred
        ? `包含 ${aiInferredCount} 条 AI 推断，导出物必须保留可信边界标记`
        : `${aiInferredCount} 条 AI 推断将从导出范围中排除`,
  });

  checks.push({
    id: 'confidence',
    label: '低置信项',
    level: lowConfidenceCount > 0 ? 'warning' : 'pass',
    message: lowConfidenceCount > 0
      ? `${lowConfidenceCount} 条低置信发现建议复查`
      : '未发现低置信风险项',
  });

  checks.push({
    id: 'format',
    label: '格式用途',
    level: 'pass',
    message: input.format === 'pdf'
      ? '适合管理层报告'
      : input.format === 'csv'
        ? '适合 ERP / SCADA / Excel'
        : input.format === 'las'
          ? '适合点云和测绘后处理'
          : '适合 3D 建模和 CAD 交付',
  });

  return {
    status: worstLevel(checks),
    checks,
  };
}
