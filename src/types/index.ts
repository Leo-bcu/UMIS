export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RawPoint extends Vec3 {
  intensity: number;
}

export interface Geometry {
  center: Vec3;
  mesh_vertices: Vec3[];
  raw_points: RawPoint[];
}

export interface Sensors {
  ch4_concentration_pct: number;
  temperature_celsius: number;
  pressure_kpa: number;
}

export interface SceneNode {
  node_id: string;
  timestamp: number;
  confidence_score: number;
  geometry: Geometry;
  sensors: Sensors;
}

export interface POI {
  id: string;
  position: [number, number, number];
  label: string;
  type: 'crack' | 'gas' | 'collapse' | 'sensor';
  description: string;
  sensors: Sensors;
}

export type AlertLevel = 'danger' | 'warning' | 'info';
export type AlertType =
  | 'gas_overload'
  | 'robot_offline'
  | 'mesh_disconnect'
  | 'temp_anomaly'
  | 'battery_low'
  | 'robot_error'
  | 'task_complete'
  | 'system';

export interface AlertEvent {
  id: string;
  level: AlertLevel;
  type: AlertType;
  title: string;
  description: string;
  robotId?: string;
  position?: [number, number, number];
  timestamp: number;
  acknowledged: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  action?: SceneAction;
  actions?: SceneAction[];
}

export interface SceneAction {
  type:
    | 'flyTo'
    | 'highlight'
    | 'toggleLayer'
    | 'markPoints'
    | 'activateTool'
    | 'selectFracture'
    | 'setGasThreshold'
    | 'switchScenario'
    | 'fitAll'
    | 'clearMarkers'
    | 'setColorMode';
  position?: [number, number, number];
  region?: string;
  layer?: string;
  visible?: boolean;
  tool?: AnnotationTool;
  fractureId?: string;
  threshold?: number;
  scenario?: ScenarioType;
  points?: {
    position: [number, number, number];
    label: string;
    level?: 'danger' | 'warning' | 'info';
    detail?: string;
    source?: string;
  }[];
  radius?: number;
  mode?: 'gas' | 'permeability' | 'stress';
}

/** LLM 放置的 3D 标记 */
export interface AIMarker {
  id: string;
  position: [number, number, number];
  label: string;
  level: 'danger' | 'warning' | 'info';
  createdAt: number;
  detail?: string;
  source?: string;
}

export interface LayerState {
  mesh: boolean;
  pointCloud: boolean;
  gasHeatmap: boolean;
  tempHeatmap: boolean;
  robots: boolean;
  fractures: boolean;
  rockMass: boolean;
  poi: boolean;
}

export interface CameraTarget {
  position: [number, number, number];
  region?: string;
  /** 'close' = 贴近放大看单个机器人/裂缝节点; 'normal' = 默认; 'wide' = 远景 */
  zoom?: 'close' | 'normal' | 'wide';
  /** 全景模式：忽略 position/zoom，由相机动态计算当前场景包围盒并拉远到容纳全部 */
  fitAll?: boolean;
}

export interface HighlightRegion {
  position: [number, number, number];
  radius: number;
  active: boolean;
}

export interface CoalStructure {
  id: string;
  name: string;
  kind: 'decline' | 'mainRoadway' | 'lowerRoadway' | 'returnAirway' | 'goafEdge';
  position: [number, number, number];
  points: [number, number, number][];
  relatedMonitorIds?: string[];
  recognizedLabels?: string[];
}

// ===================================================================
// 集群机器人 / 监控器相关
// ===================================================================

/** 机器人型号 */
export type RobotModel = 'tracked' | 'wheeled' | 'climbing' | 'snake' | 'aerial' | 'spider' | 'floatwalker';

/** 机器人状态 */
export type RobotStatus = 'online' | 'offline' | 'low_battery' | 'error' | 'maintenance';

/** Mesh 自组网角色 */
export type MeshRole = 'gateway' | 'relay' | 'edge' | 'leaf';

/** 监控器状态 */
export type MonitorStatus = 'online' | 'offline' | 'warning' | 'maintenance';

/** 监控器实体 */
export type MonitorDetectionStatus = 'detected' | 'undetected' | 'detecting';

export interface MonitorFrame {
  index: number;
  imageUrl: string;
  capturedAt: number;
  recognizedLabels: string[];
  detectionCounts?: Record<string, number>;
  detectionStatus?: MonitorDetectionStatus;
  detectedAt?: number;
  detectionDurationMs?: number;
}

