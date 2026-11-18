"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Camera, Loader2, Eye, EyeOff, ArrowRight, Aperture, Heart, Sparkles } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(email, password);
      window.location.href = "/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-[1.05fr_1fr] bg-background">
      {/* ─────────── Brand / visual panel ─────────── */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white">
        {/* Layered terracotta → midnight wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A2E] via-[#2A2336] to-[#C8956C]" />
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(200,149,108,0.55),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(245,230,220,0.18),transparent_40%)]" />
        {/* Soft grain / vignette */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.45),transparent_55%)]" />
        {/* Floating aperture rings */}
        <div className="absolute -top-16 -right-16 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute top-24 right-10 h-40 w-40 rounded-full border border-white/10" />

        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center ring-1 ring-white/20">
            <Camera className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[17px] font-bold leading-tight tracking-tight">Amour Affairs</p>
            <p className="text-[12px] text-white/70 font-medium">Photography Studio</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Aperture className="h-9 w-9 text-white/80 mb-6" strokeWidth={1.4} />
          <h2 className="text-[32px] leading-[1.18] font-bold tracking-tight">
            Every frame, every booking — beautifully in one place.
          </h2>
          <p className="mt-4 text-[14px] text-white/75 leading-relaxed">
            Manage weddings, couple shoots, leads and films from a single calm
            dashboard built for your studio.
          </p>

          <div className="mt-9 space-y-3.5">
            {[
              { icon: Heart, text: "Turn website enquiries into booked weddings" },
              { icon: Camera, text: "Curate the albums & films your clients see" },
              { icon: Sparkles, text: "Track every lead from first hello to delivery" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-lg bg-white/12 backdrop-blur-md flex items-center justify-center ring-1 ring-white/15 shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </span>
                <span className="text-[13.5px] text-white/85 font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[12px] text-white/55">
          © {new Date().getFullYear()} Amour Affairs Photography · Pune
        </p>
      </aside>

      {/* ─────────── Form panel ─────────── */}
      <main className="flex items-center justify-center px-6 py-12 sm:px-12 min-h-screen lg:min-h-0">
        <div className="w-full max-w-[400px]">
          {/* Mobile-only brand */}
          <div className="flex lg:hidden flex-col items-center mb-10">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25 mb-4">
              <Camera className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Amour Affairs</h1>
            <p className="text-sm text-muted-foreground mt-1">Studio Dashboard</p>
          </div>

          <div className="mb-8">
            <h1 className="text-[26px] font-bold text-foreground tracking-tight">Welcome back</h1>
            <p className="text-[14px] text-muted-foreground mt-1.5">Sign in to manage your studio.</p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="text-[12px] font-semibold text-foreground/80 mb-2 block">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoComplete="email"
                className="w-full h-12 px-4 bg-muted/40 border border-border rounded-xl text-foreground text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="text-[12px] font-semibold text-foreground/80">Password</label>
                <span className="text-[12px] text-muted-foreground/60">Forgot? Contact admin</span>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-12 px-4 pr-12 bg-muted/40 border border-border rounded-xl text-foreground text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="group w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-[14px] shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
              )}
            </button>
          </form>

          <p className="text-[12px] text-muted-foreground/60 mt-8 text-center lg:hidden">
            © {new Date().getFullYear()} Amour Affairs Photography
          </p>
        </div>
      </main>
    </div>
  );
}
