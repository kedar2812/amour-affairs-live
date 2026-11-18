"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Globe, Camera, Phone, Users, Mail, Inbox, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { leadsAPI, familiesAPI, getStoredToken } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";
import { istTime, formatISTDate } from "@/lib/datetime";
import {
  FamilyFestival, FamilyOccasion, FamiliesUpcomingResponse,
  daysUntilLabel, occasionTitle,
} from "@/lib/families";

interface NotifLead {
  id: number;
  lead_ref: string;
  client_name: string;
  event_type: string;
  source: string;
  stage: string;
  created_at: string;
}

// Timestamp (ms) the user last opened the bell. New leads created after
// this are counted as "unread" and drive the red badge.
const LAST_SEEN_KEY = "aa_notifs_last_seen";
// Timestamp (ms) before which notifications have been dismissed/cleared. Leads
// older than this are hidden from the panel (the lead itself is untouched).
const CLEARED_KEY = "aa_notifs_cleared_before";

const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
};

const sourceIcon = (source: string) => {
  switch (source) {
    case "Website": return <Globe className="h-3.5 w-3.5" />;
    case "Instagram": return <Camera className="h-3.5 w-3.5" />;
    case "WhatsApp": return <Phone className="h-3.5 w-3.5" />;
    case "Referral": return <Users className="h-3.5 w-3.5" />;
    default: return <Mail className="h-3.5 w-3.5" />;
  }
};

const timeAgo = (iso: string) => {
  // API datetimes are naive IST — istTime() parses them as IST so the
  // "x min ago" maths is right in every browser timezone.
  const t = istTime(iso);
  if (!t) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatISTDate(iso, { day: "numeric", month: "short" });
};

