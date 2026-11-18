"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Gift, Loader2, Cake, Heart, Baby } from "lucide-react";
import { familiesAPI, getStoredToken } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";
import {
  Family, FamilyOccasion, FamilyFestival, FamiliesUpcomingResponse, WishTarget,
  resolveRecipients, daysUntilLabel, occasionTitle,
} from "@/lib/families";
import { WhatsAppIcon } from "@/components/crm/WhatsAppIcon";
import { WishComposer } from "@/components/crm/WishComposer";
import { FestivalWishesDrawer } from "@/components/crm/FestivalWishesDrawer";

const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
};

interface ActiveWish {
  family: Family;
  target: WishTarget;
  occasionYear: number;
  years?: number | null;
}

/*
 * Upcoming Occasions — the CRM at-a-glance card. Family birthdays,
 * anniversaries and festivals due in the next 30 days, each with a
 * one-tap "send via WhatsApp" curated greeting. Full management lives
 * on the /crm page.
 */
export function UpcomingOccasions() {
  const [data, setData] = useState<FamiliesUpcomingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [wish, setWish] = useState<ActiveWish | null>(null);
  const [festival, setFestival] = useState<FamilyFestival | null>(null);

  const load = useCallback(async () => {
    if (isMockMode()) { setData(null); setLoading(false); return; }
    try {
      setData((await familiesAPI.upcoming(30)) as FamiliesUpcomingResponse);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const templates = data?.templates || {};
  const families = data?.families || [];

  // Interleave occasions + festivals, soonest first
  const rows: (FamilyOccasion | FamilyFestival)[] = [
    ...(data?.occasions || []),
    ...(data?.festivals || []),
  ].sort((a, b) => a.days_until - b.days_until).slice(0, 8);

  const sendOccasion = (o: FamilyOccasion) => {
    const target: WishTarget = o.occasion === "anniversary"
      ? { type: "anniversary" }
      : { type: "birthday", memberId: o.member_id as number };
    setWish({ family: o.family, target, occasionYear: o.occasion_year, years: o.years });
  };

  const occasionIcon = (o: FamilyOccasion) => {
    if (o.occasion === "anniversary") return <Heart className="h-3.5 w-3.5" />;
    if (o.kind === "child_birthday") return <Baby className="h-3.5 w-3.5" />;
    return <Cake className="h-3.5 w-3.5" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="h-full"
    >
      <div className="dash-card h-full flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h3 className="dash-card-title">Upcoming Occasions</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">Birthdays, anniversaries &amp; festivals — next 30 days</p>
          </div>
          <Link href="/crm" className="text-[13px] font-semibold text-primary flex items-center gap-0.5 hover:underline">
            CRM <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex-1 px-4 pb-4 space-y-1 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 gap-2">
              <Gift className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground max-w-[260px]">
                No occasions in the next 30 days. Add families and their dates on the CRM page.
              </p>
            </div>
          ) : (
            rows.map((row, i) => {
              const isToday = row.days_until <= 0;
              const dateObj = new Date(row.next_date + "T00:00:00");
              const dateBlock = (
                <div className={`w-11 shrink-0 flex flex-col items-center justify-center py-1.5 rounded-lg ${isToday ? "bg-primary/15" : "bg-muted"}`}>
                  <span className={`text-[10px] font-bold uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {dateObj.toLocaleDateString("en-IN", { month: "short" })}
                  </span>
                  <span className={`text-lg font-bold leading-tight ${isToday ? "text-primary" : "text-foreground"}`}>
                    {dateObj.getDate()}
                  </span>
                </div>
              );

              if (row.kind === "festival") {
                return (
                  <motion.div
                    key={`f-${row.id}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    {dateBlock}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] font-semibold text-foreground truncate">
                        {row.emoji ? `${row.emoji} ` : ""}{decodeEntities(row.name)}
                      </h4>
                      <p className="text-[12px] text-muted-foreground">
                        {daysUntilLabel(row.days_until)} · Festival wishes for all families
                      </p>
                    </div>
                    <button
                      onClick={() => setFestival(row)}
                      disabled={families.length === 0}
                      className="h-8 px-3 shrink-0 rounded-lg flex items-center gap-1.5 text-[12px] font-bold bg-[#25D366]/10 text-[#1DA851] border border-[#25D366]/25 hover:bg-[#25D366]/20 transition-colors disabled:opacity-40"
                      title="Send festival wishes over WhatsApp"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5" /> Send
                    </button>
                  </motion.div>
                );
              }

              const { recipients } = resolveRecipients(row.family, row.occasion === "anniversary" ? { type: "anniversary" } : { type: "birthday", memberId: row.member_id as number });
              return (
                <motion.div
                  key={row.occasion_key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  {dateBlock}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[14px] font-semibold text-foreground truncate flex items-center gap-1.5">
                      <span className="text-muted-foreground">{occasionIcon(row)}</span>
                      {decodeEntities(row.family.display_name)}
                    </h4>
                    <p className="text-[12px] text-muted-foreground truncate">
                      {occasionTitle(row)}
                      {row.years != null && row.years > 0 ? (row.occasion === "anniversary" ? ` · ${row.years} years` : ` · turns ${row.years}`) : ""}
                      {" · "}{daysUntilLabel(row.days_until)}
                    </p>
                  </div>
                  <button
                    onClick={() => sendOccasion(row)}
                    disabled={recipients.length === 0}
                    className={`h-8 px-3 shrink-0 rounded-lg flex items-center gap-1.5 text-[12px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      row.sent
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-[#25D366]/10 text-[#1DA851] border border-[#25D366]/25 hover:bg-[#25D366]/20"
                    }`}
                    title={recipients.length === 0 ? "No usable number for this family" : row.sent ? "Already wished — send again" : "Open the WhatsApp composer"}
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5" />
                    {row.sent ? "Sent" : "Send"}
                  </button>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <WishComposer
        isOpen={!!wish}
        onClose={() => setWish(null)}
        family={wish?.family || null}
        target={wish?.target || null}
        occasionYear={wish?.occasionYear || new Date().getFullYear()}
        years={wish?.years ?? null}
        templates={templates}
        onSent={load}
      />

      <FestivalWishesDrawer
        isOpen={!!festival}
        onClose={() => setFestival(null)}
        festival={festival}
        families={families}
        templates={templates}
        onSent={load}
      />
    </motion.div>
  );
}
