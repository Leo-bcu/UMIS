export type Locale = 'zh-CN' | 'en-US';

type MessageKey =
  | 'app.title'
  | 'role.workbench'
  | 'role.manager'
  | 'role.safety'
  | 'role.engineer'
  | 'role.timeline'
  | 'export.preflight'
  | 'ai.audit'
  | 'finding.queue'
  | 'control.console'
  | 'status.system'
  | 'status.loading'
  | 'status.dataSource'
  | 'status.mock'
  | 'status.live'
  | 'status.avgTemperature'
  | 'status.current'
  | 'mission.snapshot'
  | 'mission.coverage'
  | 'mission.findings'
  | 'mission.export'
  | 'mission.active'
  | 'mission.needsReview'
  | 'mission.readyForExport'
  | 'mission.closed'
  | 'coverage.title'
  | 'coverage.measuredNodes'
  | 'coverage.unknownNodes'
  | 'coverage.aiFindings'
  | 'coverage.lowConfidence'
  | 'coverage.reviewed'
  | 'coverage.truthBoundary'
  | 'coverage.truthNote'
  | 'queue.alert'
  | 'queue.finding'
  | 'queue.reviewNeeded'
  | 'queue.humanBoundary'
  | 'queue.empty'
  | 'finding.title'
  | 'finding.levelDanger'
  | 'finding.levelWarning'
  | 'finding.levelInfo'
  | 'finding.truthBoundary'
  | 'finding.confidence'
  | 'engineer.measured'
  | 'engineer.unknown'
  | 'engineer.ai'
  | 'engineer.lowConfidence'
  | 'timeline.alert'
  | 'timeline.finding'
  | 'timeline.robot'
  | 'timeline.coverage'
  | 'truth.measured'
  | 'truth.interpolated'
  | 'truth.aiInferred'
  | 'truth.unknown'
  | 'truth.humanVerified'
  | 'panel.layerControl'
  | 'panel.sensorTrends'
  | 'panel.measureTools'
  | 'panel.objectDetails'
  | 'tool.profile'
  | 'tool.area'
  | 'tool.text'
  | 'tool.distance'
  | 'tool.clear'
  | 'tool.exit'
  | 'tool.guideProfile'
  | 'tool.guideArea'
  | 'tool.guideText'
  | 'tool.guideDistance'
  | 'annotation.promoteFinding'
  | 'annotation.delete'
  | 'poi.methane'
  | 'poi.temperature'
  | 'poi.pressure'
  | 'chat.placeholder'
  | 'chat.expand'
  | 'chat.mockHint'
  | 'chat.requestFailedTitle'
  | 'chat.requestFailedBody'
  | 'chat.auditExecute'
  | 'chat.auditBlockedTitle'
  | 'watermark.physicalEcho'
  | 'top.role'
  | 'top.exportOpen'
  | 'top.exportDenied'
  | 'confidence.title'
  | 'confidence.stripBlind'
  | 'confidence.filteredNodes'
  | 'export.title'
  | 'export.subtitle'
  | 'export.preflightStatus'
  | 'export.statusBlocked'
  | 'export.statusWarning'
  | 'export.statusReady'
  | 'export.includeAi'
  | 'export.recent'
  | 'export.success'
  | 'export.failed'
  | 'export.boundaryNotice'
  | 'export.preflightPassed'
  | 'export.done'
  | 'export.preparing'
  | 'export.error'
  | 'export.bulk'
  | 'export.close'
  | 'export.inProgress'
  | 'export.action'
  | 'settings.title'
  | 'settings.description'
  | 'settings.provider'
  | 'settings.baseUrl'
  | 'settings.apiKey'
  | 'settings.model'
  | 'settings.testing'
  | 'settings.test'
  | 'settings.success'
  | 'settings.fail'
  | 'settings.cancel'
  | 'settings.save'
  | 'mobile.title'
  | 'mobile.body'
  | 'tour.help'
  | 'tour.step1.title'
  | 'tour.step1.body'
  | 'tour.step2.title'
  | 'tour.step2.body'
  | 'tour.step3.title'
  | 'tour.step3.body'
  | 'tour.step4.title'
  | 'tour.step4.body'
  | 'tour.next'
  | 'tour.prev'
  | 'tour.skip'
  | 'tour.done';

