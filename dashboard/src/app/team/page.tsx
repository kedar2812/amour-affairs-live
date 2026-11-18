"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, MapPin, Phone, Trash2, Loader2, Check, X, Upload, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Modal } from '@/components/ui/Modal';
import { useTeam } from '@/lib/useData';
import { TeamMember } from '@/data/mockData';
import { Drawer } from '@/components/ui/Drawer';
import { teamAPI, settingsAPI, getStoredToken, assetUrl } from '@/lib/api';
import { decodeEntities } from '@/lib/utils';

type TabView = "Profile" | "Schedule" | "Performance" | "Payments";

const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
};

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "AA";

/* ── Founder (About-page) content, stored in the `site_content` settings group ── */
interface Founder {
  name: string; role: string; pullquote: string;
  body1: string; body2: string; philosophy: string; caption: string; photo: string;
}

const FOUNDER_DEFAULTS: Founder = {
  name: "Taher Husain",
  role: "Founder & Creative Director",
  pullquote:
    "He doesn't shoot weddings. He archives the exact second two people stop performing and simply exist together.",
  body1:
    "Taher Husain approaches weddings with a rare clarity — shaped by observation, timing, and an instinct for the quiet truth in human connection. Since founding Amour Affairs in 2011, his work has remained understated, intentional, and deeply personal.",
  body2:
    "He doesn't interrupt moments or manufacture them. He waits for them. The result is imagery that feels effortless yet carries the weight of permanence — photographs that continue to hold meaning long after the day has passed.",
  philosophy: "The more you give, the happier you live.",
  caption: "Founder & Lead Photographer",
  photo: "",
};

