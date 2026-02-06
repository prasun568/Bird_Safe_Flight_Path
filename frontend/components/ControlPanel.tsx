"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import type { AirportItem } from "@/lib/types";

type ControlPanelProps = {
  airports: AirportItem[];
  sourceAirport: string;
  destinationAirport: string;
  riskWeight: number;
  loading: boolean;
  onSourceChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onRiskWeightChange: (value: number) => void;
  onSubmit: () => void;
};

export function ControlPanel({
  airports,
  sourceAirport,
  destinationAirport,
  riskWeight,
  loading,
  onSourceChange,
  onDestinationChange,
  onRiskWeightChange,
  onSubmit,
}: ControlPanelProps) {
  const preferenceLabel = riskWeight >= 10 ? "Safer Route" : "Shorter Route";

  return (
    <motion.div
      initial={{ opacity: 0, x: -28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <Card className="w-full max-w-[420px] border-white/15 bg-white/[0.045] p-6 text-slate-50 shadow-[0_18px_64px_rgba(8,47,73,0.35)]">
        <div className="space-y-6">
          <div className="space-y-2.5">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Mission Control</p>
            <h2 className="airfoil-text text-2xl font-semibold text-white">Bird-Safe Flight Planner</h2>
            <p className="max-w-[34ch] text-sm leading-6 text-slate-300/90">
              Select airports, balance safety against distance, and generate the safest route in real time.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2.5">
              <label className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">Source Airport</label>
              <AirportSearchField
                airports={airports}
                value={sourceAirport}
                loading={loading}
                onChange={onSourceChange}
                placeholder="Search airport or city"
              />
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">Destination Airport</label>
              <AirportSearchField
                airports={airports}
                value={destinationAirport}
                loading={loading}
                onChange={onDestinationChange}
                placeholder="Search airport or city"
              />
            </div>

            <div className="space-y-3.5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-slate-200">Risk vs Distance</span>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                  {riskWeight.toFixed(1)}
                </span>
              </div>

              <Slider
                min={0.5}
                max={20}
                step={0.5}
                value={riskWeight}
                onChange={(event) => onRiskWeightChange(Number(event.target.value))}
              />

              <div className="flex justify-between text-[11px] uppercase tracking-[0.24em] text-slate-500">
                <span>Safer Route</span>
                <span>Shorter Route</span>
              </div>

              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/85">Current Preference: {preferenceLabel}</p>
            </div>

            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 px-4 py-3 text-xs uppercase tracking-[0.22em] text-cyan-100/85">
              Airspace evaluation stays active while route updates are processing.
            </div>
          </div>

          <Button className="w-full" onClick={onSubmit} disabled={loading || airports.length < 2}>
            {loading ? "Analyzing airspace..." : "Compute Safe Route"}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function AirportSearchField({
  airports,
  value,
  loading,
  onChange,
  placeholder,
}: {
  airports: AirportItem[];
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const selectedAirport = useMemo(() => airports.find((airport) => airport.airport_name === value), [airports, value]);
  const selectedLabel = selectedAirport ? formatAirportLabel(selectedAirport) : value;

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedLabel);
    }
  }, [isOpen, selectedLabel]);

  const filteredAirports = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const sortedAirports = [...airports].sort((left, right) => formatAirportLabel(left).localeCompare(formatAirportLabel(right)));

    if (!normalizedQuery) {
      return sortedAirports.slice(0, 12);
    }

    return sortedAirports
      .filter((airport) => {
        const searchableText = normalizeSearch(`${airport.airport_name} ${airport.city ?? ""} ${formatAirportLabel(airport)}`);
        return searchableText.includes(normalizedQuery);
      })
      .slice(0, 12);
  }, [airports, query]);

  function commitSelection(airport: AirportItem) {
    onChange(airport.airport_name);
    setQuery(formatAirportLabel(airport));
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        disabled={loading || airports.length === 0}
        placeholder={airports.length === 0 ? "Loading airports..." : placeholder}
        onFocus={() => {
          setIsOpen(true);
          if (!query) {
            setQuery(selectedLabel);
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setIsOpen(false);
            setQuery(selectedLabel);
          }, 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            setQuery(selectedLabel);
          }

          if (event.key === "Enter" && filteredAirports.length > 0) {
            event.preventDefault();
            commitSelection(filteredAirports[0]);
          }
        }}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
      />

      {isOpen && filteredAirports.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-30 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-slate-950/95 p-1 shadow-[0_24px_64px_rgba(2,6,23,0.55)] backdrop-blur-xl">
          {filteredAirports.map((airport) => {
            const label = formatAirportLabel(airport);
            return (
              <button
                key={`${airport.airport_name}-${airport.latitude}-${airport.longitude}`}
                type="button"
                className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition hover:bg-cyan-400/10 hover:text-cyan-50"
                onMouseDown={(event) => {
                  event.preventDefault();
                  commitSelection(airport);
                }}
              >
                <span className="text-sm font-medium text-slate-100">{label}</span>
                <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{airport.city ?? "Airport"}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {isOpen && query.trim() && filteredAirports.length === 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-30 rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm text-slate-400 shadow-[0_24px_64px_rgba(2,6,23,0.55)] backdrop-blur-xl">
          No matching airports found.
        </div>
      ) : null}
    </div>
  );
}

function formatAirportLabel(airport: AirportItem): string {
  return airport.city ? `${airport.city} - ${airport.airport_name}` : airport.airport_name;
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().trim();
}
