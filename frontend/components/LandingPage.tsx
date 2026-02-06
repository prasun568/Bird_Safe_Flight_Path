"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Brain, CloudSun, Eye, Map, Route, ShieldCheck } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";

const sectionTransition = { duration: 0.7, ease: "easeOut" } as const;

function SectionReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={sectionTransition}
    >
      {children}
    </motion.div>
  );
}

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0B0F14] text-slate-100">
      <div className="landing-grid absolute inset-0" />
      <div className="landing-glow absolute inset-0" />

      <main className="relative z-10">
        <section className="flex min-h-screen items-center px-6 py-16 md:px-12 lg:px-20">
          <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="space-y-8"
            >
              <p className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/90">
                Aviation Safety Intelligence
              </p>

              <div className="space-y-5">
                <h1 className="airfoil-text text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                  AI-Powered Safe Flight Routing
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-300">
                  Predict and avoid bird collision risks in real-time.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link href="/console">
                  <Button className="px-8 py-3 text-base">Launch Console</Button>
                </Link>
                <a href="#visual-demo" className="inline-flex">
                  <Button className="border border-white/20 bg-white/5 px-8 py-3 text-base text-slate-100 shadow-none hover:bg-white/10">
                    View Demo
                  </Button>
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
              className="relative"
            >
              <div className="absolute -inset-8 rounded-[2rem] bg-cyan-400/15 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#0d1520]/85 p-5 shadow-[0_28px_120px_rgba(2,132,199,0.18)] backdrop-blur-2xl">
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Live Airspace Preview</span>
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-100">
                    System Active
                  </span>
                </div>

                <div className="relative h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_30%,rgba(56,189,248,0.22),transparent_42%),radial-gradient(circle_at_30%_75%,rgba(248,113,113,0.14),transparent_35%)]" />
                  <div className="absolute left-[14%] top-[68%] h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_25px_rgba(110,231,183,0.9)]" />
                  <div className="absolute right-[12%] top-[22%] h-3 w-3 rounded-full bg-rose-300 shadow-[0_0_25px_rgba(253,164,175,0.9)]" />
                  <motion.svg
                    viewBox="0 0 100 100"
                    className="absolute inset-0 h-full w-full"
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.2 }}
                  >
                    <defs>
                      <linearGradient id="routeLine" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#7dd3fc" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M12,74 C26,55 35,52 44,50 C55,48 64,39 82,23"
                      fill="none"
                      stroke="url(#routeLine)"
                      strokeWidth="1.4"
                      strokeDasharray="4 3"
                      className="landing-route-stroke"
                    />
                  </motion.svg>
                  <motion.div
                    className="absolute left-[12%] top-[74%] h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(125,211,252,0.95)]"
                    animate={{
                      x: [0, 62, 112, 162, 214],
                      y: [0, -19, -25, -42, -52],
                    }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="visual-demo" className="px-6 py-20 md:px-12 lg:px-20">
          <SectionReveal>
            <div className="mx-auto max-w-6xl space-y-8">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.34em] text-cyan-300/80">Visual Demo</p>
                <h2 className="airfoil-text text-3xl font-semibold text-white md:text-4xl">Dynamic Risk Heatmap + Smart Route Overlay</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <DemoTile title="Heatmap Intelligence" description="Gradient risk fields identify high-density bird activity corridors in seconds." icon={<Map className="h-5 w-5" />} />
                <DemoTile title="Flight Path Optimization" description="Theta*-smoothed pathing balances distance, weather, and collision risk." icon={<Route className="h-5 w-5" />} />
              </div>
            </div>
          </SectionReveal>
        </section>

        <section className="px-6 py-20 md:px-12 lg:px-20">
          <SectionReveal>
            <div className="mx-auto max-w-6xl space-y-8">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.34em] text-cyan-300/80">Core Features</p>
                <h2 className="airfoil-text text-3xl font-semibold text-white md:text-4xl">Built for Aviation-Grade Decisions</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <FeatureCard title="Risk Prediction" subtitle="XGBoost" icon={<Brain className="h-5 w-5" />} />
                <FeatureCard title="Smart Routing" subtitle="A* / Theta*" icon={<Route className="h-5 w-5" />} />
                <FeatureCard title="Weather Integration" subtitle="Dynamic Penalties" icon={<CloudSun className="h-5 w-5" />} />
                <FeatureCard title="Interactive Visualization" subtitle="Map + Heatmap" icon={<Eye className="h-5 w-5" />} />
              </div>
            </div>
          </SectionReveal>
        </section>

        <section className="px-6 py-20 md:px-12 lg:px-20">
          <SectionReveal>
            <div className="mx-auto max-w-6xl space-y-10">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.34em] text-cyan-300/80">How It Works</p>
                <h2 className="airfoil-text text-3xl font-semibold text-white md:text-4xl">Three Steps to Safer Routes</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <StepCard index="01" title="Select Airports" text="Choose departure and arrival airports from the route console." />
                <StepCard index="02" title="Analyze Risk" text="Model blends bird activity, strikes, and weather patterns." />
                <StepCard index="03" title="Generate Safe Route" text="Optimizer outputs smoother, lower-risk flight corridors." />
              </div>
            </div>
          </SectionReveal>
        </section>

        <section className="px-6 py-24 md:px-12 lg:px-20">
          <SectionReveal>
            <div className="mx-auto max-w-5xl rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-400/12 to-slate-900/60 px-8 py-12 text-center shadow-[0_20px_80px_rgba(56,189,248,0.15)] backdrop-blur-2xl md:px-14">
              <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Ready to Deploy</p>
              <h2 className="airfoil-text mt-4 text-3xl font-semibold text-white md:text-5xl">Start Planning Safer Flights Today</h2>
              <div className="mt-8">
                <Link href="/console">
                  <Button className="px-9 py-3 text-base">Open Dashboard</Button>
                </Link>
              </div>
            </div>
          </SectionReveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 px-6 py-8 md:px-12 lg:px-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 text-sm text-slate-400">
          <p>Bird-Safe Flight Path Predictor</p>
          <p>Built with Next.js, Tailwind, Framer Motion</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_14px_40px_rgba(2,6,23,0.45)] backdrop-blur-xl">
      <div className="inline-flex rounded-xl border border-cyan-300/25 bg-cyan-400/10 p-2 text-cyan-200">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
    </div>
  );
}

function DemoTile({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-[0_14px_44px_rgba(2,6,23,0.45)] backdrop-blur-xl">
      <div className="inline-flex rounded-xl border border-cyan-300/25 bg-cyan-400/10 p-2 text-cyan-200">{icon}</div>
      <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}

function StepCard({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-[0_14px_44px_rgba(2,6,23,0.45)] backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300/80">{index}</p>
      <h3 className="mt-3 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}
