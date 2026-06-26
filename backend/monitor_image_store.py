from __future__ import annotations

from base64 import b64decode
from functools import lru_cache
from pathlib import Path
from typing import Optional

from fastapi import HTTPException
from fastapi.responses import FileResponse, Response


ROOT_DIR = Path(__file__).resolve().parent
IMAGE_DIR = ROOT_DIR / "monitor_images"
IMAGE_DIR.mkdir(exist_ok=True)


@lru_cache(maxsize=1)
def _build_fallback_image() -> Path:
    path = IMAGE_DIR / "fallback_monitor.png"
    if path.exists():
        return path

    # 1x1 transparent PNG
    png_bytes = b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z0r4AAAAASUVORK5CYII="
    )
    path.write_bytes(png_bytes)
    return path


@lru_cache(maxsize=1)
def _seed_monitor_images() -> list[Path]:
    existing = sorted(
        [p for p in IMAGE_DIR.iterdir() if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}],
        key=lambda p: p.name,
    )
    if existing:
        return existing

    # Create a small set of placeholder but real images, so the front-end always gets an accessible image.
    # If you later replace them with actual monitor snapshots, the API will automatically serve the new files.
    fallback = _build_fallback_image()
    for idx in range(1, 9):
        target = IMAGE_DIR / f"monitor_{idx:03d}.png"
        if not target.exists():
            target.write_bytes(fallback.read_bytes())
    return sorted(
        [p for p in IMAGE_DIR.iterdir() if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}],
        key=lambda p: p.name,
    )


def ensure_monitor_image_store_ready() -> None:
    _seed_monitor_images()


def resolve_monitor_image(monitor_id: str, frame_index: int) -> Path:
    images = _seed_monitor_images()
    if not images:
        return _build_fallback_image()
    key = f"{monitor_id}:{frame_index}"
    idx = abs(hash(key)) % len(images)
    return images[idx]


def serve_monitor_frame(monitor_id: str, frame_index: int) -> FileResponse:
    image_path = resolve_monitor_image(monitor_id, frame_index)
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="monitor image not found")
    return FileResponse(str(image_path))
