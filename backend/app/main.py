"""FastAPI application for bird-safe flight routing."""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import DEFAULT_BETA_WEIGHT, DEFAULT_RISK_WEIGHT, DEFAULT_SAFETY_PRIORITY
from backend.app.schemas import AirportsResponse, HeatmapResponse, RouteResponse
from backend.app.services.route_service import RouteService

app = FastAPI(
    title="Bird-Safe Flight Path API",
    version="1.0.0",
    description="API for bird-risk heatmaps and safest flight path routing.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def get_route_service() -> RouteService:
    return RouteService()


@app.get("/health")
def health() -> dict:
    service = get_route_service()
    return {
        "status": "ok",
        "airports": len(service.airports_df),
        "grid_cells": len(service.grid_df),
        "model": service.model_metadata.get("model_type", "unknown"),
    }


@app.get("/get_route", response_model=RouteResponse)
def get_route(
    source_airport: str = Query(..., description="Origin airport name"),
    destination_airport: str = Query(..., description="Destination airport name"),
    risk_weight: float = Query(DEFAULT_RISK_WEIGHT, ge=0.0),
    beta_weight: float = Query(DEFAULT_BETA_WEIGHT, ge=0.0),
    safety_priority: float = Query(DEFAULT_SAFETY_PRIORITY, ge=0.0),
    algorithm: str = Query("theta", pattern="^(a_star|theta)$"),
) -> dict:
    service = get_route_service()
    result = service.compute_route(
        source_airport=source_airport,
        destination_airport=destination_airport,
        risk_weight=risk_weight,
        beta_weight=beta_weight,
        safety_priority=safety_priority,
        algorithm=algorithm,
    )
    return result


@app.get("/get_heatmap", response_model=HeatmapResponse)
def get_heatmap() -> dict:
    service = get_route_service()
    return {"data": service.heatmap_points()}


@app.get("/get_airports", response_model=AirportsResponse)
def get_airports() -> dict:
    service = get_route_service()
    return {"airports": service.list_airports()}
