"""
Mine.pt 摄像头画面随机抽样推理脚本。

功能：
1. 从 `camera/` 目录中随机抽取图片
2. 使用 `Mine.pt` 进行 YOLO 推理
3. 仅保留 dataset.yaml 中定义的 11 类
4. 将当前帧、上一帧、历史帧结果保存为 JSON

依赖：
- ultralytics
- opencv-python
- pyyaml

用法示例：
    python mine_camera_infer.py \
        --weights /Users/leo/Downloads/UMIS/approch/Mine.pt \
        --camera-dir /Users/leo/Downloads/UMIS/approch/camera \
        --dataset-yaml /Users/leo/Downloads/UMIS/approch/dataset.yaml \
        --output /Users/leo/Downloads/UMIS/approch/monitor_frames.json
"""

from __future__ import annotations

import argparse
import json
import random
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Sequence

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit("缺少依赖 pyyaml，请先安装: pip install pyyaml") from exc

try:
    from ultralytics import YOLO
except ImportError as exc:  # pragma: no cover
    raise SystemExit("缺少依赖 ultralytics，请先安装: pip install ultralytics") from exc

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

CLASS_MAP_ZH = {
    "support_structure": "支护结构",
    "cable": "电缆",
    "tube": "管路",
    "electrical_device": "电气设备",
    "indicator": "指示装置",
    "mining_machine": "采掘机械",
    "door": "门",
    "rescue_equipment": "救援装备",
    "person": "人员",
    "rail_track": "轨道",
    "container": "容器",
}


@dataclass
class DetectionItem:
    label_en: str
    label_zh: str
    confidence: float
    box: List[float]


@dataclass
class FrameResult:
    index: int
    image_path: str
    recognized_labels: List[str]
    detections: List[DetectionItem]


@dataclass
class MonitorResult:
    monitor_id: str
    related_coal_structure_id: str
    current_frame: FrameResult
    previous_frames: List[FrameResult]


def load_dataset_classes(dataset_yaml: Path) -> List[str]:
    data = yaml.safe_load(dataset_yaml.read_text(encoding="utf-8"))
    names = data.get("names", {})
    if isinstance(names, dict):
        ordered = [names[k] for k in sorted(names.keys(), key=lambda x: int(x))]
    else:
        ordered = list(names)
    return [str(name) for name in ordered]


def list_images(camera_dir: Path) -> List[Path]:
    images = [p for p in camera_dir.rglob("*") if p.suffix.lower() in IMAGE_EXTS and p.is_file()]
    return sorted(images)


def sample_images(images: Sequence[Path], count: int) -> List[Path]:
    if not images:
        raise SystemExit("camera 目录下没有可用图片")
    if count >= len(images):
        shuffled = list(images)
        random.shuffle(shuffled)
        return shuffled
    return random.sample(list(images), count)


def infer_image(model: YOLO, image_path: Path, allowed_classes: set[str]) -> FrameResult:
    results = model.predict(source=str(image_path), verbose=False)
    detections: List[DetectionItem] = []
    recognized_labels: List[str] = []

    for result in results:
        if result.boxes is None:
            continue
        for box in result.boxes:
            cls_id = int(box.cls.item()) if box.cls is not None else -1
            conf = float(box.conf.item()) if box.conf is not None else 0.0
            label_en = model.names.get(cls_id, str(cls_id))
            if label_en not in allowed_classes:
                continue
            label_zh = CLASS_MAP_ZH.get(label_en, label_en)
            detections.append(
                DetectionItem(
                    label_en=label_en,
                    label_zh=label_zh,
                    confidence=round(conf, 4),
                    box=[round(float(v), 2) for v in box.xyxy[0].tolist()],
                )
            )
            if label_zh not in recognized_labels:
                recognized_labels.append(label_zh)

    return FrameResult(
        index=1,
        image_path=str(image_path),
        recognized_labels=recognized_labels,
        detections=detections,
    )


def build_monitor_results(
    model: YOLO,
    images: Sequence[Path],
    monitor_ids: Sequence[str],
    related_structures: Sequence[str],
    history_size: int = 4,
) -> List[MonitorResult]:
    picked = sample_images(images, len(monitor_ids) * history_size)
    allowed_classes = set(CLASS_MAP_ZH.keys())
    results: List[MonitorResult] = []

    for idx, monitor_id in enumerate(monitor_ids):
        frame_paths = picked[idx * history_size : (idx + 1) * history_size]
        frame_results: List[FrameResult] = []
        for i, frame_path in enumerate(frame_paths):
            frame = infer_image(model, frame_path, allowed_classes)
            frame.index = i + 1
            frame_results.append(frame)

        results.append(
            MonitorResult(
                monitor_id=monitor_id,
                related_coal_structure_id=related_structures[idx % len(related_structures)],
                current_frame=frame_results[0],
                previous_frames=frame_results[1:],
            )
        )
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", required=True, type=Path)
    parser.add_argument("--camera-dir", required=True, type=Path)
    parser.add_argument("--dataset-yaml", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--monitor-count", type=int, default=5)
    parser.add_argument("--history-size", type=int, default=4)
    args = parser.parse_args()

    if not args.weights.exists():
        raise SystemExit(f"模型文件不存在: {args.weights}")
    if not args.dataset_yaml.exists():
        raise SystemExit(f"dataset.yaml 不存在: {args.dataset_yaml}")
    if not args.camera_dir.exists():
        raise SystemExit(f"camera 目录不存在: {args.camera_dir}")

    dataset_classes = load_dataset_classes(args.dataset_yaml)
    missing = [name for name in dataset_classes if name not in CLASS_MAP_ZH]
    if missing:
        raise SystemExit(f"发现未映射类别: {missing}")

    images = list_images(args.camera_dir)
    if not images:
        raise SystemExit("camera 目录下没有可用图片")

    model = YOLO(str(args.weights))
    monitor_ids = [f"J-{i + 1:03d}" for i in range(args.monitor_count)]
    related_structures = [f"G-00{i}" for i in range(5)]
    monitor_results = build_monitor_results(
        model=model,
        images=images,
        monitor_ids=monitor_ids,
        related_structures=related_structures,
        history_size=args.history_size,
    )

    payload: Dict[str, Any] = {
        "model": str(args.weights),
        "dataset_yaml": str(args.dataset_yaml),
        "camera_dir": str(args.camera_dir),
        "monitor_results": [
            {
                "monitor_id": item.monitor_id,
                "related_coal_structure_id": item.related_coal_structure_id,
                "current_frame": asdict(item.current_frame),
                "previous_frames": [asdict(frame) for frame in item.previous_frames],
            }
            for item in monitor_results
        ],
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入: {args.output}")


if __name__ == "__main__":
    main()
