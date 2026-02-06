"""
Bird-Safe Flight Path Predictor pipeline.

Implements:
1) Data loading and cleaning
2) Spatial grid creation
3) Aggregation and merging
4) Target creation
5) Model training and evaluation
6) Risk probability generation
7) Model persistence
8) Pathfinding-ready structure (without A* implementation)
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier


# ------------------------------
# Config and utility structures
# ------------------------------


@dataclass
class PipelineConfig:
    strike_path: Path
    occurrence_path: Path
    weather_path: Path
    weather_locations_path: Optional[Path]
    airports_path: Path
    output_dir: Path
    grid_size: float = 0.1
    risk_threshold: Optional[float] = None
    random_state: int = 42
    test_size: float = 0.2
    risk_weight: float = 10.0
    occurrence_chunksize: int = 750_000
    occurrence_max_rows: Optional[int] = None


AIRPORTS_NO_HEADER_COLUMNS = [
    "airport_id",
    "airport_name",
    "city",
    "country",
    "iata",
    "icao",
    "latitude",
    "longitude",
    "altitude_ft",
    "timezone_offset",
    "dst",
    "tz_database",
    "airport_type",
    "source",
]


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names to lowercase snake-like names."""
    df = df.copy()
    df.columns = (
        df.columns.astype(str)
        .str.strip()
        .str.lower()
        .str.replace(" ", "_", regex=False)
        .str.replace("-", "_", regex=False)
        .str.replace("?", "", regex=False)
    )
    return df


def first_existing(columns: Iterable[str], candidates: Iterable[str]) -> Optional[str]:
    colset = set(columns)
    for cand in candidates:
        if cand in colset:
            return cand
    return None


def coerce_numeric(df: pd.DataFrame, cols: Iterable[str]) -> pd.DataFrame:
    for c in cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def robust_read_csv(path: Path) -> pd.DataFrame:
    """Read CSV/TSV with fallbacks for malformed real-world files."""
    attempts = [
        {"sep": ",", "engine": "c", "low_memory": False},
        {"sep": "\t", "engine": "c", "low_memory": False},
        {"sep": None, "engine": "python", "on_bad_lines": "skip"},
        {"sep": "\t", "engine": "python", "on_bad_lines": "skip"},
    ]

    last_error: Optional[Exception] = None
    for kwargs in attempts:
        try:
            df = pd.read_csv(path, **kwargs)
            if df.shape[1] >= 2:
                return df
        except Exception as exc:
            last_error = exc
            continue

    if last_error:
        raise last_error
    raise ValueError(f"Unable to parse file: {path}")


def safe_month_from_date(df: pd.DataFrame, date_col: Optional[str]) -> pd.DataFrame:
    if date_col is None:
        df["month"] = np.nan
        return df
    df["date"] = pd.to_datetime(df[date_col], errors="coerce")
    df["month"] = df["date"].dt.month
    return df


def add_grid_columns(df: pd.DataFrame, grid_size: float = 0.1) -> pd.DataFrame:
    out = df.copy()
    out["grid_lat"] = np.round(out["latitude"] / grid_size) * grid_size
    out["grid_lon"] = np.round(out["longitude"] / grid_size) * grid_size

    # Stable string formatting at requested 0.1 degree granularity.
    out["grid_id"] = out["grid_lat"].map(lambda x: f"{x:.1f}") + "_" + out["grid_lon"].map(
        lambda x: f"{x:.1f}"
    )
    return out


