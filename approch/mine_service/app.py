from __future__ import annotations

import base64
import logging
import os
from collections import defaultdict
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from model_loader import DEFAULT_MODEL_PATH, load_model
from schemas import InferRequest, InferResponse, InferResponseItem, RawDetectionItem


LABEL_MAP = {
    "person": "人员",
    "support_structure": "支护结构",
    "cable": "电缆",
    "tube": "管道",
    "electrical_device": "电气设备",
    "indicator": "指示器",
    "mining_machine": "采掘机械",
    "door": "门",
    "rescue_equipment": "救援装备",
    "rail_track": "轨道",
    "container": "容器",
}

logger = logging.getLogger(__name__)


app = FastAPI(title="Mine Local Inference Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "mine-local-inference",
        "model_path": str(DEFAULT_MODEL_PATH),
        "model_exists": DEFAULT_MODEL_PATH.exists(),
    }


@app.post("/infer", response_model=InferResponse)
@app.post("/api/monitor-infer", response_model=InferResponse)
def infer(req: InferRequest) -> InferResponse:
    return _infer_one(req)


@app.post("/infer/batch", response_model=list[InferResponse])
@app.post("/api/monitor-infer/batch", response_model=list[InferResponse])
def infer_batch(items: list[InferRequest]) -> list[InferResponse]:
    return [_infer_one(item) for item in items]


def _infer_one(req: InferRequest) -> InferResponse:
    model_path = os.environ.get("MINE_MODEL_PATH") or str(DEFAULT_MODEL_PATH)
    try:
        model = load_model(model_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    image = _load_image(req)
    if image is None:
        raise HTTPException(status_code=400, detail="image_b64 or image_path is required")

    logger.info("YOLO request received image_path=%s image_b64=%s", _describe_image_path(req.image_path), _describe_image_b64(req.image_b64))

    results = model.predict(
        source=image,
        conf=req.conf,
        iou=req.iou,
        max_det=req.max_det,
        classes=req.classes,
        verbose=False,
    )

    detections, raw_detections = _summarize_results(results)
    predicted_class = detections[0].label_en if detections else "none"
    logger.info("YOLO inference predicted_class=%s", predicted_class)

    image_name = req.image_path or "image_b64"
    return InferResponse(
        image_name=image_name,
        model_path=model_path,
        detections=detections,
        raw_detections=raw_detections,
    )


def _load_image(req: InferRequest) -> np.ndarray | None:
    if req.image_b64:
        payload = req.image_b64.split(",", 1)[1] if "," in req.image_b64 else req.image_b64
        raw = base64.b64decode(payload)
        arr = np.frombuffer(raw, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is not None:
            return image

    if req.image_path:
        path = Path(req.image_path)
        if path.exists():
            image = cv2.imread(str(path))
            if image is not None:
                return image
        if not path.is_absolute():
            candidates = [
                Path.cwd() / path,
                Path(__file__).resolve().parent / path,
                Path(__file__).resolve().parent.parent / path,
                Path(__file__).resolve().parent.parent / "camera" / path.name,
                Path(__file__).resolve().parent.parent / "approch" / "camera" / path.name,
            ]
            for candidate in candidates:
                if candidate.exists():
                    image = cv2.imread(str(candidate))
                    if image is not None:
                        return image
    return None


def _describe_image_path(image_path: str | None) -> str:
    if not image_path:
        return "none"
    return Path(image_path).name or image_path


def _describe_image_b64(image_b64: str | None) -> str:
    if not image_b64:
        return "none"
    payload = image_b64.split(",", 1)[1] if "," in image_b64 else image_b64
    return f"len={len(payload)}"


def _summarize_results(results: list[Any]) -> tuple[list[InferResponseItem], list[RawDetectionItem]]:
    counts: dict[str, int] = defaultdict(int)
    best_conf: dict[str, float] = defaultdict(float)
    raw_items: list[RawDetectionItem] = []

    for result in results:
        names = result.names if hasattr(result, "names") else {}
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            continue
        for box in boxes:
            cls_id = int(box.cls.item()) if hasattr(box.cls, "item") else int(box.cls)
            label_en = names.get(cls_id, str(cls_id))
            label_zh = LABEL_MAP.get(label_en, label_en)
            counts[label_en] += 1
            conf = float(box.conf.item()) if hasattr(box.conf, "item") else float(box.conf)
            if conf > best_conf[label_en]:
                best_conf[label_en] = conf
            coords = box.xyxy[0].tolist() if hasattr(box, "xyxy") else []
            raw_items.append(
                RawDetectionItem(
                    label_en=label_en,
                    label_zh=label_zh,
                    confidence=round(conf, 4),
                    box=[float(v) for v in coords],
                )
            )

    items: list[InferResponseItem] = []
    for label_en, count in sorted(counts.items(), key=lambda item: item[1], reverse=True):
        items.append(
            InferResponseItem(
                label_en=label_en,
                label_zh=LABEL_MAP.get(label_en, label_en),
                count=count,
                confidence=round(best_conf[label_en], 4),
            )
        )
    return items, raw_items


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8010, reload=True)
