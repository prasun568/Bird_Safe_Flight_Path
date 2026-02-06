"""Route computation and dataset access service."""

from __future__ import annotations

import math
from functools import lru_cache
from typing import Dict, List, Optional

import pandas as pd

from backend.app.core.config import (
    DEFAULT_AIRPORTS_FILE,
    DEFAULT_BETA_WEIGHT,
    DEFAULT_GRID_FILE,
    DEFAULT_GRID_SIZE,
    DEFAULT_HIGH_RISK_THRESHOLD,
    DEFAULT_RISK_WEIGHT,
    DEFAULT_SAFETY_PRIORITY,
)
from backend.app.services.model_service import load_model_metadata
from bird_safe_pathfinding import (
    GridRiskGraph,
    get_airport_coordinates,
    load_grid_risk_data,
    nearest_grid_node,
    parse_airports,
    path_risk_summary,
    path_to_points,
    run_pathfinder,
)


@lru_cache(maxsize=1)
def _load_airports_df() -> pd.DataFrame:
    return parse_airports(DEFAULT_AIRPORTS_FILE)


@lru_cache(maxsize=1)
def _load_nodes() -> Dict[str, object]:
    return load_grid_risk_data(DEFAULT_GRID_FILE)


@lru_cache(maxsize=1)
def _load_graph() -> GridRiskGraph:
    nodes = _load_nodes()
    return GridRiskGraph(nodes=nodes, grid_size=DEFAULT_GRID_SIZE)


@lru_cache(maxsize=1)
def _load_grid_frame() -> pd.DataFrame:
    df = pd.read_csv(DEFAULT_GRID_FILE, low_memory=False)
    if "latitude" not in df.columns or "longitude" not in df.columns:
        coords = df["grid_id"].astype(str).str.split("_", n=1, expand=True)
        df["latitude"] = pd.to_numeric(coords[0], errors="coerce")
        df["longitude"] = pd.to_numeric(coords[1], errors="coerce")
    return df


class RouteService:
    def __init__(self) -> None:
        self.airports_df = _load_airports_df()
        self.nodes = _load_nodes()
        self.graph = _load_graph()
        self.grid_df = _load_grid_frame()
        self.model_metadata = load_model_metadata()

    def list_airports(self) -> List[Dict[str, object]]:
        airports = self.airports_df[["airport_name", "city", "latitude", "longitude"]].copy()
        airports = airports.dropna(subset=["airport_name", "latitude", "longitude"])
        airports = airports.sort_values("airport_name")

        records: List[Dict[str, object]] = []
        for row in airports.itertuples(index=False):
            city = None if pd.isna(row.city) else str(row.city)
            records.append(
                {
                    "airport_name": str(row.airport_name),
                    "city": city,
                    "latitude": float(row.latitude),
                    "longitude": float(row.longitude),
                }
            )

        return records

    def heatmap_points(self) -> List[Dict[str, object]]:
        df = self.grid_df.copy()
        if "risk_score" not in df.columns and "predicted_risk_probability" in df.columns:
            df["risk_score"] = df["predicted_risk_probability"]
        if "risk_score" not in df.columns:
            df["risk_score"] = 0.0
        if "latitude" not in df.columns or "longitude" not in df.columns:
            coords = df["grid_id"].astype(str).str.split("_", n=1, expand=True)
            df["latitude"] = pd.to_numeric(coords[0], errors="coerce")
            df["longitude"] = pd.to_numeric(coords[1], errors="coerce")

        df = df[["grid_id", "latitude", "longitude", "risk_score"]].dropna()
        return df.to_dict(orient="records")

    @staticmethod
    def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        r = 6371.0
        p1 = math.radians(lat1)
        p2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlmb = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
        return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def compute_route(
        self,
        source_airport: str,
        destination_airport: str,
        risk_weight: float = DEFAULT_RISK_WEIGHT,
        beta_weight: float = DEFAULT_BETA_WEIGHT,
        safety_priority: float = DEFAULT_SAFETY_PRIORITY,
        algorithm: str = "theta",
    ) -> Dict[str, object]:
        start_name, s_lat, s_lon = get_airport_coordinates(self.airports_df, source_airport)
        end_name, e_lat, e_lon = get_airport_coordinates(self.airports_df, destination_airport)

        start_grid = nearest_grid_node(self.nodes, s_lat, s_lon)
        end_grid = nearest_grid_node(self.nodes, e_lat, e_lon)

        effective_risk_weight = risk_weight * safety_priority
        effective_beta_weight = beta_weight * safety_priority

        path_ids, total_cost = run_pathfinder(
            graph=self.graph,
            start_grid=start_grid,
            end_grid=end_grid,
            algorithm=algorithm,
            alpha=effective_risk_weight,
            beta=effective_beta_weight,
            distance_weight=1.0,
        )

        points = path_to_points(self.nodes, path_ids)
        path_risk = path_risk_summary(self.nodes, path_ids)
        total_distance = 0.0
        for index in range(1, len(points)):
            total_distance += self._haversine_km(
                points[index - 1][0], points[index - 1][1], points[index][0], points[index][1]
            )

        high_risk_zones = sum(1 for value in path_risk["risk_values"] if value >= DEFAULT_HIGH_RISK_THRESHOLD)
        avg_risk = float(path_risk["mean_risk"])
        risk_level = "Low"
        if avg_risk >= 0.66:
            risk_level = "High"
        elif avg_risk >= 0.33:
            risk_level = "Medium"

        return {
            "path": points,
            "path_points": points,
            "total_distance": float(total_distance),
            "avg_risk": avg_risk,
            "high_risk_zones": int(high_risk_zones),
            "total_cost": float(total_cost),
            "path_steps": len(path_ids),
            "risk_level": risk_level,
            "start_airport": start_name,
            "end_airport": end_name,
            "start_grid_id": start_grid,
            "end_grid_id": end_grid,
            "algorithm": algorithm,
            "weights": {
                "risk_weight": risk_weight,
                "beta_weight": beta_weight,
                "safety_priority": safety_priority,
                "effective_risk_weight": effective_risk_weight,
                "effective_beta_weight": effective_beta_weight,
            },
            "risk_summary": path_risk,
            "model": self.model_metadata,
        }