def parse_airports(airports_path: Path) -> pd.DataFrame:
    """Load airports as headerless (ourairports-style export) with fallback to headered CSV."""
    try:
        df = pd.read_csv(
            airports_path,
            header=None,
            names=AIRPORTS_NO_HEADER_COLUMNS,
            low_memory=False,
        )
        if "latitude" not in df.columns or "longitude" not in df.columns:
            raise ValueError("Latitude/longitude columns missing in parsed airports CSV")
    except Exception:
        df = pd.read_csv(airports_path, low_memory=False)
        df = normalize_columns(df)
        name_col = first_existing(df.columns, ["airport_name", "name"])
        lat_col = first_existing(df.columns, ["latitude", "lat", "decimallatitude"])
        lon_col = first_existing(df.columns, ["longitude", "lon", "lng", "decimallongitude"])

        if name_col is None or lat_col is None or lon_col is None:
            raise ValueError("Unable to infer airport_name/latitude/longitude columns in airports file")

        df = df.rename(
            columns={
                name_col: "airport_name",
                lat_col: "latitude",
                lon_col: "longitude",
            }
        )

    df = normalize_columns(df)
    df = coerce_numeric(df, ["latitude", "longitude"])
    df = df.dropna(subset=["latitude", "longitude"])
    if "airport_name" in df.columns:
        df["airport_name_key"] = df["airport_name"].astype(str).str.strip().str.lower()
    return df


# ------------------------------
# Step 1: Data loading & cleaning
# ------------------------------


def load_and_clean_occurrence(path: Path) -> pd.DataFrame:
    # For smaller files, load directly.
    try:
        df = pd.read_csv(
            path,
            sep="\t",
            usecols=["decimalLatitude", "decimalLongitude", "eventDate"],
            engine="python",
            on_bad_lines="skip",
        )
    except Exception:
        df = robust_read_csv(path)
    df = normalize_columns(df)

    lat_col = first_existing(df.columns, ["latitude", "decimallatitude", "lat"])
    lon_col = first_existing(df.columns, ["longitude", "decimallongitude", "lon", "lng"])
    date_col = first_existing(df.columns, ["observation_date", "eventdate", "date"])

    if lat_col is None or lon_col is None:
        raise ValueError("Bird occurrence dataset must contain latitude and longitude columns")

    df = df.rename(columns={lat_col: "latitude", lon_col: "longitude"})
    df = coerce_numeric(df, ["latitude", "longitude"])
    df = safe_month_from_date(df, date_col)
    df = df.dropna(subset=["latitude", "longitude"])
    return df


def load_and_clean_strikes(path: Path, airports_df: pd.DataFrame) -> pd.DataFrame:
    """
    Load strike data and attempt to recover coordinates.

    Preferred: direct latitude/longitude columns.
    Fallback: map strike AirportName -> airports airport_name.
    """
    df = robust_read_csv(path)
    df = normalize_columns(df)

    lat_col = first_existing(df.columns, ["latitude", "lat"])
    lon_col = first_existing(df.columns, ["longitude", "lon", "lng"])
    date_col = first_existing(df.columns, ["date", "flightdate", "event_date"])

    if lat_col is not None and lon_col is not None:
        df = df.rename(columns={lat_col: "latitude", lon_col: "longitude"})
    else:
        airport_name_col = first_existing(df.columns, ["airportname", "airport_name"])
        if airport_name_col is None:
            raise ValueError(
                "Bird strike dataset has no latitude/longitude and no airport name for coordinate mapping"
            )

        strikes = df[[airport_name_col] + ([date_col] if date_col else [])].copy()
        strikes["airport_name_key"] = strikes[airport_name_col].astype(str).str.strip().str.lower()

        mapped = strikes.merge(
            airports_df[["airport_name_key", "latitude", "longitude"]],
            on="airport_name_key",
            how="left",
        )

        df = mapped

    df = coerce_numeric(df, ["latitude", "longitude"])
    df = safe_month_from_date(df, date_col)
    df = df.dropna(subset=["latitude", "longitude"])
    return df


