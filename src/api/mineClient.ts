import { apiConfig } from './config';

export interface MineDetectRequest {
  monitorId: string;
  imageUrl: string;
  force?: boolean;
}

export interface MineDetectionItem {
  label_en: string;
  label_zh: string;
  confidence: number;
  box: number[];
}

export interface MineInferenceDetectionSummaryItem {
  label_en: string;
  label_zh: string;
  count: number;
  confidence: number;
}

export interface MineInferenceDetectionItem {
  label_en: string;
  label_zh: string;
  confidence: number;
  box: number[];
}

export interface MineInferenceResponse {
  image_name: string;
  model_path: string;
  detections: MineInferenceDetectionSummaryItem[];
  raw_detections?: MineInferenceDetectionItem[];
}

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:')) return imageUrl;
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to load image ${imageUrl}: ${res.status}`);
  }
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to encode image ${imageUrl}`));
    reader.readAsDataURL(blob);
  });
}

function inferImagePath(imageUrl: string): string {
  if (imageUrl.startsWith('data:')) {
    return `dataurl-${imageUrl.length}`;
  }
  try {
    const url = new URL(imageUrl, window.location.href);
    const last = url.pathname.split('/').filter(Boolean).pop();
    return last ?? imageUrl;
  } catch {
    const last = imageUrl.split('/').filter(Boolean).pop();
    return last ?? imageUrl;
  }
}

async function buildImagePayload(imageUrl: string): Promise<{ image_b64: string; image_path: string }> {
  const image_path = inferImagePath(imageUrl);
  try {
    const image_b64 = await imageUrlToDataUrl(imageUrl);
    return { image_b64, image_path };
  } catch (error) {
    if (imageUrl.startsWith('data:')) {
      throw error;
    }
    // 如果远程图片无法直接 fetch，至少把路径发给后端，便于服务端读取可访问文件。
    return { image_b64: '', image_path };
  }
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${apiConfig.mineBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Mine API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  return res.json() as Promise<T>;
}

export async function inferMineFrame(request: MineDetectRequest, signal?: AbortSignal): Promise<MineInferenceResponse> {
  const { image_b64, image_path } = await buildImagePayload(request.imageUrl);
  return postJson<MineInferenceResponse>('/infer', { image_b64, image_path, conf: 0.25, iou: 0.45, max_det: 300 }, signal);
}

export async function inferMineBatch(requests: MineDetectRequest[], signal?: AbortSignal): Promise<MineInferenceResponse[]> {
  return Promise.all(requests.map((request) => inferMineFrame(request, signal)));
}
