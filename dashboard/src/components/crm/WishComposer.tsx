"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, AlertTriangle, Loader2 } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { WhatsAppIcon } from "@/components/crm/WhatsAppIcon";
import { familiesAPI } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";
import {
  Family, FamilyFestival, WishTarget,
  resolveRecipients, composeFamilyMessage, ROLE_LABEL,
} from "@/lib/families";

interface WishComposerProps {
  isOpen: boolean;
  onClose: () => void;
  family: Family | null;
  target: WishTarget | null;
  occasionYear: number;
  /** Present when target.type === "festival". */
  festival?: FamilyFestival | null;
  /** For a birthday/anniversary, the years (age / anniversary count) if known. */
  years?: number | null;
  templates: Record<string, string>;
  /** Called after the wish is logged so parents can refresh sent-state. */
  onSent?: () => void;
}

/**
 * Composes a curated WhatsApp wish for a family occasion, shows exactly which
 * numbers will receive it (per the routing rules), lets the studio edit the
 * message, opens WhatsApp per recipient, and logs the send once. Members
 * without a usable number are surfaced, never dropped silently.
 */
export function WishComposer({
  isOpen, onClose, family, target, occasionYear, festival, years, templates, onSent,
}: WishComposerProps) {
  const resolved = useMemo(() => {
    if (!family || !target) return { recipients: [], skipped: [] };
    return resolveRecipients(family, target);
  }, [family, target]);

  const member = useMemo(() => {
    if (!family || !target || target.type !== "birthday") return null;
    return family.members.find((m) => m.id === target.memberId) || null;
  }, [family, target]);

  const defaultMessage = useMemo(() => {
    if (!family || !target) return "";
    const occasion = target.type;
    return composeFamilyMessage({
      templates,
      family,
      occasion,
      member,
      festivalName: festival?.name || null,
      festivalTemplate: festival?.message_template || null,
      years: years ?? null,
    });
  }, [family, target, templates, member, festival, years]);

  const [message, setMessage] = useState(defaultMessage);
  const [opened, setOpened] = useState<number[]>([]);
  const [logging, setLogging] = useState(false);
  const [loggedOk, setLoggedOk] = useState(false);

  // Reset composer whenever it opens for a new occasion
  useEffect(() => {
    if (isOpen) {
      setMessage(defaultMessage);
      setOpened([]);
      setLoggedOk(false);
    }
  }, [isOpen, defaultMessage]);

  if (!family || !target) return null;

  const familyName = decodeEntities(family.display_name);
  const title =
    target.type === "festival"
      ? `${decodeEntities(festival?.name || "") || "Festival"} — ${familyName}`
      : target.type === "anniversary"
        ? `Anniversary — ${familyName}`
        : `Birthday — ${decodeEntities(member?.name || "") || familyName}`;

  const openWhatsApp = (digits: string, memberId: number) => {
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
    setOpened((prev) => (prev.includes(memberId) ? prev : [...prev, memberId]));
  };

  const logSend = async () => {
    setLogging(true);
    try {
      await familiesAPI.logSend({
        family_id: family.id,
        occasion: target.type,
        family_member_id: target.type === "birthday" ? target.memberId : undefined,
        festival_id: target.type === "festival" ? festival?.id : undefined,
        occasion_year: occasionYear,
        message,
      });
      setLoggedOk(true);
      onSent?.();
      setTimeout(onClose, 700);
    } catch {
      // Non-fatal — the message may already have gone out; allow retry.
    } finally {
      setLogging(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width="460px" title="Send a Wish">
      <div className="p-6 space-y-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Occasion</p>
          <p className="text-[15px] font-semibold text-foreground">{title}</p>
        </div>

        {/* Recipients */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Sending to {resolved.recipients.length} {resolved.recipients.length === 1 ? "recipient" : "recipients"}
          </p>
          {resolved.recipients.length === 0 ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[13px]">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>No family member has a usable WhatsApp number. Add one on the family record first.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {resolved.recipients.map((r) => (
                <div key={r.member_id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">
                      {r.name} <span className="font-normal text-muted-foreground">· {ROLE_LABEL[r.role]}</span>
                    </p>
                    <p className="text-[12px] text-muted-foreground font-mono">{r.display}</p>
                  </div>
                  <button
                    onClick={() => openWhatsApp(r.digits, r.member_id)}
                    className={`h-8 px-3 shrink-0 rounded-lg flex items-center gap-1.5 text-[12px] font-bold transition-colors ${
                      opened.includes(r.member_id)
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-[#25D366]/10 text-[#1DA851] border border-[#25D366]/25 hover:bg-[#25D366]/20"
                    }`}
                  >
                    {opened.includes(r.member_id) ? <Check className="h-3.5 w-3.5" /> : <WhatsAppIcon className="h-3.5 w-3.5" />}
                    {opened.includes(r.member_id) ? "Opened" : "WhatsApp"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Skipped members */}
          {resolved.skipped.length > 0 && (
            <div className="mt-2 space-y-1">
              {resolved.skipped.map((s) => (
                <p key={s.member_id} className="text-[12px] text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {s.name} ({ROLE_LABEL[s.role]}) skipped — {s.reason === "no_number" ? "no number on file" : "number looks invalid"}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Editable message */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Message</p>
            <button
              onClick={() => navigator.clipboard?.writeText(message)}
              className="text-[12px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full p-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] leading-relaxed focus:outline-none focus:border-primary/50 resize-none"
          />
        </div>

        {/* Log */}
        <button
          onClick={logSend}
          disabled={logging || loggedOk || resolved.recipients.length === 0}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {logging ? <Loader2 className="h-4 w-4 animate-spin" /> : loggedOk ? <Check className="h-4 w-4" /> : null}
          {loggedOk ? "Marked as sent" : "Mark as sent"}
        </button>
        <p className="text-[12px] text-muted-foreground text-center -mt-2">
          Open WhatsApp for each recipient above, then mark it sent so it won&apos;t show again this year.
        </p>
      </div>
    </Drawer>
  );
}
