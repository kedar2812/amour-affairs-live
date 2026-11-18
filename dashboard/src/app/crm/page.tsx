"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Loader2, CalendarHeart, Users, Gift, Cake, Heart,
  Baby, ChevronRight, Pencil, Trash2, Phone, BookImage, MessageSquareQuote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/Drawer";
import { familiesAPI, getStoredToken } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";
import { formatPhone } from "@/lib/phone";
import {
  Family, FamilyOccasion, FamilyFestival, FamiliesUpcomingResponse, WishTarget,
  resolveRecipients, daysUntilLabel, occasionTitle, ROLE_LABEL,
  FollowUpFilter, FOLLOW_UP_FILTERS, matchesFollowUp, formatFlagDate,
} from "@/lib/families";
import { WhatsAppIcon } from "@/components/crm/WhatsAppIcon";
import { WishComposer } from "@/components/crm/WishComposer";
import { FamilyForm } from "@/components/crm/FamilyForm";
import { FestivalWishesDrawer } from "@/components/crm/FestivalWishesDrawer";
import { CrmManagerDrawer } from "@/components/crm/CrmManagerDrawer";

const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
};

type Tab = "Upcoming" | "Families";

// A composer target bundled with its display context
interface ActiveWish {
  family: Family;
  target: WishTarget;
  occasionYear: number;
  festival?: FamilyFestival | null;
  years?: number | null;
}

const occasionIcon = (o: FamilyOccasion) => {
  if (o.occasion === "anniversary") return <Heart className="h-4 w-4" />;
  if (o.kind === "child_birthday") return <Baby className="h-4 w-4" />;
  return <Cake className="h-4 w-4" />;
};

