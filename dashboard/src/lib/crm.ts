/**
 * ============================================================
 * AMOUR AFFAIRS — CRM types + greeting composer
 * ============================================================
 * Shapes returned by api/crm.php and the client-side template
 * → message resolution used everywhere a WhatsApp greeting is
 * sent (dashboard card, notification bell, clients page).
 * ============================================================
 */

import { decodeEntities } from "@/lib/utils";

export type OccasionType = "birthday" | "anniversary" | "kid_birthday" | "other";

export interface ClientDate {
  id: number;
  client_id: number;
  occasion: OccasionType;
  label: string | null;
  person_name: string | null;
  occasion_date: string; // YYYY-MM-DD
  year_known: number;
  notes: string | null;
  is_active: number;
}

export interface UpcomingOccasion {
  kind: "client_date";
  id: number;
  client_id: number;
  client_name: string;
  phone: string | null;
  occasion: OccasionType;
  label: string | null;
  person_name: string | null;
  occasion_date: string;
  next_date: string;
  days_until: number;
  years: number | null;
  occasion_year: number;
  sent: boolean;
}

export interface Festival {
  id: number;
  name: string;
  emoji: string | null;
  festival_date: string;
  is_movable: number;
  message_template: string | null;
  is_active: number;
}

export interface UpcomingFestival {
  kind: "festival";
  id: number;
  name: string;
  emoji: string | null;
  festival_date: string;
  next_date: string;
  days_until: number;
  occasion_year: number;
  is_movable: number;
  message_template: string | null;
  sent_count: number;
}

export type CrmTemplates = Record<string, string>;

export interface UpcomingResponse {
  occasions: UpcomingOccasion[];
  festivals: UpcomingFestival[];
  templates: CrmTemplates;
  days: number;
}

// ── Occasion display metadata ──

export const OCCASION_META: Record<OccasionType, { label: string; emoji: string }> = {
  birthday: { label: "Birthday", emoji: "🎂" },
  anniversary: { label: "Anniversary", emoji: "💍" },
  kid_birthday: { label: "Kid's Birthday", emoji: "🎈" },
  other: { label: "Special Day", emoji: "✨" },
};

export const TEMPLATE_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "crm_tpl_birthday", label: "Birthday", hint: "{name}" },
  { key: "crm_tpl_anniversary", label: "Anniversary", hint: "{name}, {years}" },
  { key: "crm_tpl_kid_birthday", label: "Kid's birthday", hint: "{name}, {person}" },
  { key: "crm_tpl_festival", label: "Festival", hint: "{name}, {festival}" },
  { key: "crm_tpl_other", label: "Other occasions", hint: "{name}, {label}" },
];

const FALLBACK_TEMPLATES: CrmTemplates = {
  crm_tpl_birthday:
    "Dear {name}, wishing you a very happy birthday from all of us at Amour Affairs! 🎂 May your year ahead be filled with love, laughter and beautiful moments.",
  crm_tpl_anniversary:
    "Happy anniversary, {name}! 💍 It was our honour to capture your special day — wishing you both a lifetime of love and happiness. — Team Amour Affairs",
  crm_tpl_kid_birthday:
    "Dear {name}, a very happy birthday to {person}! 🎈 Wishing your little one a day full of joy and wonder. With love, Team Amour Affairs",
  crm_tpl_festival:
    "Dear {name}, warm wishes to you and your family on {festival}! ✨ May the celebrations bring you happiness and light. — Team Amour Affairs",
  crm_tpl_other: "Dear {name}, warm wishes on {label}! — Team Amour Affairs",
};

// ── Message composition ──

interface GreetingContext {
  occasion: OccasionType | "festival";
  clientName: string;
  personName?: string | null;
  label?: string | null;
  festivalName?: string | null;
  /** Per-festival template override (festivals.message_template). */
  festivalTemplate?: string | null;
  years?: number | null;
}

/** Resolve the right template and fill {name} {person} {label} {festival} {years}. */
export function composeGreeting(templates: CrmTemplates | null | undefined, ctx: GreetingContext): string {
  const t = { ...FALLBACK_TEMPLATES, ...(templates || {}) };
  let template: string;
  if (ctx.occasion === "festival") {
    template = (ctx.festivalTemplate || "").trim() || t.crm_tpl_festival;
  } else {
    template = t[`crm_tpl_${ctx.occasion}`] || t.crm_tpl_other;
  }

  const name = decodeEntities(ctx.clientName) || "friend";
  const person = decodeEntities(ctx.personName || "") || decodeEntities(ctx.label || "") || "your little one";
  const label = decodeEntities(ctx.label || "") || "this special day";
  const festival = decodeEntities(ctx.festivalName || "") || "the festival";
  const years = ctx.years != null && ctx.years > 0 ? String(ctx.years) : "";

  return template
    .replace(/\{name\}/g, name)
    .replace(/\{person\}/g, person)
    .replace(/\{label\}/g, label)
    .replace(/\{festival\}/g, festival)
    .replace(/\{years\}/g, years)
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Next occurrence of a stored YYYY-MM-DD (recurs yearly; Feb 29 → Feb 28). */
export function nextOccurrenceOf(dateStr: string): { date: Date; days: number; year: number } {
  const [, m, d] = dateStr.split("-").map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mk = (yr: number) => {
    let day = d || 1;
    if (m === 2 && day === 29) {
      const leap = (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
      if (!leap) day = 28;
    }
    return new Date(yr, (m || 1) - 1, day);
  };
  let occ = mk(today.getFullYear());
  if (occ < today) occ = mk(today.getFullYear() + 1);
  const days = Math.round((occ.getTime() - today.getTime()) / 86400000);
  return { date: occ, days, year: occ.getFullYear() };
}

/** "Today", "Tomorrow", "In 5 days". */
export function daysUntilLabel(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/** Human title for an occasion row: "Aarav's birthday", "Wedding anniversary". */
export function occasionTitle(o: UpcomingOccasion | ClientDate): string {
  const label = decodeEntities(o.label || "");
  const person = decodeEntities(o.person_name || "");
  if (label) return label;
  switch (o.occasion) {
    case "birthday": return person ? `${person}'s birthday` : "Birthday";
    case "anniversary": return "Wedding anniversary";
    case "kid_birthday": return person ? `${person}'s birthday` : "Kid's birthday";
    default: return person ? `${person} — special day` : "Special day";
  }
}
