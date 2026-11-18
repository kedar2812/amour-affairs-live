"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Archive, Loader2, Trash2, X } from "lucide-react";
import { clientsAPI, ClientDeleteImpact, getStoredToken } from "@/lib/api";
import { formatINR } from "@/lib/utils";

type DeleteMode = "keep" | "all";

interface DeleteTarget {
  dbId: number;
  name: string;
}

interface DeleteClientModalProps {
  /** The client being deleted; null closes the modal. */
  client: DeleteTarget | null;
  onClose: () => void;
  /** Runs after a successful delete — refetch the list, close any open drawer. */
  onDeleted: (mode: DeleteMode) => void;
}

/** The list falls back to bundled demo clients when the API is unreachable. */
const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
};

/**
 * Two-way delete confirmation. The studio's books and their contact list are
 * different things: a client can leave the contact list while their bookings,
 * invoices and payments stay in the accounts (those rows carry their own
 * client_name, so the history still reads correctly). "Delete everything" is
 * the nuclear option and is styled — and worded — like one.
 *
 * The dialog body is a separate keyed component so every client gets a fresh
 * modal state without a reset effect, while AnimatePresence still gets to run
 * the close animation.
 */
export function DeleteClientModal({ client, onClose, onDeleted }: DeleteClientModalProps) {
  // Portals need a DOM; on the server there is nothing to render into and the
  // modal is never open on first paint, so this stays hydration-safe.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {client && (
        <DeleteClientDialog key={client.dbId} client={client} onClose={onClose} onDeleted={onDeleted} />
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DeleteClientDialog({
  client, onClose, onDeleted,
}: { client: DeleteTarget; onClose: () => void; onDeleted: (mode: DeleteMode) => void }) {
  const [mode, setMode] = useState<DeleteMode>("keep");
  const [impact, setImpact] = useState<ClientDeleteImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(() => !isMockMode());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // Ask the API what's linked, so the dialog states real numbers rather than a
  // vague warning. A failure here is non-fatal — the delete still works.
  const clientId = client.dbId;
  useEffect(() => {
    if (isMockMode()) return;
    let cancelled = false;
    clientsAPI.impact(clientId)
      .then((res) => { if (!cancelled) setImpact(res); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingImpact(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !deleting) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleting, onClose]);

  const confirm = async () => {
    if (isMockMode()) {
      setError("Connect to the live API to delete clients — demo data is read-only.");
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await clientsAPI.delete(client.dbId, mode);
      onDeleted(mode);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this client. Nothing was changed.");
      setDeleting(false);
    }
  };

  // "3 bookings, 2 invoices and ₹4,50,000 in payments" — only the parts that exist.
  const historyPhrase = (() => {
    if (!impact) return "";
    const parts: string[] = [];
    if (impact.bookings) parts.push(`${impact.bookings} ${impact.bookings === 1 ? "booking" : "bookings"}`);
    if (impact.invoices) parts.push(`${impact.invoices} ${impact.invoices === 1 ? "invoice" : "invoices"}`);
    if (impact.transactions) parts.push(`${formatINR(impact.payments_total)} in payments`);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  })();

  const hasHistory = historyPhrase !== "";
  const crmCount = impact ? impact.special_dates : 0;

  const options: { value: DeleteMode; icon: React.ReactNode; title: string; body: string }[] = [
    {
      value: "keep",
      icon: <Archive className="h-4 w-4" />,
      title: "Keep their records",
      body: hasHistory
        ? `Removes ${client.name} from your client list. Their ${historyPhrase} stay in your books under their name — just no longer linked to a client card.`
        : `Removes ${client.name} from your client list. There's no booking or payment history attached, so nothing else changes.`,
    },
    {
      value: "all",
      icon: <Trash2 className="h-4 w-4" />,
      title: "Delete everything",
      body: hasHistory
        ? `Removes ${client.name} and permanently deletes their ${historyPhrase}. Your totals and reports will change.`
        : `Removes ${client.name} and anything attached. There's no booking or payment history to lose.`,
    },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => { if (!deleting) onClose(); }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[520px] bg-card border border-border/50 shadow-2xl rounded-2xl flex flex-col pointer-events-auto overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-6 pb-4">
          <span className="h-10 w-10 shrink-0 rounded-xl bg-red-500/10 text-red-500 grid place-items-center">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-foreground truncate">Delete {client.name}?</h2>
            <p className="text-[13px] text-muted-foreground">
              This can&apos;t be undone. Choose how much to remove.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            aria-label="Close"
            className="h-8 w-8 shrink-0 rounded-full grid place-items-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Options */}
        <div className="px-6 space-y-2">
          {loadingImpact && (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground pb-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking what&apos;s linked to this client…
            </div>
          )}

          {options.map((opt) => {
            const active = mode === opt.value;
            const danger = opt.value === "all";
            return (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                disabled={deleting}
                className={`w-full text-left p-4 rounded-xl border transition-colors disabled:opacity-60 ${
                  active
                    ? danger
                      ? "bg-red-500/5 border-red-500/40"
                      : "bg-primary/5 border-primary/40"
                    : "bg-muted/20 border-border/50 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 grid place-items-center transition-colors ${
                      active ? (danger ? "border-red-500" : "border-primary") : "border-border"
                    }`}
                  >
                    {active && <span className={`h-2 w-2 rounded-full ${danger ? "bg-red-500" : "bg-primary"}`} />}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-[13px] font-bold flex items-center gap-1.5 ${danger && active ? "text-red-500" : "text-foreground"}`}>
                      {opt.icon} {opt.title}
                      {opt.value === "keep" && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          Recommended
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-muted-foreground leading-snug mt-1">{opt.body}</p>
                  </div>
                </div>
              </button>
            );
          })}

          {crmCount > 0 && (
            <p className="text-[12px] text-muted-foreground pt-1">
              Either way, {crmCount === 1 ? "their special date" : `their ${crmCount} special dates`} and greeting
              history are removed — those only exist alongside the client.
            </p>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-medium">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 pt-5 mt-2 bg-muted/20 border-t border-border/50">
          <button
            onClick={onClose}
            disabled={deleting}
            className="h-10 px-4 rounded-xl border border-border/50 text-[13px] font-bold text-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={deleting}
            className="h-10 px-5 rounded-xl bg-red-500 text-white text-[13px] font-bold hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? "Deleting…" : mode === "all" ? "Delete everything" : "Delete client"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
