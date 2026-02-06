"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

import type { AirportItem, HeatmapPoint, RouteResponse } from "@/lib/types";

type RouteMapProps = {
  airports: AirportItem[];
  heatmap: HeatmapPoint[];
  route: RouteResponse | null;
};

const DEFAULT_CENTER: [number, number] = [22, 78];
const MAX_HEATMAP_POINTS = 1500;
const HEATMAP_PANE = "heatmapPane";
const AIRPORT_PANE = "airportPane";
const ROUTE_PANE = "routePane";

function riskColor(normalizedRisk: number) {
  const clipped = Math.max(0, Math.min(normalizedRisk, 1));
  if (clipped < 0.33) {
    const t = clipped / 0.33;
    const r = Math.round(144 + (255 - 144) * t);
    const g = Math.round(238 + (180 - 238) * t);
    const b = Math.round(144 + (100 - 144) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (clipped < 0.66) {
    const t = (clipped - 0.33) / 0.33;
    const r = Math.round(255 + (255 - 255) * t);
    const g = Math.round(180 + (165 - 180) * t);
    const b = Math.round(100 + (0 - 100) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = (clipped - 0.66) / 0.34;
    const r = Math.round(255 + (200 - 255) * t);
    const g = Math.round(165 + (50 - 165) * t);
    const b = Math.round(0 + (0 - 0) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

function displayHeatRisk(risk: number) {
  return Math.log1p(Math.max(0, risk) * 500) / Math.log1p(500);
}

function buildAirportIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 20px;
        height: 20px;
        border-radius: 9999px;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.95);
        box-shadow: 0 0 0 7px rgba(255,255,255,0.08), 0 0 26px ${color}88;
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function MapViewportSync({ route, airports, heatmap }: Pick<RouteMapProps, "route" | "airports" | "heatmap">) {
  const map = useMap();

  useEffect(() => {
    const routePoints = route?.path?.length ? route.path : [];
    const anchorPoints = routePoints.length ? routePoints : airports.slice(0, 2).map((airport) => [airport.latitude, airport.longitude] as [number, number]);
    if (anchorPoints.length === 0 && heatmap.length === 0) {
      map.setView(DEFAULT_CENTER, 4.2);
      return;
    }

    const latitudes: number[] = [];
    const longitudes: number[] = [];

    for (const [lat, lon] of anchorPoints) {
      latitudes.push(lat);
      longitudes.push(lon);
    }

    for (const cell of heatmap) {
      latitudes.push(cell.latitude);
      longitudes.push(cell.longitude);
    }

    const bounds = L.latLngBounds(
      [Math.min(...latitudes), Math.min(...longitudes)],
      [Math.max(...latitudes), Math.max(...longitudes)],
    );

    map.fitBounds(bounds.pad(0.28), {
      animate: true,
      duration: 0.8,
      maxZoom: 3.9,
      paddingTopLeft: [40, 40],
      paddingBottomRight: [40, 70],
    });
  }, [airports, heatmap, map, route]);

  return null;
}

function MapPaneSetup() {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane(HEATMAP_PANE)) {
      const pane = map.createPane(HEATMAP_PANE);
      pane.style.zIndex = "420";
      pane.style.pointerEvents = "none";
    }

    if (!map.getPane(AIRPORT_PANE)) {
      const pane = map.createPane(AIRPORT_PANE);
      pane.style.zIndex = "620";
    }

    if (!map.getPane(ROUTE_PANE)) {
      const pane = map.createPane(ROUTE_PANE);
      pane.style.zIndex = "630";
    }
  }, [map]);

  return null;
}

export function RouteMap({ airports, heatmap, route }: RouteMapProps) {
  const [visiblePath, setVisiblePath] = useState<[number, number][]>([]);
  const [flightCursorIndex, setFlightCursorIndex] = useState(0);

  useEffect(() => {
    if (!route?.path?.length) {
      setVisiblePath([]);
      setFlightCursorIndex(0);
      return;
    }

    setVisiblePath([route.path[0]]);
    setFlightCursorIndex(0);
    let index = 1;
    const intervalId = window.setInterval(() => {
      setVisiblePath(route.path.slice(0, Math.min(index + 1, route.path.length)));
      setFlightCursorIndex(Math.min(index, route.path.length - 1));
      index += 1;
      if (index >= route.path.length) {
        window.clearInterval(intervalId);
      }
    }, 110);

    return () => window.clearInterval(intervalId);
  }, [route]);

  const displayHeatmap =
    heatmap.length > MAX_HEATMAP_POINTS
      ? heatmap.filter((_, index) => index % Math.ceil(heatmap.length / MAX_HEATMAP_POINTS) === 0)
      : heatmap;

  const routeStart = route?.path?.[0];
  const routeEnd = route?.path && route.path.length > 0 ? route.path[route.path.length - 1] : undefined;
  const flightCursor = route?.path && route.path.length > 0 ? route.path[flightCursorIndex] : undefined;

  return (
    <div className="relative h-full w-full flex flex-col">
      <MapContainer center={DEFAULT_CENTER} zoom={4.2} scrollWheelZoom preferCanvas className="h-auto flex-1 w-full map-depth-layer">
        <TileLayer
          attribution="&copy; OpenStreetMap &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapPaneSetup />
        <MapViewportSync route={route} airports={airports} heatmap={heatmap} />

      {displayHeatmap.map((cell) => {
        const displayRisk = displayHeatRisk(cell.risk_score);
        const isHighRisk = displayRisk > 0.7;
        return (
          <CircleMarker
            key={cell.grid_id}
            center={[cell.latitude, cell.longitude]}
            radius={1.4 + displayRisk * 4.2}
            pane={HEATMAP_PANE}
            pathOptions={{
              fillColor: riskColor(displayRisk),
              fillOpacity: isHighRisk ? 0.6 + displayRisk * 0.22 : 0.08 + displayRisk * 0.12,
              color: isHighRisk ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.18)",
              weight: isHighRisk ? 0.7 : 0.25,
              opacity: isHighRisk ? 0.8 : 0.28,
              className: `heatmap-cell ${isHighRisk ? "heatmap-high" : ""}`,
            }}
          />
        );
      })}

      {airports.map((airport) => (
        <CircleMarker
          key={`${airport.airport_name}-${airport.latitude}-${airport.longitude}`}
          center={[airport.latitude, airport.longitude]}
          pane={AIRPORT_PANE}
          radius={2.25}
          pathOptions={{
            color: "rgba(255, 255, 255, 0.92)",
            fillColor: "rgba(56, 189, 248, 0.92)",
            fillOpacity: 0.78,
            weight: 0.8,
            opacity: 0.85,
            className: "airport-node",
          }}
        >
          <Popup>
            <div className="space-y-1 text-slate-900">
              <div className="text-sm font-semibold">{airport.airport_name}</div>
              <div className="text-xs">
                {airport.latitude.toFixed(4)}, {airport.longitude.toFixed(4)}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {routeStart ? (
        <Marker position={routeStart} icon={buildAirportIcon("#34d399")} pane={ROUTE_PANE}>
          <Popup>
            <div className="space-y-1 text-slate-900">
              <div className="text-sm font-semibold">Route Start</div>
              <div className="text-xs">{route?.start_airport}</div>
            </div>
          </Popup>
        </Marker>
      ) : null}

      {routeEnd ? (
        <Marker position={routeEnd} icon={buildAirportIcon("#f87171")} pane={ROUTE_PANE}>
          <Popup>
            <div className="space-y-1 text-slate-900">
              <div className="text-sm font-semibold">Route End</div>
              <div className="text-xs">{route?.end_airport}</div>
            </div>
          </Popup>
        </Marker>
      ) : null}

      {visiblePath.length > 1 ? (
        <Polyline
          positions={visiblePath}
          pathOptions={{
            color: "#eff6ff",
            weight: 9,
            opacity: 0.9,
            lineCap: "round",
            lineJoin: "round",
            className: "flight-route-glow",
          }}
          pane={ROUTE_PANE}
        />
      ) : null}

      {visiblePath.length > 1 ? (
        <Polyline
          positions={visiblePath}
          pathOptions={{
            color: "#38bdf8",
            weight: 4,
            opacity: 0.96,
            lineCap: "round",
            lineJoin: "round",
            className: "flight-route-line",
            dashArray: "12 10",
          }}
          pane={ROUTE_PANE}
        />
      ) : null}

      {flightCursor ? (
        <CircleMarker
          center={flightCursor}
          radius={7.5}
          pane={ROUTE_PANE}
          pathOptions={{
            color: "rgba(125, 211, 252, 1)",
            fillColor: "rgba(56, 189, 248, 1)",
            fillOpacity: 0.96,
            weight: 2,
            opacity: 0.95,
            className: "flight-cursor-dot",
          }}
        />
      ) : null}
      </MapContainer>
      <HeatmapLegend />
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div className="w-full shrink-0 bg-gradient-to-t from-slate-950/95 to-slate-950/80 px-6 py-4 border-t border-white/10 backdrop-blur-sm">
      <div className="max-w-full">
        <p className="text-xs uppercase tracking-[0.28em] font-semibold text-cyan-300/80 mb-3">Bird Risk Heatmap Legend</p>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: riskColor(0.15) }} />
            <span className="text-xs text-slate-300">Low Risk</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: riskColor(0.5) }} />
            <span className="text-xs text-slate-300">Medium Risk</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: riskColor(0.8) }} />
            <span className="text-xs text-slate-300">High Risk</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: "rgba(56, 189, 248, 1)" }} />
            <span className="text-xs text-slate-300">Airports</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-1.5 rounded-full" style={{ backgroundColor: "#38bdf8" }} />
            <span className="text-xs text-slate-300">Flight Route</span>
          </div>
        </div>
      </div>
    </div>
  );
}
