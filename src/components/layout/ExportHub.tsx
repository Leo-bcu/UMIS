import { useState, useMemo, useEffect } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { useAllRobots, useRobotStats } from '../../hooks/useRobots';
import { useAlerts } from '../../hooks/useAlerts';
import { useSceneStats } from '../../hooks/useSceneStats';
import { usePOIs } from '../../hooks/usePOIs';
import { buildExportPreflight, type ExportFormat as PreflightFormat } from '../../domain/exportPreflight';
import { createExportHistoryEntry } from '../../domain/exportHistory';
import { getSceneSemantics } from '../../lib/sceneSemantics';
import { t, type Locale } from '../../domain/i18nCatalog';

type ExportFormat = 'pdf' | 'las' | 'obj' | 'csv' | null;

function exportCopy(locale: Locale, semantics: ReturnType<typeof getSceneSemantics>) {
  if (locale === 'zh-CN') {
    return {
      pdf: {
        title: '管理层汇报材料',
        subtitle: 'PDF 安全评估报告',
        badge: '已就绪',
        description: `附带 3D 场景截图、AI 分析结论、告警列表、机器人状态、${semantics.networkLabel}分析与完整性哈希。适合${semantics.export.reportAudience}阅览。`,
        stats: [
          { label: '内容', value: '9 章节' },
          { label: '格式', value: 'A4 PDF' },
          { label: '合规', value: 'SHA-256' },
        ],
      },
      las: {
        title: '测绘后处理点云',
        subtitle: 'LAS 1.2 / .las 文件',
        badge: 'ASPRS 标准',
        description: '全量激光雷达点云，含 XYZ 坐标、反射强度、RGB 着色。可直接拖入 Trimble Business Center、AutoCAD Civil 3D、CloudCompare、ArcGIS Pro 进行测绘级后处理。',
        stats: [
          { label: '点数', value: '' },
          { label: '大小', value: '' },
          { label: '分类', value: 'ASPRS' },
        ],
      },
      obj: {
        title: '3D 实体空间网格',
        subtitle: 'OBJ + MTL 模型文件',
        badge: 'Wavefront',
        description: `${semantics.export.objectDescription}可导入 Blender、3ds Max、AutoCAD 或工程仿真工具进行后处理。`,
        stats: [
          { label: '网格', value: '' },
          { label: '顶点', value: '' },
          { label: '大小', value: '' },
        ],
      },
      csv: {
        title: '原始传感器矩阵',
        subtitle: 'CSV 数据表',
        badge: 'RFC 4180',
        description: `${semantics.export.sensorMatrixDescription} UTF-8 BOM 编码，Excel 可直接打开，可导入 SCADA、GIS 或工程数据平台。`,
        stats: [
          { label: '传感器', value: '' },
          { label: '机器人', value: '' },
          { label: '告警', value: '' },
        ],
      },
      footer: '所有导出文件均包含数据完整性校验 · 导出数据仅供工程参考',
    };
  }

  return {
    pdf: {
      title: 'Executive Briefing Pack',
      subtitle: 'PDF Safety Assessment',
      badge: 'Ready',
      description: `Includes 3D screenshots, AI findings, alert lists, robot status, ${semantics.networkLabel.toLowerCase()} analysis, and integrity hashes. Intended for ${semantics.export.reportAudience}.`,
      stats: [
        { label: 'Sections', value: '9' },
        { label: 'Format', value: 'A4 PDF' },
        { label: 'Integrity', value: 'SHA-256' },
      ],
    },
    las: {
      title: 'Survey Point Cloud',
      subtitle: 'LAS 1.2 / .las',
      badge: 'ASPRS',
      description: 'Full lidar point cloud with XYZ coordinates, intensity, and RGB coloring. Ready for Trimble Business Center, AutoCAD Civil 3D, CloudCompare, or ArcGIS Pro workflows.',
      stats: [
        { label: 'Points', value: '' },
        { label: 'Size', value: '' },
        { label: 'Class', value: 'ASPRS' },
      ],
    },
    obj: {
      title: '3D Spatial Mesh',
      subtitle: 'OBJ + MTL',
      badge: 'Wavefront',
      description: `${semantics.export.objectDescription} Ready for Blender, 3ds Max, AutoCAD, or downstream engineering simulation tools.`,
      stats: [
        { label: 'Meshes', value: '' },
        { label: 'Vertices', value: '' },
        { label: 'Size', value: '' },
      ],
    },
    csv: {
      title: 'Raw Sensor Matrix',
      subtitle: 'CSV Dataset',
      badge: 'RFC 4180',
      description: `${semantics.export.sensorMatrixDescription} UTF-8 BOM encoded, ready for Excel, SCADA, GIS, and engineering data platforms.`,
      stats: [
        { label: 'Sensors', value: '' },
        { label: 'Robots', value: '' },
        { label: 'Alerts', value: '' },
      ],
    },
    footer: 'All exports include integrity verification. Exported data is for engineering reference only.',
  };
}

