# Bird-Safe Flight Path Predictor

Complete system for safer flight routing using bird-risk prediction, risk-aware pathfinding, and a premium dashboard UI.

## What is included

- `bird_safe_flight_pipeline.py`: data prep, XGBoost training, and scored grid export
- `bird_safe_pathfinding.py`: risk-aware A* and Theta* routing
- `backend/`: FastAPI service for routes, heatmap data, and airport lists
- `frontend/`: Next.js dashboard with map, controls, and route insights

## Backend API

Run the API from the project root:

```bash
c:/Users/prasu/OneDrive/Desktop/bird_safe_flight/.venv/Scripts/python.exe -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

Endpoints:

- `GET /get_route?source_airport=...&destination_airport=...&risk_weight=...`
- `GET /get_heatmap`
- `GET /get_airports`
- `GET /health`

## Frontend

The frontend is scaffolded in `frontend/`.

Before running it, install Node.js dependencies inside that folder:

```bash
cd frontend
npm install
npm run dev
```

Set the backend URL in `frontend/.env.local` if needed:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Data and outputs

The app reads the generated artifacts in `outputs/`:

- `grid_risk_scored.csv`
- `bird_risk_xgboost.joblib`
- `model_metrics.json`
- `pathfinding_structure.json`

## Notes

- The frontend uses a dark aviation dashboard with a Leaflet map, heatmap overlay, animated route drawing, and glass control panels.
- The backend uses cached loaders so the API remains responsive after startup.
- The pathfinding backend currently supports Theta* by default and can compare against distance-only A*.
