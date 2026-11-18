"use client";

import React, { useState, useCallback } from 'react';
import { Plus, Loader2, X, Trash2, Pencil, Gift, Eye, EyeOff, ImageIcon, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { leadMagnetsAPI, getStoredToken, assetUrl } from '@/lib/api';
import { decodeEntities } from '@/lib/utils';
import { Drawer } from '@/components/ui/Drawer';
import { motion, AnimatePresence } from 'framer-motion';

interface Magnet {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  file_path: string | null;
  cover_path: string | null;
  button_label: string;
  download_count: number;
  is_active: number;
  sort_order: number;
}

interface MagnetForm {
  title: string; description: string; button_label: string; is_active: number;
}

const EMPTY: MagnetForm = { title: '', description: '', button_label: 'Download Free Guide', is_active: 1 };

const isMockMode = () => { const t = getStoredToken(); return !t || t.startsWith('mock_'); };

const decode = (m: Magnet): Magnet => ({
  ...m,
  title: decodeEntities(m.title),
  description: m.description ? decodeEntities(m.description) : m.description,
  button_label: decodeEntities(m.button_label),
});

export default function LeadMagnetsPage() {
  const [items, setItems] = useState<Magnet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MagnetForm>(EMPTY);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingFile, setExistingFile] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    if (isMockMode()) { setItems([]); setUsingMock(true); setIsLoading(false); return; }
    try {
      const res = await leadMagnetsAPI.list(true) as { lead_magnets: Magnet[] };
      setItems((res.lead_magnets || []).map(decode));
      setUsingMock(false);
    } catch { setItems([]); setUsingMock(true); }
    finally { setIsLoading(false); }
  }, []);

  React.useEffect(() => { fetchItems(); }, [fetchItems]);

  const openAdd = () => {
    setEditingId(null); setForm(EMPTY); setPdfFile(null); setExistingFile(null);
    setCoverFile(null); setCoverPreview(null); setShowForm(true);
  };
  const openEdit = (m: Magnet) => {
    setEditingId(m.id);
    setForm({ title: m.title, description: m.description || '', button_label: m.button_label, is_active: m.is_active });
    setPdfFile(null); setExistingFile(m.file_path);
    setCoverFile(null); setCoverPreview(m.cover_path ? assetUrl(m.cover_path) : null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!editingId && !pdfFile) { setError('A PDF file is required'); return; }
    if (usingMock) { setError('Connect to the live API to manage lead magnets.'); return; }
    setIsSubmitting(true); setError('');
    try {
      let mId = editingId;
      if (editingId) {
        await leadMagnetsAPI.update(editingId, { ...form });
      } else {
        const created = await leadMagnetsAPI.create({ ...form }) as Magnet;
        mId = created.id;
        // The record now exists — adopt its id so that if a file/cover upload
        // fails below, retrying edits this magnet instead of creating a duplicate.
        setEditingId(mId);
      }
      if (pdfFile && mId) {
        const fd = new FormData(); fd.append('file', pdfFile);
        setProgress({ label: 'Uploading PDF…', pct: 0 });
        await leadMagnetsAPI.uploadFile(mId, fd, (pct) =>
          setProgress({ label: pct < 100 ? 'Uploading PDF…' : 'Finishing up…', pct }));
      }
      if (coverFile && mId) {
        const fd = new FormData(); fd.append('photo', coverFile);
        setProgress({ label: 'Uploading cover…', pct: 0 });
        await leadMagnetsAPI.setCover(mId, fd, (pct) =>
          setProgress({ label: pct < 100 ? 'Uploading cover…' : 'Finishing up…', pct }));
      }
      setShowForm(false); setEditingId(null); fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lead magnet');
    } finally { setIsSubmitting(false); setProgress(null); }
  };

  const toggleActive = async (m: Magnet) => {
    if (usingMock) return;
    const next = m.is_active ? 0 : 1;
    setItems(xs => xs.map(x => x.id === m.id ? { ...x, is_active: next } : x));
    try { await leadMagnetsAPI.update(m.id, { is_active: next }); }
    catch { setItems(xs => xs.map(x => x.id === m.id ? { ...x, is_active: m.is_active } : x)); }
  };

  const handleDelete = async (m: Magnet) => {
    if (!confirm(`Delete "${m.title}"? The PDF and its captured-lead link are removed. This cannot be undone.`)) return;
    try { if (!usingMock) await leadMagnetsAPI.delete(m.id); setItems(xs => xs.filter(x => x.id !== m.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const inputCls = "w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50";
  const labelCls = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block";

  return (
    <div className="flex flex-col gap-6 max-w-[1100px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="dash-h1">Lead Magnets</h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Offer downloadable guides (pricing &amp; planning PDFs). Every download captures a new lead automatically.
          </p>
        </div>
        <Button onClick={openAdd} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> New Lead Magnet
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
          The live API is not connected. Sign in against the live API to upload guides and capture downloads.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="dash-card p-10 text-center">
          <Gift className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No lead magnets yet. Upload a free pricing or planning guide to convert visitors into leads.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence>
            {items.map(m => (
              <motion.div key={m.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
                className="dash-card p-4 flex items-center gap-4">
                <div className="h-14 w-20 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {m.cover_path ? <img src={assetUrl(m.cover_path)} alt="" className="h-full w-full object-cover" /> : <FileText className="h-5 w-5 text-muted-foreground/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-foreground truncate">{m.title}</p>
                  <p className="text-[12px] text-muted-foreground truncate flex items-center gap-3">
                    <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> {m.download_count} downloads</span>
                    {m.file_path ? <span className="text-emerald-600">PDF ready</span> : <span className="text-amber-600">No PDF yet</span>}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${m.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  {m.is_active ? 'Live' : 'Hidden'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(m)} title={m.is_active ? 'Hide' : 'Show'} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                    {m.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(m)} title="Edit" className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(m)} title="Delete" className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Drawer isOpen={showForm} onClose={() => setShowForm(false)} width="480px" title={editingId ? 'Edit Lead Magnet' : 'New Lead Magnet'}>
        <div className="p-6 space-y-5">
          <div>
            <label className={labelCls}>Cover Image <span className="normal-case font-normal text-muted-foreground/70">(optional)</span></label>
            <div className="flex items-center gap-3">
              <div className="h-20 w-28 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {coverPreview ? <img src={coverPreview} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground/40" />}
              </div>
              <label className="text-[12px] font-medium text-primary cursor-pointer hover:underline">
                {coverPreview ? 'Change image' : 'Upload image'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0] || null; setCoverFile(f); setCoverPreview(f ? URL.createObjectURL(f) : coverPreview); }} />
              </label>
            </div>
          </div>
          <div>
            <label className={labelCls}>Title *</label>
            <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} maxLength={255}
              placeholder="The Complete Wedding Photography Pricing Guide" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} maxLength={500}
              placeholder="What's inside the guide and why it helps couples." className={`${inputCls} h-auto py-2 resize-none`} />
          </div>
          <div>
            <label className={labelCls}>PDF File {editingId ? '' : '*'}</label>
            <label className="flex items-center gap-2 text-[13px] text-foreground border border-border/50 rounded-lg px-3 h-10 bg-muted/30 cursor-pointer hover:border-primary/50">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{pdfFile ? pdfFile.name : (existingFile ? 'Replace current PDF' : 'Choose a PDF…')}</span>
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
            </label>
            {existingFile && !pdfFile ? <p className="text-[11px] text-emerald-600 mt-1">A PDF is already attached.</p> : null}
          </div>
          <div>
            <label className={labelCls}>Button Label</label>
            <input type="text" value={form.button_label} onChange={(e) => setForm(f => ({ ...f, button_label: e.target.value }))} maxLength={80} className={inputCls} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))} className="h-4 w-4 rounded accent-[var(--primary)]" />
            <span className="text-[13px] text-foreground font-medium">Show on the website</span>
          </label>
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
          <Button onClick={handleSave} disabled={isSubmitting || !form.title.trim()} className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {progress ? progress.label : 'Saving...'}</> : (editingId ? 'Save Changes' : 'Create Lead Magnet')}
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
