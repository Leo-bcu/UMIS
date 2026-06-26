"""
Mine.pt 监控目标检测推理服务。

目标：
1. 支持单图推理、批量推理
2. 支持本地缓存，避免重复计算
3. 只输出指定 11 类目标，并附带中文翻译
4. 兼容前端模拟模式与独立后端模式
5. 尽量降低重复 IO 与重复模型加载带来的性能开销

启动：
    cd backend
    pip install -r requirements.txt
    uvicorn monitor_infer_service:app --host 0.0.0.0 --port 8010 --reload

前端对接：
    VITE_API_MODE=live
    VITE_API_BASE_URL=http://localhost:8010/api
"""

from __future__ import annotations

import base64
import hashlib
import io
import os
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import cv2  # type: ignore
except Exception:  # pragma: no cover
    cv2 = None

try:
    import numpy as np
except Exception as exc:  # pragma: no cover
    raise SystemExit("缺少 numpy，请先安装依赖") from exc

try:
    from ultralytics import YOLO
except Exception as exc:  # pragma: no cover
    YOLO = None  # type: ignore

CLASS_MAP_ZH: Dict[str, str] = {
    "support_structure": "支护结构",
    "cable": "电缆",
    "tube": "管道",
    "electrical_device": "电气设备",
    "indicator": "指示器",
    "mining_machine": "采掘机械",
    "door": "门",
    "rescue_equipment": "救援装备",
    "person": "人员",
    "rail_track": "轨道",
    "container": "容器",
}

ALLOWED_CLASSES = set(CLASS_MAP_ZH.keys())


class InferenceRequest(BaseModel):
    monitor_id: str = Field(..., description="监控器 ID")
    image: Optional[str] = Field(None, description="图片 base64 或 data URL")
    image_url: Optional[str] = Field(None, description="图片地址（当服务端能访问时使用）")
    force: bool = Field(False, description="是否强制跳过缓存")
    max_det: int = Field(50, ge=1, le=200)


class BatchInferenceRequest(BaseModel):
    items: List[InferenceRequest]


class DetectionItem(BaseModel):
    label_en: str
    label_zh: str
    confidence: float
    box: List[float]


class FrameResult(BaseModel):
    index: int
    image_url: str
    captured_at: int
    recognized_labels: List[str]
    detection_counts: Dict[str, int]
    detections: List[DetectionItem]


class MonitorDetectionSummary(BaseModel):
    label_en: str
    label_zh: str
    count: int


class InferenceResponse(BaseModel):
    monitor_id: str
    image_url: str
    cached_at: int
    backend: Literal["live"] = "live"
    frame_history: List[FrameResult]
    detection_summary: List[MonitorDetectionSummary]


@dataclass
class CacheEntry:
    cached_at: int
    response: InferenceResponse


class LRUCache:
    def __init__(self, capacity: int = 256):
        self.capacity = capacity
        self._data: "OrderedDict[str, CacheEntry]" = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[InferenceResponse]:
        with self._lock:
            entry = self._data.get(key)
            if not entry:
                return None
            self._data.move_to_end(key)
            return entry.response

    def set(self, key: str, value: InferenceResponse) -> None:
        with self._lock:
            self._data[key] = CacheEntry(cached_at=int(time.time() * 1000), response=value)
            self._data.move_to_end(key)
            while len(self._data) > self.capacity:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


