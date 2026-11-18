/**
 * ============================================================
 * AMOUR AFFAIRS — CRM Families model + recipient routing
 * ============================================================
 * One record per family ("Vikram & Priyanka") with husband /
 * wife / child members. `resolveRecipients` decides who a wish
 * goes to and is a pure, UI-free, unit-tested function.
 *
 * Shapes mirror api/families.php.
 * ============================================================
 */

import { decodeEntities } from "@/lib/utils";
import { waDigits, isValidStoredPhone, formatPhone } from "@/lib/phone";

export type MemberRole = "husband" | "wife" | "child";
export type OccasionKind = "birthday" | "anniversary" | "festival";

export interface FamilyMember {
  id: number;
  family_id: number;
  role: MemberRole;
  name: string;
  dob: string | null;
  dob_year_known: number;
  phone: string | null;
  whatsapp: string | null;
}

export interface Family {
  id: number;
  display_name: string;
  anniversary_date: string | null;
  anniversary_year_known: number;
  notes: string | null;
  /** 1 = the family has received their album. */
  album_given: number;
  /** Date album_given was marked yes (YYYY-MM-DD). */
  album_given_at: string | null;
  /** 1 = the family has given the studio a testimonial. */
  testimonial_given: number;
  testimonial_given_at: string | null;
  is_active: number;
  members: FamilyMember[];
}

export interface FamilyOccasion {
  kind: "birthday" | "child_birthday" | "anniversary";
  occasion: "birthday" | "anniversary";
  occasion_key: string;
  family_id: number;
  family: Family;
  member_id: number | null;
  member_role: MemberRole | null;
  person_name: string | null;
  source_date: string;
  next_date: string;
  days_until: number;
  years: number | null;
  occasion_year: number;
  sent: boolean;
}

export interface FamilyFestival {
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
}

export interface FamiliesUpcomingResponse {
  occasions: FamilyOccasion[];
  festivals: FamilyFestival[];
  families: Family[];
  templates: Record<string, string>;
  days: number;
}

// ── Recipient resolution ──

export interface Recipient {
  member_id: number;
  name: string;
  role: MemberRole;
  /** Raw stored number chosen (whatsapp preferred, else phone). */
  stored: string;
  /** wa.me digits ("919921000052"). */
  digits: string;
  display: string;
}

export interface SkippedRecipient {
  member_id: number;
  name: string;
  role: MemberRole;
  reason: "no_number" | "invalid_number";
}

export interface ResolvedRecipients {
  recipients: Recipient[];
  skipped: SkippedRecipient[];
}

/** The occasion a wish is being sent for. */
export type WishTarget =
  | { type: "birthday"; memberId: number }
  | { type: "anniversary" }
  | { type: "festival" };

const bestNumber = (m: FamilyMember): string => (m.whatsapp || m.phone || "").trim();

/**
 * Decide who receives a wish, per the studio's routing rules:
 *   • Any birthday (husband, wife, or child) → both parents (husband + wife)
 *   • Anniversary                            → both husband and wife
 *   • Festival                               → all adult members (husband + wife)
 * Adults with a valid number become recipients; anyone chosen but missing or
 * holding an invalid number is surfaced in `skipped` rather than dropped.
 * Numbers are de-duplicated so a shared handset is only messaged once.
 */
export function resolveRecipients(family: Family, target: WishTarget): ResolvedRecipients {
  const members = family.members || [];
  const adults = members.filter((m) => m.role === "husband" || m.role === "wife");

  // Every routing rule resolves to "the adult couple". Birthdays of a child
  // go to the parents; an adult's own birthday still includes their spouse,
  // which is exactly the couple — so the selection is uniform.
  const chosen = adults;

  const recipients: Recipient[] = [];
  const skipped: SkippedRecipient[] = [];
  const seenDigits = new Set<string>();

  for (const m of chosen) {
    const stored = bestNumber(m);
    if (!stored) {
      skipped.push({ member_id: m.id, name: decodeEntities(m.name), role: m.role, reason: "no_number" });
      continue;
    }
    if (!isValidStoredPhone(stored)) {
      skipped.push({ member_id: m.id, name: decodeEntities(m.name), role: m.role, reason: "invalid_number" });
      continue;
    }
    const digits = waDigits(stored);
    if (seenDigits.has(digits)) continue; // shared number — message once
    seenDigits.add(digits);
    recipients.push({
      member_id: m.id,
      name: decodeEntities(m.name),
      role: m.role,
      stored,
      digits,
      display: formatPhone(stored),
    });
  }

  return { recipients, skipped };
}

