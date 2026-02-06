"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormErrors = {
  email?: string;
  password?: string;
  form?: string;
};

export function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState({ email: false, password: false });
  const registered = searchParams.get("registered");
  const callbackUrl = searchParams.get("callbackUrl");

  const canSubmit = useMemo(() => emailPattern.test(email) && password.length >= 8, [email, password]);
  const nextUrl = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/console";

  function validate(nextEmail: string, nextPassword: string) {
    const nextErrors: FormErrors = {};

    if (!emailPattern.test(nextEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (nextPassword.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(email, password);
    setErrors(nextErrors);
    setTouched({ email: true, password: true });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl: nextUrl,
      });

      if (result?.error) {
        setErrors({ form: "Invalid email or password." });
        return;
      }

      window.location.assign(result?.url ?? nextUrl);
    } catch {
      setErrors({ form: "Login failed. Please check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    void signIn("google", { callbackUrl: nextUrl }).catch(() => {
      setErrors({ form: "Google sign-in failed. Check OAuth credentials and restart the app." });
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B0F14] text-slate-100">
      <div className="login-grid absolute inset-0" />
      <div className="login-glow absolute inset-0" />

      <main className="relative z-10 grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative flex items-center overflow-hidden px-6 py-14 md:px-10 lg:px-14">
          <motion.div
            initial={{ opacity: 0, x: -26 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 max-w-2xl space-y-8"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/90">
              <Sparkles className="h-3.5 w-3.5" />
              Secure Flight Access
            </div>

            <div className="space-y-5">
              <h1 className="airfoil-text text-5xl font-semibold leading-tight text-white sm:text-6xl xl:text-7xl">
                Bird-Safe Flight
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-300">
                Predict. Avoid. Navigate.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoTile title="Operational Safety" text="Intelligent routing for risk-aware flight planning." />
              <InfoTile title="Trusted Access" text="Glass UI with secure authentication entry points." />
            </div>

            <div className="hidden max-w-xl border-l border-cyan-300/20 pl-5 text-sm leading-7 text-slate-400 lg:block">
              Built for aviation teams that need a clean control point to access route analytics, heatmaps, and safer path guidance.
            </div>
          </motion.div>

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(56,189,248,0.12),transparent_28%),radial-gradient(circle_at_70%_70%,rgba(14,165,233,0.12),transparent_30%)]" />
          <motion.div
            aria-hidden="true"
            className="login-orb absolute bottom-10 left-8 h-20 w-20 rounded-full bg-cyan-400/15 blur-2xl"
            animate={{ y: [0, -10, 0], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
        </section>

        <section className="flex items-center justify-center px-6 py-14 md:px-10 lg:px-14">
          <motion.div
            initial={{ opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.75, ease: "easeOut", delay: 0.1 }}
            className="w-full max-w-lg"
          >
            <Card className="border-white/15 bg-white/[0.055] p-6 shadow-[0_24px_90px_rgba(2,6,23,0.45)] backdrop-blur-2xl md:p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.34em] text-cyan-300/80">Welcome Back</p>
                  <h2 className="airfoil-text text-3xl font-semibold text-white">Sign in to continue</h2>
                  <p className="text-sm leading-6 text-slate-300">
                    Access route planning, heatmaps, and real-time bird-risk insights.
                  </p>
                </div>

                {registered ? (
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    Account created successfully. Please sign in.
                  </div>
                ) : null}

                {errors.form ? (
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                    {errors.form}
                  </div>
                ) : null}

                <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                  <Field
                    label="Email"
                    icon={<Mail className="h-4 w-4" />}
                    error={touched.email ? errors.email : undefined}
                    input={
                      <Input
                        type="email"
                        placeholder="pilot@airline.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        onBlur={() => {
                          setTouched((current) => ({ ...current, email: true }));
                          setErrors((current) => ({ ...current, ...validate(email, password) }));
                        }}
                      />
                    }
                  />

                  <Field
                    label="Password"
                    icon={<Lock className="h-4 w-4" />}
                    error={touched.password ? errors.password : undefined}
                    input={
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        onBlur={() => {
                          setTouched((current) => ({ ...current, password: true }));
                          setErrors((current) => ({ ...current, ...validate(email, password) }));
                        }}
                      />
                    }
                  />

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <label className="inline-flex items-center gap-2 text-slate-300">
                      <input type="checkbox" className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-400" />
                      Remember me
                    </label>
                    <Link href="#" className="text-cyan-200/90 transition hover:text-cyan-100">
                      Forgot password?
                    </Link>
                  </div>

                  <Button className="w-full justify-between px-5 py-3.5 text-base" type="submit" disabled={loading || !canSubmit}>
                    <span>{loading ? "Signing in..." : "Login"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    className="w-full justify-center border border-white/15 bg-white/5 px-5 py-3.5 text-base text-slate-100 shadow-none hover:bg-white/10"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                  >
                    Continue with Google
                  </Button>

                  <p className="text-xs leading-5 text-slate-400">
                    Google sign-in requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in [frontend/.env.local](../.env.local).
                  </p>
                </form>

                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>or</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>New to the platform?</span>
                  <Link href="/signup" className="text-cyan-200/90 transition hover:text-cyan-100">
                    Create account
                  </Link>
                </div>
              </div>
            </Card>
          </motion.div>
        </section>
      </main>
    </div>
  );
}

function Field({
  label,
  icon,
  input,
  error,
}: {
  label: string;
  icon: React.ReactNode;
  input: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.26em] text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      {input}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

function InfoTile({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-4 w-4 text-cyan-200" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-white">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}
