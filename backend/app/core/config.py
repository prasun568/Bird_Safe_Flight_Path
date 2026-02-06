"""Filesystem and runtime configuration for the backend."""

from __future__ import annotations

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "backend"
OUTPUTS_DIR = ROOT_DIR / "outputs"
DATA_DIR = ROOT_DIR

DEFAULT_AIRPORTS_FILE = DATA_DIR / "airports.csv"
DEFAULT_GRID_FILE = OUTPUTS_DIR / "grid_risk_scored.csv"
DEFAULT_METRICS_FILE = OUTPUTS_DIR / "model_metrics.json"
DEFAULT_MODEL_FILE = OUTPUTS_DIR / "bird_risk_xgboost.joblib"
DEFAULT_PATHFINDING_FILE = OUTPUTS_DIR / "pathfinding_structure.json"

HIGH_RISK_THRESHOLD = 0.7
DEFAULT_HIGH_RISK_THRESHOLD = HIGH_RISK_THRESHOLD
DEFAULT_RISK_WEIGHT = 8.0
DEFAULT_BETA_WEIGHT = 3.0
DEFAULT_SAFETY_PRIORITY = 1.0
DEFAULT_GRID_SIZE = 0.1
