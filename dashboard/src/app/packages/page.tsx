"use client";

import React, { useState, useCallback } from 'react';
import { Search, Plus, CheckCircle2, Copy, Loader2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/Drawer';
import { packagesAPI, getStoredToken } from '@/lib/api';
import { decodeEntities } from '@/lib/utils';
import { packages as mockPackages } from '@/data/mockData';

const CATEGORIES = ["Wedding", "Pre-Wedding", "Corporate", "Portrait", "Maternity"] as const;

/* The shape the dashboard works with — normalized from the PHP API
   (snake_case + JSON columns) OR from the bundled demo packages. */
interface PackageVM {
  id: number | string;
  name: string;
  category: string;
  price: number;
  description: string;
  inclusions: string[];
  popularity: number;
  bookingsCount: number;
  isActive: boolean;
}

const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
};

// Map a raw API package (is_active, bookings_count, JSON inclusions) into the VM.
const fromAPI = (p: Record<string, unknown>): PackageVM => ({
  id: p.id as number,
  name: decodeEntities(String(p.name ?? "")),
  category: decodeEntities(String(p.category ?? "Wedding")),
  price: Number(p.price ?? 0),
  description: decodeEntities(String(p.description ?? "")),
  inclusions: Array.isArray(p.inclusions)
    ? (p.inclusions as string[]).map((i) => decodeEntities(String(i)))
    : [],
  popularity: Number(p.popularity ?? 0),
  bookingsCount: Number(p.bookings_count ?? 0),
  isActive: Number(p.is_active ?? 1) === 1,
});

const mockAsVM: PackageVM[] = mockPackages.map((p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: p.price,
  description: p.description,
  inclusions: p.inclusions,
  popularity: p.popularity,
  bookingsCount: p.bookingsCount,
  isActive: p.isActive,
}));

interface PackageForm {
  name: string;
  category: string;
  price: string;
  description: string;
  inclusions: string; // newline-separated in the editor
  isActive: boolean;
}

const EMPTY_FORM: PackageForm = {
  name: "", category: "Wedding", price: "", description: "", inclusions: "", isActive: true,
};

