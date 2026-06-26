import { create } from 'zustand';
import type { LayerState, CameraTarget, HighlightRegion, ChatMessage, Robot, ScenarioType, DataSourceType, AnnotationTool, Annotation, Fracture, AIMarker, CoalStructure, Monitor, MonitorFrame, MonitorDetectionSummary } from '../types';
import type { Finding, FindingStatus } from '../domain/findingTypes';
import type { AIActionAuditEntry } from '../domain/aiActionPolicy';
import type { ExportHistoryEntry } from '../domain/exportHistory';
import type { Locale } from '../domain/i18nCatalog';
import { getSceneSemantics } from '../lib/sceneSemantics';

// 模块级高亮计时器 — 统一管理，避免多组件 setTimeout 竞态
let _highlightTimer: ReturnType<typeof setTimeout> | null = null;

const DATA_SOURCE_SCENARIO: Record<Exclude<DataSourceType, 'fracture'>, ScenarioType> = {
  pipeline: 'pipeline',
  nuclear: 'nuclear',
  refinery: 'refinery',
  underground: 'underground',
};

/** 场景化欢迎语 — 切场景时替换第一条系统消息 */
const SCENARIO_WELCOME: Record<ScenarioType, string> = {
  coal: '## 系统就绪\n\n煤矿瓦斯巡检AI助手已上线。\n\n请在设置中配置AI模型（推荐 DeepSeek），或使用快捷指令。',
  gold: '## 系统就绪\n\n金矿安全AI助手已上线。\n\n请在设置中配置AI模型（推荐 DeepSeek），或使用快捷指令。',
  oil: '## 系统就绪\n\n油气储层AI助手已上线。\n\n请在设置中配置AI模型（推荐 DeepSeek），或使用快捷指令。',
  pipeline: '## 系统就绪\n\n管线巡检AI助手已上线。\n\n请在设置中配置AI模型（推荐 DeepSeek），或使用快捷指令。',
  nuclear: '## 系统就绪\n\n核反应堆检修AI助手已上线。\n\n请在设置中配置AI模型（推荐 DeepSeek），或使用快捷指令。',
  refinery: '## 系统就绪\n\n化工密闭空间AI助手已上线。\n\n请在设置中配置AI模型（推荐 DeepSeek），或使用快捷指令。',
  underground: '## 系统就绪\n\n地下暗流探测AI助手已上线。\n\n请在设置中配置AI模型（推荐 DeepSeek），或使用快捷指令。',
};

/** 切换场景时更新欢迎语（保留后续对话历史） */
function refreshWelcomeMessage(messages: ChatMessage[], scenario: ScenarioType): ChatMessage[] {
  if (messages.length === 0) return messages;
  return [
    { ...messages[0], content: SCENARIO_WELCOME[scenario] },
    ...messages.slice(1),
  ];
}

function isFractureScenario(scenario: ScenarioType): scenario is 'coal' | 'gold' | 'oil' {
  return scenario === 'coal' || scenario === 'gold' || scenario === 'oil';
}

function clearCrossSceneEvidence(state: SceneStore) {
  return {
    annotations: [],
    findings: [],
    acknowledgedAlertIds: [],
    aiActionAudit: [],
    exportHistory: [],
    volumeMeasureMode: false,
    highlightRegion: { ...state.highlightRegion, active: false },
  };
}

interface AIMarkerScreenPosition {
  id: string;
  x: number;
  y: number;
  side: 'left' | 'right';
  labelX: number;
  labelY: number;
  visible: boolean;
}

