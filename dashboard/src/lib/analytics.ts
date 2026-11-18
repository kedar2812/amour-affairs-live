// ============================================================
// Real analytics aggregations computed from the live API data
// (leads / bookings / payment stats). Replaces the old zeroed
// mock chart data so every chart reflects the actual database.
// ============================================================

// DB timestamps are naive IST strings — parse them as IST, not browser-local.
import { istTime } from "@/lib/datetime";

export type Range = "Week" | "Month" | "Year" | "Max";

export const LEAD_STAGES = ["New Inquiry", "Contacted", "Consultation Scheduled", "Proposal Sent", "Won"] as const;
export const LEAD_SOURCES = ["Website", "Instagram", "WhatsApp", "Google", "Referral", "Other"] as const;
const SOURCE_COLORS: Record<string, string> = {
  Website: "var(--primary)", Instagram: "#ec4899", WhatsApp: "#10b981",
  Google: "#3b82f6", Referral: "#8b5cf6", Other: "#f59e0b",
};
const TYPE_PALETTE = ["var(--primary)", "#ec4899", "#3b82f6", "#a855f7", "#10b981", "#f59e0b"];

const RANGE_DAYS: Record<Range, number> = { Week: 7, Month: 31, Year: 366, Max: 100000 };

export function withinRange(iso: string | undefined, range: Range): boolean {
  if (range === "Max") return true;
  const t = istTime(iso);
  if (!t) return false;
  return Date.now() - t <= RANGE_DAYS[range] * 86400000;
}

type Lead = { stage?: string; source?: string; created_at?: string; movedToStageAt?: string; moved_to_stage_at?: string };
type Booking = { event_type?: string; eventType?: string; created_at?: string; date_start?: string; date?: string };

// First usable date across the snake_case (API) and camelCase (mock) shapes.
const leadDate = (l: Lead) => l.created_at || l.moved_to_stage_at || l.movedToStageAt;
const bookingDate = (b: Booking) => b.created_at || b.date_start || b.date;

const FUNNEL_COLORS = [
  "var(--primary)", "hsl(var(--primary) / 0.8)", "hsl(var(--primary) / 0.65)",
  "hsl(var(--primary) / 0.5)", "hsl(var(--primary) / 0.35)",
];

// Conversion funnel — how many leads REACHED each stage (i.e. are currently at
// it or anywhere further along). Counting only the leads *sitting* at a stage
// makes the maths garbage: one lead moved straight to Won would render as
// 0 → 0 → 0 → 0 → 1 with -100% drop-offs and a 0% overall conversion. We only
// know each lead's current stage, so "Lost"/unknown leads are counted at the
// top of the funnel (they at least enquired) but at no later stage.
export function buildFunnel(leads: Lead[], range: Range) {
  const f = leads.filter((l) => withinRange(leadDate(l), range));
  const stageIndex = (l: Lead) => LEAD_STAGES.indexOf((l.stage || "") as (typeof LEAD_STAGES)[number]);
  return LEAD_STAGES.map((stage, i) => ({
    stage,
    count: f.filter((l) => {
      const k = stageIndex(l);
      return k >= i || (k === -1 && i === 0);
    }).length,
    color: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
  }));
}

// Lead volume in the current window vs the equal-length window right before
// it — the honest "vs previous" comparison for KPI badges. `previous` is null
// for "Max" (there is no previous window to compare against).
export function rangeCounts(leads: Lead[], range: Range): { current: number; previous: number | null } {
  if (range === "Max") return { current: leads.length, previous: null };
  const windowMs = RANGE_DAYS[range] * 86400000;
  const now = Date.now();
  let current = 0;
  let previous = 0;
  for (const l of leads) {
    const t = istTime(leadDate(l));
    if (!t) continue;
    const age = now - t;
    if (age < 0) continue;
    if (age <= windowMs) current++;
    else if (age <= windowMs * 2) previous++;
  }
  return { current, previous };
}

// Lead sources as a % share of leads in range.
export function buildSources(leads: Lead[], range: Range) {
  const f = leads.filter((l) => withinRange(leadDate(l), range));
  const total = f.length || 1;
  return LEAD_SOURCES
    .map((name) => ({ name, count: f.filter((l) => (l.source || "Other") === name).length }))
    .filter((s) => s.count > 0)
    .map((s) => ({ name: s.name, value: Math.round((s.count / total) * 100), color: SOURCE_COLORS[s.name] || "#f59e0b" }));
}

// Booking types by count of bookings in range.
export function buildBookingTypes(bookings: Booking[], range: Range) {
  const f = bookings.filter((b) => withinRange(bookingDate(b), range));
  const counts = new Map<string, number>();
  for (const b of f) {
    const t = b.event_type || b.eventType || "Other";
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].map(([name, value], i) => ({ name, value, color: TYPE_PALETTE[i % TYPE_PALETTE.length] }));
}

// Monthly revenue as {name, realised, projected} bars for the dashboard chart.
export function buildRevenueBars(monthly: Array<{ month: string; total: number | string }> | undefined) {
  const rows = Array.isArray(monthly) ? monthly : [];
  return rows.map((r) => {
    const d = new Date((r.month || "") + "-01T00:00:00");
    const name = Number.isNaN(d.getTime()) ? String(r.month) : d.toLocaleDateString("en-IN", { month: "short" });
    return { name, realised: Number(r.total) || 0, projected: 0 };
  });
}

// Monthly revenue series from payment stats ({month:'YYYY-MM', total}).
export function buildRevenueSeries(monthly: Array<{ month: string; total: number | string }> | undefined) {
  const rows = Array.isArray(monthly) ? monthly : [];
  return rows.map((r, i) => {
    const d = new Date((r.month || "") + "-01T00:00:00");
    const label = Number.isNaN(d.getTime())
      ? String(r.month)
      : d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    return { time: label, thisPeriod: Number(r.total) || 0, lastPeriod: i > 0 ? Number(rows[i - 1].total) || 0 : 0 };
  });
}
