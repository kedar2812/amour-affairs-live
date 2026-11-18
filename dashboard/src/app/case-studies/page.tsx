"use client";

import React, { useState, useCallback } from 'react';
import { Plus, Loader2, X, Trash2, Pencil, Sparkles, Eye, EyeOff, Star, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { caseStudiesAPI, getStoredToken, assetUrl } from '@/lib/api';
import { decodeEntities } from '@/lib/utils';
import { Drawer } from '@/components/ui/Drawer';
import { motion, AnimatePresence } from 'framer-motion';

const EVENT_TYPES = ['Wedding', 'Pre-Wedding', 'Engagement', 'Destination Wedding', 'Couple Shoot'];

interface CaseStudy {
  id: number;
  slug: string;
  couple: string;
  title: string;
  location: string | null;
  event_date: string | null;
  event_type: string;
  summary: string | null;
  body?: string;
  services: string | null;
  guest_count: string | null;
  cover_path: string | null;
  gallery?: string[];
  film_youtube_id: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_published: number;
  is_featured: number;
}

interface CSForm {
  couple: string; title: string; location: string; event_date: string; event_type: string;
  summary: string; body: string; services: string; guest_count: string; film_youtube_id: string;
  meta_title: string; meta_description: string; is_published: number; is_featured: number;
}

const EMPTY: CSForm = {
  couple: '', title: '', location: '', event_date: '', event_type: 'Wedding',
  summary: '', body: '', services: 'Photography, Cinematography', guest_count: '', film_youtube_id: '',
  meta_title: '', meta_description: '', is_published: 0, is_featured: 0,
};

const isMockMode = () => { const t = getStoredToken(); return !t || t.startsWith('mock_'); };

const dec = (s: string | null | undefined) => (s ? decodeEntities(s) : s ?? '');
const decode = (c: CaseStudy): CaseStudy => ({
  ...c,
  couple: decodeEntities(c.couple), title: decodeEntities(c.title),
  location: c.location ? decodeEntities(c.location) : c.location,
  summary: c.summary ? decodeEntities(c.summary) : c.summary,
  body: c.body ? decodeEntities(c.body) : c.body,
  services: c.services ? decodeEntities(c.services) : c.services,
  meta_title: c.meta_title ? decodeEntities(c.meta_title) : c.meta_title,
  meta_description: c.meta_description ? decodeEntities(c.meta_description) : c.meta_description,
});

export default function CaseStudiesPage() {
  const [items, setItems] = useState<CaseStudy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CSForm>(EMPTY);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    if (isMockMode()) { setItems([]); setUsingMock(true); setIsLoading(false); return; }
    try {
      const res = await caseStudiesAPI.list(true) as { case_studies: CaseStudy[] };
      setItems((res.case_studies || []).map(decode));
      setUsingMock(false);
    } catch { setItems([]); setUsingMock(true); }
    finally { setIsLoading(false); }
  }, []);

  React.useEffect(() => { fetchItems(); }, [fetchItems]);

  const openAdd = () => {
    setEditingId(null); setForm(EMPTY); setCoverFile(null); setCoverPreview(null);
    setGallery([]); setGalleryFiles([]); setShowForm(true);
  };

  const openEdit = async (c: CaseStudy) => {
    setEditingId(c.id);
    setCoverFile(null);
    setCoverPreview(c.cover_path ? assetUrl(c.cover_path) : null);
    setGalleryFiles([]);
    try {
      const full = decode(await caseStudiesAPI.get(c.id) as CaseStudy);
      setForm({
        couple: full.couple, title: full.title, location: dec(full.location), event_date: full.event_date || '',
        event_type: full.event_type, summary: dec(full.summary), body: dec(full.body),
        services: dec(full.services), guest_count: full.guest_count || '', film_youtube_id: full.film_youtube_id || '',
        meta_title: dec(full.meta_title), meta_description: dec(full.meta_description),
        is_published: full.is_published, is_featured: full.is_featured,
      });
      setGallery(full.gallery || []);
    } catch {
      setForm({ ...EMPTY, couple: c.couple, title: c.title });
      setGallery([]);
    }
    setShowForm(true);
  };

  const onCoverPick = (file: File | null) => { setCoverFile(file); setCoverPreview(file ? URL.createObjectURL(file) : null); };

  const removeGalleryImage = (path: string) => setGallery(g => g.filter(p => p !== path));

  const handleSave = async () => {
    if (!form.couple.trim() || !form.title.trim() || !form.body.trim()) { setError('Couple, title and story are required'); return; }
    if (usingMock) { setError('Connect to the live API to manage case studies.'); return; }
    setIsSubmitting(true); setError('');
    try {
      let csId = editingId;
      const payload = { ...form, event_date: form.event_date || null };
      if (editingId) {
        await caseStudiesAPI.update(editingId, { ...payload, gallery });
      } else {
        const created = await caseStudiesAPI.create(payload) as CaseStudy;
        csId = created.id;
        // Adopt the new id so a failed cover/gallery upload below can be retried
        // as an edit rather than creating a duplicate story.
        setEditingId(csId);
      }
      if (coverFile && csId) {
        const fd = new FormData(); fd.append('photo', coverFile);
        setProgress({ label: 'Uploading cover…', pct: 0 });
        await caseStudiesAPI.setCover(csId, fd, (pct) =>
          setProgress({ label: pct < 100 ? 'Uploading cover…' : 'Finishing up…', pct }));
      }
      if (galleryFiles.length && csId) {
        const fd = new FormData();
        galleryFiles.forEach(f => fd.append('photos[]', f));
        setProgress({ label: `Uploading ${galleryFiles.length} photo${galleryFiles.length > 1 ? 's' : ''}…`, pct: 0 });
        await caseStudiesAPI.addGallery(csId, fd, (pct) =>
          setProgress({ label: pct < 100 ? 'Uploading gallery…' : 'Finishing up…', pct }));
      }
      setShowForm(false); setEditingId(null); fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save case study');
    } finally { setIsSubmitting(false); setProgress(null); }
  };

  const togglePublished = async (c: CaseStudy) => {
    if (usingMock) return;
    const next = c.is_published ? 0 : 1;
    setItems(xs => xs.map(x => x.id === c.id ? { ...x, is_published: next } : x));
    try { await caseStudiesAPI.update(c.id, { is_published: next }); }
    catch { setItems(xs => xs.map(x => x.id === c.id ? { ...x, is_published: c.is_published } : x)); }
  };

  const handleDelete = async (c: CaseStudy) => {
    if (!confirm(`Delete the story for "${c.couple}"? This also removes its photos. This cannot be undone.`)) return;
    try { if (!usingMock) await caseStudiesAPI.delete(c.id); setItems(xs => xs.filter(x => x.id !== c.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const inputCls = "w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50";
  const labelCls = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block";

  return (
    <div className="flex flex-col gap-6 max-w-[1100px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="dash-h1">Case Studies</h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Publish detailed real-wedding stories. They build trust (E-E-A-T) and rank for couple, venue & location searches.
          </p>
        </div>
        <Button onClick={openAdd} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> New Story
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium flex items-center justify-between gap-3">
          <span className="break-words min-w-0">{error}</span>
          <button onClick={() => setError('')} className="shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}
      {usingMock && !isLoading && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[13px] font-medium">
          The live API is not connected. Sign in against the live API to write and publish wedding stories.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="dash-card p-10 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No stories yet. Turn a favourite wedding into a detailed case study to win trust and search rankings.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence>
            {items.map(c => (
              <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
                className="dash-card p-4 flex items-center gap-4">
                <div className="h-14 w-20 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {c.cover_path ? <img src={assetUrl(c.cover_path)} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-semibold text-foreground truncate">{c.couple}</p>
                    {c.is_featured ? <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" /> : null}
                  </div>
                  <p className="text-[12px] text-muted-foreground truncate">{[c.event_type, c.location].filter(Boolean).join(' · ')} · /{c.slug}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${c.is_published ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  {c.is_published ? 'Published' : 'Draft'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => togglePublished(c)} title={c.is_published ? 'Unpublish' : 'Publish'} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                    {c.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(c)} title="Edit" className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(c)} title="Delete" className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Drawer isOpen={showForm} onClose={() => setShowForm(false)} width="580px" title={editingId ? 'Edit Story' : 'New Story'}>
        <div className="p-6 space-y-5">
          <div>
            <label className={labelCls}>Cover Image</label>
            <div className="flex items-center gap-3">
              <div className="h-20 w-28 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {coverPreview ? <img src={coverPreview} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground/40" />}
              </div>
              <label className="text-[12px] font-medium text-primary cursor-pointer hover:underline">
                {coverPreview ? 'Change image' : 'Upload image'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onCoverPick(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Couple *</label>
              <input type="text" value={form.couple} onChange={(e) => setForm(f => ({ ...f, couple: e.target.value }))} placeholder="Priya & Rahul" className={inputCls} /></div>
            <div><label className={labelCls}>Event Type</label>
              <select value={form.event_type} onChange={(e) => setForm(f => ({ ...f, event_type: e.target.value }))} className={inputCls}>
                {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select></div>
          </div>
          <div><label className={labelCls}>Headline / Title *</label>
            <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} maxLength={255} placeholder="A Royal Udaipur Palace Wedding" className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Udaipur, Rajasthan" className={inputCls} /></div>
            <div><label className={labelCls}>Event Date</label>
              <input type="date" value={form.event_date} onChange={(e) => setForm(f => ({ ...f, event_date: e.target.value }))} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Guest Count</label>
              <input type="text" value={form.guest_count} onChange={(e) => setForm(f => ({ ...f, guest_count: e.target.value }))} placeholder="500" className={inputCls} /></div>
            <div><label className={labelCls}>Services</label>
              <input type="text" value={form.services} onChange={(e) => setForm(f => ({ ...f, services: e.target.value }))} placeholder="Photography, Film" className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Summary <span className="normal-case font-normal text-muted-foreground/70">(listing + meta)</span></label>
            <textarea value={form.summary} onChange={(e) => setForm(f => ({ ...f, summary: e.target.value }))} rows={2} maxLength={500} className={`${inputCls} h-auto py-2 resize-none`} /></div>
          <div><label className={labelCls}>The Story *</label>
            <textarea value={form.body} onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))} rows={10}
              placeholder={"Tell their story. Blank line = new paragraph.\n\n## Subheadings with two hashes"}
              className={`${inputCls} h-auto py-3 resize-none leading-relaxed font-mono text-[13px]`} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Formatting: <code>## Subheading</code> (own line), <code>- bullet</code>, <code>**bold**</code>, <code>*italic*</code>; leave a blank line between paragraphs.
            </p></div>
          <div><label className={labelCls}>Wedding Film — YouTube ID <span className="normal-case font-normal text-muted-foreground/70">(optional)</span></label>
            <input type="text" value={form.film_youtube_id} onChange={(e) => setForm(f => ({ ...f, film_youtube_id: e.target.value }))} placeholder="dQw4w9WgXcQ" className={inputCls} /></div>

          {/* Gallery */}
          <div>
            <label className={labelCls}>Gallery</label>
            {gallery.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                {gallery.map(p => (
                  <div key={p} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img src={assetUrl(p)} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => removeGalleryImage(p)} title="Remove"
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="text-[12px] font-medium text-primary cursor-pointer hover:underline">
              {galleryFiles.length ? `${galleryFiles.length} new image(s) ready to upload` : '+ Add gallery images'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))} />
            </label>
            {editingId ? <p className="text-[11px] text-muted-foreground mt-1">Removed images are saved when you click Save. New images upload on Save.</p>
              : <p className="text-[11px] text-muted-foreground mt-1">New images upload after the story is created.</p>}
          </div>

          <div className="border-t border-border/40 pt-4 space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">SEO (optional)</p>
            <div><label className={labelCls}>Meta Title</label>
              <input type="text" value={form.meta_title} onChange={(e) => setForm(f => ({ ...f, meta_title: e.target.value }))} maxLength={255} className={inputCls} /></div>
            <div><label className={labelCls}>Meta Description</label>
              <textarea value={form.meta_description} onChange={(e) => setForm(f => ({ ...f, meta_description: e.target.value }))} rows={2} maxLength={320} className={`${inputCls} h-auto py-2 resize-none`} /></div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={!!form.is_published} onChange={(e) => setForm(f => ({ ...f, is_published: e.target.checked ? 1 : 0 }))} className="h-4 w-4 rounded accent-[var(--primary)]" />
              <span className="text-[13px] text-foreground font-medium">Published</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={!!form.is_featured} onChange={(e) => setForm(f => ({ ...f, is_featured: e.target.checked ? 1 : 0 }))} className="h-4 w-4 rounded accent-[var(--primary)]" />
              <span className="text-[13px] text-foreground font-medium">Featured</span>
            </label>
          </div>
          {progress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>{progress.label}</span>
                <span className="tabular-nums">{progress.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-[width] duration-200 ease-out" style={{ width: `${progress.pct}%` }} />
              </div>
            </div>
          )}
          <Button onClick={handleSave} disabled={isSubmitting || !form.couple.trim() || !form.title.trim() || !form.body.trim()} className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {progress ? progress.label : 'Saving...'}</> : (editingId ? 'Save Changes' : 'Create Story')}
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