const CATALOG: Record<Locale, Record<MessageKey, string>> = {
  'zh-CN': {
    'app.title': '矿安智盾——数字孪生主控舱',
    'role.workbench': '角色工作台',
    'role.manager': '管理',
    'role.safety': '安全',
    'role.engineer': '数据',
    'role.timeline': '时间线',
    'export.preflight': '导出预检',
    'ai.audit': 'AI 动作审计',
    'finding.queue': '风险发现',
    'control.console': '控制台',
    'status.system': '系统状态监控',
    'status.loading': '加载统计数据...',
    'status.dataSource': '数据源',
    'status.mock': '模拟数据',
    'status.live': '实时接口',
    'status.avgTemperature': '平均温度',
    'status.current': '实时',
    'mission.snapshot': '任务交付状态',
    'mission.coverage': '覆盖',
    'mission.findings': '发现',
    'mission.export': '交付',
    'mission.active': '进行中',
    'mission.needsReview': '需复查',
    'mission.readyForExport': '可交付',
    'mission.closed': '已收束',
    'coverage.title': '探索覆盖',
    'coverage.measuredNodes': '已采样节点',
    'coverage.unknownNodes': '未探明采样位',
    'coverage.aiFindings': 'AI 推断发现',
    'coverage.lowConfidence': '低置信待复查',
    'coverage.reviewed': '条发现已人工复核',
    'coverage.truthBoundary': '可信边界',
    'coverage.truthNote': 'AI 推断不能直接作为安全结论，必须结合实测或人工复核。',
    'queue.alert': '告警',
    'queue.finding': '发现',
    'queue.reviewNeeded': '需要复查',
    'queue.humanBoundary': '已有人审边界',
    'queue.empty': '暂无高优先级复查项',
    'finding.title': '风险发现',
    'finding.levelDanger': '高危',
    'finding.levelWarning': '警告',
    'finding.levelInfo': '信息',
    'finding.truthBoundary': '可信边界',
    'finding.confidence': '置信度',
    'engineer.measured': '实测覆盖',
    'engineer.unknown': '未知采样位',
    'engineer.ai': 'AI 推断',
    'engineer.lowConfidence': '低置信',
    'timeline.alert': '告警',
    'timeline.finding': '发现',
    'timeline.robot': '机器人',
    'timeline.coverage': '覆盖',
    'truth.measured': '实测',
    'truth.interpolated': '插值',
    'truth.aiInferred': 'AI 推断',
    'truth.unknown': '未探明',
    'truth.humanVerified': '人工确认',
    'panel.layerControl': '图层控制',
    'panel.sensorTrends': '传感器趋势',
    'panel.measureTools': '测量标注工具',
    'panel.objectDetails': '详情',
    'tool.profile': '剖面线',
    'tool.area': '区域框选',
    'tool.text': '文字标注',
    'tool.distance': '测距',
    'tool.clear': '清除',
    'tool.exit': 'ESC 退出',
    'tool.guideProfile': '点击 3D 场景中两点，自动生成{profileTitle}和深度图',
    'tool.guideArea': '拖拽鼠标框选一个矩形区域，统计内部{densityLabel}',
    'tool.guideText': '点击 3D 场景中任意位置，输入标注文字',
    'tool.guideDistance': '依次点击两个点，自动计算三维空间距离',
    'annotation.promoteFinding': '转为风险发现',
    'annotation.delete': '删除',
    'poi.methane': 'CH4',
    'poi.temperature': '温度',
    'poi.pressure': '气压',
    'chat.placeholder': '输入指令...',
    'chat.expand': '展开AI对话',
    'chat.mockHint': 'Mock 模式 · 请在设置中配置API Key',
    'chat.requestFailedTitle': '请求失败',
    'chat.requestFailedBody': 'AI 助手暂时不可用。\n\n> {reason}\n\n请检查设置中的 API Key 配置，或稍后重试。',
    'chat.auditExecute': 'AI 执行 {type}',
    'chat.auditBlockedTitle': 'AI 动作被安全策略拦截',
    'watermark.physicalEcho': '原始物理回波模式',
    'top.role': '当前角色',
    'top.exportOpen': '打开导出中心',
    'top.exportDenied': '当前角色无导出权限',
    'confidence.title': '数据置信度过滤',
    'confidence.stripBlind': '剥离 AI 脑补盲区',
    'confidence.filteredNodes': '过滤节点',
    'export.title': '数据导出 / 交付中心',
    'export.subtitle': 'EXPORT HUB · 兼容 Trimble / AutoCAD / ArcGIS / Excel',
    'export.preflightStatus': '状态',
    'export.statusBlocked': '阻断',
    'export.statusWarning': '警告',
    'export.statusReady': '通过',
    'export.includeAi': '包含 AI 推断',
    'export.recent': '最近交付',
    'export.success': '成功',
    'export.failed': '失败',
    'export.boundaryNotice': '含边界提示',
    'export.preflightPassed': '已通过预检',
    'export.done': '已导出',
    'export.preparing': '准备数据中...',
    'export.error': '导出失败',
    'export.bulk': '一键全部导出',
    'export.close': '关闭',
    'export.inProgress': '导出中',
    'export.action': '导出',
    'settings.title': 'AI 模型设置',
    'settings.description': '配置大语言模型的连接参数。保存后立即生效。',
    'settings.provider': '模型提供商',
    'settings.baseUrl': 'Base URL',
    'settings.apiKey': 'API Key',
    'settings.model': '模型名称',
    'settings.testing': '测试中...',
    'settings.test': '测试连接',
    'settings.success': '连接成功',
    'settings.fail': '连接失败',
    'settings.cancel': '取消',
    'settings.save': '保存设置',
    'mobile.title': '建议使用桌面端访问',
    'mobile.body': 'HIVE 数字孪生主控舱为专业工业应用，需要较大屏幕以展示 3D 场景和多项监控面板。',
    'tour.help': '操作引导',
    'tour.step1.title': '切换行业场景',
    'tour.step1.body': '顶部下拉可一键切换煤矿、管线、核设施、炼化、地下暗流等 7 个行业场景，每个场景的传感器、告警、术语完全独立。',
    'tour.step2.title': '点选 3D 对象',
    'tour.step2.body': '在 3D 场景中点击机器人、裂缝或通道，右侧自动显示风险摘要和检测数据。',
    'tour.step3.title': '查看风险摘要',
    'tour.step3.body': '右侧面板首屏显示风险等级、一句话解释和核心指标，展开可看完整传感器数据。',
    'tour.step4.title': '问 AI 或导出',
    'tour.step4.body': '底部用自然语言提问（如"哪里最危险"），或点右上角一键导出 PDF / LAS / OBJ / CSV 报告。',
    'tour.next': '下一步',
    'tour.prev': '上一步',
    'tour.skip': '跳过',
    'tour.done': '开始使用',
  },
  'en-US': {
    'app.title': 'Mining Safety Smart Shield – Digital Twin Main Control Cabin',
    'role.workbench': 'Role Workbench',
    'role.manager': 'Manager',
    'role.safety': 'Safety',
    'role.engineer': 'Data',
    'role.timeline': 'Timeline',
    'export.preflight': 'Export Preflight',
    'ai.audit': 'AI Action Audit',
    'finding.queue': 'Findings',
    'control.console': 'Console',
    'status.system': 'System Status',
    'status.loading': 'Loading metrics...',
    'status.dataSource': 'Data Source',
    'status.mock': 'Mock Data',
    'status.live': 'Live Feed',
    'status.avgTemperature': 'Avg Temperature',
    'status.current': 'LIVE',
    'mission.snapshot': 'Mission Delivery',
    'mission.coverage': 'Coverage',
    'mission.findings': 'Findings',
    'mission.export': 'Delivery',
    'mission.active': 'Active',
    'mission.needsReview': 'Needs Review',
    'mission.readyForExport': 'Ready',
    'mission.closed': 'Closed',
    'coverage.title': 'Coverage',
    'coverage.measuredNodes': 'Sampled Nodes',
    'coverage.unknownNodes': 'Unknown Targets',
    'coverage.aiFindings': 'AI Inferences',
    'coverage.lowConfidence': 'Low-Confidence',
    'coverage.reviewed': 'findings human-reviewed',
    'coverage.truthBoundary': 'Truth Boundary',
    'coverage.truthNote': 'AI inference cannot be used as a safety conclusion without measured evidence or human review.',
    'queue.alert': 'Alert',
    'queue.finding': 'Finding',
    'queue.reviewNeeded': 'Review required',
    'queue.humanBoundary': 'Human-reviewed boundary',
    'queue.empty': 'No high-priority review items',
    'finding.title': 'Findings',
    'finding.levelDanger': 'Critical',
    'finding.levelWarning': 'Warning',
    'finding.levelInfo': 'Info',
    'finding.truthBoundary': 'Truth Boundary',
    'finding.confidence': 'Confidence',
    'engineer.measured': 'Measured Coverage',
    'engineer.unknown': 'Unknown Targets',
    'engineer.ai': 'AI Inferences',
    'engineer.lowConfidence': 'Low Confidence',
    'timeline.alert': 'Alert',
    'timeline.finding': 'Finding',
    'timeline.robot': 'Robot',
    'timeline.coverage': 'Coverage',
    'truth.measured': 'Measured',
    'truth.interpolated': 'Interpolated',
    'truth.aiInferred': 'AI Inferred',
    'truth.unknown': 'Unknown',
    'truth.humanVerified': 'Human Verified',
    'panel.layerControl': 'Layer Control',
    'panel.sensorTrends': 'Sensor Trends',
    'panel.measureTools': 'Measurement Tools',
    'panel.objectDetails': 'Details',
    'tool.profile': 'Profile',
    'tool.area': 'Area Select',
    'tool.text': 'Text Note',
    'tool.distance': 'Measure',
    'tool.clear': 'Clear',
    'tool.exit': 'ESC Exit',
    'tool.guideProfile': 'Click two points in the 3D scene to generate {profileTitle} and a depth profile.',
    'tool.guideArea': 'Drag a rectangle in the 3D scene and summarize the {densityLabel} inside it.',
    'tool.guideText': 'Click anywhere in the 3D scene to place a text note.',
    'tool.guideDistance': 'Click two points in sequence to calculate the 3D distance.',
    'annotation.promoteFinding': 'Promote to finding',
    'annotation.delete': 'Delete',
    'poi.methane': 'CH4',
    'poi.temperature': 'Temperature',
    'poi.pressure': 'Pressure',
    'chat.placeholder': 'Enter a command...',
    'chat.expand': 'Expand AI chat',
    'chat.mockHint': 'Mock mode · configure an API key in Settings',
    'chat.requestFailedTitle': 'Request Failed',
    'chat.requestFailedBody': 'The AI assistant is temporarily unavailable.\n\n> {reason}\n\nCheck the API key in Settings and try again shortly.',
    'chat.auditExecute': 'AI executed {type}',
    'chat.auditBlockedTitle': 'AI action blocked by safety policy',
    'watermark.physicalEcho': 'Raw Physical Echo Mode',
    'top.role': 'Current Role',
    'top.exportOpen': 'Open export hub',
    'top.exportDenied': 'This role cannot export data',
    'confidence.title': 'Confidence Filter',
    'confidence.stripBlind': 'Strip AI-only blind spots',
    'confidence.filteredNodes': 'nodes filtered',
    'export.title': 'Export / Delivery Hub',
    'export.subtitle': 'EXPORT HUB · Compatible with Trimble / AutoCAD / ArcGIS / Excel',
    'export.preflightStatus': 'Status',
    'export.statusBlocked': 'Blocked',
    'export.statusWarning': 'Warning',
    'export.statusReady': 'Ready',
    'export.includeAi': 'Include AI inferred',
    'export.recent': 'Recent Deliveries',
    'export.success': 'Success',
    'export.failed': 'Failed',
    'export.boundaryNotice': 'Boundary notice included',
    'export.preflightPassed': 'Preflight passed',
    'export.done': 'Exported',
    'export.preparing': 'Preparing data...',
    'export.error': 'Export failed',
    'export.bulk': 'Export All',
    'export.close': 'Close',
    'export.inProgress': 'Exporting',
    'export.action': 'Export',
    'settings.title': 'AI Model Settings',
    'settings.description': 'Configure the large-model connection parameters. Changes take effect immediately after saving.',
    'settings.provider': 'Model Provider',
    'settings.baseUrl': 'Base URL',
    'settings.apiKey': 'API Key',
    'settings.model': 'Model Name',
    'settings.testing': 'Testing...',
    'settings.test': 'Test Connection',
    'settings.success': 'Connection successful',
    'settings.fail': 'Connection failed',
    'settings.cancel': 'Cancel',
    'settings.save': 'Save Settings',
    'mobile.title': 'Use Desktop View',
    'mobile.body': 'HIVE is an industrial workbench that needs a larger screen for the 3D scene and monitoring panels.',
    'tour.help': 'Tour',
    'tour.step1.title': 'Switch Scenarios',
    'tour.step1.body': 'Use the top dropdown to switch between 7 industry scenarios — coal, pipeline, nuclear, refinery, underground — each with its own sensors, alerts, and terminology.',
    'tour.step2.title': 'Click 3D Objects',
    'tour.step2.body': 'Click a robot, fracture, or channel in the 3D scene to open its risk summary and inspection data on the right.',
    'tour.step3.title': 'Read the Risk Summary',
    'tour.step3.body': 'The right panel shows the risk level, a one-line explanation, and key metrics first. Expand for full sensor data.',
    'tour.step4.title': 'Ask AI or Export',
    'tour.step4.body': 'Ask questions in natural language at the bottom (e.g. "where is it most dangerous"), or export PDF / LAS / OBJ / CSV from the top right.',
    'tour.next': 'Next',
    'tour.prev': 'Back',
    'tour.skip': 'Skip',
    'tour.done': 'Get started',
  },
};

export function t(key: MessageKey, locale: Locale = 'zh-CN'): string {
  return CATALOG[locale][key];
}

export function tf(
  key: MessageKey,
  locale: Locale = 'zh-CN',
  params: Record<string, string | number> = {},
): string {
  return Object.entries(params).reduce(
    (message, [paramKey, value]) => message.split(`{${paramKey}}`).join(String(value)),
    t(key, locale),
  );
}
