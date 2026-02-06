"""Pydantic schemas for the bird-safe route API."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class RouteResponse(BaseModel):
    path: List[List[float]]
    total_distance: float
    avg_risk: float
    high_risk_zones: int
    total_cost: float
    path_steps: int
    risk_level: str
    start_airport: str
    end_airport: str
    start_grid_id: str
    end_grid_id: str
    algorithm: str
    comparison: Optional[dict] = None


class HeatmapPoint(BaseModel):
    grid_id: str
    latitude: float
    longitude: float
    risk_score: float


class HeatmapResponse(BaseModel):
    data: List[HeatmapPoint]


class AirportItem(BaseModel):
    airport_name: str
    city: Optional[str] = None
    latitude: float
    longitude: float


class AirportsResponse(BaseModel):
    airports: List[AirportItem]


class RouteRequest(BaseModel):
    source_airport: str = Field(..., description="Origin airport name")
    destination_airport: str = Field(..., description="Destination airport name")
    risk_weight: float = Field(default=8.0, ge=0.0, description="Risk penalty weight")
    beta_weight: float = Field(default=3.0, ge=0.0, description="Weather penalty weight")
    safety_priority: float = Field(default=1.0, ge=0.0, description="Safety tradeoff multiplier")
    algorithm: str = Field(default="theta", description="Pathfinding algorithm: a_star or theta")