export default function CrmPage() {
  const [tab, setTab] = useState<Tab>("Upcoming");
  const [data, setData] = useState<FamiliesUpcomingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mock, setMock] = useState(false);
  const [search, setSearch] = useState("");
  const [followUp, setFollowUp] = useState<FollowUpFilter>("all");

  // Drawers
  const [wish, setWish] = useState<ActiveWish | null>(null);
  const [formFamily, setFormFamily] = useState<Family | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [festivalWishes, setFestivalWishes] = useState<FamilyFestival | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [detail, setDetail] = useState<Family | null>(null);

  const load = useCallback(async () => {
    if (isMockMode()) { setMock(true); setLoading(false); return; }
    try {
      const res = (await familiesAPI.upcoming(30)) as FamiliesUpcomingResponse;
      setData(res);
      setMock(false);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const families = data?.families || [];
  const templates = data?.templates || {};

  const filteredFamilies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return families.filter((f) =>
      matchesFollowUp(f, followUp) &&
      (!q || decodeEntities(f.display_name).toLowerCase().includes(q))
    );
  }, [families, search, followUp]);

  const albumsGiven = families.filter((f) => f.album_given === 1).length;
  const testimonialsGiven = families.filter((f) => f.testimonial_given === 1).length;


  const occasions = data?.occasions || [];
  const festivals = data?.festivals || [];

  const openBirthdayOrAnniversary = (o: FamilyOccasion) => {
    const target: WishTarget = o.occasion === "anniversary"
      ? { type: "anniversary" }
      : { type: "birthday", memberId: o.member_id as number };
    setWish({ family: o.family, target, occasionYear: o.occasion_year, years: o.years });
  };

  const refreshAll = () => load();

  const deleteFamily = async (f: Family) => {
    if (!confirm(`Delete the ${decodeEntities(f.display_name)} family record? This removes their dates and wish history and cannot be undone.`)) return;
    try {
      await familiesAPI.delete(f.id);
      setDetail(null);
      load();
    } catch { /* surfaced by reload */ }
  };

  // ── Render ──

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="dash-h1">CRM</h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Families, their special dates, and curated WhatsApp wishes.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={() => setManagerOpen(true)} className="h-10 px-4 rounded-xl border-border/50">
            <CalendarHeart className="h-4 w-4 mr-2" />
            Festivals &amp; Templates
          </Button>
          <Button onClick={() => { setFormFamily(null); setFormOpen(true); }} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none">
            <Plus className="h-4 w-4 mr-2" />
            Add Family
          </Button>
        </div>
      </div>

      {mock && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[13px] font-medium shrink-0">
          Connect to the live API to manage families and wishes — demo mode is read-only.
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card/50 border border-border/50 p-1 rounded-xl w-max shrink-0 relative z-0">
        {(["Upcoming", "Families"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 z-10 ${
              tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === t && (
              <motion.div layoutId="crm-tab-active" className="absolute inset-0 bg-card shadow-sm rounded-lg -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }} />
            )}
            {t === "Upcoming" ? "Upcoming Occasions" : "Families"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {tab === "Upcoming" ? (
            <motion.div key="upcoming" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-6 pb-12">
              {/* Occasions */}
              <div className="dash-card">
                <div className="p-5 border-b border-border/50">
                  <h3 className="dash-card-title">Birthdays &amp; Anniversaries</h3>
                  <p className="text-[13px] text-muted-foreground mt-0.5">Next 30 days</p>
                </div>
                <div className="divide-y divide-border/50">
                  {occasions.length === 0 ? (
                    <EmptyRow icon={<Cake className="h-7 w-7 text-muted-foreground/40" />} text="No birthdays or anniversaries in the next 30 days." />
                  ) : (
                    occasions.map((o) => {
                      const { recipients, skipped } = resolveRecipients(o.family, o.occasion === "anniversary" ? { type: "anniversary" } : { type: "birthday", memberId: o.member_id as number });
                      return (
                        <OccasionRow
                          key={o.occasion_key}
                          o={o}
                          recipients={recipients.length}
                          skipped={skipped.length}
                          onSend={() => openBirthdayOrAnniversary(o)}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              {/* Festivals */}
              <div className="dash-card">
                <div className="p-5 border-b border-border/50">
                  <h3 className="dash-card-title">Festivals</h3>
                  <p className="text-[13px] text-muted-foreground mt-0.5">Next 30 days · sent to every family</p>
                </div>
                <div className="divide-y divide-border/50">
                  {festivals.length === 0 ? (
                    <EmptyRow icon={<Gift className="h-7 w-7 text-muted-foreground/40" />} text="No festivals in the next 30 days. Manage the calendar under Festivals & Templates." />
                  ) : (
                    festivals.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 p-4">
                        <DateBlock dateStr={f.next_date} today={f.days_until <= 0} />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[14px] font-semibold text-foreground truncate">
                            {f.emoji ? `${f.emoji} ` : ""}{decodeEntities(f.name)}
                            {f.is_movable === 1 && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">movable</span>}
                          </h4>
                          <p className="text-[12px] text-muted-foreground">{daysUntilLabel(f.days_until)} · {families.length} {families.length === 1 ? "family" : "families"}</p>
                        </div>
                        <button
                          onClick={() => setFestivalWishes(f)}
                          disabled={families.length === 0}
                          className="h-8 px-3 shrink-0 rounded-lg flex items-center gap-1.5 text-[12px] font-bold bg-[#25D366]/10 text-[#1DA851] border border-[#25D366]/25 hover:bg-[#25D366]/20 transition-colors disabled:opacity-40"
                        >
                          <WhatsAppIcon className="h-3.5 w-3.5" /> Send Wishes
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="families" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-4 pb-12">
              {/* Follow-up summary — each card jumps to the families still pending */}
              {families.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FollowUpStat
                    icon={<BookImage className="h-5 w-5" />}
                    label="Albums given"
                    done={albumsGiven}
                    total={families.length}
                    pendingLabel="still waiting for their album"
                    active={followUp === "album_pending"}
                    onClick={() => setFollowUp(followUp === "album_pending" ? "all" : "album_pending")}
                  />
                  <FollowUpStat
                    icon={<MessageSquareQuote className="h-5 w-5" />}
                    label="Testimonials given"
                    done={testimonialsGiven}
                    total={families.length}
                    pendingLabel="yet to give a testimonial"
                    active={followUp === "testimonial_pending"}
                    onClick={() => setFollowUp(followUp === "testimonial_pending" ? "all" : "testimonial_pending")}
                  />
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="relative w-full md:w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search families…"
                  className="h-10 w-full pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
                <div className="flex flex-wrap gap-2">
                  {FOLLOW_UP_FILTERS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setFollowUp(opt.key)}
                      className={`h-8 px-3 rounded-full text-[12px] font-semibold border transition-colors ${
                        followUp === opt.key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border/50 hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredFamilies.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                    <Users className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-[15px] font-semibold text-foreground">
                    {search || followUp !== "all" ? "No families match" : "No families yet"}
                  </p>
                  <p className="text-[13px] text-muted-foreground max-w-[340px]">
                    {search || followUp !== "all"
                      ? "Try a different name or filter."
                      : "Add a family to start tracking birthdays, anniversaries and festival wishes."}
                  </p>
                </div>
              ) : (
                <div className="dash-card divide-y divide-border/50">
                  {filteredFamilies.map((f) => {
                    const adults = f.members.filter((m) => m.role !== "child").length;
                    const kids = f.members.filter((m) => m.role === "child").length;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setDetail(f)}
                        className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-foreground truncate">{decodeEntities(f.display_name)}</p>
                          <p className="text-[12px] text-muted-foreground">
                            {adults} {adults === 1 ? "adult" : "adults"}{kids > 0 ? ` · ${kids} ${kids === 1 ? "child" : "children"}` : ""}
                            {f.anniversary_date ? " · anniversary set" : ""}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <FlagBadge on={f.album_given === 1} label="Album" />
                            <FlagBadge on={f.testimonial_given === 1} label="Testimonial" />
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Family detail drawer */}
      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} width="500px" title={detail ? decodeEntities(detail.display_name) : "Family"}>
        {detail && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => { setFormFamily(detail); setFormOpen(true); }} className="h-9 px-3 rounded-lg border-border/50 text-[13px]">
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
              <Button variant="outline" onClick={() => deleteFamily(detail)} className="h-9 px-3 rounded-lg border-red-500/20 text-red-500 text-[13px] hover:bg-red-500/10">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FlagDetail icon={<BookImage className="h-4 w-4" />} label="Album given" on={detail.album_given === 1} date={detail.album_given_at} />
              <FlagDetail icon={<MessageSquareQuote className="h-4 w-4" />} label="Testimonial given" on={detail.testimonial_given === 1} date={detail.testimonial_given_at} />
            </div>

            {detail.anniversary_date && (
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex items-center gap-3">
                <Heart className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Anniversary</p>
                  <p className="text-[14px] font-semibold text-foreground">
                    {new Date(detail.anniversary_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Members</p>
              <div className="space-y-2">
                {detail.members.map((m) => (
                  <div key={m.id} className="p-3 rounded-xl bg-muted/20 border border-border/50">
                    <div className="flex items-center justify-between">
                      <p className="text-[14px] font-semibold text-foreground">{decodeEntities(m.name)}</p>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded">{ROLE_LABEL[m.role]}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[12px] text-muted-foreground">
                      {m.dob && <span>DOB {new Date(m.dob + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                      {(m.whatsapp || m.phone) && <span className="font-mono flex items-center gap-1"><Phone className="h-3 w-3" /> {formatPhone(m.whatsapp || m.phone)}</span>}
                    </div>
                  </div>
                ))}
                {detail.members.length === 0 && (
                  <p className="text-[13px] text-muted-foreground text-center py-4">No members added yet.</p>
                )}
              </div>
            </div>

            {detail.notes && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
                <p className="text-[13px] text-foreground whitespace-pre-wrap bg-muted/30 border border-border/50 rounded-xl p-4">{decodeEntities(detail.notes)}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Wish composer (birthday / anniversary) */}
      <WishComposer
        isOpen={!!wish}
        onClose={() => setWish(null)}
        family={wish?.family || null}
        target={wish?.target || null}
        occasionYear={wish?.occasionYear || new Date().getFullYear()}
        years={wish?.years ?? null}
        templates={templates}
        onSent={refreshAll}
      />

      {/* Festival wishes to all families */}
      <FestivalWishesDrawer
        isOpen={!!festivalWishes}
        onClose={() => setFestivalWishes(null)}
        festival={festivalWishes}
        families={families}
        templates={templates}
        onSent={refreshAll}
      />

      {/* Add / edit family */}
      <FamilyForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        family={formFamily}
        onSaved={() => { setDetail(null); load(); }}
      />

      {/* Festival calendar + templates config */}
      <CrmManagerDrawer isOpen={managerOpen} onClose={() => { setManagerOpen(false); load(); }} />
    </div>
  );
}

// ── Small presentational helpers ──

function DateBlock({ dateStr, today }: { dateStr: string; today: boolean }) {
  const d = new Date(dateStr + "T00:00:00");
  return (
    <div className={`w-11 shrink-0 flex flex-col items-center justify-center py-1.5 rounded-lg ${today ? "bg-primary/15" : "bg-muted"}`}>
      <span className={`text-[10px] font-bold uppercase ${today ? "text-primary" : "text-muted-foreground"}`}>
        {d.toLocaleDateString("en-IN", { month: "short" })}
      </span>
      <span className={`text-lg font-bold leading-tight ${today ? "text-primary" : "text-foreground"}`}>{d.getDate()}</span>
    </div>
  );
}

function OccasionRow({ o, recipients, skipped, onSend }: {
  o: FamilyOccasion; recipients: number; skipped: number; onSend: () => void;
}) {
  const yearsLabel = o.years != null && o.years > 0
    ? (o.occasion === "anniversary" ? ` · ${o.years} years` : ` · turns ${o.years}`)
    : "";
  return (
    <div className="flex items-center gap-3 p-4">
      <DateBlock dateStr={o.next_date} today={o.days_until <= 0} />
      <div className="flex-1 min-w-0">
        <h4 className="text-[14px] font-semibold text-foreground truncate flex items-center gap-1.5">
          <span className="text-muted-foreground">{occasionIcon(o)}</span>
          {decodeEntities(o.family.display_name)}
        </h4>
        <p className="text-[12px] text-muted-foreground truncate">
          {occasionTitle(o)}{yearsLabel} · {daysUntilLabel(o.days_until)}
          {recipients > 0 ? ` · to ${recipients}` : " · no number"}
          {skipped > 0 ? ` · ${skipped} skipped` : ""}
        </p>
      </div>
      <button
        onClick={onSend}
        disabled={recipients === 0}
        className={`h-8 px-3 shrink-0 rounded-lg flex items-center gap-1.5 text-[12px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          o.sent ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                 : "bg-[#25D366]/10 text-[#1DA851] border border-[#25D366]/25 hover:bg-[#25D366]/20"
        }`}
        title={recipients === 0 ? "No usable number for this family" : o.sent ? "Already wished this year — send again" : "Compose a WhatsApp wish"}
      >
        <WhatsAppIcon className="h-3.5 w-3.5" /> {o.sent ? "Sent" : "Send"}
      </button>
    </div>
  );
}

function FollowUpStat({ icon, label, done, total, pendingLabel, active, onClick }: {
  icon: React.ReactNode; label: string; done: number; total: number;
  pendingLabel: string; active: boolean; onClick: () => void;
}) {
  const pending = total - done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className={`dash-card p-4 flex items-center gap-4 text-left transition-colors ${active ? "ring-2 ring-primary/40" : "hover:bg-muted/30"}`}
      title={active ? "Show all families" : `Show families ${pendingLabel}`}
    >
      <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-[20px] font-bold text-foreground leading-tight">
          {done} <span className="text-[13px] font-medium text-muted-foreground">of {total} · {pct}%</span>
        </p>
        <div className="h-1.5 mt-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[12px] text-muted-foreground mt-1.5">
          {pending === 0 ? "All done" : `${pending} ${pending === 1 ? "family" : "families"} ${pendingLabel}`}
        </p>
      </div>
    </button>
  );
}

function FlagBadge({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 border ${
      on ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
         : "text-amber-600 bg-amber-500/10 border-amber-500/20"
    }`}>
      {label}: {on ? "Yes" : "No"}
    </span>
  );
}

function FlagDetail({ icon, label, on, date }: { icon: React.ReactNode; label: string; on: boolean; date: string | null }) {
  return (
    <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${on ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
      <span className={on ? "text-emerald-600 mt-0.5" : "text-amber-600 mt-0.5"}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-[14px] font-semibold ${on ? "text-emerald-600" : "text-amber-600"}`}>{on ? "Yes" : "No"}</p>
        {on && date && <p className="text-[11px] text-muted-foreground">since {formatFlagDate(date)}</p>}
      </div>
    </div>
  );
}

function EmptyRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-2">
      {icon}
      <p className="text-[13px] text-muted-foreground max-w-[320px]">{text}</p>
    </div>
  );
}
