"use client";

import React, { useState, useCallback } from "react";
import { Loader2, X, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { settingsAPI, getStoredToken } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";

/* ============================================================
   WEBSITE CONTENT — dashboard-editable page copy
   Edits the `site_content` settings group consumed by the
   public website (src/js/site-content.js):
   · the enquiry section inside Weddings folders
   · the enquiry section inside Couple Shoots folders
   · the three couple-shoot session packages
   · the three wedding collections
   The website falls back to identical bundled defaults when a
   key is missing, so partial saves can never break a page.
   ============================================================ */

interface PackageRow { label: string; value: string }
interface SessionPackage { name: string; tagline: string; rows: PackageRow[] }

interface StatItem { number: string; suffix: string; label: string }

interface EnquiryCopy { label: string; title: string; text: string; button: string }

interface NoticeCfg {
  enabled: boolean;
  message: string;
  ctaLabel: string;
  ctaLink: string;
  barEnabled: boolean;
  barPosition: string; // 'top' | 'bottom'
  badgeEnabled: boolean;
  badgeText: string;
  bgColor: string;
  textColor: string;
  dismissible: boolean;
}

const DEFAULT_NOTICE: NoticeCfg = {
  enabled: true,
  message: "Now booking 2026 & 2027 weddings — limited dates remain",
  ctaLabel: "Check your date",
  ctaLink: "/contact/",
  barEnabled: true,
  barPosition: "top",
  badgeEnabled: true,
  badgeText: "Limited 2026 dates",
  bgColor: "#2A1E16",
  textColor: "#F5EDE2",
  dismissible: true,
};

// Mirrors the values baked into the website's index.html + site-content.js.
const DEFAULT_STATS: StatItem[] = [
  { number: "15", suffix: "+", label: "Years of Experience" },
  { number: "500", suffix: "+", label: "Weddings Captured" },
  { number: "10", suffix: "", label: "Press Features" },
  { number: "1000", suffix: "+", label: "Happy Couples" },
];

const DEFAULT_WEDDINGS_ENQ: EnquiryCopy = {
  label: "Begin Your Story",
  title: "Book Your *Wedding*",
  text:
    "Loved what you found in this folder? Tell us about your celebration and " +
    "we’ll get back within 24 hours — with ideas, availability and a fair quote.",
  button: "Send Inquiry",
};

const DEFAULT_COUPLE_ENQ: EnquiryCopy = {
  label: "Your Story, Before The Wedding",
  title: "Book Your *Couple Shoot*",
  text:
    "Pictured yourselves in one of these folders? Share a few details about " +
    "the two of you and we’ll get back within 24 hours with dates, locations and ideas.",
  button: "Send Inquiry",
};

const DEFAULT_WPKG_EYEBROW = "What We Offer";
const DEFAULT_WPKG_HEADING = "Wedding *Collections*";

const DEFAULT_WPACKAGES: SessionPackage[] = [
  {
    name: "The Ceremony Collection",
    tagline: "One wedding day",
    rows: [
      { label: "Coverage", value: "One wedding day" },
      { label: "Team", value: "2 photographers" },
      { label: "Deliverables", value: "400–500 fully edited images" },
      { label: "Turnaround", value: "6–8 weeks" },
      { label: "Album", value: "One fine-art album, 30 spreads" },
    ],
  },
  {
    name: "The Celebration Collection",
    tagline: "Photographs + cinematic film",
    rows: [
      { label: "Coverage", value: "Up to 3 functions" },
      { label: "Team", value: "2 photographers + 1 cinematographer" },
      { label: "Deliverables", value: "700–900 images + a 5–7 minute film" },
      { label: "Turnaround", value: "8–10 weeks" },
      { label: "Album", value: "One fine-art album, 40 spreads" },
    ],
  },
  {
    name: "The Heirloom Collection",
    tagline: "Every function, start to finish",
    rows: [
      { label: "Coverage", value: "All functions, multi-city" },
      { label: "Team", value: "3 photographers + 2 cinematographers" },
      { label: "Deliverables", value: "1200+ images, feature film + teaser" },
      { label: "Turnaround", value: "10–12 weeks" },
      { label: "Album", value: "Two fine-art albums + parent copies" },
    ],
  },
];

const DEFAULT_PKG_EYEBROW = "What to Expect";
const DEFAULT_PKG_HEADING = "Choose Your *Session*";

const DEFAULT_PACKAGES: SessionPackage[] = [
  {
    name: "The Stills Collection",
    tagline: "Photographs only",
    rows: [
      { label: "Coverage", value: "2–3 hours" },
      { label: "Deliverables", value: "80–120 fully edited images" },
      { label: "Turnaround", value: "2–3 weeks" },
      { label: "Locations", value: "Pune + outstation on request" },
      { label: "Outfit Changes", value: "Up to 2 included" },
    ],
  },
  {
    name: "The Cinema Collection",
    tagline: "A cinematic couple film",
    rows: [
      { label: "Coverage", value: "2–3 hours" },
      { label: "Deliverables", value: "A 60–90 second cinematic film" },
      { label: "Turnaround", value: "3–4 weeks" },
      { label: "Locations", value: "Pune + outstation on request" },
      { label: "Outfit Changes", value: "Up to 2 included" },
    ],
  },
  {
    name: "The Signature Collection",
    tagline: "Photographs + cinematic film",
    rows: [
      { label: "Coverage", value: "4–5 hours" },
      { label: "Deliverables", value: "80–120 edited images + cinematic film" },
      { label: "Turnaround", value: "3–4 weeks" },
      { label: "Locations", value: "Pune + outstation on request" },
      { label: "Outfit Changes", value: "Up to 3 included" },
    ],
  },
];

const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
};

