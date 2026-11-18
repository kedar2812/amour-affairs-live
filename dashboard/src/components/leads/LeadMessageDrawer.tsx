"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, Copy, Loader2, RotateCcw, Settings2,
} from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { WhatsAppIcon } from "@/components/crm/WhatsAppIcon";
import { decodeEntities } from "@/lib/utils";
import { nowISTStamp } from "@/lib/datetime";
import {
  LEAD_PRESETS, LEAD_STAGES, LeadNote, LeadPresetKey, LeadRecipient, MessageableLead,
  buildSentNote, composeLeadMessage, getPreset, leadRecipients, presetForStage, recipientLink,
} from "@/lib/leadTemplates";

interface LeadMessageDrawerProps {
  lead: MessageableLead | null;
  templates: Record<string, string>;
  onClose: () => void;
  /** Persists the stage move (and the timeline note, when logged). */
  onSubmit: (payload: { stage: string; note: LeadNote | null }) => Promise<void>;
  /** Opens the preset editor from inside the drawer. */
  onEditPresets?: () => void;
}

/**
 * Send a stage-appropriate WhatsApp message to a lead, then decide where the
 * lead goes next. Two deliberate steps: compose & send, then move — because
 * the studio's whole reason for messaging is to advance the enquiry, and the
 * stage move is the bit that gets forgotten once WhatsApp steals focus.
 */
