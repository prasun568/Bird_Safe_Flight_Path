"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wind, ShieldCheck, Radar, Cloud, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { signOut, useSession } from "next-auth/react";

import { ControlPanel } from "@/components/ControlPanel";
import { RouteInfo } from "@/components/RouteInfo";
import { Card } from "@/components/ui/card";
import { fetchAirports, fetchHeatmap, fetchRoute } from "@/lib/api";
import type { AirportItem, HeatmapPoint, RouteResponse } from "@/lib/types";

const RouteMap = dynamic(() => import("@/components/RouteMap").then((mod) => mod.RouteMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-950" />,
});

export function FlightDashboard() {
  const { data: session } = useSession();
  const [airports, setAirports] = useState<AirportItem[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeHistory, setRouteHistory] = useState<RouteHistoryItem[]>([]);
  const [sourceAirport, setSourceAirport] = useState("");
  const [destinationAirport, setDestinationAirport] = useState("");
  const [riskWeight, setRiskWeight] = useState(8);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    try {
      const savedHistory = window.localStorage.getItem("bird-safe-route-history");
      if (savedHistory) {
        setRouteHistory(JSON.parse(savedHistory) as RouteHistoryItem[]);
      }
    } catch {
      setRouteHistory([]);
    }

    async function loadInitialData() {
      try {
        setLoadingData(true);
        const [airportData, heatmapData] = await Promise.all([fetchAirports(), fetchHeatmap()]);
        if (!active) {
          return;
        }

        setAirports(airportData);
        setHeatmap(heatmapData);

        if (airportData.length >= 2) {
          setSourceAirport((current) => current || airportData[0].airport_name);
          setDestinationAirport((current) => current || airportData[1].airport_name);
        }
      } catch (fetchError) {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load dashboard data.");
        }
      } finally {
        if (active) {
          setLoadingData(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!route) {
      return;
    }

    const nextEntry: RouteHistoryItem = {
      id: `${Date.now()}-${route.start_airport}-${route.end_airport}`,
      sourceAirport: route.start_airport,
      destinationAirport: route.end_airport,
      totalDistance: route.total_distance,
      avgRisk: route.avg_risk,
      timestamp: new Date().toISOString(),
    };

    setRouteHistory((current) => {
      const nextHistory = [nextEntry, ...current.filter((item) => item.id !== nextEntry.id)].slice(0, 5);
      window.localStorage.setItem("bird-safe-route-history", JSON.stringify(nextHistory));
      return nextHistory;
    });
  }, [route]);

  async function handleGenerateRoute() {
    if (!sourceAirport || !destinationAirport) {
      return;
    }

    try {
      setError(null);
      setLoadingRoute(true);
      const routeData = await fetchRoute({
        sourceAirport,
        destinationAirport,
        riskWeight,
        betaWeight: 3,
        safetyPriority: 1,
        algorithm: "theta",
      });
      setRoute(routeData);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Route generation failed.");
    } finally {
      setLoadingRoute(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(2,6,23,0.22),rgba(2,6,23,0.52),rgba(2,6,23,0.72))]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_24%)]" />

      <header className="relative z-20 flex items-center justify-between border-b border-white/10 px-5 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/15 shadow-[0_0_32px_rgba(56,189,248,0.22)]">
            <Radar className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.42em] text-cyan-200/70">Bird-Safe Flight</p>
            <h1 className="airfoil-text text-xl font-semibold text-white md:text-2xl">Predictive Aviation Safety Console</h1>
          </div>
        </div>

        <Card className="hidden items-center gap-4 border-white/15 bg-white/[0.04] px-4 py-3 md:flex">
          <StatusPill icon={<CircleCheck className="h-3.5 w-3.5" />} label="System Active" tone="emerald" />
          <StatusPill icon={<Cloud className="h-3.5 w-3.5" />} label="Weather Synced" tone="cyan" />
          <div className="h-10 w-px bg-white/10" />
          <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Risk-Aware Routing" value="XGBoost + Theta*" />
          <div className="h-10 w-px bg-white/10" />
          <Stat icon={<Wind className="h-4 w-4" />} label="Dynamic Weather" value="Live Grid Penalty" />
          <div className="h-10 w-px bg-white/10" />
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Signed In</p>
              <p className="text-sm font-semibold text-slate-100">{session?.user?.email ?? "Authenticated User"}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100"
            >
              Sign Out
            </button>
          </div>
        </Card>
      </header>

      <main className="relative z-20 px-5 pb-5 pt-4 md:px-8 md:pb-8">
        <div className="grid gap-6 lg:grid-cols-[400px_1fr] lg:items-start">
          <div className="space-y-5">
            <ControlPanel
              airports={airports}
              sourceAirport={sourceAirport}
              destinationAirport={destinationAirport}
              riskWeight={riskWeight}
              loading={loadingRoute || loadingData}
              onSourceChange={setSourceAirport}
              onDestinationChange={setDestinationAirport}
              onRiskWeightChange={setRiskWeight}
              onSubmit={() => void handleGenerateRoute()}
            />
            <RouteInfo route={route} loading={loadingRoute} error={error} />
            <HistoryPanel items={routeHistory} />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative h-[72vh] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/20 shadow-[0_24px_120px_rgba(2,6,23,0.45)] md:h-[78vh]"
          >
            <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
              <Badge label="Risk Heatmap" tone="bg-rose-500/15 text-rose-100 border-rose-400/20" />
              <Badge label="Route Polyline" tone="bg-cyan-500/15 text-cyan-100 border-cyan-400/20" />
              <Badge label="Flight Nodes" tone="bg-emerald-500/15 text-emerald-100 border-emerald-400/20" />
            </div>
            <div className="absolute right-4 top-4 z-10 max-w-[290px] rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs leading-5 text-slate-300 shadow-xl backdrop-blur-xl">
              Bird-risk heatmap cells are rendered as a color-scaled overlay. Route drawing animates the selected path in real time.
            </div>
            <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_75%_20%,rgba(56,189,248,0.08),transparent_34%),radial-gradient(circle_at_35%_75%,rgba(248,113,113,0.06),transparent_36%)]" />
            <div className="relative z-10 h-full w-full">
              <RouteMap airports={airports} heatmap={heatmap} route={route} />
            </div>
          </motion.div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 md:hidden">
            {error}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-200">
        {icon}
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-100">{value}</p>
      </div>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: string }) {
  return <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] ${tone}`}>{label}</span>;
}

function StatusPill({ icon, label, tone }: { icon: ReactNode; label: string; tone: "emerald" | "cyan" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-300/35 bg-emerald-400/15 text-emerald-100"
      : "border-cyan-300/35 bg-cyan-400/15 text-cyan-100";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${toneClass}`}>
      {icon}
      {label}
    </span>
  );
}

type RouteHistoryItem = {
  id: string;
  sourceAirport: string;
  destinationAirport: string;
  totalDistance: number;
  avgRisk: number;
  timestamp: string;
};

function HistoryPanel({ items }: { items: RouteHistoryItem[] }) {
  return (
    <Card className="border-white/15 bg-white/[0.04] p-5 text-slate-50 shadow-[0_18px_64px_rgba(8,47,73,0.28)] backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-300/80">Previous Routes</p>
          <h3 className="airfoil-text mt-2 text-xl font-semibold text-white">Recent Activity</h3>
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Saved locally</p>
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-sm text-slate-300">
            No routes saved yet. Compute a route to start your history.
          </div>
        ) : null}

        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">{item.sourceAirport}</p>
                <p className="text-xs text-slate-400">to {item.destinationAirport}</p>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-100">
                {item.avgRisk < 0.25 ? "Low" : item.avgRisk < 0.55 ? "Moderate" : "High"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{item.totalDistance.toFixed(1)} km</span>
              <span>Risk {item.avgRisk.toFixed(3)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
