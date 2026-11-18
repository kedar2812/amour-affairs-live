"use client";

import React, { useEffect, useState } from 'react';
import {
  Save, Users, Globe, Loader2, Check, ArrowRight,
  ShieldCheck, KeyRound, LogOut, Eye, EyeOff,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BackupRestoreCard } from '@/components/settings/BackupRestoreCard';
import { useSettings } from '@/lib/useData';
import { settingsAPI, authAPI, type AuthResponse } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { formatISTDateTime } from '@/lib/datetime';

const FIELDS: { key: string; label: string; type?: string; full?: boolean; multiline?: boolean; hint?: string }[] = [
  { key: "studio_name", label: "Studio Name" },
  { key: "studio_tagline", label: "Tagline" },
  { key: "studio_email", label: "Email", type: "email" },
  { key: "studio_phone", label: "Phone" },
  { key: "studio_whatsapp", label: "WhatsApp Number", hint: "Digits only or with country code — used for every WhatsApp / Book Now button on the website." },
  { key: "studio_address", label: "Address", full: true, multiline: true, hint: "Shown in the website footer. Put each line of the address on its own line — it appears exactly that way. Commas stay on the same line (e.g. keep “5, Finance Road” together)." },
  { key: "studio_map_embed", label: "Google Maps embed", full: true, multiline: true, hint: "On Google Maps: Share → Embed a map → Copy HTML, and paste it here. Updates the map in the website footer." },
  { key: "studio_rating_value", label: "Google Rating", hint: "Your average star rating on Google, e.g. 4.9. Powers the rich-snippet star rating in search results." },
  { key: "studio_review_count", label: "Google Review Count", hint: "Total number of Google reviews, e.g. 198. Bump this when it grows — must reflect your real, public review count." },
];

