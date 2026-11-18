"use client";

import React, { useState, useCallback } from 'react';
import { Plus, Loader2, X, Trash2, Pencil, GripVertical, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { faqsAPI, getStoredToken } from '@/lib/api';
import { decodeEntities } from '@/lib/utils';
import { Drawer } from '@/components/ui/Drawer';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  { key: 'before', label: 'Before the Wedding' },
  { key: 'during', label: 'During the Wedding' },
  { key: 'after', label: 'After the Wedding' },
] as const;

type Category = typeof CATEGORIES[number]['key'];

interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: Category;
  is_active: number;
  sort_order: number;
}

interface FAQForm {
  question: string;
  answer: string;
  category: Category;
  is_active: number;
}

const EMPTY_FORM: FAQForm = { question: '', answer: '', category: 'before', is_active: 1 };

const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith('mock_');
};

const decodeFaq = (f: FAQ): FAQ => ({
  ...f,
  question: decodeEntities(f.question),
  answer: decodeEntities(f.answer),
});

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FAQForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchFaqs = useCallback(async () => {
    setIsLoading(true);
    if (isMockMode()) {
      setFaqs([]);
      setUsingMock(true);
      setIsLoading(false);
      return;
    }
    try {
      const res = await faqsAPI.list(true) as { faqs: FAQ[] };
      setFaqs((res.faqs || []).map(decodeFaq));
      setUsingMock(false);
    } catch {
      setFaqs([]);
      setUsingMock(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchFaqs(); }, [fetchFaqs]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (f: FAQ) => {
    setEditingId(f.id);
    setForm({ question: f.question, answer: f.answer, category: f.category, is_active: f.is_active });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) { setError('Question and answer are required'); return; }
    if (usingMock) { setError('Connect to the live API to manage FAQs.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      if (editingId) {
        await faqsAPI.update(editingId, { ...form });
      } else {
        const maxOrder = faqs.filter(f => f.category === form.category).reduce((m, f) => Math.max(m, f.sort_order), 0);
        await faqsAPI.create({ ...form, sort_order: maxOrder + 1 });
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchFaqs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save FAQ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (f: FAQ) => {
    if (usingMock) return;
    const next = f.is_active ? 0 : 1;
    setFaqs(fs => fs.map(x => x.id === f.id ? { ...x, is_active: next } : x));
    try {
      await faqsAPI.update(f.id, { is_active: next });
    } catch {
      setFaqs(fs => fs.map(x => x.id === f.id ? { ...x, is_active: f.is_active } : x));
    }
  };

  const handleDelete = async (f: FAQ) => {
    if (!confirm(`Delete this FAQ?\n\n"${f.question}"`)) return;
    try {
      if (!usingMock) await faqsAPI.delete(f.id);
      setFaqs(fs => fs.filter(x => x.id !== f.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1100px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="dash-h1">FAQs</h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Manage the questions shown on the website FAQs page. They also power the FAQ rich-result schema for Google.
          </p>
        </div>
        <Button onClick={openAdd} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Add FAQ
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
          The live API is not connected. The website is currently showing its built-in FAQ list. Sign in against the live API to manage FAQs here.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
      ) : (
        <div className="flex flex-col gap-8">
          {CATEGORIES.map(cat => {
            const items = faqs.filter(f => f.category === cat.key).sort((a, b) => a.sort_order - b.sort_order);
            return (
              <div key={cat.key}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-[15px] font-bold text-foreground">{cat.label}</h2>
                  <span className="text-[12px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <div className="dash-card p-6 text-center text-sm text-muted-foreground border-dashed">
                    No FAQs in this section yet.
                  </div>
                ) : (
                  <motion.div initial="hidden" animate="visible" className="flex flex-col gap-2">
                    <AnimatePresence>
                      {items.map(f => (
                        <motion.div
                          key={f.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className={`dash-card p-4 flex items-start gap-3 ${f.is_active ? '' : 'opacity-60'}`}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-1 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-foreground">{f.question}</p>
                            <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{f.answer}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => toggleActive(f)} title={f.is_active ? 'Visible — click to hide' : 'Hidden — click to show'}
                              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                              {f.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </button>
                            <button onClick={() => openEdit(f)} title="Edit"
                              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(f)} title="Delete"
                              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            );
          })}

          {faqs.length === 0 && !usingMock && (
            <div className="dash-card p-10 text-center">
              <HelpCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No FAQs yet. The website is showing its built-in questions — add your own here to take over.</p>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit drawer */}
      <Drawer isOpen={showForm} onClose={() => setShowForm(false)} width="480px" title={editingId ? 'Edit FAQ' : 'Add FAQ'}>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Section</label>
            <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value as Category }))}
              className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50">
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Question *</label>
            <input type="text" value={form.question} onChange={(e) => setForm(f => ({ ...f, question: e.target.value }))} maxLength={500}
              placeholder="How far in advance should we book?"
              className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Answer *</label>
            <textarea value={form.answer} onChange={(e) => setForm(f => ({ ...f, answer: e.target.value }))} rows={7}
              placeholder="Write the answer. Leave a blank line between paragraphs."
              className="w-full p-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none leading-relaxed" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
              className="h-4 w-4 rounded border-border accent-[var(--primary)]" />
            <span className="text-[13px] text-foreground font-medium">Show on the website</span>
          </label>
          <Button onClick={handleSave} disabled={isSubmitting || !form.question.trim() || !form.answer.trim()}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : (editingId ? 'Save Changes' : 'Add FAQ')}
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
