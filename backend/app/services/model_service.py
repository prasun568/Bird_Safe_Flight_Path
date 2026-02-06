"""Model metadata loading helpers."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

import joblib

from backend.app.core.config import DEFAULT_METRICS_FILE, DEFAULT_MODEL_FILE


@lru_cache(maxsize=1)
def load_model_metadata() -> Dict[str, Any]:
    metadata: Dict[str, Any] = {
        "model_path": str(DEFAULT_MODEL_FILE),
        "metrics_path": str(DEFAULT_METRICS_FILE),
        "model_available": DEFAULT_MODEL_FILE.exists(),
        "metrics_available": DEFAULT_METRICS_FILE.exists(),
    }

    if DEFAULT_METRICS_FILE.exists():
        with open(DEFAULT_METRICS_FILE, "r", encoding="utf-8") as f:
            metadata["metrics"] = json.load(f)

    if DEFAULT_MODEL_FILE.exists():
        model = joblib.load(DEFAULT_MODEL_FILE)
        metadata["model_type"] = type(model).__name__

    return metadata