export function LeadMessageDrawer({ lead, templates, onClose, onSubmit, onEditPresets }: LeadMessageDrawerProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [presetKey, setPresetKey] = useState<LeadPresetKey>("welcome");
  const [message, setMessage] = useState("");
  const [opened, setOpened] = useState<string[]>([]);
  const [targetStage, setTargetStage] = useState<string>("New Inquiry");
  const [stageTouched, setStageTouched] = useState(false);
  const [logNote, setLogNote] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isOpen = !!lead;
  const preset = getPreset(presetKey);
  const recipients = useMemo(() => (lead ? leadRecipients(lead) : []), [lead]);
  const composed = useMemo(
    () => (lead ? composeLeadMessage(templates, lead, presetKey) : ""),
    [lead, templates, presetKey],
  );

  // Fresh start every time the drawer opens for a lead: pick the preset that
  // matches where the lead currently sits, and pre-select its usual next stage.
  const leadId = lead?.id;
  const leadStage = lead?.stage;
  useEffect(() => {
    if (!leadId || !leadStage) return;
    const key = presetForStage(leadStage);
    setStep(1);
    setPresetKey(key);
    setOpened([]);
    setStageTouched(false);
    setTargetStage(getPreset(key).suggestedStage);
    setLogNote(true);
    setError("");
    setSaving(false);
  }, [leadId, leadStage]);

  // Follow the selected preset unless the studio has edited the text.
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    setMessage(composed);
    setEdited(false);
  }, [composed]);

  const choosePreset = (key: LeadPresetKey) => {
    setPresetKey(key);
    if (!stageTouched) setTargetStage(getPreset(key).suggestedStage);
  };

  const openWhatsApp = (r: LeadRecipient) => {
    window.open(recipientLink(r, message), "_blank", "noopener");
    setOpened((prev) => (prev.includes(r.id) ? prev : [...prev, r.id]));
  };

  const sentTo = recipients.filter((r) => opened.includes(r.id));

  const save = async () => {
    if (!lead) return;
    setSaving(true);
    setError("");
    try {
      const note = logNote ? buildSentNote(preset, sentTo, message, nowISTStamp()) : null;
      await onSubmit({ stage: targetStage, note });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const stageOptions = useMemo(() => {
    if (!lead) return [];
    return LEAD_STAGES.map((s) => ({
      value: s as string,
      label: s === lead.stage ? `Keep in ${s}` : s,
      isCurrent: s === lead.stage,
    }));
  }, [lead]);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width="480px" title="Send WhatsApp Message">
      {lead && (
        <div className="p-6 space-y-5">
          {/* Who we're messaging — decoded at the point of display, so a name
              like "Priya &amp; Rahul" always reads "Priya & Rahul". */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-foreground truncate">{decodeEntities(lead.client_name)}</p>
              <p className="text-[12px] text-muted-foreground">
                {lead.lead_ref ? `${lead.lead_ref} · ` : ""}{decodeEntities(lead.event_type || "") || "Enquiry"}
              </p>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
              {lead.stage}
            </span>
          </div>

          {/* Step rail */}
          <div className="flex items-center gap-2">
            {[
              { n: 1, label: "Compose & send" },
              { n: 2, label: "Move the lead" },
            ].map((s) => (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <span
                  className={`h-6 w-6 shrink-0 rounded-full grid place-items-center text-[11px] font-bold transition-colors ${
                    step >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.n ? <Check className="h-3 w-3" /> : s.n}
                </span>
                <span className={`text-[12px] font-semibold truncate ${step >= s.n ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-medium">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {step === 1 ? (
              <motion.div
                key="compose"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* Preset picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Choose a preset
                    </p>
                    {onEditPresets && (
                      <button
                        onClick={onEditPresets}
                        className="text-[12px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <Settings2 className="h-3 w-3" /> Edit presets
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {LEAD_PRESETS.map((p) => {
                      const active = p.key === presetKey;
                      return (
                        <button
                          key={p.key}
                          onClick={() => choosePreset(p.key)}
                          className={`w-full text-left p-3 rounded-xl border transition-colors ${
                            active
                              ? "bg-primary/5 border-primary/40"
                              : "bg-muted/20 border-border/50 hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 grid place-items-center transition-colors ${
                                active ? "border-primary" : "border-border"
                              }`}
                            >
                              {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-bold text-foreground">
                                <span className="text-primary">Stage {p.stageNo}</span> · {p.name}
                              </p>
                              <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{p.when}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Message</p>
                    <div className="flex items-center gap-3">
                      {edited && (
                        <button
                          onClick={() => { setMessage(composed); setEdited(false); }}
                          className="text-[12px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" /> Reset
                        </button>
                      )}
                      <button
                        onClick={() => navigator.clipboard?.writeText(message)}
                        className="text-[12px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); setEdited(true); }}
                    rows={10}
                    className="w-full p-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[13px] leading-relaxed focus:outline-none focus:border-primary/50 resize-y"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Edits here apply to this message only — use &ldquo;Edit presets&rdquo; to change the saved template.
                  </p>
                </div>

                {/* Recipients */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Send to
                  </p>
                  {recipients.length === 0 ? (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[13px]">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>No usable WhatsApp number on this lead. Add one with the edit (pencil) button first.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recipients.map((r) => {
                        const isOpened = opened.includes(r.id);
                        return (
                          <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-foreground truncate">
                                {r.name} <span className="font-normal text-muted-foreground">· {r.role}</span>
                              </p>
                              <p className="text-[12px] text-muted-foreground font-mono">{r.display}</p>
                            </div>
                            <button
                              onClick={() => openWhatsApp(r)}
                              className={`h-8 px-3 shrink-0 rounded-lg flex items-center gap-1.5 text-[12px] font-bold transition-colors ${
                                isOpened
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  : "bg-[#25D366]/10 text-[#1DA851] border border-[#25D366]/25 hover:bg-[#25D366]/20"
                              }`}
                            >
                              {isOpened ? <Check className="h-3.5 w-3.5" /> : <WhatsAppIcon className="h-3.5 w-3.5" />}
                              {isOpened ? "Opened" : "WhatsApp"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2"
                >
                  Next — move the lead <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="move"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {sentTo.length > 0 ? (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[13px]">
                    <Check className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      WhatsApp opened for {sentTo.map((r) => r.name).join(", ")} with the Stage {preset.stageNo} message.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[13px]">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>You haven&apos;t opened WhatsApp yet — go back if you still want to send the message.</span>
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Where should this lead go now?
                  </p>
                  <p className="text-[12px] text-muted-foreground mb-3">
                    Currently in <span className="font-semibold text-foreground">{lead.stage}</span>.
                  </p>
                  <div className="space-y-2">
                    {stageOptions.map((opt) => {
                      const active = targetStage === opt.value;
                      const suggested = opt.value === preset.suggestedStage && !opt.isCurrent;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => { setTargetStage(opt.value); setStageTouched(true); }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                            active
                              ? "bg-primary/5 border-primary/40"
                              : "bg-muted/20 border-border/50 hover:bg-muted/40"
                          }`}
                        >
                          <span
                            className={`h-4 w-4 shrink-0 rounded-full border-2 grid place-items-center transition-colors ${
                              active ? "border-primary" : "border-border"
                            }`}
                          >
                            {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                          </span>
                          <span className="text-[13px] font-semibold text-foreground flex-1">{opt.label}</span>
                          {suggested && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              Suggested
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logNote}
                    onChange={(e) => setLogNote(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-foreground">Save this message to the lead</span>
                    <span className="block text-[12px] text-muted-foreground leading-snug">
                      Adds it under Messages &amp; Notes so you can see what was sent and when.
                    </span>
                  </span>
                </label>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStep(1)}
                    disabled={saving}
                    className="h-11 px-4 rounded-xl border border-border/50 text-[13px] font-bold text-foreground hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {targetStage === lead.stage ? "Save & close" : `Move to ${targetStage}`}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Drawer>
  );
}
