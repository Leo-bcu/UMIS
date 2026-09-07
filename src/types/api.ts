/**
 * API 数据契约 — 定义后端需要返回的所有数据结构
 *
 * 这些接口是前后端对接的唯一合同。
 * 后端只需确保返回的数据结构匹配这些类型即可。
 *
 * 所有字段名使用 snake_case，与 Python 后端 / RESTful 惯例一致。
 * TypeScript 编译器会在编译期进行类型检查。
 */

import type { SceneNode, POI, SceneAction, Vec3, RawPoint, Robot, RobotModel, RobotStatus, MeshRole, Monitor, MonitorStatus } from './index';

// ===================================================================
// 场景数据相关
// ===================================================================

/**
 * 场景统计信息
 * GET /scene/stats
 */
export interface SceneStats {
  totalNodes: number;
  avgGas: number;
  avgTemp: number;
  avgConf: number;
  overThreshold: number;
  /** 在线传感器数量（live 模式下后端返回） */
  onlineSensors?: number;
  /** 数据更新时间戳（live 模式下后端返回） */
  lastUpdate?: number;
}

/**
 * 预计算的扁平几何数据（用于直接上传 GPU）
 * GET /scene/geometry
 *
 * positions: Float32Array — XYZ 坐标三元组 [x0,y0,z0, x1,y1,z1, ...]
 * confidences: Float32Array — 每个点的置信度 [0..1]
 * gasValues: Float32Array — 每个点的 CH4 浓度百分比
 * tempValues: Float32Array — 每个点的温度（°C）
 * intensities: Float32Array — 激光雷达回波强度 [0..1]
 */
export interface FlatGeometryData {
  positions: Float32Array;
  confidences: Float32Array;
  gasValues: Float32Array;
  tempValues: Float32Array;
  intensities: Float32Array;
  count: number;
}

// ===================================================================
// AI 对话相关
// ===================================================================

/**
 * AI 对话消息（Vercel AI SDK CoreMessage 兼容格式）
 */
export interface CoreMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * AI 响应（含可选的空间联动动作）
 * POST /ai/chat 的非流式响应（流式模式返回 SSE text-delta）
 */
export interface AIResponse {
  message: string;
  action?: SceneAction;
  actions?: SceneAction[];
}

/**
 * 快捷指令
 * GET /ai/quick-commands
 */
export interface QuickCommand {
  label: string;
  command: string;
  commandEn?: string;
}

// ===================================================================
// 实时 WebSocket 消息
// ===================================================================

/**
 * WebSocket 推送消息类型
 * 后端通过 WS 实时推送传感器数据更新
 */
export type WSMessageType =
  | 'sensor_update'    // 传感器数据更新
  | 'alert'           // 告警
  | 'robot_position'  // 机器人位置更新
  | 'system_status';  // 系统状态变更

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  timestamp: number;
  data: T;
}

/**
 * 传感器实时更新数据
 */
export interface SensorUpdate {
  node_id: string;
  ch4_concentration_pct: number;
  temperature_celsius: number;
  pressure_kpa: number;
}

// ===================================================================
// 集群机器人 / 监控器相关
// ===================================================================

/**
 * 机器人查询过滤参数
 * GET /robots?status=online&model=tracked&mesh_role=gateway&q=R-00
 */
export interface RobotQuery {
  status?: string;
  model?: string;
  meshRole?: string;
  q?: string;  // 搜索关键字（编号模糊匹配）
}

/**
 * 机器人集群统计概览
 * GET /robots/stats
 */
export interface RobotFleetStats {
  total: number;
  online: number;
  offline: number;
  lowBattery: number;
  error: number;
  maintenance: number;
  meshConnected: number;
  avgBattery: number;
}

/**
 * 监控器查询过滤参数
 */
export interface MonitorQuery {
  status?: string;
  q?: string;
}

/**
 * 监控器集群统计概览
 */
export interface MonitorFleetStats {
  total: number;
  online: number;
  offline: number;
  warning: number;
  maintenance: number;
  avgBattery: number;
}

// ===================================================================
// 导入原有类型供 API 层使用
// ===================================================================
export type { SceneNode, POI, Vec3, RawPoint, Robot, RobotModel, RobotStatus, MeshRole, Monitor, MonitorStatus };