export default function SettingsPage() {
  const { data: settings, refetch } = useSettings("profile");
  const { user, logout } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Hydrate the form from the saved studio_* settings once they load.
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of FIELDS) next[f.key] = settings[f.key] || "";
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.studio_name, settings.studio_tagline, settings.studio_email, settings.studio_phone, settings.studio_whatsapp, settings.studio_address, settings.studio_map_embed, settings.studio_rating_value, settings.studio_review_count]);

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError("");
    try {
      await settingsAPI.update(form);
      setSaved(true);
      refetch();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e instanceof Error && e.message) || "Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[900px] mx-auto w-full h-full pb-12">
      <div className="shrink-0 px-2 lg:px-0">
        <h1 className="dash-h1">Settings</h1>
        <p className="text-[14px] text-muted-foreground mt-1">Your studio profile, account security and data — used across the website and invoices.</p>
      </div>

      {/* Studio Profile (wired to the live settings API) */}
      <div className="dash-card p-8 space-y-6">
        <h2 className="text-xl font-bold text-foreground">Studio Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.full ? "md:col-span-2" : ""}>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">{f.label}</label>
              {f.multiline ? (
                <textarea
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  rows={f.key === "studio_map_embed" ? 4 : 3}
                  className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50 resize-none"
                />
              ) : (
                <input
                  type={f.type || "text"}
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50"
                />
              )}
              {f.hint && <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{f.hint}</p>}
            </div>
          ))}
        </div>

        <div className="pt-5 border-t border-border/50 flex items-center justify-end gap-3">
          {error && <span className="text-[13px] text-red-500 mr-auto">{error}</span>}
          {saved && <span className="text-[13px] text-emerald-600 flex items-center gap-1 mr-auto"><Check className="h-4 w-4" /> Saved</span>}
          <Button onClick={handleSave} disabled={saving} className="rounded-xl px-6 bg-primary text-primary-foreground font-bold shadow-md h-10">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Account & Security — real account info + working password change */}
      <AccountSecurityCard user={user} onSignOut={logout} />

      {/* Data & Backup — full-site backup ZIP, restore, undo + readable reports */}
      <BackupRestoreCard userEmail={user?.email ?? ''} />

      {/* Where the rest is managed — no dead placeholder tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/team" className="dash-card p-5 flex items-center gap-4 hover:border-primary/40 transition-colors group">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[15px] text-foreground">Team & Founder</h3>
            <p className="text-[12px] text-muted-foreground">Manage team members and the About-page founder block.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </Link>
        <Link href="/website" className="dash-card p-5 flex items-center gap-4 hover:border-primary/40 transition-colors group">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[15px] text-foreground">Website Content</h3>
            <p className="text-[12px] text-muted-foreground">Edit hero copy, packages, pricing and page content.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </Link>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────
   ACCOUNT & SECURITY
   Shows the signed-in identity (from the live /me endpoint, with a
   graceful fall back to the cached auth user) and a fully-wired
   password change against auth.php?action=change-password.
   ───────────────────────────────────────────────────────────── */
function AccountSecurityCard({
  user,
  onSignOut,
}: {
  user: AuthResponse["user"] | null;
  onSignOut: () => void | Promise<void>;
}) {
  const [me, setMe] = useState<(AuthResponse["user"] & { last_login?: string | null }) | null>(null);

  useEffect(() => {
    let alive = true;
    authAPI.me()
      .then((res) => { if (alive) setMe(res.user); })
      .catch(() => { /* offline / mock session — fall back to cached user below */ });
    return () => { alive = false; };
  }, []);

  const identity = me || user;
  const lastLogin = me?.last_login ? formatISTDateTime(me.last_login) : null;

  // Password form
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = current.length > 0 && next.length >= 8 && confirm.length > 0 && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setOk(false);
    if (next.length < 8) { setErr("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setErr("New password and confirmation don't match."); return; }
    if (next === current) { setErr("New password must be different from your current one."); return; }
    setBusy(true);
    try {
      await authAPI.changePassword(current, next);
      setOk(true);
      setCurrent(""); setNext(""); setConfirm("");
      setTimeout(() => setOk(false), 4000);
    } catch (e) {
      setErr((e instanceof Error && e.message) || "Couldn't update your password — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50";

  return (
    <div className="dash-card p-8 space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">Account &amp; Security</h2>
      </div>

      {/* Identity */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-[14px] font-bold text-primary">{identity?.name?.substring(0, 2).toUpperCase() || 'AA'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-foreground truncate">{identity?.name || 'Amour Affairs'}</p>
          <p className="text-[12px] text-muted-foreground truncate">{identity?.email || ''}</p>
        </div>
        <div className="text-right shrink-0">
          {identity?.role && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-md px-2 py-1">
              {String(identity.role).replace(/_/g, ' ')}
            </span>
          )}
          {lastLogin && <p className="text-[11px] text-muted-foreground mt-1.5">Last sign-in: {lastLogin}</p>}
        </div>
      </div>

      {/* Change password */}
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Change Password</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Current Password</label>
            <input type={show ? "text" : "password"} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">New Password</label>
            <input type={show ? "text" : "password"} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
            <p className="text-[11px] text-muted-foreground mt-1.5">At least 8 characters.</p>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Confirm New</label>
            <input type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => setShow((s) => !s)} className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {show ? "Hide" : "Show"} passwords
          </button>
          {err && <span className="text-[13px] text-red-500">{err}</span>}
          {ok && <span className="text-[13px] text-emerald-600 flex items-center gap-1"><Check className="h-4 w-4" /> Password updated</span>}
          <Button type="submit" disabled={!canSubmit} className="ml-auto rounded-xl px-6 bg-primary text-primary-foreground font-bold shadow-md h-10 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Update Password
          </Button>
        </div>
      </form>

      {/* Sign out */}
      <div className="pt-5 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12px] text-muted-foreground">Signed in on this device. Sign out to end your session.</p>
        <button
          onClick={() => onSignOut()}
          className="h-10 px-4 flex items-center gap-2 rounded-xl border border-border/50 text-[13px] font-semibold text-foreground hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/5 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
