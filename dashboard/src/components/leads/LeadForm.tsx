"use client";

import React from "react";
import { PhoneInput } from "@/components/ui/PhoneInput";

/**
 * The full lead / enquiry form — the same set of fields the website
 * enquiry form and the studio's own "Add Lead" flow use. Shared between
 * the Add-Lead and Edit-Lead drawers so the two can never drift apart.
 * Notes/messages are handled by the parent (single note on add, an
 * editable history on edit), so they are deliberately NOT rendered here.
 */

export interface LeadFormState {
  client_name: string;
  phone: string;
  email: string;
  instagram: string;
  bride_name: string;
  bride_phone: string;
  bride_whatsapp: string;
  groom_name: string;
  groom_phone: string;
  groom_whatsapp: string;
  event_type: string;
  event_date: string;
  venue: string;
  guest_count: string;
  budget_range: string;
  source: string;
  referrer_name: string;
  note: string;
}

export const EMPTY_LEAD_FORM: LeadFormState = {
  client_name: "", phone: "", email: "", instagram: "",
  bride_name: "", bride_phone: "", bride_whatsapp: "",
  groom_name: "", groom_phone: "", groom_whatsapp: "", event_type: "Wedding",
  event_date: "", venue: "", guest_count: "", budget_range: "", source: "Other",
  referrer_name: "", note: "",
};

export const EVENT_TYPES = ["Wedding", "Pre-Wedding", "Couple Shoot", "Engagement", "Corporate", "Other"];
export const LEAD_SOURCES = ["Website", "Instagram", "WhatsApp", "Google", "Referral", "Other"] as const;

const labelCls = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block";
const smallLabelCls = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block";
const inputBase = "w-full h-10 px-3 bg-muted/30 border rounded-lg text-sm text-foreground focus:outline-none";
const inputOk = "border-border/50 focus:border-primary/50";

interface LeadFormProps {
  form: LeadFormState;
  setForm: React.Dispatch<React.SetStateAction<LeadFormState>>;
  fieldErrors: Record<string, string>;
}