def load_and_clean_weather(path: Path) -> pd.DataFrame:
    """
    Load weather data with schema adaptation.

    Preferred columns:
    - latitude, longitude, date, temperature, wind_speed, visibility

    Supported fallback (example historical weather schema):
    - Year, Month, Day, t_mean_c (as temperature)
    - missing wind_speed/visibility are created as NaN
    """
    df = robust_read_csv(path)
    df = normalize_columns(df)

    lat_col = first_existing(df.columns, ["latitude", "lat", "decimallatitude"])
    lon_col = first_existing(df.columns, ["longitude", "lon", "lng", "decimallongitude"])

    if lat_col is not None and lon_col is not None:
        df = df.rename(columns={lat_col: "latitude", lon_col: "longitude"})
    else:
        # Fallback strategy when file has one weather station and no explicit coords.
        # Assign a neutral default centered near Kyiv if coordinates are unavailable.
        df["latitude"] = 50.45
        df["longitude"] = 30.52

    temp_col = first_existing(df.columns, ["temperature", "temp", "t_mean_c", "tmax", "t_max_c"])
    wind_col = first_existing(df.columns, ["wind_speed", "windspeed", "wind"])
    vis_col = first_existing(df.columns, ["visibility", "vis"])

    if temp_col is not None:
        df = df.rename(columns={temp_col: "temperature"})
    else:
        df["temperature"] = np.nan

    if wind_col is not None:
        df = df.rename(columns={wind_col: "wind_speed"})
    else:
        df["wind_speed"] = np.nan

    if vis_col is not None:
        df = df.rename(columns={vis_col: "visibility"})
    else:
        df["visibility"] = np.nan

    date_col = first_existing(df.columns, ["date", "observation_date", "eventdate"])
    if date_col is None and all(c in df.columns for c in ["year", "month", "day"]):
        df["date"] = pd.to_datetime(
            df[["year", "month", "day"]].rename(
                columns={"year": "year", "month": "month", "day": "day"}
            ),
            errors="coerce",
        )
    else:
        df["date"] = pd.to_datetime(df[date_col], errors="coerce") if date_col else pd.NaT

    df["month"] = df["date"].dt.month

    df = coerce_numeric(df, ["latitude", "longitude", "temperature", "wind_speed", "visibility"])
    df = df.dropna(subset=["latitude", "longitude"])
    return df


# ------------------------------
# Step 2 and 3: Grid + aggregation
# ------------------------------


def aggregate_occurrence_by_grid_month(
    path: Path,
    grid_size: float,
    chunksize: int,
    max_rows: Optional[int] = None,
) -> Tuple[pd.DataFrame, int]:
    """Chunked aggregation for large occurrence files."""
    total_rows = 0
    accumulated: Dict[Tuple[str, int], int] = {}

    try:
        reader = pd.read_csv(
            path,
            sep="\t",
            usecols=["decimalLatitude", "decimalLongitude", "eventDate"],
            engine="c",
            on_bad_lines="skip",
            chunksize=chunksize,
        )
        use_rename = True
    except Exception:
        # Fallback for alternate schemas.
        full = load_and_clean_occurrence(path)
        full = add_grid_columns(full, grid_size=grid_size)
        bird_agg = (
            full.groupby(["grid_id", "month"], dropna=False)
            .size()
            .reset_index(name="bird_density")
        )
        return bird_agg, int(len(full))

    for chunk in reader:
        chunk = normalize_columns(chunk)
        if use_rename:
            chunk = chunk.rename(
                columns={
                    "decimallatitude": "latitude",
                    "decimallongitude": "longitude",
                    "eventdate": "date",
                }
            )

        chunk = coerce_numeric(chunk, ["latitude", "longitude"])
        chunk["date"] = pd.to_datetime(chunk["date"], errors="coerce")
        chunk["month"] = chunk["date"].dt.month
        chunk = chunk.dropna(subset=["latitude", "longitude", "month"])

        if max_rows is not None and total_rows >= max_rows:
            break
        if max_rows is not None and total_rows + len(chunk) > max_rows:
            keep_n = max_rows - total_rows
            if keep_n <= 0:
                break
            chunk = chunk.iloc[:keep_n].copy()

        total_rows += len(chunk)

        chunk = add_grid_columns(chunk, grid_size=grid_size)
        counts = chunk.groupby(["grid_id", "month"], dropna=False).size()
        for (grid_id, month), count in counts.items():
            key = (str(grid_id), int(month))
            accumulated[key] = accumulated.get(key, 0) + int(count)

    bird_agg = pd.DataFrame(
        [
            {"grid_id": gid, "month": month, "bird_density": density}
            for (gid, month), density in accumulated.items()
        ]
    )

    if bird_agg.empty:
        bird_agg = pd.DataFrame(columns=["grid_id", "month", "bird_density"])

    return bird_agg, total_rows