class MineInferenceEngine:
    def __init__(self, weights_path: str):
        self.weights_path = weights_path
        self._model = None
        self._lock = threading.Lock()
        self._cache = LRUCache(capacity=512)

    @property
    def model(self):
        if self._model is None:
            if YOLO is None:
                raise RuntimeError("未安装 ultralytics，无法加载 Mine.pt")
            if not Path(self.weights_path).exists():
                raise RuntimeError(f"模型文件不存在: {self.weights_path}")
            self._model = YOLO(self.weights_path)
        return self._model

    def _decode_image(self, image: Optional[str], image_url: Optional[str]) -> bytes:
        if image:
            if image.startswith("data:"):
                image = image.split(",", 1)[-1]
            return base64.b64decode(image)
        if image_url:
            path = Path(image_url)
            if path.exists():
                return path.read_bytes()
        raise RuntimeError("未提供可用图片")

    def _image_signature(self, monitor_id: str, image_bytes: bytes, force: bool) -> str:
        digest = hashlib.sha256(image_bytes).hexdigest()
        return f"{monitor_id}:{digest}:{int(force)}"

    def _run_model(self, image_bytes: bytes, max_det: int) -> List[DetectionItem]:
        img_array = np.frombuffer(image_bytes, dtype=np.uint8)
        if cv2 is not None:
            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if frame is None:
                raise RuntimeError("图片解码失败")
        else:
            raise RuntimeError("缺少 opencv-python，无法解码图片")

        results = self.model.predict(source=frame, verbose=False, max_det=max_det)
        detections: List[DetectionItem] = []
        for result in results:
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            for box in boxes:
                cls_id = int(box.cls.item()) if box.cls is not None else -1
                label_en = self.model.names.get(cls_id, str(cls_id))
                if label_en not in ALLOWED_CLASSES:
                    continue
                conf = float(box.conf.item()) if box.conf is not None else 0.0
                xyxy = [round(float(v), 2) for v in box.xyxy[0].tolist()]
                detections.append(
                    DetectionItem(
                        label_en=label_en,
                        label_zh=CLASS_MAP_ZH[label_en],
                        confidence=round(conf, 4),
                        box=xyxy,
                    )
                )
        return detections

    def _aggregate(self, detections: Iterable[DetectionItem]) -> List[MonitorDetectionSummary]:
        summary: Dict[str, MonitorDetectionSummary] = {}
        for item in detections:
            current = summary.get(item.label_en)
            if current is None:
                current = MonitorDetectionSummary(label_en=item.label_en, label_zh=item.label_zh, count=0)
                summary[item.label_en] = current
            current.count += 1
        return sorted(summary.values(), key=lambda x: (-x.count, x.label_en))

    def infer(self, req: InferenceRequest) -> InferenceResponse:
        image_bytes = self._decode_image(req.image, req.image_url)
        key = self._image_signature(req.monitor_id, image_bytes, req.force)
        if not req.force:
            cached = self._cache.get(key)
            if cached:
                return cached

        with self._lock:
            detections = self._run_model(image_bytes, req.max_det)
            frame = FrameResult(
                index=0,
                image_url=req.image_url or f"memory://{req.monitor_id}",
                captured_at=int(time.time() * 1000),
                recognized_labels=list(dict.fromkeys([d.label_zh for d in detections])),
                detection_counts={k: sum(1 for d in detections if d.label_en == k) for k in CLASS_MAP_ZH.keys() if any(d.label_en == k for d in detections)},
                detections=detections,
            )
            response = InferenceResponse(
                monitor_id=req.monitor_id,
                image_url=frame.image_url,
                cached_at=int(time.time() * 1000),
                frame_history=[frame],
                detection_summary=self._aggregate(detections),
            )
            self._cache.set(key, response)
            return response

    def infer_batch(self, req: BatchInferenceRequest) -> List[InferenceResponse]:
        return [self.infer(item) for item in req.items]


app = FastAPI(
    title="Mine.pt 监控识别服务",
    description="独立 Mine.pt 监控目标检测推理服务",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WEIGHTS_PATH = os.environ.get("MINE_WEIGHTS_PATH", str(Path(__file__).resolve().parent.parent / "approch" / "Mine.pt"))
engine = MineInferenceEngine(WEIGHTS_PATH)


@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "mine-infer",
        "version": "1.0.0",
        "weights_path": WEIGHTS_PATH,
        "model_loaded": engine._model is not None,
        "classes": CLASS_MAP_ZH,
        "cache_size": len(engine._cache._data),
    }


@app.get("/api/classes")
async def classes() -> Dict[str, Any]:
    return {"nc": len(CLASS_MAP_ZH), "names": CLASS_MAP_ZH}


@app.post("/api/monitor-infer", response_model=InferenceResponse)
async def monitor_infer(req: InferenceRequest) -> InferenceResponse:
    try:
        return engine.infer(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/monitor-infer/batch", response_model=List[InferenceResponse])
async def monitor_infer_batch(req: BatchInferenceRequest) -> List[InferenceResponse]:
    try:
        return engine.infer_batch(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/monitor-infer/cache/clear")
async def clear_cache() -> Dict[str, Any]:
    engine._cache.clear()
    return {"status": "ok", "cleared": True}


@app.post("/api/monitor-infer/prewarm")
async def prewarm(items: List[InferenceRequest]) -> Dict[str, Any]:
    try:
        results = engine.infer_batch(BatchInferenceRequest(items=items))
        return {"status": "ok", "count": len(results)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8010)
