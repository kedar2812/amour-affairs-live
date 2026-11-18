"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, BarChart3, LineChart as LineChartIcon, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { ExportMenu } from '@/components/ui/ExportMenu';
import type { DatasetSheet } from '@/lib/exportUtils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, LineChart as RechartsLineChart, Line, ComposedChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { TimeRange } from '@/data/mockChartData';
import { useBookingStats, useLeads, useBookings, usePaymentStats } from '@/lib/useData';
import { buildFunnel, buildSources, buildBookingTypes, buildRevenueSeries } from '@/lib/analytics';
import { analyticsAPI, getStoredToken, type TrafficData } from '@/lib/api';

// Shown inside a chart card when there's no real data to plot yet.
function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center gap-1 py-8">
      <p className="text-[13px] font-semibold text-foreground">No data yet</p>
      <p className="text-[12px] text-muted-foreground max-w-[220px]">{label}</p>
    </div>
  );
}

function fmtMoney(n: number): string {
  n = Number(n) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${n}`;
}


const formatINR = (tickItem: number) => {
  if (tickItem >= 100000) return `₹${tickItem / 100000}L`;
  return `₹${tickItem / 1000}K`;
};

function AnalyticsDropdown({ active, options, onChange }: { active: string, options: string[], onChange: (val: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative z-10 w-fit">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between min-w-[100px] gap-1.5 text-[12px] text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border border-border/40 px-2.5 py-1.5 rounded-md font-medium transition-colors"
       >
        {active}
        <ChevronDown className="h-3 w-3" />
      </button>
      {isOpen && (
         <div className="absolute top-full mt-1 right-0 w-32 bg-card border border-border/50 shadow-lg rounded-lg py-1 z-50">
            {options.map((t) => (
              <button
                key={t}
                onClick={() => { onChange(t); setIsOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-muted font-medium text-foreground transition-colors"
              >
                {t}
              </button>
            ))}
         </div>
      )}
    </div>
  );
}

function RevenueCompChart({ monthly }: { monthly: Array<{ month: string; total: number | string }> }) {
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const data = buildRevenueSeries(monthly);
  const hasData = data.some((d) => d.thisPeriod > 0 || d.lastPeriod > 0);
  return (
    <div className="dash-card p-6 xl:col-span-2 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="dash-card-title">Revenue Trends</h2>
          <p className="text-[13px] text-muted-foreground">Monthly collected revenue.</p>
        </div>
        <div className="flex items-center gap-3">
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
      <div className="h-[300px] w-full flex-1">
        {!hasData ? <ChartEmpty label="Revenue appears here once payments are recorded." /> : (
        <ResponsiveContainer>
          {chartType === "bar" ? (
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={formatINR} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
              <Tooltip 
                cursor={{ fill: 'var(--border)', opacity: 0.2 }}
                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              <Bar dataKey="thisPeriod" name="Current Period" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={32} animationDuration={800} />
              <Line type="monotone" dataKey="lastPeriod" name="Last Period" stroke="#8b93a5" strokeWidth={3} strokeDasharray="5 5" activeDot={{ r: 6 }} animationDuration={800} />
            </ComposedChart>
          ) : (
            <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={formatINR} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
              <Tooltip 
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 4" }}
                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              <Line type="monotone" dataKey="thisPeriod" name="Current Period" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--primary)" }} activeDot={{ r: 6 }} animationDuration={800} />
              <Line type="monotone" dataKey="lastPeriod" name="Last Period" stroke="var(--muted-foreground)" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: "var(--background)", stroke: "var(--muted-foreground)" }} activeDot={{ r: 6 }} animationDuration={800} />
            </RechartsLineChart>
          )}
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function BookingTypesPie({ bookings }: { bookings: any[] }) {
  const [range, setRange] = useState<TimeRange>("Year");
  const data = buildBookingTypes(bookings, range);
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="dash-card p-6 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="dash-card-title">Booking Types</h2>
          <p className="text-[13px] text-muted-foreground">Breakdown of services.</p>
        </div>
        <AnalyticsDropdown active={range} options={["Week", "Month", "Year", "Max"]} onChange={setRange} />
      </div>
      <div className="h-[250px] w-full relative flex-1">
        {total === 0 ? <ChartEmpty label="Booking types appear here as you add bookings." /> : (<>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none" animationDuration={800}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
              itemStyle={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--foreground)' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <AnimatePresence mode="popLayout">
            <motion.span key={total} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="text-2xl font-bold text-foreground">{total}</motion.span>
          </AnimatePresence>
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Bookings</span>
        </div>
        </>)}
      </div>
    </div>
  );
}

function ConversionFunnelChart({ leads }: { leads: any[] }) {
  const [range, setRange] = useState<TimeRange>("Month");
  const data = buildFunnel(leads, range);
  const hasData = data.some((d) => d.count > 0);
  return (
    <div className="dash-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="dash-card-title">Pipeline Drop-off</h2>
        </div>
        <AnalyticsDropdown active={range} options={["Week", "Month", "Year", "Max"]} onChange={setRange} />
      </div>
      <div className="h-[220px] w-full">
        {!hasData ? <ChartEmpty label="Your lead pipeline appears here as inquiries come in." /> : (
         <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
            <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: 'var(--foreground)', fontWeight: 600 }} />
            <XAxis type="number" hide />
            <Tooltip
              cursor={{ fill: 'var(--border)', opacity: 0.2 }}
              contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
            />
            <Bar dataKey="count" fill="var(--primary)" barSize={24} radius={[0, 4, 4, 0]} animationDuration={800}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`hsl(40, 45%, ${60 - index * 10}%)`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function LeadSourcesChart({ leads }: { leads: any[] }) {
  const [range, setRange] = useState<TimeRange>("Month");
  const data = buildSources(leads, range);
  const hasData = data.length > 0;
  return (
    <div className="dash-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="dash-card-title">Lead Sources</h2>
        </div>
        <AnalyticsDropdown active={range} options={["Week", "Month", "Year", "Max"]} onChange={setRange} />
      </div>
      <div className="h-[220px] w-full">
        {!hasData ? <ChartEmpty label="Lead sources appear here as inquiries are tagged." /> : (
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
            <XAxis type="number" hide />
            <Tooltip
              cursor={{ fill: 'var(--border)', opacity: 0.2 }}
              contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
            />
            <Bar dataKey="value" fill="#3b82f6" barSize={16} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: 'var(--foreground)', fontSize: 13, fontWeight: 'bold', formatter: (val: any) => `${val}%` }} animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   WEBSITE TRAFFIC — first-party analytics (api/analytics.php)
   ════════════════════════════════════════════════════════════ */

const TRAFFIC_RANGES: [string, string][] = [
  ['Last 7 days', '7d'],
  ['Last 30 days', '30d'],
  ['Last 90 days', '90d'],
  ['Last 12 months', '12m'],
  ['All time', 'all'],
];

const DEVICE_COLORS: Record<string, string> = {
  desktop: 'hsl(40, 45%, 52%)',
  mobile: 'hsl(40, 45%, 36%)',
  tablet: 'hsl(40, 30%, 70%)',
  unknown: 'hsl(40, 12%, 80%)',
};

// % change vs the previous period; null when there's nothing to compare against.
function pctDelta(cur: number, prev?: number | null): number | null {
  if (prev == null || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function TrafficKpi({ label, value, delta, hint }: { label: string; value: string; delta?: number | null; hint?: string }) {
  return (
    <div className="dash-card p-4 flex flex-col justify-center items-center text-center">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block w-full">{label}</span>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      {delta != null ? (
        <span className={`mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded ${delta >= 0 ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-500/10'}`}>
          {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta >= 0 ? '+' : ''}{delta}% vs prev
        </span>
      ) : hint ? (
        <span className="mt-1.5 text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

// Horizontal bar list (same visual language as Top Pages).
function BarList({ rows }: { rows: { name: string; views: number }[] }) {
  const max = rows[0]?.views || 1;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-3">
          <span className="text-[12px] text-foreground font-medium w-[38%] truncate" title={r.name}>{r.name}</span>
          <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
            <div className="h-full bg-primary/70 rounded" style={{ width: `${Math.max(4, (r.views / max) * 100)}%` }} />
          </div>
          <span className="text-[12px] font-bold text-foreground w-12 text-right">{r.views}</span>
        </div>
      ))}
    </div>
  );
}

