"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Globe, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";
import { analyticsAPI, getStoredToken, type TrafficData } from "@/lib/api";

/*
 * Compact website-traffic strip for the dashboard home — last-30-days
 * KPIs from the first-party analytics API plus a pageview sparkline,
 * linking through to the full Analytics page.
 */

function pctDelta(cur: number, prev?: number | null): number | null {
  if (prev == null || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function StripKpi({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return (
    <div className="flex flex-col min-w-[92px]">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className="text-xl font-bold text-foreground">{value}</span>
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${delta >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-red-600 dark:text-red-500"}`}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
    </div>
  );
}

export function WebsiteTrafficStrip() {
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    if (!getStoredToken()) { setLoading(false); return; }
    analyticsAPI.traffic("30d")
      .then((d) => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  if (loading) {
    return <div className="dash-card p-5 h-[92px] animate-pulse" />;
  }
  if (!data) return null;

  const t = data.totals;
  const prev = data.prev_totals;
  const topSource = data.sources?.[0]?.source;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="dash-card p-5 flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-center gap-3 shrink-0 lg:w-[190px]">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Globe className="h-5.5 w-5.5 text-primary" strokeWidth={1.7} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-foreground leading-tight">Website Traffic</p>
            <p className="text-[11px] text-muted-foreground">Last 30 days</p>
          </div>
        </div>

        {t.views === 0 ? (
          <p className="text-[13px] text-muted-foreground flex-1">
            No visits recorded yet — traffic appears here as people browse the website.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 flex-1">
              <StripKpi label="Visitors" value={t.visitors.toLocaleString()} delta={pctDelta(t.visitors, prev?.visitors)} />
              <StripKpi label="Pageviews" value={t.views.toLocaleString()} delta={pctDelta(t.views, prev?.views)} />
              <StripKpi label="Sessions" value={t.sessions.toLocaleString()} delta={pctDelta(t.sessions, prev?.sessions)} />
              {topSource && <StripKpi label="Top Source" value={topSource} />}
            </div>

            <div className="h-[56px] w-full lg:w-[220px] shrink-0">
              <ResponsiveContainer>
                <AreaChart data={data.series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gStripTraffic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", fontSize: "12px" }}
                    labelFormatter={(_, p: any) => p?.[0]?.payload?.label ?? ""}
                    formatter={(v: any) => [v, "Pageviews"]}
                  />
                  <Area type="monotone" dataKey="views" stroke="var(--primary)" strokeWidth={2} fill="url(#gStripTraffic)" animationDuration={600} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        <Link
          href="/analytics"
          className="shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
        >
          View analytics
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}
