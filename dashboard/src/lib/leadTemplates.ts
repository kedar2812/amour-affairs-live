/**
 * ============================================================
 * AMOUR AFFAIRS — Lead WhatsApp presets (3-stage funnel)
 * ============================================================
 * The studio talks to every enquiry on WhatsApp, and always in
 * one of three moments: the welcome when the lead lands, the
 * date-hold nudge while the booking is pending, and the warm
 * closure when they go elsewhere. Those three messages live
 * here as editable templates (settings group 'crm', saved via
 * crm.php?action=templates) with the studio's own copy as the
 * fallback, so the feature works before anything is saved.
 *
 * Message text is WhatsApp-flavoured, not Markdown: *bold* uses
 * single asterisks, because it goes straight into a wa.me link.
 * ============================================================
 */

import { decodeEntities } from "@/lib/utils";
import { formatISTDate } from "@/lib/datetime";
import { isValidStoredPhone, waDigits, formatPhone } from "@/lib/phone";

// The pipeline columns, shared by the leads board and every drawer
// that can move a lead.
export const LEAD_STAGES = [
  "New Inquiry",
  "Contacted",
  "Consultation Scheduled",
  "Proposal Sent",
  "Won",
  "Lost",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export interface LeadNote {
  content: string;
  author?: string;
  authorId?: string;
  date: string;
}

/** The fields a lead needs for a message to be composed and sent. */
export interface MessageableLead {
  id: number;
  lead_ref?: string;
  client_name: string;
  phone?: string | null;
  stage: string;
  event_type?: string | null;
  event_date?: string | null;
  venue?: string | null;
  bride_name?: string | null;
  bride_phone?: string | null;
  bride_whatsapp?: string | null;
  groom_name?: string | null;
  groom_phone?: string | null;
  groom_whatsapp?: string | null;
}

export type LeadPresetKey = "welcome" | "followup" | "closure";

export interface LeadPreset {
  key: LeadPresetKey;
  /** settings row that overrides `fallback` (group 'crm'). */
  settingKey: string;
  stageNo: 1 | 2 | 3;
  /** Short name shown on the preset card. */
  name: string;
  /** When the studio should reach for this one. */
  when: string;
  /** Stage the lead usually moves to after this message goes out. */
  suggestedStage: LeadStage;
  fallback: string;
}

// ── The three presets (client's own copy, verbatim) ──

const WELCOME = `*Thank you for contacting Amour Affairs!*

We are overjoyed to connect with you. Since 2011, we have been weaving the love stories of more than 1000+ happy, delighted couples across the world into timeless memories. As one of the Premier Wedding Photography and Videography company, our clients become part of our cherished “Amour Family.”

Your journey with us begins now, and we're thrilled you reached out with your requirements. We will get back to you shortly to discuss how we can bring your vision to life with our exceptional services. We are excited to craft unforgettable moments for you.

Stay connected with us on Instagram: *https://www.instagram.com/amouraffairs/*

Join our WhatsApp community for updates and inspiration: *https://whatsapp.com/channel/0029VahBNDi8V0tjZIKaup3n*

Book an Appointment: *https://maps.app.goo.gl/8dvPLftiPk4qtZHx7?g_st=ia*

Team Amour Affairs`;

const FOLLOWUP = `Hello {name},

I hope this message finds you well. As per our last conversation, we’ve been holding your dates with the hope of being part of your special day. We know how important this time is for you, and we would be honored to capture your story.

However, we’ve recently received a few inquiries for the same dates. We genuinely don’t want to miss the opportunity to work with you, so I wanted to kindly ask if you’ve made a decision. If you’re still considering us, we would love to block the dates and begin planning together.

Please let us know at your earliest convenience, so we can plan accordingly. Your wedding deserves the very best, and we’re eager to make that happen for you!

Looking forward to hearing from you.

Warm regards,
Taher Husain
Director, Amouraffairs`;

const CLOSURE = `Hello, we have noticed that you’ve decided to go in a different direction for your wedding photography and videography, and while we’re a bit saddened not to be part of your special day, we genuinely wish you nothing but the best.

Your wedding is a beautiful celebration of love, and we hope it turns out to be everything you dreamed of and more. Should you ever need us in the future or want to capture other milestones in your life, please know that our doors are always open.

Wishing you an unforgettable wedding day and a lifetime filled with happiness, love, and cherished memories.

And do follow us - www.instagram.com/amouraffairs

With warmest wishes,
Taher Husain
Founder, Amouraffairs`;

export const LEAD_PRESETS: LeadPreset[] = [
  {
    key: "welcome",
    settingKey: "crm_tpl_lead_welcome",
    stageNo: 1,
    name: "Initial Inquiry & Welcome",
    when: "A new enquiry just came in — welcome them and introduce the studio.",
    suggestedStage: "Contacted",
    fallback: WELCOME,
  },
  {
    key: "followup",
    settingKey: "crm_tpl_lead_followup",
    stageNo: 2,
    name: "Date Hold & Booking Follow-up",
    when: "Booking still undecided — check on the dates and nudge gently.",
    suggestedStage: "Proposal Sent",
    fallback: FOLLOWUP,
  },
  {
    key: "closure",
    settingKey: "crm_tpl_lead_closure",
    stageNo: 3,
    name: "Warm Closure & Goodwill",
    when: "They went elsewhere — close warmly and keep the door open.",
    suggestedStage: "Lost",
    fallback: CLOSURE,
  },
];

export const getPreset = (key: LeadPresetKey): LeadPreset =>
  LEAD_PRESETS.find((p) => p.key === key) || LEAD_PRESETS[0];

/** Placeholders offered in the preset editor. */
export const LEAD_PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{name}", label: "Couple / client name" },
  { token: "{bride}", label: "Bride's name" },
  { token: "{groom}", label: "Groom's name" },
  { token: "{event}", label: "Event type" },
  { token: "{date}", label: "Event date" },
  { token: "{venue}", label: "Venue" },
];