/* ── Small shared inputs ── */

function Field({ label, value, onChange, hint, textarea }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; textarea?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
          className="w-full p-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none" />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
      )}
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <span className="text-[13px] font-semibold text-foreground">{label}</span>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 rounded-lg border border-border/50 bg-transparent cursor-pointer p-1" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground font-mono focus:outline-none focus:border-primary/50" />
      </div>
    </div>
  );
}

function NoticeEditor({ cfg, onChange }: { cfg: NoticeCfg; onChange: (c: NoticeCfg) => void }) {
  const set = <K extends keyof NoticeCfg>(key: K, val: NoticeCfg[K]) => onChange({ ...cfg, [key]: val });
  return (
    <div className="space-y-5">
      <Toggle label="Show the booking notice" checked={cfg.enabled} onChange={(v) => set("enabled", v)}
        hint="Master switch — turns off both the bar and the badge across the whole site." />

      <div className={cfg.enabled ? "space-y-5" : "space-y-5 opacity-50 pointer-events-none"}>
        <Field label="Message" value={cfg.message} onChange={(v) => set("message", v)}
          hint="Shown in the announcement bar, e.g. “Now booking 2026 & 2027 weddings — limited dates remain”." />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Button Label" value={cfg.ctaLabel} onChange={(v) => set("ctaLabel", v)} hint="Leave blank for no button." />
          <Field label="Button Link" value={cfg.ctaLink} onChange={(v) => set("ctaLink", v)} hint="e.g. /contact/ or a full https:// URL." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ColorField label="Background Colour" value={cfg.bgColor} onChange={(v) => set("bgColor", v)} />
          <ColorField label="Text Colour" value={cfg.textColor} onChange={(v) => set("textColor", v)} />
        </div>

        <div className="border-t border-border/40 pt-4 space-y-3">
          <Toggle label="Announcement bar" checked={cfg.barEnabled} onChange={(v) => set("barEnabled", v)}
            hint="The slim site-wide strip." />
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Bar Position</label>
            <select value={cfg.barPosition} onChange={(e) => set("barPosition", e.target.value)}
              className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50">
              <option value="top">Top of page (above the menu)</option>
              <option value="bottom">Bottom of page</option>
            </select>
          </div>
          <Toggle label="Visitors can dismiss the bar" checked={cfg.dismissible} onChange={(v) => set("dismissible", v)}
            hint="Adds a × button. Changing the message re-shows it to everyone." />
        </div>

        <div className="border-t border-border/40 pt-4 space-y-3">
          <Toggle label="Floating badge (homepage)" checked={cfg.badgeEnabled} onChange={(v) => set("badgeEnabled", v)}
            hint="A small pill near the hero that fades out as visitors scroll." />
          <Field label="Badge Text" value={cfg.badgeText} onChange={(v) => set("badgeText", v)}
            hint="Keep it short, e.g. “Limited 2026 dates”." />
        </div>
      </div>
    </div>
  );
}