export interface MonitorDetectionSummary {
  labelEn: string;
  labelZh: string;
  count: number;
}

export interface Monitor {
  id: string;
  status: MonitorStatus;
  position: [number, number, number];
  battery: number;
  task: string;
  depth: number;
  signalStrength: number;
  coverageRadius: number;
  relatedCoalStructureId?: string;
  recognizedLabels?: string[];
  detectionSummary?: MonitorDetectionSummary[];
  frameHistory?: MonitorFrame[];
  sensors: {
    ch4: number;
    temperature: number;
    humidity: number;
  };
  lastUpdate: number;
}

/** 机器人实体 */
export interface Robot {
  /** 编号，如 R-001 */
  id: string;
  /** 型号 */
  model: RobotModel;
  /** 当前状态 */
  status: RobotStatus;
  /** 3D 坐标 [x, y, z] */
  position: [number, number, number];
  /** 电量百分比 0-100 */
  battery: number;
  /** Mesh 组网角色 */
  meshRole: MeshRole;
  /** 是否已接入 Mesh 网络 */
  meshConnected: boolean;
  /** 当前执行任务描述 */
  task: string;
  /** 深度（米），正数表示地下 */
  depth: number;
  /** 信号强度 dBm */
  signalStrength: number;
  /** 回传传感器数据 */
  sensors: {
    ch4: number;
    temperature: number;
    humidity: number;
  };
  /** 最后回传时间戳 */
  lastUpdate: number;
}

// ===================================================================
// 裂缝网络相关
// ===================================================================

/** 行业场景类型 */
export type ScenarioType = 'coal' | 'gold' | 'oil' | 'pipeline' | 'nuclear' | 'refinery' | 'underground';

/** 数据源类型（顶层切换） */
export type DataSourceType = 'fracture' | 'pipeline' | 'nuclear' | 'refinery' | 'underground';

/** 传感器读数 */
export interface SensorReading {
  ch4_pct: number;
  co_ppm: number;
  h2s_ppm: number;
  temperature_c: number;
  stress_mpa: number;
  stress_sigma1: number;
  stress_sigma2: number;
  stress_sigma3: number;
  permeability_md: number;
  water_pressure_mpa: number;
  microseismic_count: number;
  acoustic_emission_mv: number;
  humidity_pct: number;
  fracture_aperture_um: number;
  displacement_mm: number;
  rock_strength_mpa: number;
  pore_pressure_mpa: number;
  porosity_pct: number;
  fluid_ph: number;
  water_saturation_pct: number;
}

/** 裂缝测点 */
export interface FractureNode {
  id: string;
  position: [number, number, number];
  sensors: SensorReading;
  timestamp: number;
  robotId: string | null;
}

/** 裂缝实体 */
export interface Fracture {
  id: string;
  name: string;
  type: 'main' | 'branch';
  path: [number, number, number][];
  length: number;
  aperture_um: number;
  porosity: number;
  fractal_dim: number;
  tortuosity: number;
  dip_angle: number;
  azimuth_angle: number;
  roughness_coeff: number;
  connectivity: number;
  sensorReading: SensorReading;
  nodes: FractureNode[];
  parentFractureId: string | null;
  /** 形态分类：煤矿专用。cavity=矿坑腔体, tunnel=巷道, fracture=矿坑内裂隙面。
   *  其他场景不传此字段，走原有渲染逻辑。 */
  morphology?: 'cavity' | 'tunnel' | 'fracture';
}

/** 标注工具类型 */
export type AnnotationTool = 'none' | 'profile' | 'area' | 'text' | 'distance';

/** 标注实体 */
export interface Annotation {
  id: string;
  type: AnnotationTool;
  points: [number, number, number][];
  label?: string;
  createdAt: number;
}

/** 虚拟实验类型 */
export type ExperimentType =
  | 'gas_diffusion'
  | 'stability_assessment'
  | 'water_inrush_warning'
  | 'rockburst_prediction'
  | 'permeability_evaluation'
  | 'connectivity_analysis'
  | 'hydraulic_fracturing'
  | 'stress_concentration';

/** 实验结果 */
export interface ExperimentResult {
  type: ExperimentType;
  scenario: ScenarioType;
  summary: string;
  riskLevel: 'normal' | 'caution' | 'warning' | 'danger';
  data: Record<string, number>;
  timestamp: number;
}
