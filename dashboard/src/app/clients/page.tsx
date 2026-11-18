"use client";

import React, { useState } from 'react';
import { Search, Plus, Star, Copy, Users, Loader2, Check, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useClients } from '@/lib/useData';
import { clientsAPI } from '@/lib/api';
import { isValidEmail } from '@/lib/utils';
import { isValidStoredPhone, formatPhone, waLink } from '@/lib/phone';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { WhatsAppIcon } from '@/components/crm/WhatsAppIcon';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { flattenClients } from '@/lib/exportUtils';
import { Drawer } from '@/components/ui/Drawer';
import { DeleteClientModal } from '@/components/clients/DeleteClientModal';
import { motion } from 'framer-motion';

const EMPTY_ADD = { name: "", phone: "", email: "", whatsapp: "", city: "", type: "Wedding", tags: "", notes: "" };

type TabView = "Overview" | "Booking History" | "Payments" | "Gallery Deliveries" | "Notes";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 280, damping: 24 }
  }
};

type ClientRow = {
  id: number | string; dbId: number; name: string; type: string; phone: string; email: string;
  whatsapp: string; city: string; totalBookings: number; totalSpend: number;
  tags: string[]; notes: string;
};

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>("Overview");
  const { data: rawClients, refetch } = useClients();

  // Global search deep link: /clients/?q=priya pre-fills the search box
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearchQuery(q);
  }, []);

  // Add / edit client form state (one drawer serves both modes)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ ...EMPTY_ADD });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addedOk, setAddedOk] = useState(false);
  const setField = (k: string, v: string) => setAddForm((p) => ({ ...p, [k]: v }));

  // Delete confirmation — the modal owns the keep-vs-delete-everything choice.
  const [deletingClient, setDeletingClient] = useState<ClientRow | null>(null);

  const openAddDrawer = () => {
    setEditingId(null);
    setAddForm({ ...EMPTY_ADD });
    setAddError("");
    setAddedOk(false);
    setIsAddOpen(true);
  };

  const openEditDrawer = (client: ClientRow) => {
    setEditingId(client.dbId);
    setAddForm({
      name: client.name,
      phone: client.phone,
      email: client.email,
      whatsapp: client.whatsapp,
      city: client.city === "—" ? "" : client.city,
      type: client.type,
      tags: client.tags.join(", "),
      notes: client.notes,
    });
    setAddError("");
    setAddedOk(false);
    setIsAddOpen(true);
  };

  const handleAddSubmit = async () => {
    if (!addForm.name.trim()) { setAddError("Please enter the client's name."); return; }
    if (addForm.phone.trim() && !isValidStoredPhone(addForm.phone)) { setAddError("That phone number doesn't look complete — check the country code and digits, or leave it blank."); return; }
    if (addForm.whatsapp.trim() && !isValidStoredPhone(addForm.whatsapp)) { setAddError("That WhatsApp number doesn't look complete — check the country code and digits, or leave it blank."); return; }
    if (addForm.email.trim() && !isValidEmail(addForm.email)) { setAddError("Enter a valid email address, or leave the email blank."); return; }
    setAdding(true); setAddError("");
    try {
      const payload = {
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        email: addForm.email.trim(),
        whatsapp: addForm.whatsapp.trim() || addForm.phone.trim(),
        city: addForm.city.trim(),
        type: addForm.type,
        tags: addForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: addForm.notes.trim(),
      };
      if (editingId) {
        await clientsAPI.update(editingId, payload);
      } else {
        await clientsAPI.create(payload);
      }
      await refetch();
      // Keep the open detail drawer in sync with what was just saved
      if (editingId && selectedClient && selectedClient.dbId === editingId) {
        setSelectedClient({ ...selectedClient, ...payload, city: payload.city || "—" });
      }
      setAddedOk(true);
      setTimeout(() => { setAddedOk(false); setIsAddOpen(false); setAddForm({ ...EMPTY_ADD }); setEditingId(null); }, 900);
    } catch (e: any) {
      setAddError(e?.message || "Couldn't save the client — please try again.");
    } finally {
      setAdding(false);
    }
  };

  // Normalise API (snake_case) + mock (camelCase) into one safe shape so the
  // page renders real client records correctly and never crashes on nulls.
  const clients: ClientRow[] = (rawClients as any[]).map((c) => ({
    id: c.id,
    dbId: Number(c.dbId ?? c.id) || 0,
    name: c.name || "Unnamed client",
    type: c.type || "Client",
    phone: c.phone || "",
    email: c.email || "",
    whatsapp: c.whatsapp || c.phone || "",
    city: c.city || "—",
    totalBookings: Number(c.totalBookings ?? c.total_bookings ?? 0),
    totalSpend: Number(c.totalSpend ?? c.total_spend ?? 0),
    tags: Array.isArray(c.tags) ? c.tags : [],
    notes: c.notes || "",
  }));

  const sq = searchQuery.toLowerCase();
  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(sq) || c.phone.includes(searchQuery)
  );

  const getAvatarColor = (type: string) => {
    switch (type) {
      case 'Wedding': return 'bg-amber-500/20 text-amber-500';
      case 'Corporate': return 'bg-purple-500/20 text-purple-500';
      default: return 'bg-primary/20 text-primary';
    }
  };

  const handleClientClick = (client: ClientRow) => {
    setActiveTab("Overview"); // reset tab when opening new client
    setSelectedClient(client);
  };

  const inputCls = "w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50";

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="dash-h1">Clients</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Your client relationships, special dates and history.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-[280px] pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <ExportMenu
            datasets={[flattenClients(filteredClients as never)]}
            filename="amour-affairs-clients"
            pdfTitle="Clients Export"
            variant="inline"
          />
          <Button onClick={openAddDrawer} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none">
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Grid Layout */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 content-start pb-12"
      >
        {filteredClients.map(client => (
          <motion.div
            key={client.id}
            variants={cardVariants}
            whileHover={{ y: -4, scale: 1.01, boxShadow: "0 12px 24px -10px rgba(0,0,0,0.08)" }}
            whileTap={{ scale: 0.995 }}
            onClick={() => handleClientClick(client)}
            className="dash-card p-6 cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-4">
              <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                <AvatarFallback className={`font-bold text-sm ${getAvatarColor(client.type)}`}>
                  {client.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getAvatarColor(client.type)} border-opacity-50`}>
                  {client.type}
                </span>
                {/* Revealed on hover so the card stays calm; the confirm dialog
                    is the real guard against a mis-click. */}
                <button
                  onClick={(e) => { e.stopPropagation(); setDeletingClient(client); }}
                  title={`Delete ${client.name}`}
                  aria-label={`Delete ${client.name}`}
                  className="h-7 w-7 rounded-lg grid place-items-center text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <h3 className="font-bold text-[16px] text-foreground mb-1 group-hover:text-primary transition-colors">{client.name}</h3>
            <p className="text-[13px] text-muted-foreground font-mono">{formatPhone(client.phone)}</p>

            <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border/50">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Bookings</p>
                <p className="text-[15px] font-bold text-foreground">{client.totalBookings}</p>
              </div>
              <div className="w-[1px] h-8 bg-border/50" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Spend</p>
                <p className="text-[15px] font-bold text-foreground">₹{(client.totalSpend / 100000).toFixed(1)}L</p>
              </div>
            </div>

            {client.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {client.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20">{tag}</span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>

      {filteredClients.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-20 gap-3">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
            <Users className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-[15px] font-semibold text-foreground">{searchQuery ? "No clients match your search" : "No clients yet"}</p>
          <p className="text-[13px] text-muted-foreground max-w-[320px]">
            {searchQuery ? "Try a different name or phone number." : "Clients you add — or convert from leads and bookings — will appear here with their full history."}
          </p>
        </div>
      )}

      <Drawer isOpen={!!selectedClient} onClose={() => setSelectedClient(null)} width="560px" title={selectedClient?.name}>
        {selectedClient && (
          <div className="flex flex-col h-full">
            {/* Drawer Header Block */}
            <div className="p-6 border-b border-border/50 flex gap-4 items-center shrink-0">
              <Avatar className="h-16 w-16 shadow-lg">
                <AvatarFallback className={`text-xl font-bold ${getAvatarColor(selectedClient.type)}`}>{selectedClient.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-foreground truncate">{selectedClient.name}</h2>
                  {selectedClient.tags.includes("VIP") && (
                    <Star className="h-4 w-4 fill-amber-500 text-amber-500 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                  <span className="font-mono">{formatPhone(selectedClient.phone)}</span>
                  {selectedClient.email && <span className="w-1 h-1 rounded-full bg-border" />}
                  <span className="truncate">{selectedClient.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { openEditDrawer(selectedClient); }}
                  title="Edit client details"
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/50 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeletingClient(selectedClient)}
                  title="Delete this client"
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 border border-border/50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Inner Tabs */}
            <div className="px-6 py-3 border-b border-border/50 flex gap-6 overflow-x-auto shrink-0 hide-scrollbar relative">
              {(["Overview", "Booking History", "Payments", "Gallery Deliveries", "Notes"] as TabView[]).map(tab => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative text-[13px] font-bold pb-2 transition-colors whitespace-nowrap ${isActive ? "text-primary font-extrabold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {tab}
                    {isActive && (
                      <motion.div
                        layoutId="client-drawer-tab"
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content Switcher */}
            <div className="p-6 flex-1 overflow-y-auto">
              {activeTab === "Overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 border border-border/50 p-4 rounded-xl">
                      <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-1">Total Lifetime Spend</p>
                      <p className="text-2xl font-bold text-emerald-500">₹{selectedClient.totalSpend.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-muted/30 border border-border/50 p-4 rounded-xl">
                      <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-1">Total Bookings</p>
                      <p className="text-2xl font-bold text-foreground">{selectedClient.totalBookings}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Contact Details</h4>
                    <div className="dash-card border border-border/50 rounded-xl divide-y divide-border/50">
                      <div className="flex items-center justify-between p-3">
                        <span className="text-[13px] text-muted-foreground font-medium">WhatsApp</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-mono text-foreground">{formatPhone(selectedClient.whatsapp)}</span>
                          {selectedClient.whatsapp && (
                            <a
                              href={waLink(selectedClient.whatsapp, "")}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open chat in WhatsApp"
                              className="h-6 w-6 rounded flex items-center justify-center text-[#1DA851] hover:bg-[#25D366]/15 transition-colors"
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6" title="Copy number"
                            onClick={() => navigator.clipboard?.writeText(selectedClient.whatsapp || selectedClient.phone || "")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3">
                        <span className="text-[13px] text-muted-foreground font-medium">City</span>
                        <span className="text-[13px] text-foreground font-medium">{selectedClient.city}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "Notes" && (
                <div>
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Notes</h4>
                  {selectedClient.notes ? (
                    <p className="text-[14px] text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 border border-border/50 rounded-xl p-4">{selectedClient.notes}</p>
                  ) : (
                    <p className="text-[13px] text-muted-foreground py-6 text-center">No notes recorded for this client yet.</p>
                  )}
                </div>
              )}
              {(activeTab === "Booking History" || activeTab === "Payments" || activeTab === "Gallery Deliveries") && (
                <div className="text-center text-muted-foreground py-12 text-[13px]">
                  No {activeTab.toLowerCase()} recorded for {selectedClient.name} yet.
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Add / Edit client form */}
      <Drawer isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} width="480px" title={editingId ? "Edit Client" : "Add Client"}>
        <div className="p-6 space-y-4">
          {addError && (
            <div className="text-[13px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{addError}</div>
          )}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Name *</label>
            <input value={addForm.name} onChange={(e) => setField("name", e.target.value)} placeholder="Client name" className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Phone</label>
            <PhoneInput value={addForm.phone} onChange={(v) => setField("phone", v)} />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">WhatsApp <span className="normal-case font-medium text-muted-foreground/70">— if different from phone</span></label>
            <PhoneInput value={addForm.whatsapp} onChange={(v) => setField("whatsapp", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Email</label>
              <input type="email" value={addForm.email} onChange={(e) => setField("email", e.target.value)} placeholder="name@email.com" className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Type</label>
              <select value={addForm.type} onChange={(e) => setField("type", e.target.value)} className={inputCls}>
                {["Wedding", "Pre-Wedding", "Corporate", "Portrait", "Other"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">City</label>
              <input value={addForm.city} onChange={(e) => setField("city", e.target.value)} placeholder="Pune" className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Tags</label>
              <input value={addForm.tags} onChange={(e) => setField("tags", e.target.value)} placeholder="VIP, Referral (comma-sep)" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Notes</label>
            <textarea value={addForm.notes} onChange={(e) => setField("notes", e.target.value)} rows={3} placeholder="Anything worth remembering…"
              className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50 resize-none" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="h-10 px-4 rounded-xl border-border/50">Cancel</Button>
            <Button onClick={handleAddSubmit} disabled={adding || addedOk} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-bold">
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : addedOk ? <Check className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {addedOk ? "Saved" : editingId ? "Save Changes" : "Add Client"}
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Delete confirmation — keep their records, or remove everything */}
      <DeleteClientModal
        client={deletingClient}
        onClose={() => setDeletingClient(null)}
        onDeleted={() => {
          // The record is gone — drop any open drawer pointing at it, then reload.
          if (selectedClient && deletingClient && selectedClient.dbId === deletingClient.dbId) {
            setSelectedClient(null);
          }
          if (editingId && deletingClient && editingId === deletingClient.dbId) {
            setIsAddOpen(false);
            setEditingId(null);
          }
          refetch();
        }}
      />
    </div>
  );
}