function StatsEditor({ stats, onChange }: { stats: StatItem[]; onChange: (s: StatItem[]) => void }) {
  const setStat = (i: number, patch: Partial<StatItem>) =>
    onChange(stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {stats.map((stat, i) => (
        <div key={i} className="border border-border/50 rounded-xl p-5 space-y-4 bg-muted/10">
          <div className="flex items-end gap-3">
            <div className="w-[45%]">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Number</label>
              <input type="text" inputMode="numeric" value={stat.number}
                onChange={(e) => setStat(i, { number: e.target.value })}
                className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Suffix</label>
              <input type="text" value={stat.suffix} placeholder="e.g. +"
                onChange={(e) => setStat(i, { suffix: e.target.value })}
                className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <Field label="Label" value={stat.label} onChange={(v) => setStat(i, { label: v })} />
          <p className="text-[11px] text-muted-foreground">
            Shows as <span className="font-semibold text-foreground">{(stat.number || "0") + (stat.suffix || "")}</span> — {stat.label || "…"}
          </p>
        </div>
      ))}
    </div>
  );
}

function EnquiryEditor({ copy, onChange }: { copy: EnquiryCopy; onChange: (c: EnquiryCopy) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Eyebrow Label" value={copy.label} onChange={(v) => onChange({ ...copy, label: v })} />
        <Field label="Heading" value={copy.title} onChange={(v) => onChange({ ...copy, title: v })}
          hint="Wrap a word in *asterisks* for the italic accent, e.g. Book Your *Wedding*" />
      </div>
      <Field label="Intro Text" value={copy.text} onChange={(v) => onChange({ ...copy, text: v })} textarea />
      <Field label="Submit Button Label" value={copy.button} onChange={(v) => onChange({ ...copy, button: v })} />
    </div>
  );
}

