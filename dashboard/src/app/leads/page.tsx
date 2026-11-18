"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Search, Plus, Phone, Mail, Camera, Globe, Users, Loader2, X, Trash2, MessageSquare, Pencil, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { leadsAPI, crmAPI, getStoredToken } from '@/lib/api';
import { decodeEntities, isValidEmail } from '@/lib/utils';
import { isValidStoredPhone, formatPhone } from '@/lib/phone';
import { parseIST, istTime, formatISTDate, formatISTDateTime, nowISTStamp } from '@/lib/datetime';
import { leads as mockLeads } from '@/data/mockData';
import { Drawer } from '@/components/ui/Drawer';
import { LeadForm, LeadFormState, EMPTY_LEAD_FORM } from '@/components/leads/LeadForm';
import { LeadMessageDrawer } from '@/components/leads/LeadMessageDrawer';
import { LeadPresetsDrawer } from '@/components/leads/LeadPresetsDrawer';
import { WhatsAppIcon } from '@/components/crm/WhatsAppIcon';
import { LEAD_STAGES, LeadNote, leadRecipients } from '@/lib/leadTemplates';
import { motion, AnimatePresence } from 'framer-motion';

/* Shape returned by api/leads.php — website enquiries land here as
   source "Website" / stage "New Inquiry", with the visitor's message
   stored as the first note. */
interface APILead {
  id: number;
  lead_ref: string;
  client_name: string;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  bride_name?: string | null;
  bride_phone?: string | null;
  bride_whatsapp?: string | null;
  groom_name?: string | null;
  groom_phone?: string | null;
  groom_whatsapp?: string | null;
  referrer_name?: string | null;
  event_type: string;
  event_date: string | null;
  venue: string | null;
  guest_count: string | null;
  budget_range: string | null;
  source: string;
  stage: string;
  last_activity: string | null;
  moved_to_stage_at: string | null;
  notes: LeadNote[];
  created_at: string;
}

// The bundled demo leads (camelCase) mapped into the API shape, used
// only in mock mode / when the API is unreachable.
const mockAsAPILeads: APILead[] = mockLeads.map((l, i) => ({
  id: i + 1,
  lead_ref: l.id,
  client_name: l.clientName,
  phone: l.phone,
  email: l.email,
  instagram: l.instagram || null,
  event_type: l.eventType,
  event_date: l.eventDate,
  venue: null,
  guest_count: null,
  budget_range: l.budgetRange,
  source: l.source,
  stage: l.stage,
  last_activity: l.lastActivity,
  moved_to_stage_at: l.movedToStageAt,
  notes: l.notes.map(n => ({ content: n.content, author: n.authorId, date: n.date })),
  created_at: l.movedToStageAt,
}));

const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
};

// Decode once on load — visitor names/messages arrive HTML-encoded
// from the PHP sanitizer (e.g. "Priya &amp; Rahul", "We&apos;d love…")
const dec = (v: string | null | undefined) => (v ? decodeEntities(v) : v ?? null);
const decodeLead = (l: APILead): APILead => ({
  ...l,
  client_name: decodeEntities(l.client_name),
  event_type: decodeEntities(l.event_type),
  venue: dec(l.venue),
  guest_count: dec(l.guest_count),
  budget_range: dec(l.budget_range),
  instagram: dec(l.instagram),
  bride_name: dec(l.bride_name),
  groom_name: dec(l.groom_name),
  referrer_name: dec(l.referrer_name),
  notes: (l.notes || []).map(n => ({
    ...n,
    content: decodeEntities(n.content),
    author: n.author ? decodeEntities(n.author) : n.author,
  })),
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const columnVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 350, damping: 28 } }
};

const cardContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } }
};

const cardItemVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 25 } }
};

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState<"Pipeline" | "List">("Pipeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<APILead | null>(null);
  const [leads, setLeads] = useState<APILead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [error, setError] = useState("");

  // Add-lead drawer
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<LeadFormState>(EMPTY_LEAD_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit-lead drawer — the same form, pre-filled from a lead, saving in place
  const [editLead, setEditLead] = useState<APILead | null>(null);
  const [editForm, setEditForm] = useState<LeadFormState>(EMPTY_LEAD_FORM);
  const [editNotes, setEditNotes] = useState<LeadNote[]>([]);
  const [editStage, setEditStage] = useState<string>("New Inquiry");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // WhatsApp presets — the three funnel messages, editable from the header.
  const [messageLead, setMessageLead] = useState<APILead | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [templates, setTemplates] = useState<Record<string, string>>({});

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    if (isMockMode()) {
      setLeads(mockAsAPILeads);
      setUsingMockData(true);
      setIsLoading(false);
      return;
    }
    try {
      const res = await leadsAPI.list() as { leads: APILead[] };
      setLeads((res.leads || []).map(decodeLead));
      setUsingMockData(false);
    } catch {
      setLeads(mockAsAPILeads);
      setUsingMockData(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Saved preset overrides. Failing to load is non-fatal — composeLeadMessage
  // falls back to the built-in copy, so messaging still works.
  React.useEffect(() => {
    if (isMockMode()) return;
    crmAPI.templates.get()
      .then(res => setTemplates(res.templates || {}))
      .catch(() => {});
  }, []);

  // Global search deep link: /leads/?q=priya pre-fills the search box
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearchQuery(q);
  }, []);

  const filteredLeads = leads.filter(l =>
    l.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.lead_ref || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.phone || "").includes(searchQuery)
  );

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = leads.filter(l => {
      const created = parseIST(l.created_at);
      return created && created >= monthStart;
    });
    return [
      { label: "Total Leads", val: String(leads.length) },
      { label: "New Inquiries", val: String(leads.filter(l => l.stage === "New Inquiry").length) },
      { label: "From Website", val: String(leads.filter(l => (l.source || "").startsWith("Website")).length) },
      { label: "This Month", val: String(thisMonth.length) },
    ];
  }, [leads]);

  const getSourceIcon = (source: string) => {
    if ((source || "").startsWith("Website")) return <Globe className="h-3 w-3" />;
    switch (source) {
      case 'Instagram': return <Camera className="h-3 w-3" />;
      case 'WhatsApp': return <Phone className="h-3 w-3" />;
      case 'Referral': return <Users className="h-3 w-3" />;
      default: return <Mail className="h-3 w-3" />;
    }
  };

  const getDaysInStage = (movedAt: string | null) => {
    const t = istTime(movedAt);
    if (!t) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
  };

  // ── Actions ──

  const handleStageChange = async (lead: APILead, stage: string) => {
    const prev = lead.stage;
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, stage, moved_to_stage_at: new Date().toISOString() } : l));
    setSelectedLead(s => s && s.id === lead.id ? { ...s, stage } : s);
    if (usingMockData) return;
    try {
      await leadsAPI.update(lead.id, { stage });
    } catch (err) {
      setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, stage: prev } : l));
      setError(err instanceof Error ? err.message : "Failed to update stage");
    }
  };

  /* Called by the message drawer once a preset has gone out: moves the lead to
     the stage the studio picked and (optionally) files the message under the
     lead's notes. Errors bubble up so the drawer can show them in place. */
  const handleMessageSubmit = async (lead: APILead, payload: { stage: string; note: LeadNote | null }) => {
    if (usingMockData) {
      throw new Error("Connect to the live API to update leads — demo data is read-only.");
    }
    const body: Record<string, unknown> = { stage: payload.stage };
    if (payload.note) body.notes = [...(lead.notes || []), payload.note];
    const updated = await leadsAPI.update(lead.id, body) as APILead;
    const decoded = decodeLead(updated);
    setLeads(ls => ls.map(l => l.id === lead.id ? decoded : l));
    setSelectedLead(s => (s && s.id === lead.id ? decoded : s));
  };

  const openMessage = (lead: APILead) => {
    setSelectedLead(null); // don't stack drawers
    setMessageLead(lead);
  };

  const handleDelete = async (lead: APILead) => {
    if (!confirm(`Delete lead ${lead.lead_ref} (${lead.client_name})? This cannot be undone.`)) return;
    try {
      if (!usingMockData) await leadsAPI.delete(lead.id);
      setLeads(ls => ls.filter(l => l.id !== lead.id));
      setSelectedLead(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  // Shared validation for both the add and edit forms.
  const validateLeadForm = (form: LeadFormState, setErrs: (e: Record<string, string>) => void) => {
    const errs: Record<string, string> = {};
    if (!form.client_name.trim()) errs.client_name = "Please enter the couple's name.";
    const phoneCheck = (v: string, key: string) => {
      if (v.trim() && !isValidStoredPhone(v)) errs[key] = "Check the country code and digits, or leave it blank.";
    };
    phoneCheck(form.phone, "phone");
    phoneCheck(form.bride_phone, "bride_phone");
    phoneCheck(form.bride_whatsapp, "bride_whatsapp");
    phoneCheck(form.groom_phone, "groom_phone");
    phoneCheck(form.groom_whatsapp, "groom_whatsapp");
    if (form.email.trim() && !isValidEmail(form.email)) errs.email = "Enter a valid email address.";
    if (form.source === "Referral" && !form.referrer_name.trim()) errs.referrer_name = "Who referred them?";
    setErrs(errs);
    return Object.keys(errs).length === 0;
  };

  // Open the edit drawer, pre-filled from a lead. `lead` is already decoded
  // (fetchLeads runs decodeLead), so the form holds plain text — the PHP
  // sanitizer re-encodes once on save, so there is no double-encoding.
  const openEdit = (lead: APILead) => {
    setEditLead(lead);
    setEditForm({
      client_name: lead.client_name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      instagram: lead.instagram || "",
      bride_name: lead.bride_name || "",
      bride_phone: lead.bride_phone || "",
      bride_whatsapp: lead.bride_whatsapp || "",
      groom_name: lead.groom_name || "",
      groom_phone: lead.groom_phone || "",
      groom_whatsapp: lead.groom_whatsapp || "",
      event_type: lead.event_type || "Wedding",
      event_date: lead.event_date || "",
      venue: lead.venue || "",
      guest_count: lead.guest_count || "",
      budget_range: lead.budget_range || "",
      source: lead.source || "Other",
      referrer_name: lead.referrer_name || "",
      note: "",
    });
    setEditNotes((lead.notes || []).map(n => ({ ...n })));
    setEditStage(lead.stage || "New Inquiry");
    setEditErrors({});
    setSelectedLead(null); // avoid stacking the detail drawer under the editor
  };

  const handleEditLead = async () => {
    if (!editLead) return;
    if (!validateLeadForm(editForm, setEditErrors)) return;
    if (usingMockData) {
      setError("Connect to the live API to edit leads — demo data is read-only.");
      return;
    }
    setIsSavingEdit(true);
    setError("");
    try {
      // Keep only notes with content; append the "add note" field if used.
      const notes: LeadNote[] = editNotes
        .map(n => ({ ...n, content: n.content.trim() }))
        .filter(n => n.content.length > 0);
      if (editForm.note.trim()) {
        notes.push({ content: editForm.note.trim(), author: "Dashboard", date: nowISTStamp() });
      }
      // Primary phone stays populated for the list/contact view; prefer the
      // explicit field, else fall back to the couple's numbers.
      const primaryPhone = editForm.phone.trim() || editForm.bride_phone.trim() || editForm.groom_phone.trim();
      const updated = await leadsAPI.update(editLead.id, {
        client_name: editForm.client_name.trim(),
        phone: primaryPhone,
        email: editForm.email.trim(),
        instagram: editForm.instagram.trim(),
        bride_name: editForm.bride_name.trim(),
        bride_phone: editForm.bride_phone.trim(),
        bride_whatsapp: editForm.bride_whatsapp.trim(),
        groom_name: editForm.groom_name.trim(),
        groom_phone: editForm.groom_phone.trim(),
        groom_whatsapp: editForm.groom_whatsapp.trim(),
        referrer_name: editForm.source === "Referral" ? editForm.referrer_name.trim() : "",
        event_type: editForm.event_type,
        event_date: editForm.event_date || null,
        venue: editForm.venue.trim(),
        guest_count: editForm.guest_count.trim(),
        budget_range: editForm.budget_range.trim(),
        source: editForm.source,
        stage: editStage,
        notes,
      }) as APILead;
      // Reflect the saved record (decoded) in the list immediately.
      const decoded = decodeLead(updated);
      setLeads(ls => ls.map(l => l.id === editLead.id ? decoded : l));
      setEditLead(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleAddLead = async () => {
    if (!validateLeadForm(addForm, setFieldErrors)) return;
    setIsSubmitting(true);
    setError("");
    try {
      const notes = addForm.note.trim()
        ? [{ content: addForm.note.trim(), author: "Dashboard", date: nowISTStamp() }]
        : [];
      if (usingMockData) {
        setError("Connect to the live API to add leads — demo data is read-only.");
        return;
      }
      // Keep the top-level phone populated for the list/contact view — prefer
      // the explicit primary phone, else the bride's number, then the groom's.
      const primaryPhone = addForm.phone.trim() || addForm.bride_phone.trim() || addForm.groom_phone.trim();
      await leadsAPI.create({
        client_name: addForm.client_name.trim(),
        phone: primaryPhone,
        email: addForm.email.trim(),
        instagram: addForm.instagram.trim(),
        bride_name: addForm.bride_name.trim(),
        bride_phone: addForm.bride_phone.trim(),
        bride_whatsapp: addForm.bride_whatsapp.trim(),
        groom_name: addForm.groom_name.trim(),
        groom_phone: addForm.groom_phone.trim(),
        groom_whatsapp: addForm.groom_whatsapp.trim(),
        referrer_name: addForm.source === "Referral" ? addForm.referrer_name.trim() : "",
        event_type: addForm.event_type,
        event_date: addForm.event_date || null,
        venue: addForm.venue.trim(),
        guest_count: addForm.guest_count.trim(),
        budget_range: addForm.budget_range.trim(),
        source: addForm.source,
        stage: "New Inquiry",
        notes,
      });
      setShowAddForm(false);
      setAddForm(EMPTY_LEAD_FORM);
      fetchLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ──

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="dash-h1">Leads</h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Track and convert your inquiries — website enquiry forms land here as &ldquo;New Inquiry&rdquo;.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-[240px] pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowPresets(true)}
            className="h-10 px-4 rounded-xl border-border/50"
            title="Edit the three WhatsApp funnel messages"
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Message Presets
          </Button>
          <Button onClick={() => { setAddForm(EMPTY_LEAD_FORM); setFieldErrors({}); setShowAddForm(true); }} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium flex items-center justify-between gap-3 shrink-0">
          <span className="break-words min-w-0">{error}</span>
          <button onClick={() => setError("")} className="shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      {usingMockData && !isLoading && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[13px] font-medium shrink-0">
          Showing demo leads — the live API is not connected. Website enquiries will appear here once it is.
        </div>
      )}

      {/* Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {stats.map(stat => (
          <div key={stat.label} className="dash-card p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
            <span className="text-xl font-bold text-foreground">{stat.val}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card/50 border border-border/50 p-1 rounded-xl w-max shrink-0 relative z-0">
        {(["Pipeline", "List"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 z-10 ${
              activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="leads-tab-active"
                className="absolute inset-0 bg-card shadow-sm rounded-lg -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            {tab === "Pipeline" ? "Pipeline" : "List View"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === "Pipeline" ? (
            <motion.div
              key="pipeline"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={containerVariants}
              className="flex-1 overflow-x-auto min-h-[500px]"
            >
              <div className="flex gap-6 h-full pb-4 items-start w-max">
                {LEAD_STAGES.map(stage => {
                  const stageLeads = filteredLeads.filter(l => l.stage === stage);
                  return (
                    <motion.div
                      key={stage}
                      variants={columnVariants}
                      className="flex flex-col w-[300px] min-w-[300px] bg-muted/20 border border-border/20 rounded-xl p-3 h-full"
                    >
                      <div className="flex items-center justify-between px-2 mb-3">
                        <h3 className="font-bold text-[14px] text-foreground">{stage}</h3>
                        <span className="text-[12px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                      </div>

                      <motion.div
                        variants={cardContainerVariants}
                        className="flex flex-col gap-3"
                      >
                        {stageLeads.map(lead => {
                          const days = getDaysInStage(lead.moved_to_stage_at);
                          const isStale = days > 5;
                          const isCritical = days > 10;
                          const hasMessage = (lead.notes || []).length > 0;

                          return (
                            <motion.div
                              key={lead.id}
                              variants={cardItemVariants}
                              whileHover={{ y: -3, scale: 1.015, boxShadow: "0 10px 20px -10px rgba(0,0,0,0.06)" }}
                              whileTap={{ scale: 0.995 }}
                              onClick={() => setSelectedLead(lead)}
                              className="dash-card p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="bg-primary/20 text-primary text-[9px] font-bold">{lead.client_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <span className="font-semibold text-[13px] text-foreground truncate max-w-[120px]">{lead.client_name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {hasMessage && <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openMessage(lead); }}
                                    className="text-muted-foreground hover:text-[#1DA851] transition-colors"
                                    title="Send a WhatsApp message"
                                  >
                                    <WhatsAppIcon className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openEdit(lead); }}
                                    className="text-muted-foreground hover:text-primary transition-colors"
                                    title="Edit lead"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              <p className="text-[11px] text-muted-foreground font-medium mb-3">
                                {lead.event_type}
                                {lead.event_date ? ` • ${formatISTDate(lead.event_date, { month: 'short', year: 'numeric' })}` : ""}
                              </p>

                              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded text-[10px] text-muted-foreground font-medium">
                                  {getSourceIcon(lead.source)} {lead.source}
                                </div>
                                <span className={`text-[10px] font-bold ${isCritical ? 'text-red-500' : isStale ? 'text-amber-500' : 'text-muted-foreground'}`}>
                                  {days} days
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="dash-card overflow-x-auto"
            >
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Ref", "Client", "Contact", "Event", "Source", "Stage", "Received"].map(h => (
                      <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(lead => (
                    <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="border-b border-border/30 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-[12px] font-semibold text-muted-foreground whitespace-nowrap">{lead.lead_ref}</td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-foreground whitespace-nowrap">{lead.client_name}</td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {[lead.phone, lead.email].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                        {lead.event_type}
                        {lead.event_date ? ` · ${formatISTDate(lead.event_date)}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded text-[10px] text-muted-foreground font-medium">
                          {getSourceIcon(lead.source)} {lead.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] font-medium text-foreground whitespace-nowrap">{lead.stage}</td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                        {lead.created_at ? formatISTDate(lead.created_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); openMessage(lead); }}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-[#1DA851] hover:bg-muted transition-colors"
                          title="Send a WhatsApp message"
                        >
                          <WhatsAppIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(lead); }}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                          title="Edit lead"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No leads found.</td></tr>
                  )}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Lead detail drawer */}
      <Drawer isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} title={selectedLead?.client_name || "Lead Details"}>
        {selectedLead && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-muted-foreground">{selectedLead.lead_ref}</span>
              <span className="text-[12px] text-muted-foreground">
                {selectedLead.created_at ? formatISTDateTime(selectedLead.created_at) : ""}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => openMessage(selectedLead)}
                disabled={leadRecipients(selectedLead).length === 0}
                title={leadRecipients(selectedLead).length === 0 ? "No usable WhatsApp number on this lead" : "Send a preset WhatsApp message"}
                className="h-10 rounded-xl bg-[#25D366]/10 text-[#1DA851] border border-[#25D366]/25 hover:bg-[#25D366]/20 transition-colors font-bold text-[13px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-[#25D366]/10"
              >
                <WhatsAppIcon className="h-4 w-4" /> Send Message
              </button>
              <Button
                onClick={() => openEdit(selectedLead)}
                className="h-10 rounded-xl bg-primary text-primary-foreground font-bold"
              >
                <Pencil className="h-4 w-4 mr-2" /> Edit Lead
              </Button>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Came From</h4>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-xl flex items-center gap-2">
                {getSourceIcon(selectedLead.source)}
                <span className="text-[14px] text-foreground font-semibold">{selectedLead.source || "Unknown"}</span>
                {selectedLead.referrer_name && (
                  <span className="text-[13px] text-muted-foreground">· referred by {selectedLead.referrer_name}</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Stage</h4>
              <select
                value={selectedLead.stage}
                onChange={(e) => handleStageChange(selectedLead, e.target.value)}
                className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50"
              >
                {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {(selectedLead.bride_name || selectedLead.bride_phone || selectedLead.groom_name || selectedLead.groom_phone) && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Couple</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { role: "Bride", name: selectedLead.bride_name, phone: selectedLead.bride_phone, wa: selectedLead.bride_whatsapp },
                    { role: "Groom", name: selectedLead.groom_name, phone: selectedLead.groom_phone, wa: selectedLead.groom_whatsapp },
                  ].map((p) => (
                    <div key={p.role} className="bg-muted/30 border border-border/50 p-3 rounded-xl">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{p.role}</p>
                      <p className="text-[13px] font-semibold text-foreground truncate">{p.name || "—"}</p>
                      {p.phone && <p className="text-[12px] text-muted-foreground font-mono mt-1">{formatPhone(p.phone)}</p>}
                      {p.wa && p.wa !== p.phone && <p className="text-[12px] text-muted-foreground font-mono">WA {formatPhone(p.wa)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Contact</h4>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-xl space-y-2">
                {selectedLead.phone ? (
                  <a href={`tel:${selectedLead.phone}`} className="flex items-center gap-2 text-[13px] text-foreground font-medium hover:text-primary">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {selectedLead.phone}
                  </a>
                ) : null}
                {selectedLead.email ? (
                  <a href={`mailto:${selectedLead.email}`} className="flex items-center gap-2 text-[13px] text-foreground font-medium hover:text-primary break-all">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {selectedLead.email}
                  </a>
                ) : null}
                {!selectedLead.phone && !selectedLead.email && (
                  <p className="text-[13px] text-muted-foreground">No contact details.</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Event Details</h4>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-xl">
                <p className="text-[14px] text-foreground font-semibold">{selectedLead.event_type}</p>
                <p className="text-[12px] text-muted-foreground">
                  {selectedLead.event_date
                    ? `Planned: ${formatISTDate(selectedLead.event_date)}`
                    : "No date shared yet"}
                </p>
                {selectedLead.venue ? (
                  <p className="text-[12px] text-muted-foreground mt-1">Venue: {selectedLead.venue}</p>
                ) : null}
                {selectedLead.guest_count ? (
                  <p className="text-[12px] text-muted-foreground mt-1">Guests: {selectedLead.guest_count}</p>
                ) : null}
                {selectedLead.budget_range ? (
                  <p className="text-[13px] text-primary font-bold mt-2">{selectedLead.budget_range}</p>
                ) : null}
              </div>
            </div>

            {(selectedLead.notes || []).length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Messages &amp; Notes</h4>
                <div className="space-y-3">
                  {selectedLead.notes.map((note, i) => (
                    <div key={i} className="bg-muted/30 border border-border/50 p-4 rounded-xl">
                      <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">{note.content}</p>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {note.author || note.authorId || "—"}
                        {note.date ? ` · ${formatISTDateTime(note.date)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => handleDelete(selectedLead)}
              className="w-full h-10 rounded-xl border border-red-500/20 text-red-500 text-sm font-bold hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" /> Delete Lead
            </button>
          </div>
        )}
      </Drawer>

      {/* Add lead drawer */}
      <Drawer isOpen={showAddForm} onClose={() => setShowAddForm(false)} width="440px" title="Add Lead">
        <div className="p-6 space-y-5">
          <LeadForm form={addForm} setForm={setAddForm} fieldErrors={fieldErrors} />
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Note (optional)</label>
            <textarea value={addForm.note} onChange={(e) => setAddForm(f => ({ ...f, note: e.target.value }))} rows={3} placeholder="How did this enquiry come in?"
              className="w-full p-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <Button onClick={handleAddLead} disabled={isSubmitting || !addForm.client_name.trim()} className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Add Lead"}
          </Button>
        </div>
      </Drawer>

      {/* Edit lead drawer — the same enquiry form, pre-filled and saved in place */}
      <Drawer isOpen={!!editLead} onClose={() => setEditLead(null)} width="460px" title={editLead ? `Edit — ${editLead.client_name}` : "Edit Lead"}>
        {editLead && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-muted-foreground">{editLead.lead_ref}</span>
              <span className="text-[11px] text-muted-foreground">
                Received {editLead.created_at ? formatISTDate(editLead.created_at) : "—"}
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Stage</label>
              <select
                value={editStage}
                onChange={(e) => setEditStage(e.target.value)}
                className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50"
              >
                {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <LeadForm form={editForm} setForm={setEditForm} fieldErrors={editErrors} />

            {/* Messages & notes — full control over what came in */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">Messages &amp; Notes</label>
              {editNotes.length === 0 && (
                <p className="text-[12px] text-muted-foreground">No messages yet — add one below.</p>
              )}
              {editNotes.map((n, i) => (
                <div key={i} className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {n.author || n.authorId || "Note"}{n.date ? ` · ${formatISTDateTime(n.date)}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditNotes(ns => ns.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                      title="Remove this note"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={n.content}
                    onChange={(e) => setEditNotes(ns => ns.map((m, j) => j === i ? { ...m, content: e.target.value } : m))}
                    rows={3}
                    className="w-full p-2.5 bg-background border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none"
                  />
                </div>
              ))}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Add a note</label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm(f => ({ ...f, note: e.target.value }))}
                  rows={2}
                  placeholder="Add context, a call summary, next steps…"
                  className="w-full p-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button variant="outline" onClick={() => setEditLead(null)} className="flex-1 h-10 rounded-xl border-border/50">
                Cancel
              </Button>
              <Button onClick={handleEditLead} disabled={isSavingEdit || !editForm.client_name.trim()} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-bold">
                {isSavingEdit ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Send a stage preset on WhatsApp, then move the lead */}
      <LeadMessageDrawer
        lead={messageLead}
        templates={templates}
        onClose={() => setMessageLead(null)}
        onSubmit={async (payload) => { if (messageLead) await handleMessageSubmit(messageLead, payload); }}
        onEditPresets={() => { setMessageLead(null); setShowPresets(true); }}
      />

      {/* Edit the three funnel messages */}
      <LeadPresetsDrawer
        isOpen={showPresets}
        onClose={() => setShowPresets(false)}
        templates={templates}
        onSaved={setTemplates}
      />
    </div>
  );
}
