"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
};

export function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState({ name: false, email: false, password: false, confirmPassword: false });

  const canSubmit = useMemo(
    () => name.trim().length >= 2 && emailPattern.test(email) && password.length >= 8 && password === confirmPassword,
    [name, email, password, confirmPassword],
  );

  function validate(nextName: string, nextEmail: string, nextPassword: string, nextConfirmPassword: string) {
    const nextErrors: FormErrors = {};

    if (nextName.trim().length < 2) {
      nextErrors.name = "Enter your full name or team name.";
    }

    if (!emailPattern.test(nextEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (nextPassword.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (nextPassword !== nextConfirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(name, email, password, confirmPassword);
    setErrors(nextErrors);
    setTouched({ name: true, email: true, password: true, confirmPassword: true });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setErrors({ form: payload.error ?? "Registration failed." });
        return;
      }

      router.push("/login?registered=1");
    } catch {
      setErrors({ form: "Registration failed. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignup() {
    void signIn("google", { callbackUrl: "/console" }).catch(() => {
      setErrors({ form: "Google sign-up failed. Check OAuth credentials and restart the app." });
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
              Create Secure Access
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
              <InfoTile title="Built for Teams" text="Create your account and access the route console securely." />
              <InfoTile title="Minimal Friction" text="Fast onboarding without clutter or visual noise." />
            </div>
          </motion.div>
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
                  <p className="text-xs uppercase tracking-[0.34em] text-cyan-300/80">New Account</p>
                  <h2 className="airfoil-text text-3xl font-semibold text-white">Create your access</h2>
                  <p className="text-sm leading-6 text-slate-300">
                    Join the secure cockpit for route planning and bird-risk intelligence.
                  </p>
                </div>

                {errors.form ? (
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                    {errors.form}
                  </div>
                ) : null}

                <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                  <Field
                    label="Full Name"
                    icon={<UserPlus className="h-4 w-4" />}
                    error={touched.name ? errors.name : undefined}
                    input={
                      <Input
                        type="text"
                        placeholder="Aviation Operations"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        onBlur={() => {
                          setTouched((current) => ({ ...current, name: true }));
                          setErrors((current) => ({ ...current, ...validate(name, email, password, confirmPassword) }));
                        }}
                      />
                    }
                  />

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
                          setErrors((current) => ({ ...current, ...validate(name, email, password, confirmPassword) }));
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
                          setErrors((current) => ({ ...current, ...validate(name, email, password, confirmPassword) }));
                        }}
                      />
                    }
                  />

                  <Field
                    label="Confirm Password"
                    icon={<Lock className="h-4 w-4" />}
                    error={touched.confirmPassword ? errors.confirmPassword : undefined}
                    input={
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        onBlur={() => {
                          setTouched((current) => ({ ...current, confirmPassword: true }));
                          setErrors((current) => ({ ...current, ...validate(name, email, password, confirmPassword) }));
                        }}
                      />
                    }
                  />

                  <Button className="w-full justify-between px-5 py-3.5 text-base" type="submit" disabled={loading || !canSubmit}>
                    <span>{loading ? "Creating account..." : "Create account"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <div className="h-px flex-1 bg-white/10" />
                    <span>or</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  <Button
                    type="button"
                    className="w-full justify-center border border-white/15 bg-white/5 px-5 py-3.5 text-base text-slate-100 shadow-none hover:bg-white/10"
                    onClick={handleGoogleSignup}
                    disabled={loading}
                  >
                    Continue with Google
                  </Button>
                </form>

                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Already have an account?</span>
                  <Link href="/login" className="text-cyan-200/90 transition hover:text-cyan-100">
                    Back to login
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
