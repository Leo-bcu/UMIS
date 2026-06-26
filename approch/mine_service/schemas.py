from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class InferResponseItem(BaseModel):
    label_en: str
    label_zh: str
    count: int = Field(ge=0)
    confidence: float = Field(ge=0.0, le=1.0)


class RawDetectionItem(BaseModel):
    label_en: str
    label_zh: str
    confidence: float = Field(ge=0.0, le=1.0)
    box: list[float]


class InferRequest(BaseModel):
    image_b64: Optional[str] = None
    image_path: Optional[str] = None
    conf: float = 0.25
    iou: float = 0.45
    max_det: int = 300
    classes: Optional[List[int]] = None


class InferResponse(BaseModel):
    image_name: str
    model_path: str
    detections: List[InferResponseItem]
    raw_detections: List[RawDetectionItem] = []
