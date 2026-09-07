/**
 * HTTP 客户端封装
 * 提供 GET / POST 方法，统一错误处理和超时控制
 * 所有 live 模式的 API 调用都经过这里
 */

import { apiConfig } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function request<T>(
  endpoint: string,
  options: RequestInit & RequestOptions = {}
): Promise<T> {
  const url = `${apiConfig.baseUrl}${endpoint}`;
  const { signal, headers, ...rest } = options;

  // 超时控制：合并用户传入的 signal 和超时 signal
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), apiConfig.timeout);

  // 合并 signals
  const combinedSignal = signal
    ? mergeSignals(signal, timeoutController.signal)
    : timeoutController.signal;

  try {
    const response = await fetch(url, {
      ...rest,
      signal: combinedSignal,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new ApiError(
        response.status,
        `API ${response.status}: ${errorBody || response.statusText}`,
        endpoint
      );
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

function mergeSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort();
      break;
    }
    sig.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export const httpClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