export function LeadForm({ form, setForm, fieldErrors }: LeadFormProps) {
  const set = <K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <>
      <div>
        <label className={labelCls}>Couple / Client Name *</label>
        <input
          type="text"
          value={form.client_name}
          onChange={(e) => set("client_name", e.target.value)}
          placeholder="Priya & Rahul"
          className={`${inputBase} ${fieldErrors.client_name ? "border-red-500 ring-2 ring-red-500/20" : inputOk}`}
        />
        {fieldErrors.client_name && <p className="text-red-500 text-[12px] font-medium mt-1.5">{fieldErrors.client_name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Primary Phone</label>
          <PhoneInput value={form.phone} onChange={(v) => set("phone", v)} />
          {fieldErrors.phone && <p className="text-red-500 text-[12px] font-medium mt-1.5">{fieldErrors.phone}</p>}
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="name@email.com"
            className={`${inputBase} ${fieldErrors.email ? "border-red-500 ring-2 ring-red-500/20" : inputOk}`}
          />
          {fieldErrors.email && <p className="text-red-500 text-[12px] font-medium mt-1.5">{fieldErrors.email}</p>}
        </div>
      </div>

      <div>
        <label className={labelCls}>Instagram <span className="normal-case font-medium text-muted-foreground/70">— optional</span></label>
        <input
          type="text"
          value={form.instagram}
          onChange={(e) => set("instagram", e.target.value)}
          placeholder="@handle"
          className={`${inputBase} ${inputOk}`}
        />
      </div>

      {/* Bride */}
      <div className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/50">
        <p className="text-[12px] font-bold text-foreground">Bride</p>
        <div>
          <label className={smallLabelCls}>Name</label>
          <input
            type="text"
            value={form.bride_name}
            onChange={(e) => set("bride_name", e.target.value)}
            placeholder="Bride's name"
            className={`${inputBase} ${inputOk}`}
          />
        </div>
        <div>
          <label className={smallLabelCls}>Phone</label>
          <PhoneInput value={form.bride_phone} onChange={(v) => set("bride_phone", v)} />
          {fieldErrors.bride_phone && <p className="text-red-500 text-[12px] font-medium mt-1.5">{fieldErrors.bride_phone}</p>}
        </div>
        <div>
          <label className={smallLabelCls}>WhatsApp <span className="normal-case font-medium text-muted-foreground/70">— if different</span></label>
          <PhoneInput value={form.bride_whatsapp} onChange={(v) => set("bride_whatsapp", v)} />
          {fieldErrors.bride_whatsapp && <p className="text-red-500 text-[12px] font-medium mt-1.5">{fieldErrors.bride_whatsapp}</p>}
        </div>
      </div>

      {/* Groom */}
      <div className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/50">
        <p className="text-[12px] font-bold text-foreground">Groom</p>
        <div>
          <label className={smallLabelCls}>Name</label>
          <input
            type="text"
            value={form.groom_name}
            onChange={(e) => set("groom_name", e.target.value)}
            placeholder="Groom's name"
            className={`${inputBase} ${inputOk}`}
          />
        </div>
        <div>
          <label className={smallLabelCls}>Phone</label>
          <PhoneInput value={form.groom_phone} onChange={(v) => set("groom_phone", v)} />
          {fieldErrors.groom_phone && <p className="text-red-500 text-[12px] font-medium mt-1.5">{fieldErrors.groom_phone}</p>}
        </div>
        <div>
          <label className={smallLabelCls}>WhatsApp <span className="normal-case font-medium text-muted-foreground/70">— if different</span></label>
          <PhoneInput value={form.groom_whatsapp} onChange={(v) => set("groom_whatsapp", v)} />
          {fieldErrors.groom_whatsapp && <p className="text-red-500 text-[12px] font-medium mt-1.5">{fieldErrors.groom_whatsapp}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Event Type</label>
          <select
            value={form.event_type}
            onChange={(e) => set("event_type", e.target.value)}
            className={`${inputBase} ${inputOk}`}
          >
            {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Event Date</label>
          <input
            type="date"
            value={form.event_date}
            onChange={(e) => set("event_date", e.target.value)}
            className={`${inputBase} ${inputOk}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Source</label>
          <select
            value={form.source}
            onChange={(e) => set("source", e.target.value)}
            className={`${inputBase} ${inputOk}`}
          >
            {/* Preserve the exact incoming source (e.g. "Website (Weddings)")
                even when it isn't one of the standard picklist values. */}
            {!(LEAD_SOURCES as readonly string[]).includes(form.source) && form.source && (
              <option value={form.source}>{form.source}</option>
            )}
            {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {form.source === "Referral" && (
          <div>
            <label className={labelCls}>Referrer&apos;s Name *</label>
            <input
              type="text"
              value={form.referrer_name}
              onChange={(e) => set("referrer_name", e.target.value)}
              placeholder="Who referred them?"
              className={`${inputBase} ${fieldErrors.referrer_name ? "border-red-500 ring-2 ring-red-500/20" : inputOk}`}
            />
            {fieldErrors.referrer_name && <p className="text-red-500 text-[12px] font-medium mt-1.5">{fieldErrors.referrer_name}</p>}
          </div>
        )}
        <div>
          <label className={labelCls}>Budget Range</label>
          <input
            type="text"
            value={form.budget_range}
            onChange={(e) => set("budget_range", e.target.value)}
            placeholder="₹1,00,000 – ₹1,50,000"
            className={`${inputBase} ${inputOk}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Venue / City</label>
          <input
            type="text"
            value={form.venue}
            onChange={(e) => set("venue", e.target.value)}
            placeholder="Taj, Goa"
            className={`${inputBase} ${inputOk}`}
          />
        </div>
        <div>
          <label className={labelCls}>Guest Count</label>
          <input
            type="text"
            value={form.guest_count}
            onChange={(e) => set("guest_count", e.target.value)}
            placeholder="100–300"
            className={`${inputBase} ${inputOk}`}
          />
        </div>
      </div>
    </>
  );
}
