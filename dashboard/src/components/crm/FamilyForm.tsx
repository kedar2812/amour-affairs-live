"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/Drawer";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { familiesAPI } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";
import { isValidStoredPhone } from "@/lib/phone";
import { Family, FamilyMember, MemberRole, formatFlagDate } from "@/lib/families";

interface FamilyFormProps {
  isOpen: boolean;
  onClose: () => void;
  /** null = create; a Family = edit. */
  family: Family | null;
  onSaved: () => void;
}

interface MemberDraft {
  id?: number;
  role: MemberRole;
  name: string;
  dob: string;
  phone: string;
  whatsapp: string;
}

const emptyMember = (role: MemberRole): MemberDraft => ({ role, name: "", dob: "", phone: "", whatsapp: "" });

const toDraft = (m: FamilyMember): MemberDraft => ({
  id: m.id,
  role: m.role,
  // Decode on prefill: the API stores names HTML-encoded, so editing a raw
  // value and re-saving would double-encode it (& → &amp; → &amp;amp;).
  name: decodeEntities(m.name),
  dob: m.dob || "",
  phone: m.phone || "",
  whatsapp: m.whatsapp || "",
});

const inputCls =
  "w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50";
const labelCls = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block";

export function FamilyForm({ isOpen, onClose, family, onSaved }: FamilyFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [notes, setNotes] = useState("");
  const [albumGiven, setAlbumGiven] = useState(false);
  const [testimonialGiven, setTestimonialGiven] = useState(false);
  const [husband, setHusband] = useState<MemberDraft>(emptyMember("husband"));
  const [wife, setWife] = useState<MemberDraft>(emptyMember("wife"));
  const [children, setChildren] = useState<MemberDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState("");

  // Prefill on open (edit) or reset (create)
  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setSavedOk(false);
    if (family) {
      setDisplayName(decodeEntities(family.display_name));
      setAnniversary(family.anniversary_date || "");
      setNotes(decodeEntities(family.notes || ""));
      setAlbumGiven(family.album_given === 1);
      setTestimonialGiven(family.testimonial_given === 1);
      const h = family.members.find((m) => m.role === "husband");
      const w = family.members.find((m) => m.role === "wife");
      setHusband(h ? toDraft(h) : emptyMember("husband"));
      setWife(w ? toDraft(w) : emptyMember("wife"));
      setChildren(family.members.filter((m) => m.role === "child").map(toDraft));
    } else {
      setDisplayName("");
      setAnniversary("");
      setNotes("");
      setAlbumGiven(false);
      setTestimonialGiven(false);
      setHusband(emptyMember("husband"));
      setWife(emptyMember("wife"));
      setChildren([]);
    }
  }, [isOpen, family]);

  // Suggest a combined display name from the two adult names, until edited
  const suggestName = (h: string, w: string) => {
    const a = h.trim();
    const b = w.trim();
    if (a && b) return `${a} & ${b}`;
    return a || b || "";
  };
  const [nameTouched, setNameTouched] = useState(false);
  useEffect(() => {
    if (!nameTouched && !family) {
      setDisplayName(suggestName(husband.name, wife.name));
    }
  }, [husband.name, wife.name, nameTouched, family]);

  const validMemberPhones = (m: MemberDraft): string | null => {
    if (m.phone.trim() && !isValidStoredPhone(m.phone)) return `${m.name || m.role}'s phone looks incomplete.`;
    if (m.whatsapp.trim() && !isValidStoredPhone(m.whatsapp)) return `${m.name || m.role}'s WhatsApp looks incomplete.`;
    return null;
  };

  const save = async () => {
    if (!displayName.trim()) { setError("Give the family a name (e.g. \"Vikram & Priyanka\")."); return; }
    const all = [husband, wife, ...children];
    for (const m of all) {
      const err = validMemberPhones(m);
      if (err) { setError(err); return; }
    }
    // Children need a name to be meaningful
    for (const c of children) {
      if (!c.name.trim() && (c.dob || c.phone || c.whatsapp)) {
        setError("Every child needs a name."); return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const members = all
        .filter((m) => m.name.trim())
        .map((m) => ({
          id: m.id,
          role: m.role,
          name: m.name.trim(),
          dob: m.dob || null,
          phone: m.phone.trim(),
          whatsapp: m.whatsapp.trim(),
        }));

      const payload = {
        display_name: displayName.trim(),
        anniversary_date: anniversary || null,
        notes: notes.trim(),
        album_given: albumGiven ? 1 : 0,
        testimonial_given: testimonialGiven ? 1 : 0,
        members,
      };

      if (family) {
        await familiesAPI.update(family.id, payload);
      } else {
        await familiesAPI.create(payload);
      }
      setSavedOk(true);
      onSaved();
      setTimeout(onClose, 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the family — please try again.");
    } finally {
      setSaving(false);
    }
  };

  // A plain render function (NOT a nested component) so the inputs keep focus
  // across keystrokes — a nested component type would remount every render.
  const memberFields = (value: MemberDraft, onChange: (m: MemberDraft) => void, roleLabel: string) => (
    <div className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/50">
      <p className="text-[12px] font-bold text-foreground">{roleLabel}</p>
      <div>
        <label className={labelCls}>Name</label>
        <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Full name" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Date of Birth</label>
        <input type="date" value={value.dob} onChange={(e) => onChange({ ...value, dob: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Phone</label>
        <PhoneInput value={value.phone} onChange={(v) => onChange({ ...value, phone: v })} />
      </div>
      <div>
        <label className={labelCls}>WhatsApp <span className="normal-case font-medium text-muted-foreground/70">— if different</span></label>
        <PhoneInput value={value.whatsapp} onChange={(v) => onChange({ ...value, whatsapp: v })} />
      </div>
    </div>
  );

  // Checkbox + explicit Yes/No readout, so an unticked box reads as a
  // deliberate "No" rather than a field someone forgot to fill in.
  const yesNoField = (label: string, checked: boolean, onChange: (v: boolean) => void, markedOn: string | null) => (
    <label
      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
        checked ? "bg-emerald-500/10 border-emerald-500/30" : "bg-muted/20 border-border/50 hover:bg-muted/40"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded accent-[var(--primary)] shrink-0"
      />
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-semibold text-foreground">{label}</span>
        {checked && markedOn && (
          <span className="block text-[11px] text-muted-foreground">since {formatFlagDate(markedOn)}</span>
        )}
      </span>
      <span className={`text-[11px] font-bold uppercase tracking-wide ${checked ? "text-emerald-600" : "text-muted-foreground"}`}>
        {checked ? "Yes" : "No"}
      </span>
    </label>
  );

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width="500px" title={family ? "Edit Family" : "Add Family"}>
      <div className="p-6 space-y-5">
        {error && (
          <div className="text-[13px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
        )}

        <div>
          <label className={labelCls}>Family Name *</label>
          <input
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setNameTouched(true); }}
            placeholder="Vikram &amp; Priyanka"
            className={inputCls}
          />
        </div>

        {/* Follow-ups — the two questions the studio tracks per family */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {yesNoField("Album given?", albumGiven, setAlbumGiven, family?.album_given === 1 ? family.album_given_at : null)}
          {yesNoField("Testimonial given?", testimonialGiven, setTestimonialGiven, family?.testimonial_given === 1 ? family.testimonial_given_at : null)}
        </div>

        <div>
          <label className={labelCls}>Anniversary</label>
          <input type="date" value={anniversary} onChange={(e) => setAnniversary(e.target.value)} className={inputCls} />
        </div>

        {memberFields(husband, setHusband, "Husband")}
        {memberFields(wife, setWife, "Wife")}

        {/* Children — repeatable */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold text-foreground">Children</p>
            <button
              onClick={() => setChildren((p) => [...p, emptyMember("child")])}
              className="text-[12px] font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add child
            </button>
          </div>
          {children.map((c, i) => (
            <div key={i} className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/50 relative">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-foreground">Child {i + 1}</p>
                <button
                  onClick={() => setChildren((p) => p.filter((_, j) => j !== i))}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Remove child"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div>
                <label className={labelCls}>Name</label>
                <input value={c.name} onChange={(e) => setChildren((p) => p.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} placeholder="Child's name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Date of Birth</label>
                <input type="date" value={c.dob} onChange={(e) => setChildren((p) => p.map((r, j) => j === i ? { ...r, dob: e.target.value } : r))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>WhatsApp <span className="normal-case font-medium text-muted-foreground/70">— optional</span></label>
                <PhoneInput value={c.whatsapp} onChange={(v) => setChildren((p) => p.map((r, j) => j === i ? { ...r, whatsapp: v } : r))} />
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything worth remembering…"
            className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50 resize-none" />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="h-10 px-4 rounded-xl border-border/50">Cancel</Button>
          <Button onClick={save} disabled={saving || savedOk} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : savedOk ? <Check className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {savedOk ? "Saved" : family ? "Save Changes" : "Add Family"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
