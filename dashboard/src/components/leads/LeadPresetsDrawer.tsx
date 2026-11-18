"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { crmAPI } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";
import { LEAD_PLACEHOLDERS, LEAD_PRESETS } from "@/lib/leadTemplates";

interface LeadPresetsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Record<string, string>;
  /** Hands the saved set back so open composers pick up the new copy. */
  onSaved: (templates: Record<string, string>) => void;
}

/**
 * Edits the three funnel messages. Each preset falls back to the studio's
 * original copy when its settings row is empty, so "Reset" simply clears the
 * override rather than storing a second copy of the same text.
 */
export function LeadPresetsDrawer({ isOpen, onClose, templates, onSaved }: LeadPresetsDrawerProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Load the saved text into the editor each time it opens; presets with no
  // override show their fallback so the studio edits what they actually send.
  // Decoded on load (crm.php stores raw, but a legacy row could hold entities)
  // so an ampersand shows as "&" here and goes out as "&" — never "&amp;".
  useEffect(() => {
    if (!isOpen) return;
    const next: Record<string, string> = {};
    for (const p of LEAD_PRESETS) {
      next[p.settingKey] = decodeEntities((templates[p.settingKey] || "").trim()) || p.fallback;
    }
    setDraft(next);
    setSaved(false);
    setError("");
  }, [isOpen, templates]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, string> = {};
      for (const p of LEAD_PRESETS) {
        const text = draft[p.settingKey] ?? "";
        // Unchanged copy is stored as an empty override so the built-in
        // fallback stays the source of truth.
        payload[p.settingKey] = text.trim() === p.fallback.trim() ? "" : text;
      }
      const res = await crmAPI.templates.save(payload);
      onSaved(res.templates || payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the presets.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width="520px" title="WhatsApp Message Presets">
      <div className="p-6 space-y-6">
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Three messages, one for each moment in the booking funnel. They appear in the send-message
          window on every lead, so edit them here once and they&apos;re ready everywhere.
        </p>

        <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Placeholders you can use
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_PLACEHOLDERS.map((p) => (
              <span key={p.token} className="px-2 py-1 rounded-lg bg-card border border-border/50 text-[11px] text-muted-foreground">
                <code className="font-mono text-foreground">{p.token}</code> {p.label}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            WhatsApp bold is a single asterisk: <code className="font-mono">*like this*</code>. A placeholder with
            nothing to fill it is removed cleanly.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-medium">
            {error}
          </div>
        )}

        {LEAD_PRESETS.map((p) => {
          const value = draft[p.settingKey] ?? "";
          const isDefault = value.trim() === p.fallback.trim();
          return (
            <div key={p.key}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-foreground">
                    <span className="text-primary">Stage {p.stageNo}</span> · {p.name}
                  </p>
                  <p className="text-[12px] text-muted-foreground leading-snug">{p.when}</p>
                </div>
                {!isDefault && (
                  <button
                    onClick={() => setDraft((d) => ({ ...d, [p.settingKey]: p.fallback }))}
                    className="shrink-0 text-[12px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                )}
              </div>
              <textarea
                value={value}
                onChange={(e) => setDraft((d) => ({ ...d, [p.settingKey]: e.target.value }))}
                rows={9}
                className="w-full p-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[13px] leading-relaxed focus:outline-none focus:border-primary/50 resize-y"
              />
            </div>
          );
        })}

        <button
          onClick={save}
          disabled={saving}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved" : "Save presets"}
        </button>
      </div>
    </Drawer>
  );
}