function WebsiteTraffic({ onData }: { onData?: (d: TrafficData | null) => void }) {
  const [rangeLabel, setRangeLabel] = useState('Last 30 days');
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const range = TRAFFIC_RANGES.find(([l]) => l === rangeLabel)?.[1] || '30d';

  useEffect(() => {
    let live = true;
    if (!getStoredToken()) { setLoading(false); setData(null); return; }
    setLoading(true);
    analyticsAPI.traffic(range)
      .then((d) => { if (live) { setData(d); setLoading(false); onData?.(d); } })
      .catch(() => { if (live) { setData(null); setLoading(false); onData?.(null); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const totals = data?.totals;
  const hasData = !!totals && totals.views > 0;
  const prev = data?.prev_totals;
  const eng = data?.engagement;
  const topSource = data?.sources?.[0]?.source;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Website Traffic</h2>
          <p className="text-[13px] text-muted-foreground">Live first-party visitor analytics from your website.</p>
        </div>
        <AnalyticsDropdown active={rangeLabel} options={TRAFFIC_RANGES.map(([l]) => l)} onChange={setRangeLabel} />
      </div>

      {loading ? (
        <div className="dash-card p-12 flex items-center justify-center"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
      ) : !hasData ? (
        <div className="dash-card p-10 text-center">
          <p className="text-[14px] font-semibold text-foreground">No traffic recorded yet</p>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-md mx-auto">
            Visits appear here as people browse the website. Give it a little time after launch, or widen the date range.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <TrafficKpi label="Visitors" value={totals!.visitors.toLocaleString()} delta={pctDelta(totals!.visitors, prev?.visitors)} />
            <TrafficKpi label="Pageviews" value={totals!.views.toLocaleString()} delta={pctDelta(totals!.views, prev?.views)} />
            <TrafficKpi label="Sessions" value={totals!.sessions.toLocaleString()} delta={pctDelta(totals!.sessions, prev?.sessions)} />
            <TrafficKpi label="Pages / Session" value={eng?.pages_per_session != null ? String(eng.pages_per_session) : '—'} hint="Depth of each visit" />
            <TrafficKpi label="Bounce Rate" value={eng?.bounce_rate != null ? `${eng.bounce_rate}%` : '—'} hint="Single-page visits" />
            <TrafficKpi label="Top Source" value={topSource || '—'} hint="Where visitors come from" />
          </div>

          <div className="dash-card p-6">
            <h3 className="text-base font-bold text-foreground mb-4">Visitors &amp; Pageviews</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={data!.series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gTraffic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={24} dy={8} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }} itemStyle={{ fontSize: '13px', fontWeight: 'bold' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="views" name="Pageviews" stroke="var(--primary)" strokeWidth={2} fill="url(#gTraffic)" animationDuration={700} />
                  <Line type="monotone" dataKey="visitors" name="Visitors" stroke="#8b93a5" strokeWidth={2} dot={false} animationDuration={700} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="dash-card p-6 xl:col-span-2">
              <h3 className="text-base font-bold text-foreground mb-4">Top Pages</h3>
              <div className="space-y-2.5">
                {data!.top_pages.map((p) => {
                  const max = data!.top_pages[0]?.views || 1;
                  return (
                    <div key={p.path} className="flex items-center gap-3">
                      <span className="text-[12px] text-foreground font-medium w-[44%] truncate" title={p.path}>{p.path}</span>
                      <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                        <div className="h-full bg-primary/70 rounded" style={{ width: `${Math.max(4, (p.views / max) * 100)}%` }} />
                      </div>
                      <span className="text-[12px] font-bold text-foreground w-12 text-right">{p.views}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="dash-card p-6 flex flex-col">
              <h3 className="text-base font-bold text-foreground mb-4">Devices</h3>
              <div className="h-[220px] w-full flex-1">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data!.devices} dataKey="views" nameKey="device" innerRadius={55} outerRadius={78} paddingAngle={2} stroke="none" animationDuration={700}>
                      {data!.devices.map((d) => <Cell key={d.device} fill={DEVICE_COLORS[d.device] || 'hsl(40, 20%, 75%)'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }} itemStyle={{ fontSize: '13px', fontWeight: 'bold' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="dash-card p-6 xl:col-span-2">
              <h3 className="text-base font-bold text-foreground mb-4">Traffic Sources</h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer>
                  <BarChart data={data!.sources} layout="vertical" margin={{ top: 0, right: 36, left: 20, bottom: 0 }}>
                    <YAxis dataKey="source" type="category" axisLine={false} tickLine={false} width={92} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                    <XAxis type="number" hide allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'var(--border)', opacity: 0.2 }} contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }} />
                    <Bar dataKey="views" fill="var(--primary)" barSize={18} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: 'var(--foreground)', fontSize: 12, fontWeight: 'bold' }} animationDuration={700} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dash-card p-6">
              <h3 className="text-base font-bold text-foreground mb-4">Browsers</h3>
              {(data!.browsers?.length ?? 0) === 0 ? (
                <ChartEmpty label="Browser data appears here as visits are recorded." />
              ) : (
                <BarList rows={data!.browsers.map((b) => ({ name: b.browser, views: b.views }))} />
              )}
            </div>
          </div>

          {data!.countries.length > 0 && (
            <div className="dash-card p-6">
              <h3 className="text-base font-bold text-foreground mb-4">Top Countries</h3>
              <div className="flex flex-wrap gap-2">
                {data!.countries.map((c) => (
                  <span key={c.country} className="text-[12px] font-medium text-foreground bg-muted/40 border border-border/40 rounded-full px-3 py-1">
                    {c.country} · {c.views}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}


export default function AnalyticsPage() {
  const { data: bStats } = useBookingStats();
  const { data: leads } = useLeads();
  const { data: bookings } = useBookings();
  const { data: payStats } = usePaymentStats();
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const bs = (bStats || {}) as Record<string, number>;
  const monthly = (((payStats || {}) as any).monthly_revenue || []) as Array<{ month: string; total: number | string }>;
  const avgBooking = (bs.total_bookings ?? 0) > 0 ? (bs.total_revenue ?? 0) / bs.total_bookings : 0;

  // Everything currently on screen, flattened into a downloadable report.
  const exportDatasets = useMemo<DatasetSheet[]>(() => {
    const sheets: DatasetSheet[] = [];
    if (traffic) {
      sheets.push({
        sheetName: 'Traffic Overview',
        columns: ['Metric', 'Value'],
        rows: [
          ['Date range', traffic.range],
          ['Visitors', traffic.totals.visitors],
          ['Pageviews', traffic.totals.views],
          ['Sessions', traffic.totals.sessions],
          ['Pages per session', traffic.engagement?.pages_per_session ?? '—'],
          ['Bounce rate (%)', traffic.engagement?.bounce_rate ?? '—'],
        ],
      });
      sheets.push({
        sheetName: 'Traffic Over Time',
        columns: ['Date', 'Pageviews', 'Visitors'],
        rows: traffic.series.map((s) => [s.label, s.views, s.visitors]),
      });
      sheets.push({
        sheetName: 'Top Pages',
        columns: ['Page', 'Views', 'Visitors'],
        rows: traffic.top_pages.map((p) => [p.path, p.views, p.visitors]),
      });
      sheets.push({
        sheetName: 'Traffic Sources',
        columns: ['Source', 'Views'],
        rows: traffic.sources.map((s) => [s.source, s.views]),
      });
      sheets.push({
        sheetName: 'Devices & Browsers',
        columns: ['Type', 'Name', 'Views'],
        rows: [
          ...traffic.devices.map((d): (string | number)[] => ['Device', d.device, d.views]),
          ...(traffic.browsers || []).map((b): (string | number)[] => ['Browser', b.browser, b.views]),
        ],
      });
    }
    sheets.push({
      sheetName: 'Studio KPIs',
      columns: ['Metric', 'Value'],
      rows: [
        ['Total revenue (₹)', bs.total_revenue ?? 0],
        ['Total bookings', bs.total_bookings ?? 0],
        ['Collected (₹)', bs.collected ?? 0],
        ['Outstanding (₹)', bs.outstanding ?? 0],
        ['Upcoming shoots (30d)', bs.upcoming_30_days ?? 0],
      ],
    });
    return sheets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traffic, bStats]);

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full h-full pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="dash-h1">Analytics</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Website traffic and studio performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportMenu datasets={exportDatasets} filename="amour-affairs-analytics" pdfTitle="Analytics Report" />
        </div>
      </div>

      {/* Website traffic (first-party analytics) */}
      <WebsiteTraffic onData={setTraffic} />

      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-border/50" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Studio Performance</span>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: "Total Revenue", val: fmtMoney(bs.total_revenue), up: true },
          { label: "Total Bookings", val: String(bs.total_bookings ?? 0), up: true },
          { label: "Avg Booking Val", val: fmtMoney(avgBooking), up: true },
          { label: "Collected", val: fmtMoney(bs.collected), up: true },
          { label: "Outstanding", val: fmtMoney(bs.outstanding), up: false },
          { label: "Upcoming (30d)", val: String(bs.upcoming_30_days ?? 0), up: true },
        ].map(kpi => (
          <div key={kpi.label} className="dash-card p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block w-full">{kpi.label}</span>
            <span className="text-xl font-bold text-foreground">{kpi.val}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <RevenueCompChart monthly={monthly} />
        <BookingTypesPie bookings={bookings as any[]} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
        <ConversionFunnelChart leads={leads as any[]} />
        <LeadSourcesChart leads={leads as any[]} />
      </div>
    </div>
  );
}
