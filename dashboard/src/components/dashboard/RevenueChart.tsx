"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, LineChart as LineChartIcon } from "lucide-react";
import { usePaymentStats } from "@/lib/useData";
import { buildRevenueBars } from "@/lib/analytics";
import { formatINRCompact } from "@/lib/utils";

const fmtRevenue = formatINRCompact;

// Y-axis tick: compact ₹ label for raw-rupee values.
function fmtAxis(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/*
 * Monthly Revenue — collected revenue per month over the last 12 months,
 * from the payments API. Bar/line toggle; empty state until payments exist.
 */

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-card rounded-lg px-3.5 py-2.5 shadow-lg border border-border/50 text-[14px]">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-sm" style={{ background: entry.color }} />
          <span className="text-muted-foreground capitalize">{entry.name || entry.dataKey}:</span>
          <span className="font-semibold text-foreground">{formatINRCompact(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart() {
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const { data: payStats } = usePaymentStats();
  const monthly = (((payStats || {}) as any).monthly_revenue || []) as Array<{ month: string; total: number | string }>;
  const currentData = buildRevenueBars(monthly);
  const totalRealised = currentData.reduce((s, d) => s + d.realised, 0);
  const hasData = currentData.some((d) => d.realised > 0);
  const currentKPIs = {
    total: fmtRevenue(totalRealised),
    avg: fmtRevenue(currentData.length ? totalRealised / currentData.length : 0),
    increaseText: "collected over the last 12 months",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 }}
      className="h-full"
    >
      <div className="dash-card h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-3">
          <div className="min-w-[200px]">
            <h3 className="dash-card-title">Monthly Revenue</h3>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl font-bold text-foreground tracking-tight">{currentKPIs.total}</span>
            </div>
            <p className="text-[12px] text-muted-foreground mt-1">{currentKPIs.increaseText}</p>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            {/* Chart Type Toggle */}
            <div className="flex items-center bg-muted/50 border border-border/50 rounded-lg p-0.5">
              <button 
                 onClick={() => setChartType("bar")}
                 className={`p-1.5 rounded-md transition-colors ${chartType === "bar" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                 title="Bar Chart"
              >
                  <BarChart3 className="h-4 w-4" />
              </button>
              <button 
                 onClick={() => setChartType("line")}
                 className={`p-1.5 rounded-md transition-colors ${chartType === "line" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                 title="Line Chart"
              >
                  <LineChartIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 px-4 pb-3 min-h-[260px]">
          {!hasData ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-center gap-1 py-8">
              <p className="text-[13px] font-semibold text-foreground">No revenue yet</p>
              <p className="text-[12px] text-muted-foreground max-w-[240px]">Monthly collected revenue appears here as you record payments.</p>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={currentData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={3} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 500 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 500 }} tickFormatter={fmtAxis} dx={-4} domain={[0, 'dataMax']} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.8, radius: 4 }} />
                <Bar dataKey="realised" name="Collected" fill="var(--primary)" radius={[4, 4, 0, 0]} animationDuration={800} />
              </BarChart>
            ) : (
              <LineChart data={currentData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 500 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 500 }} tickFormatter={fmtAxis} dx={-4} domain={[0, 'dataMax']} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Line type="monotone" dataKey="realised" name="Collected" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--primary)" }} activeDot={{ r: 6 }} animationDuration={800} />
              </LineChart>
            )}
          </ResponsiveContainer>
          )}
        </div>

        {/* Legend strip */}
        <div className="border-t border-border/50 px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
            <span className="text-[12px] text-muted-foreground font-medium">Collected</span>
          </div>
          <div className="ml-auto text-[12px] text-muted-foreground">
            Avg: <span className="font-semibold text-foreground">{currentKPIs.avg}</span> / month
          </div>
        </div>
      </div>
    </motion.div>
  );
}
