"use client";

import React, { useState, useCallback } from 'react';
import { Plus, Loader2, X, Trash2, Pencil, Newspaper, Eye, EyeOff, Star, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { guidesAPI, getStoredToken, assetUrl } from '@/lib/api';
import { decodeEntities } from '@/lib/utils';
import { Drawer } from '@/components/ui/Drawer';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = ['Wedding Planning', 'Pricing & Budget', 'Venues', 'Photography Tips', 'Pre-Wedding', 'Destination Weddings'];

interface Guide {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  body?: string;
  category: string;
  cover_path: string | null;
  author: string;
  read_minutes: number;
  meta_title: string | null;
  meta_description: string | null;
  is_published: number;
  is_featured: number;
  sort_order: number;
  published_at: string | null;
}

interface GuideForm {
  title: string; slug: string; excerpt: string; body: string; category: string;
  author: string; read_minutes: number; meta_title: string; meta_description: string;
  is_published: number; is_featured: number;
}

const EMPTY: GuideForm = {
  title: '', slug: '', excerpt: '', body: '', category: 'Wedding Planning',
  author: 'Amour Affairs', read_minutes: 5, meta_title: '', meta_description: '',
  is_published: 0, is_featured: 0,
};

const isMockMode = () => { const t = getStoredToken(); return !t || t.startsWith('mock_'); };

const decode = (g: Guide): Guide => ({
  ...g,
  title: decodeEntities(g.title),
  excerpt: g.excerpt ? decodeEntities(g.excerpt) : g.excerpt,
  body: g.body ? decodeEntities(g.body) : g.body,
  category: decodeEntities(g.category),
  author: decodeEntities(g.author),
  meta_title: g.meta_title ? decodeEntities(g.meta_title) : g.meta_title,
  meta_description: g.meta_description ? decodeEntities(g.meta_description) : g.meta_description,
});

export default function GuidesPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<GuideForm>(EMPTY);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);

  const fetchGuides = useCallback(async () => {
    setIsLoading(true);
    if (isMockMode()) { setGuides([]); setUsingMock(true); setIsLoading(false); return; }
    try {
      const res = await guidesAPI.list(true) as { guides: Guide[] };
      setGuides((res.guides || []).map(decode));
      setUsingMock(false);
    } catch { setGuides([]); setUsingMock(true); }
    finally { setIsLoading(false); }
  }, []);

  React.useEffect(() => { fetchGuides(); }, [fetchGuides]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setCoverFile(null); setCoverPreview(null); setShowForm(true); };

  const openEdit = async (g: Guide) => {
    setEditingId(g.id);
    setCoverFile(null);
    setCoverPreview(g.cover_path ? assetUrl(g.cover_path) : null);
    // Listing has no body — fetch the full record for editing
    try {
      const full = await guidesAPI.get(g.id) as Guide;
      const d = decode(full);
      setForm({
        title: d.title, slug: d.slug, excerpt: d.excerpt || '', body: d.body || '',
        category: d.category, author: d.author, read_minutes: d.read_minutes,
        meta_title: d.meta_title || '', meta_description: d.meta_description || '',
        is_published: d.is_published, is_featured: d.is_featured,
      });
    } catch {
      setForm({ ...EMPTY, title: g.title, slug: g.slug, excerpt: g.excerpt || '', category: g.category, author: g.author, read_minutes: g.read_minutes, is_published: g.is_published, is_featured: g.is_featured });
    }
    setShowForm(true);
  };

  const onCoverPick = (file: File | null) => {
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) { setError('Title and body are required'); return; }
    if (usingMock) { setError('Connect to the live API to manage guides.'); return; }
    setIsSubmitting(true); setError('');
    try {
      let guideId = editingId;
      if (editingId) {
        await guidesAPI.update(editingId, { ...form });
      } else {
        const created = await guidesAPI.create({ ...form }) as Guide;
        guideId = created.id;
        // Adopt the new id so a failed cover upload below can be retried as an
        // edit rather than creating a duplicate guide.
        setEditingId(guideId);
      }
      if (coverFile && guideId) {
        const fd = new FormData();
        fd.append('photo', coverFile);
        setProgress({ label: 'Uploading cover…', pct: 0 });
        await guidesAPI.setCover(guideId, fd, (pct) =>
          setProgress({ label: pct < 100 ? 'Uploading cover…' : 'Finishing up…', pct }));
      }
      setShowForm(false); setForm(EMPTY); setCoverFile(null); setCoverPreview(null); setEditingId(null);
      fetchGuides();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save guide');
    } finally { setIsSubmitting(false); setProgress(null); }
  };

  const togglePublished = async (g: Guide) => {
    if (usingMock) return;
    const next = g.is_published ? 0 : 1;
    setGuides(gs => gs.map(x => x.id === g.id ? { ...x, is_published: next } : x));
    try { await guidesAPI.update(g.id, { is_published: next }); }
    catch { setGuides(gs => gs.map(x => x.id === g.id ? { ...x, is_published: g.is_published } : x)); }
  };

  const handleDelete = async (g: Guide) => {
    if (!confirm(`Delete the guide "${g.title}"? This cannot be undone.`)) return;
    try { if (!usingMock) await guidesAPI.delete(g.id); setGuides(gs => gs.filter(x => x.id !== g.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const inputCls = "w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50";
  const labelCls = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block";

  return (
    <div className="flex flex-col gap-6 max-w-[1100px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="dash-h1">Guides</h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Publish wedding cost guides, venue guides and planning resources. These drive organic search & AI visibility.
          </p>
        </div>
        <Button onClick={openAdd} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> New Guide
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
          The live API is not connected. Sign in against the live API to write and publish guides.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
      ) : guides.length === 0 ? (
        <div className="dash-card p-10 text-center">
          <Newspaper className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No guides yet. Write your first wedding guide to start ranking for planning searches.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence>
            {guides.map(g => (
              <motion.div key={g.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
                className="dash-card p-4 flex items-center gap-4">
                <div className="h-14 w-20 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {g.cover_path
                    ? <img src={assetUrl(g.cover_path)} alt="" className="h-full w-full object-cover" />
                    : <ImageIcon className="h-5 w-5 text-muted-foreground/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-semibold text-foreground truncate">{g.title}</p>
                    {g.is_featured ? <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" /> : null}
                  </div>
                  <p className="text-[12px] text-muted-foreground truncate">{g.category} · {g.read_minutes} min read · /{g.slug}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${g.is_published ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  {g.is_published ? 'Published' : 'Draft'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => togglePublished(g)} title={g.is_published ? 'Unpublish' : 'Publish'}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                    {g.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(g)} title="Edit"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(g)} title="Delete"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Drawer isOpen={showForm} onClose={() => setShowForm(false)} width="560px" title={editingId ? 'Edit Guide' : 'New Guide'}>
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
          <div>
            <label className={labelCls}>Title *</label>
            <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} maxLength={255}
              placeholder="The Real Cost of a Wedding Photographer in Pune" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Read Time (min)</label>
              <input type="number" min={1} value={form.read_minutes} onChange={(e) => setForm(f => ({ ...f, read_minutes: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>URL Slug {editingId ? '' : '(auto from title if blank)'}</label>
            <input type="text" value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="cost-of-wedding-photographer-pune" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Excerpt <span className="normal-case font-normal text-muted-foreground/70">(listing + meta fallback)</span></label>
            <textarea value={form.excerpt} onChange={(e) => setForm(f => ({ ...f, excerpt: e.target.value }))} rows={2} maxLength={500}
              placeholder="A short summary shown on the guides listing." className={`${inputCls} h-auto py-2 resize-none`} />
          </div>
          <div>
            <label className={labelCls}>Body *</label>
            <textarea value={form.body} onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))} rows={12}
              placeholder={"Write the guide. Use a blank line between paragraphs.\n\n## Subheadings start with two hashes\n\n- Bullet points start with a dash"}
              className={`${inputCls} h-auto py-3 resize-none leading-relaxed font-mono text-[13px]`} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Formatting: <code>## Subheading</code> (own line), <code>- bullet</code>, <code>**bold**</code>, <code>*italic*</code>; leave a blank line between paragraphs.
            </p>
          </div>
          <div className="border-t border-border/40 pt-4 space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">SEO (optional)</p>
            <div>
              <label className={labelCls}>Meta Title</label>
              <input type="text" value={form.meta_title} onChange={(e) => setForm(f => ({ ...f, meta_title: e.target.value }))} maxLength={255} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Meta Description</label>
              <textarea value={form.meta_description} onChange={(e) => setForm(f => ({ ...f, meta_description: e.target.value }))} rows={2} maxLength={320}
                className={`${inputCls} h-auto py-2 resize-none`} />
            </div>
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
          <Button onClick={handleSave} disabled={isSubmitting || !form.title.trim() || !form.body.trim()} className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {progress ? progress.label : 'Saving...'}</> : (editingId ? 'Save Changes' : 'Create Guide')}
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
