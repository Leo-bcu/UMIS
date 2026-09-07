/**
 * API 全局配置
 * 读取 .env 中的环境变量，控制 mock/live 模式切换
 *
 * 后端就绪后：将 .env 中 VITE_API_MODE 改为 live 即可
 */

export type ApiMode = 'mock' | 'live';

export interface ApiConfig {
  /** mock = 内置模拟数据，live = 真实后端 */
  mode: ApiMode;
  /** 后端 API 基础地址 */
  baseUrl: string;
  /** 独立 Mine 推理服务地址 */
  mineBaseUrl: string;
  /** WebSocket 地址（实时传感器推送） */
  wsUrl: string;
  /** 请求超时（毫秒） */
  timeout: number;
}

export const apiConfig: ApiConfig = {
  mode: (import.meta.env.VITE_API_MODE as ApiMode) || 'mock',
  baseUrl: (import.meta.env.VITE_API_BASE_URL as string) || '/api',
  mineBaseUrl: (import.meta.env.VITE_MINE_API_BASE_URL as string) || 'http://127.0.0.1:8010',
  wsUrl: (import.meta.env.VITE_WS_URL as string) || 'ws://localhost:8080/ws',
  timeout: 30000,
};

/** 是否处于 mock 模式 */
export const isMockMode = apiConfig.mode === 'mock';

/** 是否处于 live 模式 */
export const isLiveMode = apiConfig.mode === 'live';
