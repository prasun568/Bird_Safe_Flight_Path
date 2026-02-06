"""
Advanced pathfinding for Bird-Safe Flight Path Predictor.

Implements:
- Distance-only baseline A*
- Risk/weather-aware A*
- Theta* smoothing with line-of-sight checks
"""

from __future__ import annotations

import argparse
import heapq
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd


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


@dataclass
class NodeData:
    latitude: float
    longitude: float
    risk_score: float
    weather_penalty: float


class GridRiskGraph:
    """Implicit 8-neighbor graph over quantized grid cells."""

    def __init__(self, nodes: Dict[str, NodeData], grid_size: float = 0.1) -> None:
        self.nodes = nodes
        self.grid_size = grid_size
        self.coord_to_grid: Dict[Tuple[int, int], str] = {}
        for grid_id, data in nodes.items():
            self.coord_to_grid[self.quantize(data.latitude, data.longitude)] = grid_id

    def quantize(self, lat: float, lon: float) -> Tuple[int, int]:
        return int(round(lat / self.grid_size)), int(round(lon / self.grid_size))

    def quantized_coord(self, grid_id: str) -> Tuple[int, int]:
        node = self.nodes[grid_id]
        return self.quantize(node.latitude, node.longitude)

    def node_at_quantized(self, qlat: int, qlon: int) -> Optional[str]:
        return self.coord_to_grid.get((qlat, qlon))

    def neighbors(self, grid_id: str) -> List[str]:
        qlat, qlon = self.quantized_coord(grid_id)
        result: List[str] = []
        for dlat in (-1, 0, 1):
            for dlon in (-1, 0, 1):
                if dlat == 0 and dlon == 0:
                    continue
                n_id = self.node_at_quantized(qlat + dlat, qlon + dlon)
                if n_id is not None:
                    result.append(n_id)
        return result

    def line_of_sight(self, from_id: str, to_id: str) -> bool:
        """Bresenham-style visibility check over quantized grid occupancy."""
        x0, y0 = self.quantized_coord(from_id)
        x1, y1 = self.quantized_coord(to_id)

        dx = abs(x1 - x0)
        dy = abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1

        err = dx - dy
        x, y = x0, y0

        while True:
            if self.node_at_quantized(x, y) is None:
                return False
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x += sx
            if e2 < dx:
                err += dx
                y += sy
        return True


def parse_grid_id(grid_id: str) -> Tuple[float, float]:
    lat_s, lon_s = grid_id.split("_", maxsplit=1)
    return float(lat_s), float(lon_s)


