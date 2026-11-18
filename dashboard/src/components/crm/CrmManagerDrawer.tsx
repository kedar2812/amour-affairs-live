"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/Drawer";
import { crmAPI } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";
import {
  CrmTemplates, Festival, TEMPLATE_FIELDS, UpcomingFestival,
  daysUntilLabel, nextOccurrenceOf,
} from "@/lib/crm";
import { WhatsAppIcon } from "@/components/crm/WhatsAppIcon";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Optional: open a per-recipient send list for a festival. When omitted,
      the drawer is pure config (calendar + templates) with no send button. */
  onSendFestival?: (festival: UpcomingFestival, templates: CrmTemplates) => void;
}

const EMPTY_FEST = { name: "", emoji: "", date: "", isMovable: false, template: "" };

/**
 * "Festivals & Wishes" manager: the festival calendar (add / edit / remove,
 * with movable-date reminders) and the greeting message templates.
 */
export function CrmManagerDrawer({ isOpen, onClose, onSendFestival }: Props) {
  const [tab, setTab] = useState<"festivals" | "templates">("festivals");
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [templates, setTemplates] = useState<CrmTemplates>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FEST });
  const [saving, setSaving] = useState(false);
  const [tplSaved, setTplSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [festRes, tplRes] = await Promise.all([crmAPI.festivals.list(), crmAPI.templates.get()]);
      setFestivals((festRes.festivals || []) as Festival[]);
      setTemplates(tplRes.templates || {});
    } catch (e: unknown) {
      setError((e as Error)?.message || "Couldn't load CRM settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen) { load(); setFormOpen(false); } }, [isOpen, load]);

  const openAdd = () => { setEditingId(null); setForm({ ...EMPTY_FEST }); setFormOpen(true); };
  const openEdit = (f: Festival) => {
    setEditingId(f.id);
    setForm({
      name: decodeEntities(f.name),
      emoji: f.emoji || "",
      date: f.festival_date,
      isMovable: Number(f.is_movable) === 1,
      template: f.message_template ? decodeEntities(f.message_template) : "",
    });
    setFormOpen(true);
  };

  const saveFestival = async () => {
    if (!form.name.trim()) { setError("Festival name is required."); return; }
    if (!form.date) { setError("Pick the festival date."); return; }
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      emoji: form.emoji.trim(),
      festival_date: form.date,
      is_movable: form.isMovable,
      message_template: form.template.trim(),
    };
    try {
      if (editingId) await crmAPI.festivals.update(editingId, payload);
      else await crmAPI.festivals.create(payload);
      setFormOpen(false);
      await load();
    } catch (e: unknown) {
      setError((e as Error)?.message || "Couldn't save the festival.");
    } finally {
      setSaving(false);
    }
  };

  const deleteFestival = async (id: number) => {
    try {
      await crmAPI.festivals.delete(id);
      setFestivals((prev) => prev.filter((f) => f.id !== id));
    } catch (e: unknown) {
      setError((e as Error)?.message || "Couldn't remove the festival.");
    }
  };

  const saveTemplates = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await crmAPI.templates.save(templates);
      setTemplates(res.templates || templates);
      setTplSaved(true);
      setTimeout(() => setTplSaved(false), 1400);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Couldn't save the templates.");
    } finally {
      setSaving(false);
    }
  };

  const startSend = (f: Festival) => {
    if (!onSendFestival) return;
    const next = nextOccurrenceOf(f.festival_date);
    onSendFestival(
      {
        kind: "festival",
        id: f.id,
        name: decodeEntities(f.name),
        emoji: f.emoji,
        festival_date: f.festival_date,
        next_date: `${next.date.getFullYear()}-${String(next.date.getMonth() + 1).padStart(2, "0")}-${String(next.date.getDate()).padStart(2, "0")}`,
        days_until: next.days,
        occasion_year: next.year,
        is_movable: Number(f.is_movable),
        message_template: f.message_template,
        sent_count: 0,
      },
      templates
    );
  };

  const inputCls = "w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width="520px" title="Festivals & Wishes">
      <div className="flex flex-col h-full">
        <div className="px-6 py-3 border-b border-border/50 flex gap-6 shrink-0">
          {(["festivals", "templates"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-[13px] font-bold pb-1 border-b-2 transition-colors ${tab === t ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}
            >
              {t === "festivals" ? "Festival Calendar" : "Message Templates"}
            </button>
          ))}
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="text-[13px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
          ) : tab === "festivals" ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-muted-foreground max-w-[300px]">
                  Festivals repeat every year. Ones marked <span className="font-semibold text-amber-600">movable</span> shift with the lunar calendar — update their date each year.
                </p>
                {!formOpen && (
                  <Button variant="outline" onClick={openAdd} className="h-8 px-3 rounded-lg border-border/50 text-[12px] shrink-0">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add
                  </Button>
                )}
              </div>

              {formOpen && (
                <div className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-[1fr_84px] gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Festival name</label>
                      <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Diwali" className={inputCls} />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Emoji</label>
                      <input value={form.emoji} onChange={(e) => setForm((p) => ({ ...p, emoji: e.target.value }))} placeholder="🪔" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">This year&apos;s date</label>
                      <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className={inputCls} />
                    </div>
                    <label className="flex items-center gap-2 h-10 text-[13px] text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={form.isMovable} onChange={(e) => setForm((p) => ({ ...p, isMovable: e.target.checked }))} className="h-4 w-4 rounded" />
                      Date moves each year
                    </label>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Custom message (optional)</label>
                    <textarea
                      value={form.template}
                      onChange={(e) => setForm((p) => ({ ...p, template: e.target.value }))}
                      rows={3}
                      placeholder="Leave blank to use the general festival template. {name} and {festival} are filled automatically."
                      className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[13px] focus:outline-none focus:border-primary/50 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setFormOpen(false)} className="h-9 px-3 rounded-lg border-border/50">
                      <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
                    </Button>
                    <Button onClick={saveFestival} disabled={saving} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground font-bold">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                      {editingId ? "Save" : "Add festival"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="dash-card border border-border/50 rounded-xl divide-y divide-border/50">
                {festivals.map((f) => {
                  const next = nextOccurrenceOf(f.festival_date);
                  return (
                    <div key={f.id} className={`flex items-center gap-3 p-3 ${Number(f.is_active) === 0 ? "opacity-50" : ""}`}>
                      <span className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-[16px]">{f.emoji || "✨"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-foreground truncate">
                          {decodeEntities(f.name)}
                          {Number(f.is_movable) === 1 && (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">movable</span>
                          )}
                        </p>
                        <p className="text-[12px] text-muted-foreground">
                          {next.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {daysUntilLabel(next.days)}
                        </p>
                      </div>
                      {onSendFestival && (
                        <button
                          onClick={() => startSend(f)}
                          title="Send wishes to clients"
                          className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[12px] font-bold bg-[#25D366]/10 text-[#1DA851] border border-[#25D366]/25 hover:bg-[#25D366]/20 transition-colors"
                        >
                          <WhatsAppIcon className="h-3.5 w-3.5" /> Wishes
                        </button>
                      )}
                      <button onClick={() => openEdit(f)} title="Edit" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteFestival(f.id)} title="Remove" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                {festivals.length === 0 && (
                  <p className="text-[13px] text-muted-foreground text-center py-8">No festivals yet — add the ones you greet clients on.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-[12px] text-muted-foreground">
                These messages pre-fill WhatsApp when you send wishes. Placeholders like <code className="font-mono text-[11px] bg-muted/60 px-1 rounded">{"{name}"}</code> are replaced with the client&apos;s details automatically.
              </p>
              {TEMPLATE_FIELDS.map((fld) => (
                <div key={fld.key}>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    {fld.label} <span className="normal-case font-medium text-muted-foreground/70">— uses {fld.hint}</span>
                  </label>
                  <textarea
                    value={templates[fld.key] || ""}
                    onChange={(e) => setTemplates((p) => ({ ...p, [fld.key]: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[13px] focus:outline-none focus:border-primary/50 resize-none"
                  />
                </div>
              ))}
              <div className="flex justify-end">
                <Button onClick={saveTemplates} disabled={saving} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-bold">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : tplSaved ? <Check className="h-4 w-4 mr-2" /> : null}
                  {tplSaved ? "Saved" : "Save templates"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
