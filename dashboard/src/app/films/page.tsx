"use client";

import React, { useState, useCallback } from "react";
import {
  Search, Plus, Trash2, Star, X, Loader2, Pencil, Film,
  GripVertical, ExternalLink,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { filmsAPI } from "@/lib/api";

const FILTERS = [
  { value: "", label: "All Films" },
  { value: "featured", label: "Now Showing Pool" },
];

interface FilmItem {
  id: number;
  youtube_id: string;
  title: string;
  caption: string;
  is_featured: number;
  is_active: number;
  sort_order: number;
  created_at: string;
}

interface FilmFormState {
  youtube_input: string;
  title: string;
  caption: string;
  is_featured: boolean;
}

const EMPTY_FORM: FilmFormState = { youtube_input: "", title: "", caption: "", is_featured: false };

/** Extract a YouTube video ID from a raw ID or any common URL form. */
function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
}

const thumbUrl = (youtubeId: string) => `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;

export default function FilmsPage() {
  const [films, setFilms] = useState<FilmItem[]>([]);
  const [activeFilter, setActiveFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  React.useEffect(() => { const q = new URLSearchParams(window.location.search).get("q"); if (q) setSearchQuery(q); }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Add / edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingFilm, setEditingFilm] = useState<FilmItem | null>(null);
  const [form, setForm] = useState<FilmFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchFilms = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await filmsAPI.list({ all: true });
      setFilms((res as { films: FilmItem[] }).films || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load films");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchFilms(); }, [fetchFilms]);

  const filteredFilms = films.filter(f => {
    if (activeFilter === "featured" && !f.is_featured) return false;
    const q = searchQuery.toLowerCase();
    return f.title.toLowerCase().includes(q) || (f.caption || "").toLowerCase().includes(q);
  });

  const parsedId = extractYouTubeId(form.youtube_input);

  // ── Modal ──

  const openCreateModal = () => {
    setEditingFilm(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (film: FilmItem) => {
    setEditingFilm(film);
    setForm({
      youtube_input: film.youtube_id,
      title: film.title,
      caption: film.caption || "",
      is_featured: !!film.is_featured,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!parsedId) { setError("Enter a valid YouTube link or video ID"); return; }
    if (!form.title.trim()) { setError("Title is required"); return; }
    setIsSaving(true);
    setError("");
    try {
      const payload = {
        youtube_id: parsedId,
        title: form.title,
        caption: form.caption,
        is_featured: form.is_featured ? 1 : 0,
      };
      if (editingFilm) {
        await filmsAPI.update(editingFilm.id, payload);
      } else {
        await filmsAPI.create(payload);
      }
      setShowModal(false);
      fetchFilms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Actions ──

  const toggleFeatured = async (film: FilmItem) => {
    try {
      await filmsAPI.update(film.id, { is_featured: film.is_featured ? 0 : 1 });
      setFilms(prev => prev.map(f => f.id === film.id ? { ...f, is_featured: f.is_featured ? 0 : 1 } : f));
    } catch (err) { setError(err instanceof Error ? err.message : "Update failed"); }
  };

  const toggleActive = async (film: FilmItem) => {
    try {
      await filmsAPI.update(film.id, { is_active: film.is_active ? 0 : 1 });
      setFilms(prev => prev.map(f => f.id === film.id ? { ...f, is_active: f.is_active ? 0 : 1 } : f));
    } catch (err) { setError(err instanceof Error ? err.message : "Update failed"); }
  };

  const handleDelete = async (film: FilmItem) => {
    if (!confirm(`Remove "${film.title}" from the film library?`)) return;
    try {
      await filmsAPI.delete(film.id);
      setFilms(prev => prev.filter(f => f.id !== film.id));
    } catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Reorder over the full fetched list, not the filtered view,
    // so items hidden by search/filter are never dropped from state.
    const oldIndex = films.findIndex(f => f.id === active.id);
    const newIndex = films.findIndex(f => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(films, oldIndex, newIndex);
    setFilms(reordered);
    try {
      await filmsAPI.reorder(reordered.map((f, i) => ({ id: f.id, sort_order: i + 1 })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reorder failed");
      fetchFilms();
    }
  };

  // ── Render ──

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="dash-h1">Films</h1>
          <p className="text-[14px] text-muted-foreground mt-1">YouTube films shown on the website — starred films enter the &ldquo;Now Showing&rdquo; rotation.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search films..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-[220px] pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <Button onClick={openCreateModal} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Add Film
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium flex items-center justify-between gap-3">
          <span className="break-words min-w-0">{error}</span>
          <button onClick={() => setError("")} className="shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-card/50 border border-border/50 p-1 rounded-xl w-max">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setActiveFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeFilter === f.value ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      ) : filteredFilms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Film className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold text-foreground">No films yet</p>
          <p className="text-sm text-muted-foreground mt-1">Paste a YouTube link to add your first film.</p>
          <Button onClick={openCreateModal} className="mt-4 rounded-xl bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Add Film
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredFilms.map(f => f.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-12">
              {filteredFilms.map(film => (
                <SortableFilmCard
                  key={film.id}
                  film={film}
                  onEdit={() => openEditModal(film)}
                  onDelete={() => handleDelete(film)}
                  onToggleFeatured={() => toggleFeatured(film)}
                  onToggleActive={() => toggleActive(film)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-[520px] border border-border/50 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{editingFilm ? "Edit Film" : "Add Film"}</h2>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">YouTube Link or Video ID *</label>
                <input type="text" value={form.youtube_input} onChange={(e) => setForm(f => ({ ...f, youtube_input: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
                {form.youtube_input && !parsedId && (
                  <p className="text-[12px] text-red-500 mt-1.5">Couldn&rsquo;t find a video ID in that link.</p>
                )}
              </div>

              {/* Live thumbnail preview */}
              {parsedId && (
                <div className="rounded-xl overflow-hidden border border-border/50 bg-muted aspect-video">
                  <img src={thumbUrl(parsedId)} alt="Video preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Annie & Shyam"
                  className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Caption</label>
                <input type="text" value={form.caption} onChange={(e) => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="Wedding Trailer"
                  className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm(f => ({ ...f, is_featured: e.target.checked }))} className="rounded border-border" />
                <span className="text-sm font-medium text-foreground">Include in &ldquo;Now Showing&rdquo; rotation</span>
              </label>
              <Button onClick={handleSave} disabled={isSaving || !parsedId || !form.title.trim()} className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold">
                {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : editingFilm ? "Save Changes" : "Add Film"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ── Sortable film card ── */
function SortableFilmCard({ film, onEdit, onDelete, onToggleFeatured, onToggleActive }: {
  film: FilmItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFeatured: () => void;
  onToggleActive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: film.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}
      className={`dash-card overflow-hidden group ${isDragging ? "z-10 shadow-2xl opacity-90" : ""} ${!film.is_active ? "opacity-50" : ""}`}>
      <div className="aspect-video bg-muted overflow-hidden relative">
        <img src={thumbUrl(film.youtube_id)} alt={film.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" draggable={false} />
        <a href={`https://www.youtube.com/watch?v=${film.youtube_id}`} target="_blank" rel="noopener noreferrer"
          className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
          title="Watch on YouTube">
          <span className="h-10 w-10 rounded-full bg-white/90 text-foreground flex items-center justify-center shadow">
            <ExternalLink className="h-4 w-4" />
          </span>
        </a>
        {film.is_featured ? (
          <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center">
            <Star className="h-3 w-3 text-white" fill="currentColor" />
          </div>
        ) : null}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-foreground truncate">{film.title}</p>
            <p className="text-[12px] text-muted-foreground truncate mt-0.5">{film.caption || "—"}</p>
          </div>
          <span {...attributes} {...listeners} className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing" title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <button onClick={onToggleActive}
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${film.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-400"}`}>
            {film.is_active ? "Live" : "Hidden"}
          </button>
          <div className="flex items-center gap-1">
            <button onClick={onToggleFeatured}
              className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${film.is_featured ? "text-amber-500 hover:bg-amber-500/10" : "text-muted-foreground hover:bg-muted hover:text-amber-500"}`}
              title={film.is_featured ? "Remove from Now Showing pool" : "Add to Now Showing pool"}>
              <Star className="h-3.5 w-3.5" fill={film.is_featured ? "currentColor" : "none"} />
            </button>
            <button onClick={onEdit} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit film">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500" title="Delete film">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