function PackagesEditor({ packages, onChange }: {
  packages: SessionPackage[]; onChange: (p: SessionPackage[]) => void;
}) {
  const setPkg = (i: number, patch: Partial<SessionPackage>) =>
    onChange(packages.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const setRow = (i: number, j: number, patch: Partial<PackageRow>) =>
    onChange(packages.map((p, idx) => (idx === i
      ? { ...p, rows: p.rows.map((r, k) => (k === j ? { ...r, ...patch } : r)) }
      : p)));

  const addRow = (i: number) =>
    onChange(packages.map((p, idx) => (idx === i
      ? { ...p, rows: [...p.rows, { label: "", value: "" }] } : p)));

  const removeRow = (i: number, j: number) =>
    onChange(packages.map((p, idx) => (idx === i
      ? { ...p, rows: p.rows.filter((_, k) => k !== j) } : p)));

  const addPackage = () =>
    onChange([...packages, { name: "", tagline: "", rows: [{ label: "", value: "" }] }]);

  const removePackage = (i: number) => onChange(packages.filter((_, idx) => idx !== i));

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {packages.map((pkg, i) => (
          <div key={i} className="border border-border/50 rounded-xl p-5 space-y-4 bg-muted/10">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Card {i + 1}</span>
              <button onClick={() => removePackage(i)} title="Remove card"
                className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <Field label="Name" value={pkg.name} onChange={(v) => setPkg(i, { name: v })} />
            <Field label="Tagline" value={pkg.tagline} onChange={(v) => setPkg(i, { tagline: v })}
              hint="The small gold line under the name." />

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Detail Rows</label>
              <div className="space-y-2">
                {pkg.rows.map((row, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <input type="text" value={row.label} placeholder="Label" onChange={(e) => setRow(i, j, { label: e.target.value })}
                      className="w-[30%] h-9 px-2.5 bg-muted/30 border border-border/50 rounded-lg text-[13px] text-foreground focus:outline-none focus:border-primary/50" />
                    <input type="text" value={row.value} placeholder="Value" onChange={(e) => setRow(i, j, { value: e.target.value })}
                      className="flex-1 h-9 px-2.5 bg-muted/30 border border-border/50 rounded-lg text-[13px] text-foreground focus:outline-none focus:border-primary/50" />
                    <button onClick={() => removeRow(i, j)} title="Remove row"
                      className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => addRow(i)}
                className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-primary hover:opacity-80 transition-opacity">
                <Plus className="h-3.5 w-3.5" /> Add Row
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addPackage}
        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary hover:opacity-80 transition-opacity">
        <Plus className="h-3.5 w-3.5" /> Add Card
      </button>
    </>
  );
}

export default function WebsiteContentPage() {
  const [stats, setStats] = useState<StatItem[]>(DEFAULT_STATS);
  const [weddingsEnq, setWeddingsEnq] = useState<EnquiryCopy>(DEFAULT_WEDDINGS_ENQ);
  const [coupleEnq, setCoupleEnq] = useState<EnquiryCopy>(DEFAULT_COUPLE_ENQ);
  const [wpkgEyebrow, setWpkgEyebrow] = useState(DEFAULT_WPKG_EYEBROW);
  const [wpkgHeading, setWpkgHeading] = useState(DEFAULT_WPKG_HEADING);
  const [wpackages, setWpackages] = useState<SessionPackage[]>(DEFAULT_WPACKAGES);
  const [pkgEyebrow, setPkgEyebrow] = useState(DEFAULT_PKG_EYEBROW);
  const [pkgHeading, setPkgHeading] = useState(DEFAULT_PKG_HEADING);
  const [packages, setPackages] = useState<SessionPackage[]>(DEFAULT_PACKAGES);
  const [notice, setNotice] = useState<NoticeCfg>(DEFAULT_NOTICE);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [mockMode, setMockMode] = useState(false);

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    if (isMockMode()) {
      setMockMode(true);
      setIsLoading(false);
      return;
    }
    try {
      const res = await settingsAPI.getGroup("site_content") as { settings: Record<string, string> };
      const s: Record<string, string> = {};
      Object.entries(res.settings || {}).forEach(([k, v]) => { s[k] = decodeEntities(v || ""); });

      if (s.site_stats_json) {
        try {
          const parsed = JSON.parse(s.site_stats_json);
          if (parsed && Array.isArray(parsed.stats) && parsed.stats.length > 0) {
            setStats(parsed.stats.map((st: Partial<StatItem>) => ({
              number: String(st.number ?? ""),
              suffix: String(st.suffix ?? ""),
              label: String(st.label ?? ""),
            })));
          }
        } catch { /* keep defaults on malformed JSON */ }
      }

      setWeddingsEnq({
        label: s.site_weddings_enq_label || DEFAULT_WEDDINGS_ENQ.label,
        title: s.site_weddings_enq_title || DEFAULT_WEDDINGS_ENQ.title,
        text: s.site_weddings_enq_text || DEFAULT_WEDDINGS_ENQ.text,
        button: s.site_weddings_enq_button || DEFAULT_WEDDINGS_ENQ.button,
      });
      setCoupleEnq({
        label: s.site_couple_enq_label || DEFAULT_COUPLE_ENQ.label,
        title: s.site_couple_enq_title || DEFAULT_COUPLE_ENQ.title,
        text: s.site_couple_enq_text || DEFAULT_COUPLE_ENQ.text,
        button: s.site_couple_enq_button || DEFAULT_COUPLE_ENQ.button,
      });
      setWpkgEyebrow(s.site_weddings_pkg_eyebrow || DEFAULT_WPKG_EYEBROW);
      setWpkgHeading(s.site_weddings_pkg_heading || DEFAULT_WPKG_HEADING);
      if (s.site_weddings_packages_json) {
        try {
          const parsed = JSON.parse(s.site_weddings_packages_json);
          if (parsed && Array.isArray(parsed.packages) && parsed.packages.length > 0) {
            setWpackages(parsed.packages);
          }
        } catch { /* keep defaults on malformed JSON */ }
      }

      setPkgEyebrow(s.site_couple_pkg_eyebrow || DEFAULT_PKG_EYEBROW);
      setPkgHeading(s.site_couple_pkg_heading || DEFAULT_PKG_HEADING);
      if (s.site_couple_packages_json) {
        try {
          const parsed = JSON.parse(s.site_couple_packages_json);
          if (parsed && Array.isArray(parsed.packages) && parsed.packages.length > 0) {
            setPackages(parsed.packages);
          }
        } catch { /* keep defaults on malformed JSON */ }
      }

      // Booking-availability notice (settings group `notice`) — separate group,
      // wrapped so a failure here can't lose the page copy above.
      try {
        const nres = await settingsAPI.getGroup("notice") as { settings: Record<string, string> };
        const n = nres.settings || {};
        if (Object.keys(n).length > 0) {
          setNotice({
            enabled: (n.notice_enabled ?? "1") === "1",
            message: decodeEntities(n.notice_message || DEFAULT_NOTICE.message),
            ctaLabel: decodeEntities(n.notice_cta_label ?? DEFAULT_NOTICE.ctaLabel),
            ctaLink: n.notice_cta_link ?? DEFAULT_NOTICE.ctaLink,
            barEnabled: (n.notice_bar_enabled ?? "1") === "1",
            barPosition: n.notice_bar_position || DEFAULT_NOTICE.barPosition,
            badgeEnabled: (n.notice_badge_enabled ?? "1") === "1",
            badgeText: decodeEntities(n.notice_badge_text || DEFAULT_NOTICE.badgeText),
            bgColor: n.notice_bg_color || DEFAULT_NOTICE.bgColor,
            textColor: n.notice_text_color || DEFAULT_NOTICE.textColor,
            dismissible: (n.notice_dismissible ?? "1") === "1",
          });
        }
      } catch { /* keep notice defaults */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load website content");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchContent(); }, [fetchContent]);

  const handleSave = async () => {
    if (mockMode) {
      setError("Connect to the live API to save — demo mode is read-only.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const cleanPackages = (list: SessionPackage[]) => list
        .map(p => ({
          name: p.name.trim(),
          tagline: p.tagline.trim(),
          rows: p.rows.filter(r => r.label.trim() && r.value.trim()),
        }))
        .filter(p => p.name);

      const cleanedPackages = cleanPackages(packages);
      const cleanedWpackages = cleanPackages(wpackages);

      if (cleanedPackages.length === 0 || cleanedWpackages.length === 0) {
        setError("Every package card needs a name — both on Weddings and Couple Shoots.");
        return;
      }

      const cleanedStats = stats.map((s) => ({
        number: s.number.trim(),
        suffix: s.suffix.trim(),
        label: s.label.trim(),
      }));

      if (cleanedStats.some((s) => !s.number || !s.label)) {
        setError("Each key number needs a value and a label.");
        return;
      }

      await settingsAPI.update({
        site_stats_json: JSON.stringify({ stats: cleanedStats }),
        site_weddings_enq_label: weddingsEnq.label.trim(),
        site_weddings_enq_title: weddingsEnq.title.trim(),
        site_weddings_enq_text: weddingsEnq.text.trim(),
        site_weddings_enq_button: weddingsEnq.button.trim(),
        site_couple_enq_label: coupleEnq.label.trim(),
        site_couple_enq_title: coupleEnq.title.trim(),
        site_couple_enq_text: coupleEnq.text.trim(),
        site_couple_enq_button: coupleEnq.button.trim(),
        site_weddings_pkg_eyebrow: wpkgEyebrow.trim(),
        site_weddings_pkg_heading: wpkgHeading.trim(),
        site_weddings_packages_json: JSON.stringify({ packages: cleanedWpackages }),
        site_couple_pkg_eyebrow: pkgEyebrow.trim(),
        site_couple_pkg_heading: pkgHeading.trim(),
        site_couple_packages_json: JSON.stringify({ packages: cleanedPackages }),
        // Booking-availability notice
        notice_enabled: notice.enabled ? "1" : "0",
        notice_message: notice.message.trim(),
        notice_cta_label: notice.ctaLabel.trim(),
        notice_cta_link: notice.ctaLink.trim(),
        notice_bar_enabled: notice.barEnabled ? "1" : "0",
        notice_bar_position: notice.barPosition === "bottom" ? "bottom" : "top",
        notice_badge_enabled: notice.badgeEnabled ? "1" : "0",
        notice_badge_text: notice.badgeText.trim(),
        notice_bg_color: notice.bgColor.trim(),
        notice_text_color: notice.textColor.trim(),
        notice_dismissible: notice.dismissible ? "1" : "0",
      });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1100px] mx-auto w-full pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="dash-h1">Website Content</h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Edit the homepage key numbers, the booking-availability notice, the enquiry sections inside the Weddings &amp; Couple Shoots folders, and the couple-shoot session packages.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || isLoading} className="h-10 px-6 rounded-xl bg-primary text-primary-foreground font-bold shadow-sm">
          {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
            : savedAt ? <><Check className="h-4 w-4 mr-2" /> Saved</>
            : "Save All Changes"}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium flex items-center justify-between gap-3">
          <span className="break-words min-w-0">{error}</span>
          <button onClick={() => setError("")} className="shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      {mockMode && !isLoading && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[13px] font-medium">
          Demo mode — showing the website&apos;s built-in defaults. Connect to the live API to edit and save.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
      ) : (
        <>
          {/* Homepage key numbers */}
          <div className="dash-card p-6 md:p-8 space-y-5">
            <div>
              <h2 className="dash-card-title">Homepage — Key Numbers</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                The four figures in the strip below the hero (years of experience, weddings
                captured, press features, happy couples). The <span className="font-semibold text-foreground">number</span> counts
                up on the site; the <span className="font-semibold text-foreground">suffix</span> (e.g. &ldquo;+&rdquo;) sits beside it.
              </p>
            </div>
            <StatsEditor stats={stats} onChange={setStats} />
          </div>

          {/* Booking-availability notice */}
          <div className="dash-card p-6 md:p-8 space-y-5">
            <div>
              <h2 className="dash-card-title">Booking Availability Notice</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                A site-wide announcement bar plus an optional floating badge on the homepage —
                ideal for booking scarcity (&ldquo;limited dates&rdquo;) or a seasonal promotion.
              </p>
            </div>
            <NoticeEditor cfg={notice} onChange={setNotice} />
          </div>

          {/* Weddings enquiry */}
          <div className="dash-card p-6 md:p-8 space-y-5">
            <div>
              <h2 className="dash-card-title">Weddings — Folder Enquiry</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Shown at the end of every opened wedding folder, after &ldquo;Continue Browsing&rdquo;.
              </p>
            </div>
            <EnquiryEditor copy={weddingsEnq} onChange={setWeddingsEnq} />
          </div>

          {/* Weddings collections (the three package cards) */}
          <div className="dash-card p-6 md:p-8 space-y-6">
            <div>
              <h2 className="dash-card-title">Weddings — Collections</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                The three package cards in the &ldquo;What We Offer&rdquo; section on the Weddings
                page. Same card design as the couple-shoot packages. No pricing is shown on the website.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Section Eyebrow" value={wpkgEyebrow} onChange={setWpkgEyebrow} />
              <Field label="Section Heading" value={wpkgHeading} onChange={setWpkgHeading}
                hint="Wrap a word in *asterisks* for the italic accent, e.g. Wedding *Collections*" />
            </div>

            <PackagesEditor packages={wpackages} onChange={setWpackages} />
          </div>

          {/* Couple shoots enquiry */}
          <div className="dash-card p-6 md:p-8 space-y-5">
            <div>
              <h2 className="dash-card-title">Couple Shoots — Folder Enquiry</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Shown at the end of every opened couple-shoot folder, after &ldquo;Continue Browsing&rdquo;.
              </p>
            </div>
            <EnquiryEditor copy={coupleEnq} onChange={setCoupleEnq} />
          </div>

          {/* Session packages */}
          <div className="dash-card p-6 md:p-8 space-y-6">
            <div>
              <h2 className="dash-card-title">Couple Shoots — Session Packages</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                The three offering cards in the &ldquo;What to Expect&rdquo; section: photographs only,
                cinematic film only, and photographs + film. No pricing is shown on the website.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Section Eyebrow" value={pkgEyebrow} onChange={setPkgEyebrow} />
              <Field label="Section Heading" value={pkgHeading} onChange={setPkgHeading}
                hint="Wrap a word in *asterisks* for the italic accent, e.g. Choose Your *Session*" />
            </div>

            <PackagesEditor packages={packages} onChange={setPackages} />
          </div>
        </>
      )}
    </div>
  );
}