export default function TeamPage() {
  const [searchQuery, setSearchQuery] = useState("");
  React.useEffect(() => { const q = new URLSearchParams(window.location.search).get("q"); if (q) setSearchQuery(q); }, []);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>("Profile");
  const { data: teamMembers, refetch } = useTeam(true);

  const mock = isMockMode();

  /* ── Add member modal ── */
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addRole, setAddRole] = useState("");
  const [addPhoto, setAddPhoto] = useState<File | null>(null);
  const [addPreview, setAddPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ kind: "error" | "ok"; msg: string } | null>(null);

  const resetAdd = () => {
    setAddName(""); setAddRole(""); setAddPhoto(null);
    if (addPreview) URL.revokeObjectURL(addPreview);
    setAddPreview("");
  };

  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 64 * 1024 * 1024) { setBanner({ kind: "error", msg: "Photo must be under 64MB" }); return; }
    setAddPhoto(file);
    setAddPreview(URL.createObjectURL(file));
  };

  const handleAddSave = async () => {
    if (mock) { setBanner({ kind: "error", msg: "Connect to the live API to add members — demo mode is read-only." }); return; }
    if (!addName.trim()) { setBanner({ kind: "error", msg: "Name is required." }); return; }
    if (!addPhoto) { setBanner({ kind: "error", msg: "A photo is required — the website shows team members with photos only." }); return; }
    setSaving(true); setBanner(null);
    try {
      const fd = new FormData();
      fd.append("name", addName.trim());
      fd.append("role", addRole.trim());
      fd.append("photo", addPhoto);
      fd.append("is_active", "1");
      fd.append("sort_order", String(teamMembers.length + 1));
      fd.append("avatar_initials", initialsOf(addName));
      await teamAPI.create(fd);
      await refetch();
      setBanner({ kind: "ok", msg: `${addName.trim()} added to the team.` });
      resetAdd();
      setAddOpen(false);
    } catch (err) {
      setBanner({ kind: "error", msg: err instanceof Error ? err.message : "Failed to add member" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (member: TeamMember) => {
    if (mock) { setBanner({ kind: "error", msg: "Connect to the live API to delete members — demo mode is read-only." }); return; }
    if (!window.confirm(`Remove ${member.name} from the team? This also removes them from the website.`)) return;
    try {
      await teamAPI.delete(Number(member.id));
      await refetch();
      setSelectedMember(null);
      setBanner({ kind: "ok", msg: `${member.name} removed.` });
    } catch (err) {
      setBanner({ kind: "error", msg: err instanceof Error ? err.message : "Failed to delete member" });
    }
  };

  /* ── Founder editor ── */
  const [founder, setFounder] = useState<Founder>(FOUNDER_DEFAULTS);
  const [founderPhotoFile, setFounderPhotoFile] = useState<File | null>(null);
  const [founderPreview, setFounderPreview] = useState("");
  const [founderSaving, setFounderSaving] = useState(false);
  const [founderSavedAt, setFounderSavedAt] = useState<number | null>(null);

  const loadFounder = useCallback(async () => {
    if (isMockMode()) return;
    try {
      const res = await settingsAPI.getGroup("site_content");
      const s = res.settings || {};
      const val = (k: string, fallback: string) => (s[k] ? decodeEntities(s[k]) : fallback);
      setFounder({
        name: val("site_founder_name", FOUNDER_DEFAULTS.name),
        role: val("site_founder_role", FOUNDER_DEFAULTS.role),
        pullquote: val("site_founder_pullquote", FOUNDER_DEFAULTS.pullquote),
        body1: val("site_founder_body1", FOUNDER_DEFAULTS.body1),
        body2: val("site_founder_body2", FOUNDER_DEFAULTS.body2),
        philosophy: val("site_founder_philosophy", FOUNDER_DEFAULTS.philosophy),
        caption: val("site_founder_caption", FOUNDER_DEFAULTS.caption),
        photo: s.site_founder_photo ? decodeEntities(s.site_founder_photo) : "",
      });
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => { loadFounder(); }, [loadFounder]);

  const handleFounderPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 64 * 1024 * 1024) { setBanner({ kind: "error", msg: "Founder photo must be under 64MB" }); return; }
    setFounderPhotoFile(file);
    if (founderPreview) URL.revokeObjectURL(founderPreview);
    setFounderPreview(URL.createObjectURL(file));
  };

  const saveFounder = async () => {
    if (mock) { setBanner({ kind: "error", msg: "Connect to the live API to save — demo mode is read-only." }); return; }
    if (!founder.name.trim()) { setBanner({ kind: "error", msg: "Founder name is required." }); return; }
    setFounderSaving(true); setBanner(null);
    try {
      let photoPath = founder.photo;
      if (founderPhotoFile) {
        const fd = new FormData();
        fd.append("photo", founderPhotoFile);
        const up = await settingsAPI.uploadImage(fd);
        photoPath = up.file_path;
      }
      await settingsAPI.update({
        site_founder_name: founder.name.trim(),
        site_founder_role: founder.role.trim(),
        site_founder_pullquote: founder.pullquote.trim(),
        site_founder_body1: founder.body1.trim(),
        site_founder_body2: founder.body2.trim(),
        site_founder_philosophy: founder.philosophy.trim(),
        site_founder_caption: founder.caption.trim(),
        ...(photoPath ? { site_founder_photo: photoPath } : {}),
      });
      setFounder(f => ({ ...f, photo: photoPath }));
      setFounderPhotoFile(null);
      setFounderSavedAt(Date.now());
      setTimeout(() => setFounderSavedAt(null), 3000);
    } catch (err) {
      setBanner({ kind: "error", msg: err instanceof Error ? err.message : "Failed to save founder" });
    } finally {
      setFounderSaving(false);
    }
  };

  const founderImgSrc = founderPreview || (founder.photo ? assetUrl(founder.photo) : "/founder.jpeg");

  const filteredTeam = teamMembers.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.role || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: TeamMember['status']) => {
    switch (status) {
      case 'On Shoot': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Available': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Editing': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'On Leave': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const handleMemberClick = (member: TeamMember) => {
    setActiveTab("Profile");
    setSelectedMember(member);
  };

  // Real API members expose photo_path (snake_case); mock data has none.
  const photoOf = (m: TeamMember) => {
    const p = (m as unknown as { photo_path?: string }).photo_path;
    return p ? assetUrl(p) : "";
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="dash-h1">Team</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Manage your crew and the people shown on the website About page.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-[240px] pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button onClick={() => { resetAdd(); setBanner(null); setAddOpen(true); }} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Inline banner */}
      {banner && (
        <div className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-between gap-3 ${banner.kind === "error" ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"}`}>
          <span className="break-words min-w-0">{banner.msg}</span>
          <button onClick={() => setBanner(null)} className="shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      {mock && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[13px] font-medium">
          Demo mode — showing built-in sample data. Connect to the live API to add, edit, and publish team members and the founder block.
        </div>
      )}

      {/* ── Founder (About page) editor ── */}
      <div className="dash-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-5">
          <div>
            <h2 className="dash-card-title">Founder — About Page</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">The photo and story shown in the founder section of the website About page.</p>
          </div>
          <Button onClick={saveFounder} disabled={founderSaving} className="h-10 px-6 rounded-xl bg-primary text-primary-foreground font-bold shadow-sm shrink-0">
            {founderSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
              : founderSavedAt ? <><Check className="h-4 w-4 mr-2" /> Saved</>
              : "Save Founder"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
          {/* Photo */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Photo</label>
            <div className="aspect-[3/4] w-full rounded-xl overflow-hidden border border-border/50 bg-muted/30 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={founderImgSrc} alt="Founder" className="w-full h-full object-cover" />
            </div>
            <label className="inline-flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 cursor-pointer text-[13px] font-medium text-foreground transition-colors">
              <Upload className="h-3.5 w-3.5" /> Change photo
              <input type="file" accept="image/*" className="hidden" onChange={handleFounderPhoto} />
            </label>
            <p className="text-[11px] text-muted-foreground mt-1.5">JPEG, PNG, WebP — max 64MB</p>
          </div>

          {/* Text fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldT label="Name" value={founder.name} onChange={(v) => setFounder({ ...founder, name: v })} />
              <FieldT label="Role" value={founder.role} onChange={(v) => setFounder({ ...founder, role: v })} />
            </div>
            <FieldT label="Photo Caption" value={founder.caption} onChange={(v) => setFounder({ ...founder, caption: v })} />
            <FieldT label="Pull Quote" value={founder.pullquote} onChange={(v) => setFounder({ ...founder, pullquote: v })} textarea />
            <FieldT label="Story — Paragraph 1" value={founder.body1} onChange={(v) => setFounder({ ...founder, body1: v })} textarea />
            <FieldT label="Story — Paragraph 2" value={founder.body2} onChange={(v) => setFounder({ ...founder, body2: v })} textarea />
            <FieldT label="Philosophy Line" value={founder.philosophy} onChange={(v) => setFounder({ ...founder, philosophy: v })} />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        {[
          { label: "Total Members", val: teamMembers.length },
          { label: "On Shoot Today", val: teamMembers.filter(m => m.status === "On Shoot").length },
          { label: "Available Now", val: teamMembers.filter(m => m.status === "Available").length },
          { label: "On Leave", val: teamMembers.filter(m => m.status === "On Leave").length }
        ].map(stat => (
          <div key={stat.label} className="dash-card p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
            <span className="text-xl font-bold text-foreground">{stat.val}</span>
          </div>
        ))}
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 content-start pb-12">
        {filteredTeam.map(member => (
          <div key={member.id} className="dash-card p-6 hover:-translate-y-1 transition-transform group relative">
            <button
              onClick={() => handleDelete(member)}
              title="Remove member"
              className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="flex items-start justify-between mb-4 cursor-pointer" onClick={() => handleMemberClick(member)}>
              <div className="flex gap-4">
                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                  {photoOf(member) && <AvatarImage src={photoOf(member)} alt={member.name} />}
                  <AvatarFallback className="bg-primary/20 text-primary font-bold">{member.avatarInitials || initialsOf(member.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-[15px] text-foreground group-hover:text-primary transition-colors">{member.name}</h3>
                  <p className="text-[12px] text-muted-foreground font-medium">{member.role}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusColor(member.status)}`}>
                {member.status || "Active"}
              </span>
              {member.currentAssignment && (
                <p className="text-[12px] text-muted-foreground mt-2 flex items-start gap-1.5">
                  <MapPin className="h-3 w-3 mt-0.5" />
                  <span className="truncate">{member.currentAssignment}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-border/50">
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Upcoming</p>
                <p className="text-[13px] font-bold text-foreground">{member.upcomingShootsCount ?? 0} shoots</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleMemberClick(member)} className="h-8 w-8 hover:bg-muted/50 rounded-full text-muted-foreground"><Pencil className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Member modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => { setAddOpen(false); resetAdd(); }}
        title="Add Team Member"
        description="Shown on the website About page (members with a photo appear in the marquee)."
        confirmText={saving ? "Adding..." : "Add Member"}
        cancelText="Cancel"
        onConfirm={saving ? undefined : handleAddSave}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full overflow-hidden border border-border/50 bg-muted/30 shrink-0 flex items-center justify-center">
              {addPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={addPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-muted-foreground text-xs font-bold">{addName ? initialsOf(addName) : "—"}</span>
              )}
            </div>
            <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 cursor-pointer text-[13px] font-medium text-foreground transition-colors">
              <Upload className="h-3.5 w-3.5" /> {addPhoto ? "Change photo" : "Upload photo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleAddPhoto} />
            </label>
          </div>
          <FieldT label="Name" value={addName} onChange={setAddName} />
          <FieldT label="Role" value={addRole} onChange={setAddRole} hint="e.g. Lead Photographer, Senior Cinematographer" />
        </div>
      </Modal>

      <Drawer isOpen={!!selectedMember} onClose={() => setSelectedMember(null)} width="480px" title={selectedMember?.name}>
        {selectedMember && (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-border/50 shrink-0">
              <div className="flex gap-4 items-center justify-between">
                <div className="flex gap-4 items-center">
                  <Avatar className="h-16 w-16 shadow-md">
                    {photoOf(selectedMember) && <AvatarImage src={photoOf(selectedMember)} alt={selectedMember.name} />}
                    <AvatarFallback className="bg-primary/20 text-primary font-bold text-xl">{selectedMember.avatarInitials || initialsOf(selectedMember.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{selectedMember.name}</h2>
                    <p className="text-[13px] text-muted-foreground">{selectedMember.role}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(selectedMember)} title="Remove member" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Inner Tabs */}
            <div className="px-6 py-3 border-b border-border/50 flex gap-6 shrink-0">
              {(["Profile", "Schedule", "Performance", "Payments"] as TabView[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-[13px] font-bold pb-2 border-b-2 transition-colors ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {activeTab === "Profile" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Bio</h4>
                    <p className="text-[13px] text-foreground leading-relaxed">{selectedMember.bio || "No bio yet."}</p>
                  </div>
                  {Array.isArray(selectedMember.equipment) && selectedMember.equipment.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Equipment</h4>
                      <div className="flex flex-col gap-2 bg-muted/30 p-4 rounded-xl border border-border/50">
                        {selectedMember.equipment.map((eq, i) => (
                          <div key={i} className="text-[13px] font-medium text-foreground">{eq}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "Schedule" && (
                <div className="text-center text-muted-foreground py-12 text-[13px]">
                  No shoots scheduled for {selectedMember.name.split(" ")[0]} yet. Assigned shoots will appear here.
                </div>
              )}
              {activeTab !== "Profile" && activeTab !== "Schedule" && (
                <div className="text-center text-muted-foreground py-12 text-[13px]">
                  No {activeTab.toLowerCase()} recorded for {selectedMember.name.split(" ")[0]} yet.
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* ── Shared labelled input ── */
function FieldT({ label, value, onChange, hint, textarea }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; textarea?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
          className="w-full p-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none" />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
      )}
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  );
}