const leadTime = (iso: string) => istTime(iso);

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<NotifLead[]>([]);
  const [occasions, setOccasions] = useState<FamilyOccasion[]>([]);
  const [festivals, setFestivals] = useState<FamilyFestival[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSeen, setLastSeen] = useState(0);
  const [clearedBefore, setClearedBefore] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchLeads = useCallback(async () => {
    if (isMockMode()) { setLeads([]); setLoading(false); return; }
    try {
      const res = (await leadsAPI.list()) as { leads: NotifLead[] };
      const list = (res.leads || [])
        .map((l) => ({ ...l, client_name: decodeEntities(l.client_name), event_type: decodeEntities(l.event_type) }))
        .sort((a, b) => leadTime(b.created_at) - leadTime(a.created_at));
      setLeads(list);
    } catch {
      /* leave list as-is on transient errors */
    } finally {
      setLoading(false);
    }
    // CRM reminders: occasions due in the next 7 days ride along with leads
    try {
      const crm = (await familiesAPI.upcoming(7)) as FamiliesUpcomingResponse;
      setOccasions((crm.occasions || []).filter((o) => !o.sent));
      setFestivals(crm.festivals || []);
    } catch {
      /* CRM feed is best-effort — never block lead notifications */
    }
  }, []);

  useEffect(() => {
    setLastSeen(Number(localStorage.getItem(LAST_SEEN_KEY) || 0));
    setClearedBefore(Number(localStorage.getItem(CLEARED_KEY) || 0));
    fetchLeads();
    // Light polling so freshly-submitted website enquiries surface without a refresh
    const id = setInterval(fetchLeads, 60000);
    return () => clearInterval(id);
  }, [fetchLeads]);

  // Refetch when the tab regains focus (catches enquiries sent while away)
  useEffect(() => {
    const onFocus = () => fetchLeads();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchLeads]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Hide notifications the user has cleared; the underlying lead stays intact.
  const visibleLeads = leads.filter((l) => leadTime(l.created_at) > clearedBefore);
  // Occasions due today (not yet wished) count toward the badge so a birthday
  // is impossible to miss even without opening the panel.
  const dueToday = occasions.filter((o) => o.days_until <= 0).length +
    festivals.filter((f) => f.days_until <= 0).length;
  const unread = visibleLeads.filter((l) => leadTime(l.created_at) > lastSeen).length + dueToday;

  const clearAll = () => {
    const now = Date.now();
    localStorage.setItem(CLEARED_KEY, String(now));
    localStorage.setItem(LAST_SEEN_KEY, String(now));
    setClearedBefore(now);
    setLastSeen(now);
  };

  const togglePanel = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Opening the panel marks everything as seen.
      const now = Date.now();
      localStorage.setItem(LAST_SEEN_KEY, String(now));
      setLastSeen(now);
    }
  };

  const goToLead = () => {
    setOpen(false);
    router.push("/leads");
  };

  const goToCrm = () => {
    setOpen(false);
    router.push("/crm");
  };

  const occasionRows = [
    ...occasions.map((o) => ({
      key: o.occasion_key,
      emoji: o.occasion === "anniversary" ? "💍" : o.kind === "child_birthday" ? "🎈" : "🎂",
      title: `${decodeEntities(o.family.display_name)} — ${occasionTitle(o)}`,
      when: daysUntilLabel(o.days_until),
      days: o.days_until,
    })),
    ...festivals.map((f) => ({
      key: `f-${f.id}`,
      emoji: f.emoji || "✨",
      title: `${decodeEntities(f.name)} — festival wishes`,
      when: daysUntilLabel(f.days_until),
      days: f.days_until,
    })),
  ].sort((a, b) => a.days - b.days).slice(0, 6);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={togglePanel}
        className="h-10 w-10 relative flex items-center justify-center rounded-xl border border-border/50 bg-card/10 hover:bg-card/20 backdrop-blur-md transition-colors"
        title="Notifications"
      >
        <Bell className="h-[18px] w-[18px] text-foreground" strokeWidth={1.7} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-white text-[10px] font-bold ring-2 ring-card pulse-glow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-[340px] max-h-[460px] bg-card border border-border/60 rounded-2xl shadow-2xl z-[200] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <h3 className="text-[14px] font-bold text-foreground">Notifications</h3>
              <div className="flex items-center gap-2.5">
                {unread > 0 && (
                  <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{unread} new</span>
                )}
                {visibleLeads.length > 0 && (
                  <button onClick={clearAll} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {occasionRows.length > 0 && (
                <div className="border-b border-border/50">
                  <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Occasions</p>
                  <ul>
                    {occasionRows.map((row) => (
                      <li key={row.key}>
                        <button
                          onClick={goToCrm}
                          className={`w-full text-left px-4 py-2.5 flex gap-3 items-center hover:bg-muted/40 transition-colors ${row.days <= 0 ? "bg-primary/[0.05]" : ""}`}
                        >
                          <span className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-[15px]">{row.emoji}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold text-foreground truncate">{row.title}</span>
                            <span className={`block text-[11px] mt-0.5 ${row.days <= 0 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                              {row.when} · tap to send wishes
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </div>
              ) : visibleLeads.length === 0 && occasionRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                    <Inbox className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-[13px] font-semibold text-foreground">You&apos;re all caught up</p>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    New website enquiries will appear here the moment they come in.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {visibleLeads.slice(0, 12).map((lead) => {
                    const isUnread = leadTime(lead.created_at) > lastSeen;
                    return (
                      <li key={lead.id}>
                        <button
                          onClick={goToLead}
                          className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/40 transition-colors ${isUnread ? "bg-primary/[0.04]" : ""}`}
                        >
                          <span className={`mt-0.5 h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${lead.source === "Website" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {sourceIcon(lead.source)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-foreground truncate">{lead.client_name}</span>
                              {isUnread && <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />}
                            </span>
                            <span className="block text-[12px] text-muted-foreground truncate">
                              New {lead.source === "Website" ? "website " : ""}enquiry · {lead.event_type}
                            </span>
                            <span className="block text-[11px] text-muted-foreground/70 mt-0.5">{timeAgo(lead.created_at)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <button
              onClick={goToLead}
              className="shrink-0 px-4 py-3 border-t border-border/50 text-[13px] font-semibold text-primary hover:bg-muted/40 transition-colors text-center"
            >
              View all leads
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