export default function PackagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  React.useEffect(() => { const q = new URLSearchParams(window.location.search).get("q"); if (q) setSearchQuery(q); }, []);
  const [packages, setPackages] = useState<PackageVM[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState("");

  const [showDrawer, setShowDrawer] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [form, setForm] = useState<PackageForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPackages = useCallback(async () => {
    setIsLoading(true);
    if (isMockMode()) {
      setPackages(mockAsVM);
      setUsingMock(true);
      setIsLoading(false);
      return;
    }
    try {
      const res = (await packagesAPI.list({ all: true })) as { packages: Record<string, unknown>[] };
      setPackages((res.packages || []).map(fromAPI));
      setUsingMock(false);
    } catch {
      setPackages(mockAsVM);
      setUsingMock(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const filteredPackages = packages.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Wedding': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Pre-Wedding': return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
      case 'Corporate': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowDrawer(true);
  };

  const openEdit = (pkg: PackageVM) => {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      category: pkg.category,
      price: String(pkg.price),
      description: pkg.description,
      inclusions: pkg.inclusions.join("\n"),
      isActive: pkg.isActive,
    });
    setShowDrawer(true);
  };

  const openDuplicate = (pkg: PackageVM) => {
    setEditingId(null);
    setForm({
      name: `${pkg.name} (Copy)`,
      category: pkg.category,
      price: String(pkg.price),
      description: pkg.description,
      inclusions: pkg.inclusions.join("\n"),
      isActive: pkg.isActive,
    });
    setShowDrawer(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Package name is required"); return; }
    if (usingMock) { setError("Connect to the live API to save packages — demo data is read-only."); return; }
    setIsSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price) || 0,
      description: form.description.trim(),
      inclusions: form.inclusions.split("\n").map(s => s.trim()).filter(Boolean),
      is_active: form.isActive ? 1 : 0,
    };
    try {
      if (editingId !== null) {
        await packagesAPI.update(Number(editingId), payload);
      } else {
        await packagesAPI.create(payload);
      }
      setShowDrawer(false);
      fetchPackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (pkg: PackageVM) => {
    if (usingMock) { setError("Connect to the live API to delete packages."); return; }
    if (!confirm(`Delete the "${pkg.name}" package? This cannot be undone.`)) return;
    try {
      await packagesAPI.delete(Number(pkg.id));
      setPackages(prev => prev.filter(p => p.id !== pkg.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="dash-h1">Packages</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Design and manage your service offerings &amp; pricing.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search packages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-[240px] pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button onClick={openCreate} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Package
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium flex items-center justify-between gap-3 shrink-0">
          <span className="break-words min-w-0">{error}</span>
          <button onClick={() => setError("")} className="shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      {usingMock && !isLoading && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[13px] font-medium shrink-0">
          Showing demo packages — the live API is not connected. Sign in against the live API to edit and save pricing.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
      ) : filteredPackages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-semibold text-foreground">No packages yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first service package and set its price.</p>
          <Button onClick={openCreate} className="mt-4 rounded-xl bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" /> Create Package</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
          {filteredPackages.map(pkg => (
            <div key={pkg.id} className="dash-card flex flex-col h-full group">
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${getCategoryColor(pkg.category)}`}>
                    {pkg.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${pkg.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">{pkg.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-foreground mb-1">{pkg.name}</h2>
                <p className="text-2xl font-bold text-primary mb-3">₹{pkg.price.toLocaleString('en-IN')}</p>
                <p className="text-[13px] text-muted-foreground mb-6 line-clamp-2">{pkg.description}</p>

                <div className="mt-auto space-y-2 mb-6">
                  {pkg.inclusions.slice(0, 4).map((inc, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-[13px] text-foreground font-medium">{inc}</span>
                    </div>
                  ))}
                  {pkg.inclusions.length > 4 && (
                    <div className="text-[12px] text-muted-foreground font-semibold px-6 pt-1">
                      + {pkg.inclusions.length - 4} more inclusions
                    </div>
                  )}
                </div>

                {pkg.bookingsCount > 0 && (
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 mb-6">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[11px] font-bold uppercase text-muted-foreground">Popularity</span>
                      <span className="text-[11px] font-bold text-foreground">{pkg.popularity}% ({pkg.bookingsCount} bookings)</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pkg.popularity}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-auto">
                  <Button className="flex-1 rounded-xl bg-muted/50 text-foreground hover:bg-muted font-medium border border-border/50" onClick={() => openEdit(pkg)}>
                    Edit Details
                  </Button>
                  <button onClick={() => openDuplicate(pkg)} title="Duplicate" className="h-9 w-9 shrink-0 rounded-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Copy className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(pkg)} title="Delete" className="h-9 w-9 shrink-0 rounded-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer isOpen={showDrawer} onClose={() => setShowDrawer(false)} width="480px" title={editingId !== null ? "Edit Package" : "New Package"}>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Package Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="The Signature Wedding"
              className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Price (₹)</label>
              <input type="number" min={0} value={form.price} onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} placeholder="150000"
                className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Category</label>
              <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Description</label>
            <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
              className="w-full p-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div>
            <label className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Inclusions <span className="font-normal normal-case text-muted-foreground/60">(one per line)</span></label>
            <textarea value={form.inclusions} onChange={(e) => setForm(f => ({ ...f, inclusions: e.target.value }))} rows={5} placeholder={"Full-day coverage\nTwo photographers\n300+ edited photos\nCinematic highlight film"}
              className="w-full p-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded border-border" />
            <span className="text-sm font-medium text-foreground">Active (available when creating bookings)</span>
          </label>
          <div className="pt-2 border-t border-border/50">
            <Button onClick={handleSave} disabled={isSaving || !form.name.trim()} className="w-full bg-primary text-primary-foreground font-bold rounded-xl h-10">
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : (editingId !== null ? "Save Changes" : "Create Package")}
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