def aggregate_strike_by_grid_month(strike_df: pd.DataFrame, grid_size: float) -> pd.DataFrame:
    strike_grid = add_grid_columns(strike_df, grid_size=grid_size)
    return (
        strike_grid.groupby(["grid_id", "month"], dropna=False)
        .size()
        .reset_index(name="strike_density")
    )


def aggregate_weather_by_grid_month(weather_df: pd.DataFrame, grid_size: float) -> pd.DataFrame:
    weather_grid = add_grid_columns(weather_df, grid_size=grid_size)
    return (
        weather_grid.groupby(["grid_id", "month"], dropna=False)
        .agg(
            temperature=("temperature", "mean"),
            wind_speed=("wind_speed", "mean"),
            visibility=("visibility", "mean"),
        )
        .reset_index()
    )


def merge_aggregates(
    bird_agg: pd.DataFrame,
    strike_agg: pd.DataFrame,
    weather_agg: pd.DataFrame,
) -> pd.DataFrame:
    merged = bird_agg.merge(strike_agg, on=["grid_id", "month"], how="outer")
    merged = merged.merge(weather_agg, on=["grid_id", "month"], how="left")

    merged["bird_density"] = merged["bird_density"].fillna(0)
    merged["strike_density"] = merged["strike_density"].fillna(0)

    for col in ["temperature", "wind_speed", "visibility"]:
        merged[col] = pd.to_numeric(merged[col], errors="coerce")
        if merged[col].isna().all():
            merged[col] = 0.0
        else:
            merged[col] = merged[col].fillna(merged[col].median())

    merged["month"] = pd.to_numeric(merged["month"], errors="coerce").fillna(0).astype(int)
    return merged


# ------------------------------
# Step 4: target creation
# ------------------------------


def add_targets(df: pd.DataFrame, risk_threshold: Optional[float]) -> pd.DataFrame:
    out = df.copy()

    if risk_threshold is None:
        # If strikes are sparse, any positive count is risky.
        risk_threshold = 0.0

    out["risk"] = (out["strike_density"] > risk_threshold).astype(int)

    smin = out["strike_density"].min()
    smax = out["strike_density"].max()
    if smax == smin:
        out["strike_risk_score"] = 0.0
    else:
        out["strike_risk_score"] = (out["strike_density"] - smin) / (smax - smin)

    return out


# ------------------------------
# Step 5 and 6: model training
# ------------------------------


