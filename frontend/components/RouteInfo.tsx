"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Gauge, MapPinned, ShieldAlert, Signal } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { RouteResponse } from "@/lib/types";

type RouteInfoProps = {
  route: RouteResponse | null;
  loading: boolean;
  error: string | null;
};

function riskTone(level: string) {
  if (level === "High") return "from-red-500/20 to-rose-500/10 text-rose-100 border-rose-400/30";
  if (level === "Medium") return "from-amber-400/20 to-orange-500/10 text-amber-50 border-amber-300/30";
  return "from-emerald-400/20 to-teal-500/10 text-emerald-50 border-emerald-300/30";
}

function riskBadge(level: string) {
  if (level === "High") return "border-rose-300/35 bg-rose-400/15 text-rose-100";
  if (level === "Medium") return "border-amber-300/35 bg-amber-400/15 text-amber-100";
  return "border-emerald-300/35 bg-emerald-400/15 text-emerald-100";
}

export function RouteInfo({ route, loading, error }: RouteInfoProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Card className="w-full max-w-[420px] border-white/15 bg-white/[0.045] p-6 text-slate-50 shadow-[0_18px_64px_rgba(8,47,73,0.33)]">
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Route Insights</p>
            <h3 className="airfoil-text mt-2 text-xl font-semibold text-white">Flight Corridor Summary</h3>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
          ) : null}

          {!route && !loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              Generate a route to see distance, average risk, and route stability metrics.
            </div>
          ) : null}

          {route ? (
            <div className="space-y-4">
              <div className={`rounded-2xl border bg-gradient-to-br p-4 ${riskTone(route.risk_level)}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-xl border border-white/15 bg-white/10 p-2">
                      <ShieldAlert className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] opacity-75">Risk Level</p>
                      <p className="mt-1 text-2xl font-semibold">{route.risk_level}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <p className="text-[11px] uppercase tracking-[0.28em] opacity-75">Status</p>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${riskBadge(route.risk_level)}`}>
                      {route.risk_level}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Metric icon={<MapPinned className="h-4 w-4" />} label="Distance" value={`${route.total_distance.toFixed(1)} km`} />
                <Metric icon={<Signal className="h-4 w-4" />} label="Average Risk" value={route.avg_risk.toFixed(3)} />
                <Metric icon={<AlertTriangle className="h-4 w-4" />} label="High Risk Cells" value={String(route.high_risk_zones)} />
                <Metric icon={<Gauge className="h-4 w-4" />} label="Route Cost" value={route.total_cost.toFixed(2)} />
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-[0.22em] text-[11px] text-slate-500">Route Steps</span>
                  <span className="text-white font-semibold">{route.path_steps}</span>
                </div>
              </div>

              {route.comparison ? (
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Baseline Comparison</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>Baseline steps: {route.comparison.baseline_steps}</p>
                    <p>Upgraded steps: {route.comparison.upgraded_steps}</p>
                    <p>Baseline cost: {route.comparison.baseline_total_cost.toFixed(2)}</p>
                    <p>Upgraded cost: {route.comparison.upgraded_total_cost.toFixed(2)}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              <div className="h-14 animate-pulse rounded-2xl bg-white/8" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 animate-pulse rounded-2xl bg-white/8" />
                <div className="h-20 animate-pulse rounded-2xl bg-white/8" />
                <div className="h-20 animate-pulse rounded-2xl bg-white/8" />
                <div className="h-20 animate-pulse rounded-2xl bg-white/8" />
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <span className="rounded-lg border border-white/10 bg-white/5 p-1.5">{icon}</span>
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      </div>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