const CAMERA_IMAGE_MODULES = import.meta.glob('../../approch/camera/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const CAMERA_FRAME_POOL = Object.values(CAMERA_IMAGE_MODULES).sort();

const DETECTION_CLASS_MAP: Record<string, string> = {
  support_structure: '支护结构',
  cable: '电缆',
  tube: '管道',
  electrical_device: '电气设备',
  indicator: '指示器',
  mining_machine: '采掘机械',
  door: '门',
  rescue_equipment: '救援装备',
  person: '人员',
  rail_track: '轨道',
  container: '容器',
};

const DETECTION_CLASS_NAMES = Object.keys(DETECTION_CLASS_MAP);
const MAX_FRAME_CACHE = 24;

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildMonitorFrame(seed: number, monitorId: string): MonitorFrame | null {
  if (CAMERA_FRAME_POOL.length === 0) return null;
  const index = seed % CAMERA_FRAME_POOL.length;
  const imageUrl = CAMERA_FRAME_POOL[index] ?? '';
  const detectionSummary = Object.entries(DETECTION_CLASS_MAP)
    .map(([labelEn, labelZh], classIndex) => {
      const raw = Array.from(`${imageUrl}:${monitorId}:${seed}`).reduce((sum, ch) => sum + ch.charCodeAt(0), classIndex * 11);
      const count = raw % 4 === 0 ? 0 : (raw % 3) + 1;
      return { labelEn, labelZh, count };
    })
    .filter((item) => item.count > 0);
  return {
    index,
    imageUrl,
    capturedAt: Date.now() - seed * 12000,
    recognizedLabels: detectionSummary.map((item) => item.labelZh),
    detectionCounts: detectionSummary.reduce<Record<string, number>>((acc, item) => {
      acc[item.labelEn] = item.count;
      return acc;
    }, {}),
  };
}

function aggregateFrameSummary(frame?: MonitorFrame | null): MonitorDetectionSummary[] {
  if (!frame?.detectionCounts) return [];
  return Object.entries(frame.detectionCounts).map(([labelEn, count]) => ({
    labelEn,
    labelZh: DETECTION_CLASS_MAP[labelEn] ?? labelEn,
    count,
  })).sort((a, b) => b.count - a.count);
}

interface SceneStore {
  // Layer visibility
  layers: LayerState;
  locale: Locale;
  // Parameters
  gasThreshold: number;
  confidenceFilter: number;
  physicalTruthMode: boolean;
  /** 裂缝着色模式：默认(gas) / 渗透率(permeability) / 应力(stress) */
  fractureColorMode: 'gas' | 'permeability' | 'stress';
  // Spatial actions
  cameraTarget: CameraTarget | null;
  highlightRegion: HighlightRegion;
  // Volume measurement
  volumeMeasureMode: boolean;
  // Chat
  messages: ChatMessage[];
  // Panel collapse
  chatCollapsed: boolean;
  // 3D screenshot callback
  captureScreenshot: (() => string | null) | null;
  // Camera live position
  cameraInfo: { x: number; y: number; z: number; dist: number };
  // Selected robot for detail dialog
  selectedRobot: Robot | null;
  robotDetailOpen: boolean;
  selectedMonitor: Monitor | null;
  monitorDetailOpen: boolean;
  monitorRefreshToken: number;
  monitorFrameMap: Record<string, MonitorFrame>;
  refreshMonitorFrame: (monitorId: string, imageUrl?: string, force?: boolean) => Promise<void>;
  refreshMonitorFrames: () => Promise<void>;
  /** 当前聚焦的机器人 ID（3D 场景中显示放大指示器） */
  focusedRobotId: string | null;

  // === v2: 裂缝网络 ===
  dataSource: DataSourceType;
  scenario: ScenarioType;
  fractures: Fracture[];
  selectedFracture: Fracture | null;
  selectedFractureNode: string | null;
  selectedCoalStructure: CoalStructure | null;
  /** 高亮的裂缝 ID 列表（传感器区域点击时高亮对应裂缝面） */
  highlightedFractureIds: string[] | null;

  // === v2: 标注工具 ===
  activeTool: AnnotationTool;
  annotations: Annotation[];

  // Actions
  setLayer: (key: keyof LayerState, value: boolean) => void;
  setLocale: (locale: Locale) => void;
  setGasThreshold: (value: number) => void;
  setConfidenceFilter: (value: number) => void;
  setPhysicalTruthMode: (value: boolean) => void;
  setFractureColorMode: (mode: 'gas' | 'permeability' | 'stress') => void;
  flyTo: (target: CameraTarget) => void;
  clearCameraTarget: () => void;
  setHighlightRegion: (region: HighlightRegion) => void;
  /** 设置高亮并自动定时消失（统一计时器，避免竞态） */
  highlightWithTimer: (position: [number, number, number], radius: number, duration?: number) => void;
  /** 立即清除高亮 */
  clearHighlight: () => void;
  /** 重置场景视角：清除高亮、选中、AI标记，相机回到全景 */
  resetSceneView: () => void;
  setVolumeMeasureMode: (value: boolean) => void;
  toggleChatCollapsed: () => void;
  setCaptureScreenshot: (fn: (() => string | null) | null) => void;
  setCameraInfo: (info: { x: number; y: number; z: number; dist: number }) => void;
  openRobotDetail: (robot: Robot) => void;
  openMonitorDetail: (monitor: Monitor) => void;
  closeRobotDetail: () => void;
  closeMonitorDetail: () => void;
  clearSelection: () => void;
  // v2 actions
  setDataSource: (d: DataSourceType) => void;
  setScenario: (s: ScenarioType) => void;
  setFractures: (f: Fracture[]) => void;
  selectFracture: (f: Fracture | null) => void;
  selectFractureNode: (id: string | null) => void;
  selectCoalStructure: (s: CoalStructure | null) => void;
  setHighlightedFractureIds: (ids: string[] | null) => void;
  setActiveTool: (t: AnnotationTool) => void;
  addAnnotation: (a: Annotation) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  // AI markers (LLM-placed)
  aiMarkers: AIMarker[];
  aiMarkerScreens: AIMarkerScreenPosition[];
  setAIMarkers: (markers: AIMarker[]) => void;
  addAIMarkers: (markers: AIMarker[]) => void;
  clearAIMarkers: () => void;
  setAIMarkerScreens: (items: AIMarkerScreenPosition[]) => void;

  // === Phase 1: 风险发现 / 证据链 ===
  findings: Finding[];
  addFinding: (finding: Finding) => void;
  updateFindingStatus: (id: string, status: FindingStatus) => void;
  clearFindings: () => void;

  // === Phase 3: AI action audit ===
  aiActionAudit: AIActionAuditEntry[];
  addAIActionAudit: (entry: AIActionAuditEntry) => void;
  markAIActionUndone: (id: string) => void;
  clearAIActionAudit: () => void;

  // === Phase 4: export history ===
  exportHistory: ExportHistoryEntry[];
  addExportHistory: (entry: ExportHistoryEntry) => void;
  clearExportHistory: () => void;

  // === C1: 告警确认 ===
  acknowledgedAlertIds: string[];
  acknowledgeAlert: (id: string) => void;
  acknowledgeAllAlerts: (ids: string[]) => void;

  // === 易用性: 角色面板外部跳转 ===
  roleDashboardTab: 'manager' | 'safety' | 'engineer' | 'timeline';
  setRoleDashboardTab: (tab: 'manager' | 'safety' | 'engineer' | 'timeline') => void;

  // === 易用性: 新手引导 ===
  onboardingActive: boolean;
  startOnboarding: () => void;
  stopOnboarding: () => void;

  // === 任务回放 ===
  /** 回放进度 0~1（0=刚开始，1=全部渲染完毕） */
  playbackProgress: number;
  /** 是否正在播放回放 */
  isPlaying: boolean;
  /** 回放是否处于活跃状态（开始播放后为 true，用户点击"完成"或切换场景后为 false） */
  playbackActive: boolean;
  /** 回放速度倍率 */
  playbackSpeed: number;
  setPlaybackProgress: (v: number) => void;
  setPlaying: (v: boolean) => void;
  setPlaybackSpeed: (v: number) => void;
  /** 开始回放（进度归零、播放开始） */
  startPlayback: () => void;
  /** 停止回放（恢复完整渲染） */
  stopPlayback: () => void;
}

export const useSceneStore = create<SceneStore>((set) => ({
  layers: {
    mesh: false,
    pointCloud: true,
    gasHeatmap: false,
    tempHeatmap: false,
    robots: true,
    fractures: true,
    rockMass: true,
    poi: true,
  },
  locale: 'zh-CN',
  gasThreshold: 1.5,
  confidenceFilter: 0,
  physicalTruthMode: false,
  fractureColorMode: 'gas',
  cameraTarget: null,
  highlightRegion: { position: [0, 0, 0], radius: 10, active: false },
  volumeMeasureMode: false,
  messages: [
    {
      id: 'msg-0',
      role: 'assistant',
      content: '## 系统就绪\n\n煤矿瓦斯巡检AI助手已上线。\n\n请在设置中配置AI模型（推荐 DeepSeek），或使用快捷指令。',
      timestamp: Date.now(),
    },
  ],
  chatCollapsed: false,
  captureScreenshot: null,
  cameraInfo: { x: 30, y: 15, z: 60, dist: 68.7 },
  selectedRobot: null,
  robotDetailOpen: false,
  selectedMonitor: null,
  monitorDetailOpen: false,
  monitorRefreshToken: 0,
  monitorFrameMap: {},
  focusedRobotId: null,

  // v2 state
  dataSource: 'fracture',
  scenario: 'coal',
  fractures: [],
  selectedFracture: null,
  selectedFractureNode: null,
  selectedCoalStructure: null,
  highlightedFractureIds: null,
  activeTool: 'none',
  annotations: [],

  setLayer: (key, value) =>
    set((state) => ({
      layers: { ...state.layers, [key]: value },
    })),

  setLocale: (locale) => set({ locale }),

  setGasThreshold: (value) => set({ gasThreshold: value }),

  setConfidenceFilter: (value) => set({ confidenceFilter: value }),

  setPhysicalTruthMode: (value) => {
    set({ physicalTruthMode: value });
  },

  setFractureColorMode: (mode) => set({ fractureColorMode: mode }),

  flyTo: (target) => set({ cameraTarget: target }),

  clearCameraTarget: () => set({ cameraTarget: null }),

  setHighlightRegion: (region) => {
    if (_highlightTimer) { clearTimeout(_highlightTimer); _highlightTimer = null; }
    set({ highlightRegion: region });
  },

  highlightWithTimer: (position, radius, duration = 5000) => {
    if (_highlightTimer) clearTimeout(_highlightTimer);
    set({ highlightRegion: { position, radius, active: true } });
    _highlightTimer = setTimeout(() => {
      set((state) => ({ highlightRegion: { ...state.highlightRegion, active: false } }));
      _highlightTimer = null;
    }, duration);
  },

  clearHighlight: () => {
    if (_highlightTimer) { clearTimeout(_highlightTimer); _highlightTimer = null; }
    set((state) => ({ highlightRegion: { ...state.highlightRegion, active: false } }));
  },

  resetSceneView: () => {
    if (_highlightTimer) { clearTimeout(_highlightTimer); _highlightTimer = null; }
    set((state) => ({
      ...clearCrossSceneEvidence(state),
      cameraTarget: { position: [0, 0, 0], fitAll: true },
      selectedFracture: null,
      selectedFractureNode: null,
      selectedCoalStructure: null,
      highlightedFractureIds: null,
      aiMarkers: [],
      aiMarkerScreens: [],
      fractureColorMode: 'gas' as const,
      selectedRobot: null,
      robotDetailOpen: false,
      selectedMonitor: null,
      monitorDetailOpen: false,
      focusedRobotId: null,
    }));
  },

  setVolumeMeasureMode: (value) => set({ volumeMeasureMode: value }),

  toggleChatCollapsed: () =>
    set((state) => ({ chatCollapsed: !state.chatCollapsed })),

  setCaptureScreenshot: (fn) => set({ captureScreenshot: fn }),

  setCameraInfo: (info) => set({ cameraInfo: info }),

  openRobotDetail: (robot) => set({
    selectedRobot: robot,
    robotDetailOpen: true,
    focusedRobotId: robot.id,
    selectedMonitor: null,
    monitorDetailOpen: false,
    selectedFracture: null,
    selectedFractureNode: null,
  }),
  openMonitorDetail: (monitor) => set({
    selectedMonitor: monitor,
    monitorDetailOpen: true,
    selectedRobot: null,
    robotDetailOpen: false,
    focusedRobotId: null,
  }),
  closeRobotDetail: () => set({ robotDetailOpen: false, selectedRobot: null, focusedRobotId: null }),
  closeMonitorDetail: () => set({ monitorDetailOpen: false, selectedMonitor: null }),
  refreshMonitorFrame: async (monitorId, imageUrl, force = false) => {
    const { inferMonitorFrame } = await import('../domain/monitorInference');
    const state = useSceneStore.getState();
    const monitor = state.selectedMonitor?.id === monitorId ? state.selectedMonitor : null;
    const currentFrame = monitor?.frameHistory?.[0] ?? state.monitorFrameMap[monitorId] ?? null;
    const resolvedImage = imageUrl ?? currentFrame?.imageUrl ?? '';
    if (!resolvedImage) return;

    const framePool = CAMERA_FRAME_POOL.length > 0 ? CAMERA_FRAME_POOL : [resolvedImage];
    const currentIndex = currentFrame ? framePool.indexOf(currentFrame.imageUrl) : -1;
    const nextImage = force
      ? framePool[(currentIndex + 1 + framePool.length) % framePool.length]
      : resolvedImage;
    const imageToInfer = nextImage || resolvedImage;

    const result = await inferMonitorFrame({ monitorId, imageUrl: imageToInfer, force: true });
    const frame = result.frameHistory[0];
    if (!frame) return;
    if (currentFrame?.imageUrl === frame.imageUrl && !force) return;
    set((current) => ({
      monitorRefreshToken: current.monitorRefreshToken + 1,
      monitorFrameMap: { ...current.monitorFrameMap, [monitorId]: frame },
      selectedMonitor: current.selectedMonitor?.id === monitorId
        ? { ...current.selectedMonitor, frameHistory: [frame], detectionSummary: result.detectionSummary, lastUpdate: frame.detectedAt ?? frame.capturedAt }
        : current.selectedMonitor,
    }));
  },
  refreshMonitorFrames: async () => {
    const { inferMonitorBatch } = await import('../domain/monitorInference');
    const state = useSceneStore.getState();
    const requests = Object.entries(state.monitorFrameMap)
      .map(([monitorId, frame]) => ({ monitorId, imageUrl: frame?.imageUrl ?? '' }))
      .filter((item) => item.imageUrl);
    if (requests.length === 0) return;
    const results = await inferMonitorBatch(requests.map((request) => ({ ...request, force: true })));
    set((current) => ({
      monitorRefreshToken: current.monitorRefreshToken + 1,
      monitorFrameMap: results.reduce<Record<string, MonitorFrame>>((acc, result) => {
        const frame = result.frameHistory[0];
        if (frame) acc[result.monitorId] = frame;
        return acc;
      }, { ...current.monitorFrameMap }),
      selectedMonitor: current.selectedMonitor
        ? (() => {
            const hit = results.find((item) => item.monitorId === current.selectedMonitor?.id);
            const frame = hit?.frameHistory[0];
            return frame
              ? { ...current.selectedMonitor, frameHistory: [frame], detectionSummary: hit!.detectionSummary, lastUpdate: frame.detectedAt ?? frame.capturedAt }
              : current.selectedMonitor;
          })()
        : current.selectedMonitor,
    }));
  },
  clearSelection: () => set({
    selectedRobot: null,
    robotDetailOpen: false,
    selectedMonitor: null,
    monitorDetailOpen: false,
    focusedRobotId: null,
    selectedFracture: null,
    selectedFractureNode: null,
    highlightedFractureIds: null,
  }),

  // v2 actions
  setDataSource: (d) => set((state) => {
    const nextScenario =
      d === 'fracture'
        ? isFractureScenario(state.scenario) ? state.scenario : 'coal'
        : DATA_SOURCE_SCENARIO[d];
    return {
      ...clearCrossSceneEvidence(state),
      dataSource: d,
      scenario: nextScenario,
      gasThreshold: getSceneSemantics(nextScenario).threshold.defaultValue,
      selectedFracture: null,
      selectedFractureNode: null,
      highlightedFractureIds: null,
      selectedRobot: null,
      robotDetailOpen: false,
      focusedRobotId: null,
      fractureColorMode: 'gas' as const,
      activeTool: 'none' as const,
      playbackActive: false,
      isPlaying: false,
      playbackProgress: 1,
      aiMarkers: [],
      aiMarkerScreens: [],
      cameraTarget: nextScenario === 'coal'
        ? { position: [0, 0, 0], fitAll: true }
        : { position: [0, 0, 0], zoom: 'wide' },
      messages: refreshWelcomeMessage(state.messages, nextScenario),
    };
  }),
  setScenario: (s) => set((state) => ({
    ...clearCrossSceneEvidence(state),
    scenario: s,
    gasThreshold: getSceneSemantics(s).threshold.defaultValue,
    selectedFracture: null,
    selectedFractureNode: null,
    highlightedFractureIds: null,
    selectedRobot: null,
    robotDetailOpen: false,
    focusedRobotId: null,
    activeTool: 'none',
    playbackActive: false,
    isPlaying: false,
    playbackProgress: 1,
    aiMarkers: [],
    aiMarkerScreens: [],
    cameraTarget: s === 'coal'
      ? { position: [0, 0, 0], fitAll: true }
      : { position: [0, 0, 0], zoom: 'wide' },
    messages: refreshWelcomeMessage(state.messages, s),
  })),
  setFractures: (f) => set({ fractures: f }),
  selectFracture: (f) => set({
    selectedFracture: f,
    selectedFractureNode: null,
    selectedCoalStructure: null,
    ...(f
      ? { selectedRobot: null, robotDetailOpen: false, focusedRobotId: null }
      : {}),
  }),
  selectFractureNode: (id) => set({ selectedFractureNode: id }),
  selectCoalStructure: (s) => set({
    selectedCoalStructure: s,
    selectedFracture: null,
    selectedFractureNode: null,
    ...(s
      ? { selectedRobot: null, robotDetailOpen: false, focusedRobotId: null }
      : {}),
  }),
  setHighlightedFractureIds: (ids) => set({ highlightedFractureIds: ids }),
  setActiveTool: (t) => set({ activeTool: t }),
  addAnnotation: (a) => set((state) => ({ annotations: [...state.annotations, a] })),
  removeAnnotation: (id) => set((state) => ({ annotations: state.annotations.filter((a) => a.id !== id) })),
  clearAnnotations: () => set({ annotations: [] }),

  // AI markers
  aiMarkers: [],
  aiMarkerScreens: [],
  setAIMarkers: (markers) => set({ aiMarkers: markers }),
  addAIMarkers: (markers) => set((state) => ({ aiMarkers: [...state.aiMarkers, ...markers] })),
  clearAIMarkers: () => set({ aiMarkers: [], aiMarkerScreens: [] }),
  setAIMarkerScreens: (items) => set({ aiMarkerScreens: items }),

  // Phase 1: 风险发现 / 证据链
  findings: [],
  addFinding: (finding) => set((state) => ({
    findings: state.findings.some((f) => f.id === finding.id)
      ? state.findings
      : [finding, ...state.findings],
  })),
  updateFindingStatus: (id, status) => set((state) => ({
    findings: state.findings.map((finding) =>
      finding.id === id
        ? { ...finding, status, updatedAt: Date.now() }
        : finding
    ),
  })),
  clearFindings: () => set({ findings: [] }),

  // Phase 3: AI action audit
  aiActionAudit: [],
  addAIActionAudit: (entry) => set((state) => ({
    aiActionAudit: [entry, ...state.aiActionAudit].slice(0, 50),
  })),
  markAIActionUndone: (id) => set((state) => ({
    aiActionAudit: state.aiActionAudit.map((entry) =>
      entry.id === id ? { ...entry, undoneAt: Date.now(), undoable: false } : entry
    ),
  })),
  clearAIActionAudit: () => set({ aiActionAudit: [] }),

  // Phase 4: export history
  exportHistory: [],
  addExportHistory: (entry) => set((state) => ({
    exportHistory: [entry, ...state.exportHistory].slice(0, 20),
  })),
  clearExportHistory: () => set({ exportHistory: [] }),

  // C1: 告警确认
  acknowledgedAlertIds: [],
  acknowledgeAlert: (id) => set((state) => ({
    acknowledgedAlertIds: state.acknowledgedAlertIds.includes(id)
      ? state.acknowledgedAlertIds
      : [...state.acknowledgedAlertIds, id],
  })),
  acknowledgeAllAlerts: (ids) => set((state) => ({
    acknowledgedAlertIds: [...new Set([...state.acknowledgedAlertIds, ...ids])],
  })),

  // 易用性: 角色面板外部跳转
  roleDashboardTab: 'manager',
  setRoleDashboardTab: (tab) => set({ roleDashboardTab: tab }),

  // 易用性: 新手引导
  onboardingActive: false,
  startOnboarding: () => set({ onboardingActive: true }),
  stopOnboarding: () => set({ onboardingActive: false }),

  // 任务回放
  playbackProgress: 1,
  isPlaying: false,
  playbackActive: false,
  playbackSpeed: 50,
  setPlaybackProgress: (v) => set({ playbackProgress: Math.max(0, Math.min(1, v)) }),
  setPlaying: (v) => set({ isPlaying: v }),
  setPlaybackSpeed: (v) => set({ playbackSpeed: v }),
  startPlayback: () => set({ isPlaying: true, playbackProgress: 0, playbackActive: true }),
  stopPlayback: () => set({ isPlaying: false, playbackProgress: 1, playbackActive: false }),
}));