// ── Message composition ──

const FALLBACK_TEMPLATES: Record<string, string> = {
  crm_tpl_birthday:
    "Dear {name}, wishing you a very happy birthday from all of us at Amour Affairs! May your year ahead be filled with love, laughter and beautiful moments.",
  crm_tpl_anniversary:
    "Happy anniversary, {name}! It was our honour to capture your special day — wishing you both a lifetime of love and happiness. — Team Amour Affairs",
  crm_tpl_kid_birthday:
    "Dear {name}, a very happy birthday to {person}! Wishing your little one a day full of joy and wonder. With love, Team Amour Affairs",
  crm_tpl_festival:
    "Dear {name}, warm wishes to you and your family on {festival}! May the celebrations bring you happiness and light. — Team Amour Affairs",
  crm_tpl_other: "Dear {name}, warm wishes on {label}! — Team Amour Affairs",
};

interface ComposeArgs {
  templates: Record<string, string> | null | undefined;
  family: Family;
  occasion: OccasionKind;
  /** For a birthday: the member whose birthday it is. */
  member?: FamilyMember | null;
  /** For a festival. */
  festivalName?: string | null;
  festivalTemplate?: string | null;
  years?: number | null;
}

/**
 * Build the WhatsApp message for a family occasion. {name} resolves to the
 * birthday person for adult birthdays, and to the family's display name for
 * child birthdays, anniversaries and festivals (the message goes to the
 * parents/couple). Fills {person} {festival} {years} {label}.
 */
export function composeFamilyMessage(args: ComposeArgs): string {
  const { family, occasion, member, festivalName, festivalTemplate, years } = args;
  const t = { ...FALLBACK_TEMPLATES, ...(args.templates || {}) };
  const familyName = decodeEntities(family.display_name) || "friends";

  let template: string;
  let name: string;
  let person = "";

  if (occasion === "festival") {
    template = (festivalTemplate || "").trim() || t.crm_tpl_festival;
    name = familyName;
  } else if (occasion === "anniversary") {
    template = t.crm_tpl_anniversary;
    name = familyName;
  } else if (member && member.role === "child") {
    template = t.crm_tpl_kid_birthday;
    name = familyName;
    person = decodeEntities(member.name);
  } else {
    // Adult birthday — address the birthday person directly
    template = t.crm_tpl_birthday;
    name = member ? decodeEntities(member.name) : familyName;
  }

  const yearsStr = years != null && years > 0 ? String(years) : "";
  return template
    .replace(/\{name\}/g, name)
    .replace(/\{person\}/g, person || "your little one")
    .replace(/\{festival\}/g, decodeEntities(festivalName || "") || "the festival")
    .replace(/\{label\}/g, "this special day")
    .replace(/\{years\}/g, yearsStr)
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

// ── Display helpers ──

export const ROLE_LABEL: Record<MemberRole, string> = {
  husband: "Husband",
  wife: "Wife",
  child: "Child",
};

/** "Aarav's Birthday", "Wedding Anniversary". */
export function occasionTitle(o: FamilyOccasion): string {
  const person = decodeEntities(o.person_name || "");
  if (o.occasion === "anniversary") return "Wedding Anniversary";
  return person ? `${person}'s Birthday` : "Birthday";
}

/** "3 Sep 2026" from a stored YYYY-MM-DD. */
export function formatFlagDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Follow-ups (album / testimonial) ──

export type FollowUpFilter = "all" | "album_pending" | "testimonial_pending" | "complete";

export const FOLLOW_UP_FILTERS: { key: FollowUpFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "album_pending", label: "Album not given" },
  { key: "testimonial_pending", label: "Testimonial not given" },
  { key: "complete", label: "Both done" },
];

export function matchesFollowUp(f: Family, filter: FollowUpFilter): boolean {
  if (filter === "album_pending") return f.album_given !== 1;
  if (filter === "testimonial_pending") return f.testimonial_given !== 1;
  if (filter === "complete") return f.album_given === 1 && f.testimonial_given === 1;
  return true;
}
