/**
 * ============================================================
 * AMOUR AFFAIRS — IST date/time helpers
 * ============================================================
 * Every timestamp in the system is Indian Standard Time:
 * the API pins both PHP and MySQL to Asia/Kolkata, so the
 * "YYYY-MM-DD HH:MM:SS" strings it returns are IST wall time
 * with no timezone marker. These helpers (1) parse those naive
 * strings *as IST* rather than as the browser's local zone, and
 * (2) format everything in Asia/Kolkata — so the dashboard shows
 * the same, correct Indian time no matter where it's opened.
 * ============================================================
 */

const IST = "Asia/Kolkata";

/**
 * Parse an API/DB timestamp into a Date.
 * - "2026-07-08 09:00:00" / "2026-07-08T09:00:00" (naive) → treated as IST
 * - "2026-07-08" (date-only) → IST midnight
 * - Strings with an explicit zone ("...Z", "...+05:30") → respected as-is
 * Returns null when empty or unparseable.
 */
export function parseIST(value: string | null | undefined): Date | null {
  if (!value) return null;
  let s = String(value).trim();
  if (!s) return null;
  s = s.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += "T00:00:00";
  // No trailing Z or ±hh:mm → naive IST wall time; stamp the offset.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s += "+05:30";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Epoch millis for a DB timestamp (0 when missing/invalid) — for sorting/diffs. */
export function istTime(value: string | null | undefined): number {
  const d = parseIST(value);
  return d ? d.getTime() : 0;
}

type DateOpts = Intl.DateTimeFormatOptions;

export function formatISTDate(value: string | Date | null | undefined, opts?: DateOpts): string {
  const d = value instanceof Date ? value : parseIST(value);
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { timeZone: IST, ...opts });
}

export function formatISTTime(value: string | Date | null | undefined, opts?: DateOpts): string {
  const d = value instanceof Date ? value : parseIST(value);
  if (!d) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: IST, ...opts });
}

export function formatISTDateTime(value: string | Date | null | undefined, opts?: DateOpts): string {
  const d = value instanceof Date ? value : parseIST(value);
  if (!d) return "";
  return d.toLocaleString("en-IN", { timeZone: IST, ...opts });
}

/** Day-of-month (1–31) in IST — for calendar date blocks. */
export function istDayOfMonth(value: string | Date | null | undefined): number {
  const d = value instanceof Date ? value : parseIST(value);
  if (!d) return 0;
  return Number(d.toLocaleDateString("en-IN", { day: "numeric", timeZone: IST }));
}

/** Current time as a naive IST "YYYY-MM-DD HH:mm:ss" string — matches the
    format the PHP API writes, so client-written timestamps stay consistent. */
export function nowISTStamp(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  // hour can render as "24" at midnight in some engines — normalise it.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")}`;
}

/** "YYYY-MM-DD" key of the IST calendar day — for grouping by date. */
export function istDayKey(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : parseIST(value);
  if (!d) return "";
  // en-CA renders dates as YYYY-MM-DD.
  return d.toLocaleDateString("en-CA", { timeZone: IST });
}