def train_risk_model(
    df: pd.DataFrame,
    random_state: int = 42,
    test_size: float = 0.2,
) -> Tuple[XGBClassifier, Dict[str, object], pd.DataFrame]:
    enriched = df.copy()
    enriched["sin_month"] = np.sin(2 * np.pi * enriched["month"] / 12.0)
    enriched["cos_month"] = np.cos(2 * np.pi * enriched["month"] / 12.0)

    features = [
        "bird_density",
        "strike_density",
        "temperature",
        "wind_speed",
        "visibility",
        "sin_month",
        "cos_month",
    ]
    X = enriched[features]
    y = enriched["risk"]

    can_stratify = y.nunique() > 1 and y.value_counts().min() > 1

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y if can_stratify else None,
    )

    model = XGBClassifier(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        random_state=random_state,
        objective="binary:logistic",
        eval_metric="logloss",
        n_jobs=-1,
        tree_method="hist",
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    roc_auc = float("nan")
    if y_test.nunique() > 1:
        roc_auc = float(roc_auc_score(y_test, y_proba))

    eval_payload: Dict[str, object] = {
        "model": "xgboost_xgbclassifier",
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "roc_auc": roc_auc,
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "classification_report": classification_report(y_test, y_pred, zero_division=0),
        "feature_importance": {
            feat: float(imp) for feat, imp in zip(features, model.feature_importances_)
        },
    }

    scored = enriched.copy()
    scored["risk_score"] = model.predict_proba(X)[:, 1]
    scored["predicted_risk_probability"] = scored["risk_score"]

    return model, eval_payload, scored


# ------------------------------
# Step 8: pathfinding prep
# ------------------------------


def parse_grid_id_to_lat_lon(grid_id: str) -> Tuple[float, float]:
    lat_s, lon_s = grid_id.split("_", maxsplit=1)
    return float(lat_s), float(lon_s)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlmb = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return 2 * r * np.arctan2(np.sqrt(a), np.sqrt(1 - a))


def nearest_grid_id(lat: float, lon: float, grid_centers: pd.DataFrame) -> Optional[str]:
    if grid_centers.empty:
        return None
    dists = np.sqrt((grid_centers["grid_lat"] - lat) ** 2 + (grid_centers["grid_lon"] - lon) ** 2)
    idx = int(dists.idxmin())
    return str(grid_centers.loc[idx, "grid_id"])


def build_pathfinding_structure(
    risk_scored_df: pd.DataFrame,
    airports_df: pd.DataFrame,
    risk_weight: float,
) -> Dict[str, object]:
    """
    Build graph-ready structures:
    - nodes with risk_score
    - airport -> nearest grid mapping
    - edge cost function for future A* integration
    """
    grid_centers = risk_scored_df[["grid_id"]].drop_duplicates().copy()
    grid_centers[["grid_lat", "grid_lon"]] = grid_centers["grid_id"].apply(
        lambda gid: pd.Series(parse_grid_id_to_lat_lon(gid))
    )

    weather_df = risk_scored_df.copy()
    for col in ["temperature", "wind_speed", "visibility"]:
        weather_df[col] = pd.to_numeric(weather_df[col], errors="coerce")
        if weather_df[col].isna().all():
            weather_df[col] = 0.0
        else:
            weather_df[col] = weather_df[col].fillna(weather_df[col].median())

    wind_norm = (weather_df["wind_speed"] - weather_df["wind_speed"].min()) / (
        (weather_df["wind_speed"].max() - weather_df["wind_speed"].min()) + 1e-9
    )
    vis_norm = (weather_df["visibility"] - weather_df["visibility"].min()) / (
        (weather_df["visibility"].max() - weather_df["visibility"].min()) + 1e-9
    )
    temp_norm = (weather_df["temperature"] - weather_df["temperature"].min()) / (
        (weather_df["temperature"].max() - weather_df["temperature"].min()) + 1e-9
    )
    weather_df["weather_penalty"] = 0.4 * wind_norm + 0.4 * (1.0 - vis_norm) + 0.2 * temp_norm

    nodes = (
        weather_df.groupby("grid_id", as_index=False)
        .agg(
            grid_lat=("grid_id", lambda x: parse_grid_id_to_lat_lon(x.iloc[0])[0]),
            grid_lon=("grid_id", lambda x: parse_grid_id_to_lat_lon(x.iloc[0])[1]),
            risk_score=("risk_score", "mean"),
            weather_penalty=("weather_penalty", "mean"),
        )
        .to_dict(orient="records")
    )

    airport_maps: List[Dict[str, object]] = []
    for _, row in airports_df.iterrows():
        airport_name = row.get("airport_name")
        lat = row.get("latitude")
        lon = row.get("longitude")
        if pd.isna(lat) or pd.isna(lon):
            continue
        node_id = nearest_grid_id(float(lat), float(lon), grid_centers)
        airport_maps.append(
            {
                "airport_name": airport_name,
                "latitude": float(lat),
                "longitude": float(lon),
                "nearest_grid_id": node_id,
            }
        )

    return {
        "nodes": nodes,
        "airport_node_map": airport_maps,
        "cost_function": {
            "formula": "cost = distance + alpha*risk_score + beta*weather_penalty",
            "alpha": risk_weight,
            "beta": 3.0,
            "example": {
                "distance": 125.0,
                "risk_score": 0.35,
                "weather_penalty": 0.4,
                "alpha": risk_weight,
                "beta": 3.0,
                "cost": 125.0 + (0.35 * risk_weight) + (0.4 * 3.0),
            },
        },
        "notes": "Use this structure as input for a future A* implementation.",
    }


# ------------------------------
# Orchestration
# ------------------------------


def run_pipeline(config: PipelineConfig) -> Dict[str, object]:
    config.output_dir.mkdir(parents=True, exist_ok=True)

    airports_df = parse_airports(config.airports_path)
    strike_df = load_and_clean_strikes(config.strike_path, airports_df)
    weather_df = load_and_clean_weather(config.weather_path)

    bird_agg, occurrence_rows = aggregate_occurrence_by_grid_month(
        path=config.occurrence_path,
        grid_size=config.grid_size,
        chunksize=config.occurrence_chunksize,
        max_rows=config.occurrence_max_rows,
    )
    strike_agg = aggregate_strike_by_grid_month(strike_df, grid_size=config.grid_size)
    weather_agg = aggregate_weather_by_grid_month(weather_df, grid_size=config.grid_size)

    merged = merge_aggregates(
        bird_agg=bird_agg,
        strike_agg=strike_agg,
        weather_agg=weather_agg,
    )

    target_df = add_targets(merged, risk_threshold=config.risk_threshold)

    model, metrics, scored = train_risk_model(
        target_df,
        random_state=config.random_state,
        test_size=config.test_size,
    )

    pathfinding_struct = build_pathfinding_structure(
        risk_scored_df=scored,
        airports_df=airports_df,
        risk_weight=config.risk_weight,
    )

    merged_path = config.output_dir / "grid_risk_dataset.csv"
    scored_path = config.output_dir / "grid_risk_scored.csv"
    model_path = config.output_dir / "bird_risk_xgboost.joblib"
    metrics_path = config.output_dir / "model_metrics.json"
    path_struct_path = config.output_dir / "pathfinding_structure.json"

    target_df.to_csv(merged_path, index=False)
    scored.to_csv(scored_path, index=False)
    joblib.dump(model, model_path)

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    with open(path_struct_path, "w", encoding="utf-8") as f:
        json.dump(pathfinding_struct, f, indent=2)

    return {
        "merged_dataset": str(merged_path),
        "scored_dataset": str(scored_path),
        "model_path": str(model_path),
        "metrics_path": str(metrics_path),
        "pathfinding_structure": str(path_struct_path),
        "metrics": metrics,
        "row_counts": {
            "occurrence_rows": int(occurrence_rows),
            "strike_rows": int(len(strike_df)),
            "weather_rows": int(len(weather_df)),
            "grid_rows": int(len(target_df)),
        },
    }


def build_default_config(workspace: Path) -> PipelineConfig:
    return PipelineConfig(
        strike_path=workspace / "Bird Strike Dataset" / "Bird_strikes.csv",
        occurrence_path=workspace
        / "Bird Occurrence Dataset"
        / "0086343-230224095556074"
        / "0086343-230224095556074.csv",
        weather_path=workspace / "Weather Dataset" / "kyiv-ukraine.csv",
        weather_locations_path=workspace / "Weather Dataset" / "locations.csv",
        airports_path=workspace / "airports.csv",
        output_dir=workspace / "outputs",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bird-safe flight path risk pipeline")
    parser.add_argument("--workspace", type=str, default=".", help="Workspace root path")
    parser.add_argument("--grid-size", type=float, default=0.1, help="Grid size in degrees")
    parser.add_argument(
        "--risk-threshold",
        type=float,
        default=None,
        help="Strike density threshold for binary risk; default uses >0",
    )
    parser.add_argument("--risk-weight", type=float, default=10.0, help="Risk weight for cost function")
    parser.add_argument("--test-size", type=float, default=0.2, help="Test split fraction")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed")
    parser.add_argument(
        "--occurrence-max-rows",
        type=int,
        default=None,
        help="Optional cap on occurrence rows for faster runs on very large files",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    workspace = Path(args.workspace).resolve()

    cfg = build_default_config(workspace)
    cfg.grid_size = args.grid_size
    cfg.risk_threshold = args.risk_threshold
    cfg.risk_weight = args.risk_weight
    cfg.test_size = args.test_size
    cfg.random_state = args.random_state
    cfg.occurrence_max_rows = args.occurrence_max_rows

    results = run_pipeline(cfg)

    print("Pipeline complete.")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