def euclidean_distance(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    return float(math.sqrt((a_lat - b_lat) ** 2 + (a_lon - b_lon) ** 2))


def heuristic(node: NodeData, goal: NodeData) -> float:
    return euclidean_distance(node.latitude, node.longitude, goal.latitude, goal.longitude)


def movement_cost(
    current: NodeData,
    nxt: NodeData,
    alpha: float,
    beta: float,
    distance_weight: float,
) -> float:
    distance = euclidean_distance(current.latitude, current.longitude, nxt.latitude, nxt.longitude)
    return (distance_weight * distance) + (alpha * nxt.risk_score) + (beta * nxt.weather_penalty)


def reconstruct_path(came_from: Dict[str, str], current: str) -> List[str]:
    path = [current]
    while current in came_from:
        current = came_from[current]
        path.append(current)
    path.reverse()
    return path


def weighted_a_star(
    graph: GridRiskGraph,
    start_id: str,
    goal_id: str,
    alpha: float,
    beta: float,
    distance_weight: float = 1.0,
) -> Tuple[List[str], float]:
    if start_id == goal_id:
        return [start_id], 0.0

    open_heap: List[Tuple[float, str]] = []
    heapq.heappush(open_heap, (0.0, start_id))

    came_from: Dict[str, str] = {}
    g_score: Dict[str, float] = {start_id: 0.0}
    closed: set[str] = set()

    while open_heap:
        _, current = heapq.heappop(open_heap)
        if current in closed:
            continue

        if current == goal_id:
            return reconstruct_path(came_from, current), g_score[current]

        closed.add(current)
        current_data = graph.nodes[current]

        for neighbor in graph.neighbors(current):
            if neighbor in closed:
                continue

            neighbor_data = graph.nodes[neighbor]
            tentative_g = g_score[current] + movement_cost(
                current=current_data,
                nxt=neighbor_data,
                alpha=alpha,
                beta=beta,
                distance_weight=distance_weight,
            )

            if tentative_g < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score = tentative_g + heuristic(neighbor_data, graph.nodes[goal_id])
                heapq.heappush(open_heap, (f_score, neighbor))

    raise ValueError("No path found between start and goal")


def theta_star(
    graph: GridRiskGraph,
    start_id: str,
    goal_id: str,
    alpha: float,
    beta: float,
    distance_weight: float = 1.0,
) -> Tuple[List[str], float]:
    if start_id == goal_id:
        return [start_id], 0.0

    open_heap: List[Tuple[float, str]] = []
    heapq.heappush(open_heap, (0.0, start_id))

    came_from: Dict[str, str] = {}
    g_score: Dict[str, float] = {start_id: 0.0}
    closed: set[str] = set()

    while open_heap:
        _, current = heapq.heappop(open_heap)
        if current in closed:
            continue

        if current == goal_id:
            return reconstruct_path(came_from, current), g_score[current]

        closed.add(current)

        for neighbor in graph.neighbors(current):
            if neighbor in closed:
                continue

            parent = came_from.get(current, current)

            if parent != current and graph.line_of_sight(parent, neighbor):
                candidate_parent = parent
            else:
                candidate_parent = current

            base_g = g_score[candidate_parent]
            tentative_g = base_g + movement_cost(
                current=graph.nodes[candidate_parent],
                nxt=graph.nodes[neighbor],
                alpha=alpha,
                beta=beta,
                distance_weight=distance_weight,
            )

            if tentative_g < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = candidate_parent
                g_score[neighbor] = tentative_g
                f_score = tentative_g + heuristic(graph.nodes[neighbor], graph.nodes[goal_id])
                heapq.heappush(open_heap, (f_score, neighbor))

    raise ValueError("No path found between start and goal")


def minmax_normalize(series: pd.Series) -> pd.Series:
    s = pd.to_numeric(series, errors="coerce")
    if s.isna().all():
        return pd.Series(np.zeros(len(series)), index=series.index)
    s = s.fillna(s.median())
    smin = float(s.min())
    smax = float(s.max())
    if smax == smin:
        return pd.Series(np.zeros(len(series)), index=series.index)
    return (s - smin) / (smax - smin)


def load_grid_risk_data(path: Path) -> Dict[str, NodeData]:
    df = pd.read_csv(path, low_memory=False)
    df = normalize_columns(df)

    grid_col = first_existing(df.columns, ["grid_id"])
    risk_col = first_existing(df.columns, ["risk_score", "predicted_risk_probability", "risk"])
    if grid_col is None or risk_col is None:
        raise ValueError("Grid file must contain grid_id and risk_score/predicted_risk_probability")

    if "latitude" not in df.columns or "longitude" not in df.columns:
        coords = df[grid_col].astype(str).map(parse_grid_id)
        df["latitude"] = coords.map(lambda x: x[0])
        df["longitude"] = coords.map(lambda x: x[1])

    temp = minmax_normalize(df.get("temperature", pd.Series(np.zeros(len(df)))))
    wind = minmax_normalize(df.get("wind_speed", pd.Series(np.zeros(len(df)))))
    vis = minmax_normalize(df.get("visibility", pd.Series(np.zeros(len(df)))))

    # Higher wind and lower visibility increase weather penalty.
    weather_penalty = 0.4 * wind + 0.4 * (1.0 - vis) + 0.2 * temp
    df["weather_penalty"] = weather_penalty

    grouped = (
        df.groupby(grid_col, as_index=False)
        .agg(
            latitude=("latitude", "first"),
            longitude=("longitude", "first"),
            risk_score=(risk_col, "mean"),
            weather_penalty=("weather_penalty", "mean"),
        )
        .reset_index(drop=True)
    )

    nodes: Dict[str, NodeData] = {}
    for _, row in grouped.iterrows():
        gid = str(row[grid_col])
        nodes[gid] = NodeData(
            latitude=float(row["latitude"]),
            longitude=float(row["longitude"]),
            risk_score=float(row["risk_score"]),
            weather_penalty=float(row["weather_penalty"]),
        )

    if not nodes:
        raise ValueError("No valid grid nodes found")

    return nodes


def parse_airports(airports_path: Path) -> pd.DataFrame:
    try:
        airports = pd.read_csv(
            airports_path,
            header=None,
            names=AIRPORTS_NO_HEADER_COLUMNS,
            low_memory=False,
        )
    except Exception:
        airports = pd.read_csv(airports_path, low_memory=False)

    airports = normalize_columns(airports)
    name_col = first_existing(airports.columns, ["airport_name", "name"])
    lat_col = first_existing(airports.columns, ["latitude", "lat", "decimallatitude"])
    lon_col = first_existing(airports.columns, ["longitude", "lon", "lng", "decimallongitude"])
    if name_col is None or lat_col is None or lon_col is None:
        raise ValueError("Airports dataset must include airport_name, latitude, longitude")

    airports = airports.rename(
        columns={
            name_col: "airport_name",
            lat_col: "latitude",
            lon_col: "longitude",
        }
    )

    airports["latitude"] = pd.to_numeric(airports["latitude"], errors="coerce")
    airports["longitude"] = pd.to_numeric(airports["longitude"], errors="coerce")
    airports = airports.dropna(subset=["airport_name", "latitude", "longitude"])
    airports["airport_name_key"] = airports["airport_name"].astype(str).str.strip().str.lower()
    return airports


def get_airport_coordinates(airports_df: pd.DataFrame, airport_name: str) -> Tuple[str, float, float]:
    key = airport_name.strip().lower()
    match = airports_df[airports_df["airport_name_key"] == key]
    if match.empty:
        raise ValueError(f"Airport not found: {airport_name}")
    row = match.iloc[0]
    return str(row["airport_name"]), float(row["latitude"]), float(row["longitude"])


def nearest_grid_node(nodes: Dict[str, NodeData], lat: float, lon: float) -> str:
    best_id = None
    best_dist = float("inf")
    for gid, node in nodes.items():
        d = euclidean_distance(lat, lon, node.latitude, node.longitude)
        if d < best_dist:
            best_dist = d
            best_id = gid
    if best_id is None:
        raise ValueError("Unable to find nearest grid node")
    return best_id


def path_to_points(nodes: Dict[str, NodeData], path: List[str]) -> List[Tuple[float, float]]:
    return [(nodes[gid].latitude, nodes[gid].longitude) for gid in path]


def path_risk_summary(nodes: Dict[str, NodeData], path: List[str]) -> Dict[str, object]:
    risks = [nodes[gid].risk_score for gid in path]
    weather = [nodes[gid].weather_penalty for gid in path]
    return {
        "risk_values": risks,
        "weather_penalties": weather,
        "mean_risk": float(np.mean(risks)) if risks else 0.0,
        "max_risk": float(np.max(risks)) if risks else 0.0,
        "mean_weather_penalty": float(np.mean(weather)) if weather else 0.0,
    }


def optional_plot_folium(
    points: List[Tuple[float, float]],
    start_airport: Tuple[str, float, float],
    end_airport: Tuple[str, float, float],
    output_html: Path,
) -> Optional[str]:
    try:
        import folium  # type: ignore
    except Exception:
        return None

    if not points:
        return None

    center_lat = float(np.mean([p[0] for p in points]))
    center_lon = float(np.mean([p[1] for p in points]))
    fmap = folium.Map(location=[center_lat, center_lon], zoom_start=6)

    folium.Marker(
        [start_airport[1], start_airport[2]],
        popup=f"Start: {start_airport[0]}",
        icon=folium.Icon(color="green"),
    ).add_to(fmap)
    folium.Marker(
        [end_airport[1], end_airport[2]],
        popup=f"End: {end_airport[0]}",
        icon=folium.Icon(color="red"),
    ).add_to(fmap)
    folium.PolyLine(points, color="blue", weight=4, opacity=0.8).add_to(fmap)

    fmap.save(str(output_html))
    return str(output_html)


def run_pathfinder(
    graph: GridRiskGraph,
    start_grid: str,
    end_grid: str,
    algorithm: str,
    alpha: float,
    beta: float,
    distance_weight: float,
) -> Tuple[List[str], float]:
    if algorithm == "theta":
        return theta_star(
            graph=graph,
            start_id=start_grid,
            goal_id=end_grid,
            alpha=alpha,
            beta=beta,
            distance_weight=distance_weight,
        )
    if algorithm == "a_star":
        return weighted_a_star(
            graph=graph,
            start_id=start_grid,
            goal_id=end_grid,
            alpha=alpha,
            beta=beta,
            distance_weight=distance_weight,
        )
    raise ValueError("algorithm must be one of: a_star, theta")


def find_safest_path(
    grid_path: Path,
    airports_path: Path,
    start_airport_name: str,
    end_airport_name: str,
    alpha: float = 8.0,
    beta: float = 3.0,
    distance_weight: float = 1.0,
    safety_priority: float = 1.0,
    algorithm: str = "theta",
    compare_baseline: bool = False,
    create_map: bool = False,
    map_output: Optional[Path] = None,
) -> Dict[str, object]:
    nodes = load_grid_risk_data(grid_path)
    graph = GridRiskGraph(nodes, grid_size=0.1)

    airports = parse_airports(airports_path)
    start_name, s_lat, s_lon = get_airport_coordinates(airports, start_airport_name)
    end_name, e_lat, e_lon = get_airport_coordinates(airports, end_airport_name)

    start_grid = nearest_grid_node(nodes, s_lat, s_lon)
    end_grid = nearest_grid_node(nodes, e_lat, e_lon)

    eff_alpha = alpha * safety_priority
    eff_beta = beta * safety_priority

    path_ids, total_cost = run_pathfinder(
        graph=graph,
        start_grid=start_grid,
        end_grid=end_grid,
        algorithm=algorithm,
        alpha=eff_alpha,
        beta=eff_beta,
        distance_weight=distance_weight,
    )

    points = path_to_points(nodes, path_ids)
    risk_summary = path_risk_summary(nodes, path_ids)

    comparison = None
    if compare_baseline:
        baseline_path, baseline_cost = weighted_a_star(
            graph=graph,
            start_id=start_grid,
            goal_id=end_grid,
            alpha=0.0,
            beta=0.0,
            distance_weight=1.0,
        )
        comparison = {
            "baseline_algorithm": "a_star_distance_only",
            "baseline_total_cost": float(baseline_cost),
            "baseline_steps": len(baseline_path),
            "upgraded_algorithm": algorithm,
            "upgraded_total_cost": float(total_cost),
            "upgraded_steps": len(path_ids),
            "upgraded_mean_risk": risk_summary["mean_risk"],
        }

    map_file = None
    if create_map:
        if map_output is None:
            map_output = Path("outputs") / "safest_path_map.html"
        map_output.parent.mkdir(parents=True, exist_ok=True)
        map_file = optional_plot_folium(
            points=points,
            start_airport=(start_name, s_lat, s_lon),
            end_airport=(end_name, e_lat, e_lon),
            output_html=map_output,
        )

    return {
        "algorithm": algorithm,
        "weights": {
            "alpha": float(alpha),
            "beta": float(beta),
            "distance_weight": float(distance_weight),
            "safety_priority": float(safety_priority),
            "effective_alpha": float(eff_alpha),
            "effective_beta": float(eff_beta),
        },
        "start_airport": {"name": start_name, "latitude": s_lat, "longitude": s_lon},
        "end_airport": {"name": end_name, "latitude": e_lat, "longitude": e_lon},
        "start_grid_id": start_grid,
        "end_grid_id": end_grid,
        "path_grid_ids": path_ids,
        "path_points": points,
        "path_steps": len(path_ids),
        "total_cost": float(total_cost),
        "path_risk": risk_summary,
        "comparison": comparison,
        "map_file": map_file,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Risk-aware A*/Theta* for bird-safe routing")
    parser.add_argument("--grid-file", type=str, default="outputs/grid_risk_scored.csv")
    parser.add_argument("--airports-file", type=str, default="airports.csv")
    parser.add_argument("--start-airport", type=str, required=True)
    parser.add_argument("--end-airport", type=str, required=True)
    parser.add_argument("--algorithm", type=str, default="theta", choices=["a_star", "theta"])
    parser.add_argument("--alpha", type=float, default=8.0, help="Risk score weight")
    parser.add_argument("--beta", type=float, default=3.0, help="Weather penalty weight")
    parser.add_argument("--distance-weight", type=float, default=1.0, help="Distance term weight")
    parser.add_argument(
        "--safety-priority",
        type=float,
        default=1.0,
        help="Safety-shortest tradeoff scaler applied to alpha and beta",
    )
    parser.add_argument("--compare", action="store_true", help="Compare against distance-only A*")
    parser.add_argument("--plot", action="store_true", help="Generate folium HTML map if folium is installed")
    parser.add_argument("--map-output", type=str, default="outputs/safest_path_map.html")
    parser.add_argument("--save-json", type=str, default="outputs/safest_path_result.json")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    result = find_safest_path(
        grid_path=Path(args.grid_file),
        airports_path=Path(args.airports_file),
        start_airport_name=args.start_airport,
        end_airport_name=args.end_airport,
        alpha=args.alpha,
        beta=args.beta,
        distance_weight=args.distance_weight,
        safety_priority=args.safety_priority,
        algorithm=args.algorithm,
        compare_baseline=bool(args.compare),
        create_map=bool(args.plot),
        map_output=Path(args.map_output),
    )

    save_path = Path(args.save_json)
    save_path.parent.mkdir(parents=True, exist_ok=True)
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print("Advanced pathfinding complete.")
    print(json.dumps(result, indent=2))
    print(f"Saved result to: {save_path}")


if __name__ == "__main__":
    main()