export function ExportHub({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeFormat, setActiveFormat] = useState<ExportFormat>(null);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [includeAIInferred, setIncludeAIInferred] = useState(true);

  const captureScreenshot = useSceneStore((s) => s.captureScreenshot);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const confidenceFilter = useSceneStore((s) => s.confidenceFilter);
  const layers = useSceneStore((s) => s.layers);
  const scenario = useSceneStore((s) => s.scenario);
  const dataSource = useSceneStore((s) => s.dataSource);
  const locale = useSceneStore((s) => s.locale);
  const fractures = useSceneStore((s) => s.fractures);
  const annotations = useSceneStore((s) => s.annotations);
  const findings = useSceneStore((s) => s.findings);
  const messages = useSceneStore((s) => s.messages);
  const cameraInfo = useSceneStore((s) => s.cameraInfo);
  const exportHistory = useSceneStore((s) => s.exportHistory);
  const addExportHistory = useSceneStore((s) => s.addExportHistory);

  const { data: robots } = useAllRobots(dataSource, scenario);
  const { data: robotStats } = useRobotStats(dataSource, scenario);
  const { data: alerts } = useAlerts(dataSource, scenario);
  const { data: stats } = useSceneStats();
  const { data: pois } = usePOIs();
  const semantics = getSceneSemantics(scenario);
  const copy = exportCopy(locale, semantics);

  const exportStats = useMemo(() => {
    const fractureNodeRows = fractures.reduce((sum, fracture) => sum + fracture.nodes.length, 0);
    const robotRows = robots?.length ?? 0;
    const alertRows = alerts?.length ?? 0;
    const pointRows = fractureNodeRows + robotRows + 12_000;
    const meshCount = fractures.length + (robotRows > 0 ? robotRows : 0) + 1;
    const estimatedVertices = fractures.reduce((sum, fracture) => sum + Math.max(8, fracture.path.length * 16), 0) + robotRows * 6 + 12_000;

    return {
      las: {
        totalPoints: pointRows,
        estimatedSizeMB: Math.max(1, Number((pointRows * 34 / 1024 / 1024).toFixed(1))),
      },
      obj: {
        meshCount,
        estimatedVertices,
        estimatedSizeMB: Math.max(1, Number((estimatedVertices * 48 / 1024 / 1024).toFixed(1))),
      },
      csv: {
        sensorRows: fractureNodeRows,
        robotRows,
        alertRows,
      },
    };
  }, [alerts, fractures, robots]);

  const preflight = useMemo(() => buildExportPreflight({
    format: (activeFormat || 'pdf') as PreflightFormat,
    pointCount: exportStats.las.totalPoints,
    findingCount: findings.length,
    findings,
    includeAIInferred,
  }), [activeFormat, exportStats.las.totalPoints, findings, includeAIInferred]);

  // M5: ESC 键关闭（导出进行中时禁止关闭）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeFormat === null) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, activeFormat, onClose]);

  if (!open) return null;

  const handleExport = async (format: ExportFormat) => {
    if (!format) return;
    setActiveFormat(format);
    setProgress(t('export.preparing', locale));
    setDone(null);
    try {
      switch (format) {
        case 'pdf':
          setProgress(locale === 'zh-CN' ? '生成 PDF 安全评估报告...' : 'Generating PDF safety report...');
          {
            const { exportPDF } = await import('../../lib/pdfExport');
          await exportPDF(captureScreenshot, {
            gasThreshold, confidenceFilter, layers, scenario,
            stats, robots, robotStats, alerts, fractures, pois, annotations, findings, messages, cameraInfo,
          });
          }
          break;
        case 'las':
          setProgress(locale === 'zh-CN'
            ? `生成 LAS 1.2 点云文件 (${exportStats.las.totalPoints.toLocaleString()} 点)...`
            : `Generating LAS 1.2 point cloud (${exportStats.las.totalPoints.toLocaleString()} points)...`);
          {
            const { exportLAS } = await import('../../lib/exportLAS');
          exportLAS(fractures, robots ?? null, scenario);
          }
          break;
        case 'obj':
          setProgress(locale === 'zh-CN' ? '生成 OBJ 3D 网格模型...' : 'Generating OBJ 3D mesh...');
          {
            const { exportOBJ } = await import('../../lib/exportOBJ');
          exportOBJ(fractures, robots ?? null, scenario);
          }
          break;
        case 'csv':
          setProgress(locale === 'zh-CN'
            ? `生成 CSV 传感器矩阵 (${exportStats.csv.sensorRows + exportStats.csv.robotRows} 行)...`
            : `Generating CSV sensor matrix (${exportStats.csv.sensorRows + exportStats.csv.robotRows} rows)...`);
          {
            const { exportCSV } = await import('../../lib/exportCSV');
          exportCSV(fractures, robots ?? null, alerts ?? null, scenario);
          }
          break;
      }
      const entry = createExportHistoryEntry({
        format,
        status: 'success',
        preflightStatus: preflight.status,
        findingCount: findings.length,
        includeAIInferred,
      });
      addExportHistory(entry);
      setDone(entry.label);
    } catch (e) {
      addExportHistory(createExportHistoryEntry({
        format,
        status: 'failed',
        preflightStatus: preflight.status,
        findingCount: findings.length,
        includeAIInferred,
        errorMessage: (e as Error).message,
      }));
      setDone(null);
      setProgress(`${t('export.error', locale)}: ${(e as Error).message}`);
    } finally {
      setActiveFormat(null);
    }
  };

  const isExporting = activeFormat !== null;

  // M6: 批量导出 — 依次导出全部格式
  const handleExportAll = async () => {
    const formats: ExportFormat[] = ['pdf', 'csv', 'las', 'obj'];
    for (const fmt of formats) {
      await handleExport(fmt);
      // 短暂延迟让用户看到完成状态
      await new Promise(r => setTimeout(r, 600));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-[#101820]/45 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[680px] max-h-[85vh] overflow-y-auto rounded-xl border border-[#D9E1EA] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E1EA]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1F2937] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </div>
            <div>
              <div className="text-base font-bold text-text">{t('export.title', locale)}</div>
              <div className="text-[10px] text-text-muted/60 tracking-wide">{t('export.subtitle', locale)}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-[#EEF2F6] flex items-center justify-center text-text-muted hover:text-text transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Export Cards */}
        <div className="p-6 space-y-3">
          <div className="rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-text">{t('export.preflight', locale)}</div>
                <div className="mt-0.5 text-[10px] text-text-muted/70">
                  {t('export.preflightStatus', locale)}: {preflight.status === 'blocked' ? t('export.statusBlocked', locale) : preflight.status === 'warning' ? t('export.statusWarning', locale) : t('export.statusReady', locale)}
                </div>
              </div>
              <label className="flex items-center gap-2 text-[10px] text-text-muted">
                <input
                  type="checkbox"
                  checked={includeAIInferred}
                  onChange={(e) => setIncludeAIInferred(e.target.checked)}
                />
                {t('export.includeAi', locale)}
              </label>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {preflight.checks.map((check) => (
                <div key={check.id} className="rounded border border-[#D9E1EA] bg-white px-2 py-1">
                  <div className={`text-[9px] ${check.level === 'blocked' ? 'text-[#B42318]' : check.level === 'warning' ? 'text-[#9A6700]' : 'text-[#087443]'}`}>
                    {check.label}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-text-muted/70">
                    {check.message}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {exportHistory.length > 0 && (
            <div className="rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-text">{t('export.recent', locale)}</div>
                <div className="text-[9px] font-mono text-text-muted/60">{exportHistory.length}</div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {exportHistory.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded border border-[#D9E1EA] bg-white px-2 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[9px] text-text">{entry.label}</span>
                      <span className={`text-[9px] ${entry.status === 'success' ? 'text-[#087443]' : 'text-[#B42318]'}`}>
                        {entry.status === 'success' ? t('export.success', locale) : t('export.failed', locale)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[9px] text-text-muted/60">
                      {locale === 'zh-CN'
                        ? `${entry.findingCount} 项发现 · ${entry.requiresBoundaryNotice ? t('export.boundaryNotice', locale) : t('export.preflightPassed', locale)}`
                        : `${entry.findingCount} findings · ${entry.requiresBoundaryNotice ? t('export.boundaryNotice', locale) : t('export.preflightPassed', locale)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress / Status */}
          {(isExporting || progress || done) && (
            <div className={`px-4 py-2.5 rounded-lg text-[11px] font-medium flex items-center gap-2 ${
              done ? 'bg-[#E7F7EF] text-[#087443] border border-[#B7E4CB]'
              : progress.startsWith(t('export.error', locale)) ? 'bg-[#FFF7F5] text-[#B42318] border border-[#F3B8B0]'
              : 'bg-[#F2F5F9] text-[#344054] border border-[#D9E1EA]'
            }`}>
              {isExporting && (
                <svg className="w-3.5 h-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {done ? `${t('export.done', locale)}: ${done}` : progress}
            </div>
          )}

          {/* Card 1: PDF Report */}
          <ExportCard
            icon="report"
            title={copy.pdf.title}
            subtitle={copy.pdf.subtitle}
            badge={copy.pdf.badge}
            badgeColor="green"
            description={copy.pdf.description}
            stats={[
              ...copy.pdf.stats,
            ]}
            onClick={() => handleExport('pdf')}
            disabled={isExporting || preflight.status === 'blocked'}
            active={activeFormat === 'pdf'}
          />

          {/* Card 2: LAS Point Cloud */}
          <ExportCard
            icon="cloud"
            title={copy.las.title}
            subtitle={copy.las.subtitle}
            badge={copy.las.badge}
            badgeColor="blue"
            description={copy.las.description}
            stats={[
              { ...copy.las.stats[0], value: exportStats.las.totalPoints.toLocaleString() },
              { ...copy.las.stats[1], value: `~${exportStats.las.estimatedSizeMB} MB` },
              copy.las.stats[2],
            ]}
            onClick={() => handleExport('las')}
            disabled={isExporting || preflight.status === 'blocked'}
            active={activeFormat === 'las'}
          />

          {/* Card 3: OBJ Mesh */}
          <ExportCard
            icon="cube"
            title={copy.obj.title}
            subtitle={copy.obj.subtitle}
            badge={copy.obj.badge}
            badgeColor="orange"
            description={copy.obj.description}
            stats={[
              { ...copy.obj.stats[0], value: locale === 'zh-CN' ? `${exportStats.obj.meshCount} 个` : `${exportStats.obj.meshCount}` },
              { ...copy.obj.stats[1], value: exportStats.obj.estimatedVertices.toLocaleString() },
              { ...copy.obj.stats[2], value: `~${exportStats.obj.estimatedSizeMB} MB` },
            ]}
            onClick={() => handleExport('obj')}
            disabled={isExporting || preflight.status === 'blocked'}
            active={activeFormat === 'obj'}
          />

          {/* Card 4: CSV Data */}
          <ExportCard
            icon="table"
            title={copy.csv.title}
            subtitle={copy.csv.subtitle}
            badge={copy.csv.badge}
            badgeColor="cyan"
            description={copy.csv.description}
            stats={[
              { ...copy.csv.stats[0], value: locale === 'zh-CN' ? `${exportStats.csv.sensorRows} 行` : `${exportStats.csv.sensorRows}` },
              { ...copy.csv.stats[1], value: locale === 'zh-CN' ? `${exportStats.csv.robotRows} 行` : `${exportStats.csv.robotRows}` },
              { ...copy.csv.stats[2], value: locale === 'zh-CN' ? `${exportStats.csv.alertRows} 条` : `${exportStats.csv.alertRows}` },
            ]}
            onClick={() => handleExport('csv')}
            disabled={isExporting || preflight.status === 'blocked'}
            active={activeFormat === 'csv'}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#D9E1EA] flex items-center justify-between">
          <div className="text-[9px] text-text-muted/50">
            {copy.footer}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAll}
              disabled={isExporting || preflight.status === 'blocked'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1F2937] text-white border border-[#1F2937] rounded-md text-[11px] font-medium hover:bg-[#111827] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              {t('export.bulk', locale)}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#F8FAFC] border border-[#D9E1EA] rounded-md text-xs text-text hover:bg-[#EEF2F6] transition-colors"
            >
              {t('export.close', locale)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export Card Component ──

type BadgeColor = 'green' | 'blue' | 'orange' | 'cyan';

function ExportCard({
  icon,
  title,
  subtitle,
  badge,
  badgeColor,
  description,
  stats,
  onClick,
  disabled,
  active,
}: {
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: BadgeColor;
  description: string;
  stats: { label: string; value: string }[];
  onClick: () => void;
  disabled: boolean;
  active: boolean;
}) {
  const badgeColors: Record<BadgeColor, string> = {
    green: 'bg-[#E7F7EF] text-[#087443] border-[#B7E4CB]',
    blue: 'bg-[#F2F5F9] text-[#344054] border-[#B7C3D0]',
    orange: 'bg-[#FFFAF0] text-[#9A6700] border-[#EFD39B]',
    cyan: 'bg-[#F2F5F9] text-[#344054] border-[#B7C3D0]',
  };

  return (
    <div className={`group relative rounded-lg border transition-all ${
      active ? 'border-[#1F2937] bg-[#F8FAFC]' : 'border-[#D9E1EA] bg-white hover:border-[#B7C3D0] hover:bg-[#F8FAFC]'
    } ${disabled && !active ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-4 p-4">
        {/* Icon */}
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          active ? 'bg-[#1F2937]' : 'bg-[#F8FAFC] group-hover:bg-[#EEF2F6]'
        }`}>
          <ExportIcon icon={icon} active={active} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-text">{title}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${badgeColors[badgeColor]}`}>
              {badge}
            </span>
          </div>
          <div className="text-[11px] text-text-muted font-mono mb-2">{subtitle}</div>
          <p className="text-[10px] text-text-muted/70 leading-relaxed mb-3">{description}</p>

          {/* Stats */}
          <div className="flex gap-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="text-[9px] text-text-muted/50 uppercase tracking-wider">{s.label}</span>
                <span className="text-[11px] text-text font-mono font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClick}
          disabled={disabled}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${
            active
              ? 'bg-[#1F2937] text-white'
              : disabled
              ? 'bg-[#F8FAFC] text-text-muted cursor-not-allowed'
              : 'bg-white text-[#1F2937] border border-[#D9E1EA] hover:bg-[#EEF2F6]'
          }`}
        >
          {active ? (
            <>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              {useSceneStore.getState().locale === 'zh-CN' ? '导出中' : 'Exporting'}
            </>
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              {useSceneStore.getState().locale === 'zh-CN' ? '导出' : 'Export'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Icons ──

function ExportIcon({ icon, active }: { icon: string; active: boolean }) {
  const color = active ? 'text-white' : 'text-text-muted group-hover:text-text';
  const stroke = 'currentColor';

  switch (icon) {
    case 'report':
      return (
        <svg className={`w-5 h-5 ${color}`} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
    case 'cloud':
      return (
        <svg className={`w-5 h-5 ${color}`} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
          <circle cx="6" cy="6" r="1.5" fill={stroke} />
          <circle cx="18" cy="6" r="1.5" fill={stroke} />
          <circle cx="6" cy="18" r="1.5" fill={stroke} />
          <circle cx="18" cy="18" r="1.5" fill={stroke} />
          <circle cx="12" cy="12" r="2" fill={stroke} />
          <path d="M6 6L12 12M18 6L12 12M6 18L12 12M18 18L12 12" strokeWidth="0.5" opacity="0.5" />
        </svg>
      );
    case 'cube':
      return (
        <svg className={`w-5 h-5 ${color}`} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
          <path d="M21 7.5l-9-5-9 5 9 5 9-5z" />
          <path d="M3 7.5v9l9 5 9-5v-9" />
          <path d="M12 12.5v10" strokeWidth="1" opacity="0.4" />
        </svg>
      );
    case 'table':
      return (
        <svg className={`w-5 h-5 ${color}`} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" strokeWidth="1" opacity="0.5" />
        </svg>
      );
    default:
      return null;
  }
}
