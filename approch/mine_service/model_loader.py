from __future__ import annotations

import os
import sys
import types
from functools import lru_cache
from pathlib import Path
from typing import Any

from ultralytics import YOLO


ROOT_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = ROOT_DIR.parent / "yolo11n.pt"
DEFAULT_MODEL_NAME = os.environ.get("MINE_MODEL_NAME", "yolo11n.pt")


def _register_ultralytics_compat_modules() -> None:
    """Register legacy module aliases expected by some YOLO checkpoints."""
    try:
        import ultralytics.nn.tasks as tasks
        import ultralytics.nn as nn_pkg
    except Exception:
        return

    extraction_pkg = sys.modules.get('ultralytics.nn.extraction')
    if extraction_pkg is None:
        extraction_pkg = types.ModuleType('ultralytics.nn.extraction')
        extraction_pkg.__path__ = []  # type: ignore[attr-defined]
        sys.modules['ultralytics.nn.extraction'] = extraction_pkg

    c2psa_pkg = sys.modules.get('ultralytics.nn.extraction.c2psa_variants')
    if c2psa_pkg is None:
        c2psa_pkg = types.ModuleType('ultralytics.nn.extraction.c2psa_variants')
        c2psa_pkg.__package__ = 'ultralytics.nn.extraction'
        sys.modules['ultralytics.nn.extraction.c2psa_variants'] = c2psa_pkg

    sys.modules.setdefault('ultralytics.nn.extraction.tasks', tasks)

    if not hasattr(extraction_pkg, 'tasks'):
        setattr(extraction_pkg, 'tasks', tasks)
    if not hasattr(extraction_pkg, 'c2psa_variants'):
        setattr(extraction_pkg, 'c2psa_variants', c2psa_pkg)
    if not hasattr(nn_pkg, 'extraction'):
        setattr(nn_pkg, 'extraction', extraction_pkg)

    # Older checkpoints may import custom blocks from this legacy namespace.
    # Re-export the current Ultralytics task symbols so unpickling can resolve them.
    legacy_symbols = {
        name: getattr(tasks, name)
        for name in dir(tasks)
        if not name.startswith('_')
    }
    for name, value in legacy_symbols.items():
        if not hasattr(extraction_pkg, name):
            setattr(extraction_pkg, name, value)
        if not hasattr(c2psa_pkg, name):
            setattr(c2psa_pkg, name, value)


@lru_cache(maxsize=1)
def load_model(model_path: str | Path | None = None) -> Any:
    candidate = Path(model_path) if model_path else DEFAULT_MODEL_PATH
    if candidate.exists():
        _register_ultralytics_compat_modules()
        return YOLO(str(candidate))

    _register_ultralytics_compat_modules()
    return YOLO(DEFAULT_MODEL_NAME)
