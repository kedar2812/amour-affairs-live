import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The PHP API stores text HTML-encoded (htmlspecialchars with
 * ENT_QUOTES | ENT_HTML5, so apostrophes arrive as &apos;).
 * Decode once when data is loaded — otherwise text displays encoded
 * AND every edit-save cycle re-encodes it (& → &amp; → &amp;amp;).
 * &amp; is decoded last so e.g. &amp;quot; doesn't double-decode.
 */
export function decodeEntities(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Full Indian-format rupees: 150000 → "₹1,50,000". Never NaN. */
export function formatINR(value: number | string | null | undefined): string {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Compact Indian-format rupees for KPI tiles: ₹1.5L, ₹2.3Cr, ₹45K. */
export function formatINRCompact(value: number | string | null | undefined): string {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (abs >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/** 10-digit Indian mobile, with optional +91 / 0 prefix and spaces/dashes. */
export function isValidIndianPhone(value: string): boolean {
  const digits = value.replace(/[\s\-()]/g, "").replace(/^\+91/, "").replace(/^0/, "");
  return /^[6-9]\d{9}$/.test(digits);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