/** The preset the studio most likely wants, given where the lead sits now. */
export function presetForStage(stage: string): LeadPresetKey {
  if (stage === "Lost") return "closure";
  if (stage === "New Inquiry") return "welcome";
  return "followup";
}

// ── Composition ──

const dec = (v: string | null | undefined) => (v ? decodeEntities(v).trim() : "");

/** "Priya & Rahul" when both names are known, else whatever we have. */
function displayName(lead: MessageableLead): string {
  const bride = dec(lead.bride_name);
  const groom = dec(lead.groom_name);
  if (bride && groom) return `${bride} & ${groom}`;
  return bride || groom || dec(lead.client_name) || "there";
}

/**
 * Fill a preset's placeholders for a lead. Line breaks are preserved
 * exactly — these messages are multi-paragraph and WhatsApp renders
 * them as typed — so only runs of spaces and orphaned punctuation left
 * behind by an empty placeholder are tidied.
 */
export function composeLeadMessage(
  templates: Record<string, string> | null | undefined,
  lead: MessageableLead,
  key: LeadPresetKey,
): string {
  const preset = getPreset(key);
  // Decoded on the way out, never encoded on the way in: crm.php stores
  // templates raw and leads.php stores notes raw (they're a JSON field, not a
  // sanitised string), so a studio "&" stays "&" through a full round trip.
  // The decode here is belt-and-braces for any legacy encoded row.
  const template = decodeEntities((templates?.[preset.settingKey] || "").trim()) || preset.fallback;

  const values: Record<string, string> = {
    name: displayName(lead),
    bride: dec(lead.bride_name),
    groom: dec(lead.groom_name),
    event: dec(lead.event_type) || "wedding",
    date: lead.event_date ? formatISTDate(lead.event_date, { day: "numeric", month: "long", year: "numeric" }) : "",
    venue: dec(lead.venue),
  };

  return template
    .replace(/\{(name|bride|groom|event|date|venue)\}/g, (_m, k: string) => values[k] ?? "")
    .split("\n")
    .map((line) => {
      const cleaned = line
        .replace(/[ \t]{2,}/g, " ")      // gaps left by an empty placeholder
        .replace(/\s+([,.!?])/g, "$1")   // "Hello ," → "Hello,"
        .trimEnd();
      // A line that held nothing but a placeholder collapses to punctuation —
      // drop it rather than sending a stray comma. Sign-offs ("Warm regards,")
      // keep their punctuation because they still carry words.
      return /^[\s,.!?;:·\-—–]*$/.test(cleaned) ? "" : cleaned;
    })
    .join("\n")
    .trim();
}

// ── Recipients ──

export interface LeadRecipient {
  /** Stable key for this number within the lead. */
  id: string;
  role: string;
  name: string;
  /** E.164-ish stored form. */
  phone: string;
  display: string;
  digits: string;
}

/**
 * Every usable WhatsApp number on a lead, most-likely-first: the primary
 * contact, then the bride and groom (their WhatsApp number when it differs
 * from their phone). Duplicates and unusable numbers are dropped.
 */
export function leadRecipients(lead: MessageableLead): LeadRecipient[] {
  const candidates: { id: string; role: string; name: string; phone: string | null | undefined }[] = [
    { id: "primary", role: "Primary contact", name: dec(lead.client_name), phone: lead.phone },
    { id: "bride_wa", role: "Bride · WhatsApp", name: dec(lead.bride_name) || "Bride", phone: lead.bride_whatsapp },
    { id: "bride", role: "Bride", name: dec(lead.bride_name) || "Bride", phone: lead.bride_phone },
    { id: "groom_wa", role: "Groom · WhatsApp", name: dec(lead.groom_name) || "Groom", phone: lead.groom_whatsapp },
    { id: "groom", role: "Groom", name: dec(lead.groom_name) || "Groom", phone: lead.groom_phone },
  ];

  const seen = new Set<string>();
  const out: LeadRecipient[] = [];
  for (const c of candidates) {
    const phone = (c.phone || "").trim();
    if (!phone || !isValidStoredPhone(phone)) continue;
    const digits = waDigits(phone);
    if (!digits || seen.has(digits)) continue;
    seen.add(digits);
    out.push({
      id: c.id,
      role: c.role,
      name: c.name || "—",
      phone,
      display: formatPhone(phone),
      digits,
    });
  }
  return out;
}

/** wa.me deep link for a resolved recipient. */
export function recipientLink(recipient: LeadRecipient, message: string): string {
  return `https://wa.me/${recipient.digits}?text=${encodeURIComponent(message)}`;
}

/** The note written to the lead's timeline when a preset goes out. */
export function buildSentNote(
  preset: LeadPreset,
  recipients: LeadRecipient[],
  message: string,
  date: string,
): LeadNote {
  const to = recipients.length
    ? recipients.map((r) => `${r.name} (${r.display})`).join(", ")
    : "no recipient recorded";
  return {
    content: `Stage ${preset.stageNo} — ${preset.name} → ${to}\n\n${message}`,
    author: "WhatsApp",
    date,
  };
}
