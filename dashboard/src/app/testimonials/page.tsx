"use client";

import React, { useState, useCallback } from "react";
import { Search, Plus, Trash2, Star, X, Loader2, Edit3, Upload, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/Drawer";
import { testimonialsAPI, settingsAPI, assetUrl } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";

const MAX_PHOTO_SIZE = 64 * 1024 * 1024; // 64MB

interface Testimonial {
  id: number;
  client_name: string;
  event_type: string;
  event_date: string | null;
  review_text: string;
  rating: number;
  photo_path: string | null;
  city: string;
  is_featured: number;
  show_on_weddings: number;
  show_on_pages: number;
  marquee_row: number;
  is_active: number;
  sort_order: number;
  created_at: string;
}

/* The testimonials page scrolls its marquee rows in alternating
   directions, derived purely from row position — row 1 left,
   row 2 right, and so on. Keeping it derived (never stored) means
   adding or emptying rows can never break the pattern. */
const rowDirection = (row: number) => (row % 2 === 1 ? "scrolls left" : "scrolls right");

/* One heading for every enquiry-form marquee on the website (all pages
   with a form except Home + Weddings). Mirrors MARQUEE_DEFAULTS in
   src/js/testimonial-marquee.js — *word* renders gold italic. */
const MARQUEE_DEFAULTS = { eyebrow: "Loved By Couples", heading: "Words From *Our Couples*" };

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  React.useEffect(() => { const q = new URLSearchParams(window.location.search).get("q"); if (q) setSearchQuery(q); }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formText, setFormText] = useState("");
  const [formType, setFormType] = useState("Wedding");
  const [formCity, setFormCity] = useState("");
  const [formFeatured, setFormFeatured] = useState(false);
  const [formWeddings, setFormWeddings] = useState(false);
  const [formPages, setFormPages] = useState(false);
  const [formRow, setFormRow] = useState(1);
  const [formDate, setFormDate] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enquiry-form marquee heading (settings-backed, shared by every page)
  const [marqueeEyebrow, setMarqueeEyebrow] = useState(MARQUEE_DEFAULTS.eyebrow);
  const [marqueeHeading, setMarqueeHeading] = useState(MARQUEE_DEFAULTS.heading);
  const [marqueeSaving, setMarqueeSaving] = useState(false);
  const [marqueeSaved, setMarqueeSaved] = useState(false);

  React.useEffect(() => {
    settingsAPI.getGroup("site_content").then((res) => {
      const s = (res as { settings: Record<string, string> }).settings || {};
      if (s.site_testi_marquee_eyebrow) setMarqueeEyebrow(decodeEntities(s.site_testi_marquee_eyebrow));
      if (s.site_testi_marquee_heading) setMarqueeHeading(decodeEntities(s.site_testi_marquee_heading));
    }).catch(() => { /* defaults stay */ });
  }, []);

  const saveMarqueeCopy = async () => {
    setMarqueeSaving(true); setMarqueeSaved(false); setError("");
    try {
      await settingsAPI.update({
        site_testi_marquee_eyebrow: marqueeEyebrow.trim() || MARQUEE_DEFAULTS.eyebrow,
        site_testi_marquee_heading: marqueeHeading.trim() || MARQUEE_DEFAULTS.heading,
      });
      setMarqueeSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setMarqueeSaving(false); }
  };

  const fetchTestimonials = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await testimonialsAPI.list({ all: true });
      const list = ((res as { testimonials: Testimonial[] }).testimonials || []).map(t => ({
        ...t,
        // Decode once on load — text displays correctly and edit-save
        // cycles re-encode to the same stored value (no double-encoding)
        client_name: decodeEntities(t.client_name),
        review_text: decodeEntities(t.review_text),
        event_type: decodeEntities(t.event_type),
        city: decodeEntities(t.city),
      }));
      setTestimonials(list);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setIsLoading(false); }
  }, []);

  React.useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

  const filtered = testimonials.filter(t =>
    t.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.review_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* The testimonials page renders exactly two marquee rows (row 1 left,
     row 2 right). A testimonial may join either existing row, or open the
     NEXT row up to that limit — rows stay contiguous so the alternating
     scroll pattern stays intact. */
  const MAX_ROWS = 2;
  const highestRow = Math.min(MAX_ROWS, Math.max(1, ...testimonials.map(t => Number(t.marquee_row) || 1)));
  const rowOptions = Array.from({ length: highestRow }, (_, i) => i + 1);
  const rowCount = (row: number) =>
    testimonials.filter(t => (Number(t.marquee_row) || 1) === row && t.id !== editingId).length;

  const openCreate = () => {
    setEditingId(null);
    setFormName(""); setFormText(""); setFormType("Wedding");
    setFormCity(""); setFormFeatured(false); setFormWeddings(false); setFormPages(false); setFormDate("");
    setFormRow(1);
    setPhotoFile(null); setPhotoPreview("");
    setShowForm(true);
  };

  const openEdit = (t: Testimonial) => {
    setEditingId(t.id);
    setFormName(t.client_name); setFormText(t.review_text); setFormType(t.event_type);
    setFormCity(t.city || ""); setFormFeatured(!!t.is_featured);
    setFormWeddings(!!Number(t.show_on_weddings));
    setFormPages(!!Number(t.show_on_pages));
    setFormRow(Number(t.marquee_row) || 1);
    setFormDate(t.event_date || "");
    setPhotoFile(null);
    setPhotoPreview(t.photo_path ? assetUrl(t.photo_path) : "");
    setShowForm(true);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) { setError("Photo must be under 64MB"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!formName.trim() || !formText.trim()) { setError("Name and review text are required"); return; }
    setIsSubmitting(true);
    setError("");
    try {
      if (editingId) {
        await testimonialsAPI.update(editingId, {
          client_name: formName, review_text: formText, event_type: formType,
          city: formCity, is_featured: formFeatured ? 1 : 0,
          show_on_weddings: formWeddings ? 1 : 0,
          show_on_pages: formPages ? 1 : 0,
          marquee_row: formRow,
          event_date: formDate || null,
        });
        // Photo is a separate multipart action — only upload when a new file is picked
        if (photoFile) {
          const pf = new FormData();
          pf.append("photo", photoFile);
          await testimonialsAPI.setPhoto(editingId, pf);
        }
      } else {
        const formData = new FormData();
        formData.append("client_name", formName);
        formData.append("review_text", formText);
        formData.append("event_type", formType);
        formData.append("city", formCity);
        formData.append("is_featured", formFeatured ? "1" : "0");
        formData.append("show_on_weddings", formWeddings ? "1" : "0");
        formData.append("show_on_pages", formPages ? "1" : "0");
        formData.append("marquee_row", String(formRow));
        if (formDate) formData.append("event_date", formDate);
        if (photoFile) formData.append("photo", photoFile);
        await testimonialsAPI.create(formData);
      }
      setShowForm(false);
      fetchTestimonials();
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (t: Testimonial) => {
    if (!confirm(`Delete testimonial from "${t.client_name}"?`)) return;
    try { await testimonialsAPI.delete(t.id); setTestimonials(prev => prev.filter(i => i.id !== t.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  };

  const toggleFeatured = async (t: Testimonial) => {
    try {
      await testimonialsAPI.update(t.id, { is_featured: t.is_featured ? 0 : 1 });
      setTestimonials(prev => prev.map(i => i.id === t.id ? { ...i, is_featured: i.is_featured ? 0 : 1 } : i));
    } catch (err) { setError(err instanceof Error ? err.message : "Update failed"); }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="dash-h1">Testimonials</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Manage client reviews for your website.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-[220px] pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <Button onClick={openCreate} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Add Testimonial
          </Button>
        </div>
      </div>

      <div className="dash-card p-5 flex flex-col gap-4">
        <div>
          <p className="text-[15px] font-semibold text-foreground">Enquiry-Form Marquee</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            One scrolling testimonial strip sits above the enquiry form on About, Films, Couple Shoots, Premium Albums,
            Contact, Guides and Case Studies. Tick &ldquo;Show in the enquiry-form marquees&rdquo; on a testimonial to include it
            &mdash; every page updates together. Wrap a word in *asterisks* to make it gold italic.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Eyebrow</label>
            <input type="text" value={marqueeEyebrow} onChange={(e) => { setMarqueeEyebrow(e.target.value); setMarqueeSaved(false); }}
              className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Heading</label>
            <input type="text" value={marqueeHeading} onChange={(e) => { setMarqueeHeading(e.target.value); setMarqueeSaved(false); }}
              className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
          </div>
          <Button onClick={saveMarqueeCopy} disabled={marqueeSaving} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none">
            {marqueeSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : marqueeSaved ? "Saved" : "Save Heading"}
          </Button>
        </div>
        <p className="text-[12px] text-muted-foreground">
          {testimonials.filter(t => Number(t.show_on_pages) && Number(t.is_active)).length} testimonial(s) currently in the marquee.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium flex items-center justify-between">
          {error}<button onClick={() => setError("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-semibold text-foreground">No testimonials yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first client review.</p>
          <Button onClick={openCreate} className="mt-4 rounded-xl bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" /> Add Testimonial</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
          {filtered.map(t => (
            <div key={t.id} className="dash-card p-6 flex flex-col h-full group">
              <div className="flex items-start justify-between mb-4">
                <Quote className="h-5 w-5 text-primary/30" />
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggleFeatured(t)} className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${t.is_featured ? "bg-amber-500/10 text-amber-500" : "hover:bg-muted text-muted-foreground"}`}>
                    <Star className="h-3.5 w-3.5" fill={t.is_featured ? "currentColor" : "none"} />
                  </button>
                  <button onClick={() => openEdit(t)} className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(t)} className="h-7 w-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[14px] text-foreground leading-relaxed flex-1 line-clamp-4">&ldquo;{t.review_text}&rdquo;</p>
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-foreground">{t.client_name}</p>
                  <p className="text-[12px] text-muted-foreground">{t.event_type}{t.city ? ` · ${t.city}` : ""}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full" title={`Marquee row ${Number(t.marquee_row) || 1} (${rowDirection(Number(t.marquee_row) || 1)})`}>
                    Row {Number(t.marquee_row) || 1}
                  </span>
                  {Number(t.show_on_weddings) ? <span className="text-[10px] font-bold uppercase bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full">Weddings</span> : null}
                  {Number(t.show_on_pages) ? <span className="text-[10px] font-bold uppercase bg-sky-500/10 text-sky-500 px-2 py-0.5 rounded-full" title="Shown in the marquee above the enquiry form on the other pages">Pages</span> : null}
                  {t.is_featured ? <span className="text-[10px] font-bold uppercase bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">Featured</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Drawer */}
      <Drawer isOpen={showForm} onClose={() => setShowForm(false)} width="440px" title={editingId ? "Edit Testimonial" : "Add Testimonial"}>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Client Name *</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Priya & Rahul"
              className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Review Text *</label>
            <textarea value={formText} onChange={(e) => setFormText(e.target.value)} rows={4} placeholder="Their review..."
              className="w-full p-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Event Type</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value)}
                className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50">
                <option>Wedding</option><option>Pre-Wedding</option><option>Corporate</option><option>Portrait</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">City</label>
              <input type="text" value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="Pune"
                className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Event Date</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
              className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Testimonials-Page Row</label>
            <select value={formRow} onChange={(e) => setFormRow(Number(e.target.value))}
              className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50">
              {rowOptions.map(row => (
                <option key={row} value={row}>
                  Row {row} — {rowDirection(row)} ({rowCount(row)} testimonial{rowCount(row) === 1 ? "" : "s"})
                </option>
              ))}
              {highestRow < MAX_ROWS && (
                <option value={highestRow + 1}>
                  + Start Row {highestRow + 1} — {rowDirection(highestRow + 1)} (new row)
                </option>
              )}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              The page runs two marquee rows — row 1 scrolls left, row 2 scrolls right.
              Assign each testimonial to whichever row keeps them balanced.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formFeatured} onChange={(e) => setFormFeatured(e.target.checked)} className="rounded border-border" />
            <span className="text-sm font-medium text-foreground">Show on homepage (Featured)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formWeddings} onChange={(e) => setFormWeddings(e.target.checked)} className="rounded border-border" />
            <span className="text-sm font-medium text-foreground">Showcase on the Weddings page</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={formPages} onChange={(e) => setFormPages(e.target.checked)} className="rounded border-border mt-1" />
            <span className="text-sm font-medium text-foreground">
              Show in the enquiry-form marquees
              <span className="block text-[11px] font-normal text-muted-foreground">About, Films, Couple Shoots, Premium Albums, Contact, Guides &amp; Case Studies</span>
            </span>
          </label>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Couple Photo (optional)</label>
            <label className="block cursor-pointer">
              <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${photoPreview ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Couple preview" className="max-h-[160px] mx-auto rounded-lg object-contain" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-[12px] text-muted-foreground">JPEG, PNG, WebP — max 64MB</p>
                  </>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            </label>
            <p className="text-[11px] text-muted-foreground mt-1.5">Shown on the Testimonials page and in the website marquees. Leave empty to use a stock couple photo.</p>
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : editingId ? "Save Changes" : "Add Testimonial"}
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
