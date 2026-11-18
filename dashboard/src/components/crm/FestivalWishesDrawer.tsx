"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, AlertTriangle } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { WhatsAppIcon } from "@/components/crm/WhatsAppIcon";
import { familiesAPI } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";
import {
  Family, FamilyFestival, resolveRecipients, composeFamilyMessage,
} from "@/lib/families";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  festival: FamilyFestival | null;
  families: Family[];
  templates: Record<string, string>;
  onSent?: () => void;
}

/**
 * Send a festival's wishes to every family, one tap each. Each family row
 * resolves its adult recipients, opens WhatsApp per number, and records a
 * per-family sent tick (idempotent for this festival + year).
 */
export function FestivalWishesDrawer({ isOpen, onClose, festival, families, templates, onSent }: Props) {
  const [search, setSearch] = useState("");
  const [sentIds, setSentIds] = useState<number[]>([]);
  const [logging, setLogging] = useState<number | null>(null);

  useEffect(() => { if (isOpen) { setSearch(""); setSentIds([]); } }, [isOpen, festival]);

  const rows = useMemo(() => {
    if (!festival) return [];
    const q = search.trim().toLowerCase();
    return families
      .filter((f) => !q || decodeEntities(f.display_name).toLowerCase().includes(q))
      .map((f) => {
        const { recipients, skipped } = resolveRecipients(f, { type: "festival" });
        const message = composeFamilyMessage({
          templates, family: f, occasion: "festival",
          festivalName: festival.name, festivalTemplate: festival.message_template,
        });
        return { family: f, recipients, skipped, message };
      });
  }, [festival, families, search, templates]);

  if (!festival) return null;

  const markSent = async (family: Family, message: string) => {
    setLogging(family.id);
    try {
      await familiesAPI.logSend({
        family_id: family.id,
        occasion: "festival",
        festival_id: festival.id,
        occasion_year: festival.occasion_year,
        message,
      });
      setSentIds((prev) => (prev.includes(family.id) ? prev : [...prev, family.id]));
      onSent?.();
    } catch {
      // non-fatal
    } finally {
      setLogging(null);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width="500px" title={`${festival.emoji || ""} ${decodeEntities(festival.name)} — Wishes`.trim()}>
      <div className="p-6 space-y-4">
        <p className="text-[13px] text-muted-foreground">
          Send festival wishes to each family. Both adults receive the message; open WhatsApp then mark it sent.
        </p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search families…"
            className="h-10 w-full pl-9 pr-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-[13px] text-muted-foreground text-center py-8">No families found.</p>
          )}
          {rows.map(({ family, recipients, skipped, message }) => {
            const sent = sentIds.includes(family.id);
            return (
              <div key={family.id} className="p-3 rounded-xl bg-muted/20 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-foreground truncate">{decodeEntities(family.display_name)}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {recipients.length > 0 ? `${recipients.length} recipient${recipients.length > 1 ? "s" : ""}` : "No usable number"}
                      {skipped.length > 0 ? ` · ${skipped.length} skipped` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {recipients.map((r) => (
                      <a
                        key={r.member_id}
                        href={`https://wa.me/${r.digits}?text=${encodeURIComponent(message)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`WhatsApp ${r.name}`}
                        className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[12px] font-bold bg-[#25D366]/10 text-[#1DA851] border border-[#25D366]/25 hover:bg-[#25D366]/20 transition-colors"
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5" /> {r.name.split(" ")[0]}
                      </a>
                    ))}
                    <button
                      onClick={() => markSent(family, message)}
                      disabled={sent || logging === family.id || recipients.length === 0}
                      className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                        sent ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                             : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/50"
                      } disabled:opacity-40`}
                      title={sent ? "Marked as sent" : "Mark as sent"}
                    >
                      {logging === family.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                {skipped.length > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {skipped.map((s) => s.name).join(", ")} — no usable number
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
}
