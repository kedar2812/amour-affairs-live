"use client";

/* ============================================================
   PREMIUM ALBUMS — dedicated dashboard tab
   ------------------------------------------------------------
   Premium Albums are the studio's physical, handcrafted product
   collections (12×12 / 15×15 albums, canvas prints) shown on the
   /premium-albums website page. They reuse the `premium_album`
   album type in the API but are a different *thing* from the
   wedding / couple-shoot event folders, so they get their own tab
   with product-appropriate labels (Collection Name, Format,
   Material & Finish) and NO film field.
   ============================================================ */

import React, { useState, useCallback } from "react";
import {
  Search, Plus, Upload, Trash2, X, Loader2, ArrowLeft,
  Pencil, ImagePlus, BookOpen, GripVertical,
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
import { albumsAPI, galleryAPI, assetUrl } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";

const ALBUM_TYPE = "premium_album";
const MAX_FILE_SIZE = 64 * 1024 * 1024; // 64MB — full-res wedding photos

interface AlbumPhoto {
  id: number;
  album_id: number;
  file_path: string;
  thumbnail_path: string;
  sort_order: number;
  is_active: number;
}

interface Collection {
  id: number;
  type: string;
  couple: string;        // → Collection Name
  location: string;      // → Format (spec line 1)
  date_label: string;    // → Material & Finish (spec line 2)
  description: string;
  cover: string | null;
  cover_thumb: string | null;
  photo_count: number;
  sort_order: number;
  is_active: number;
  created_at: string;
  photos?: AlbumPhoto[];
}

interface CollectionForm {
  couple: string;
  location: string;
  date_label: string;
  description: string;
}

const EMPTY_FORM: CollectionForm = { couple: "", location: "", date_label: "", description: "" };

// Decode once on load — text displays correctly and edit-save cycles
// re-encode to the same stored value (no double-encoding)
const decodeCollection = (a: Collection): Collection => ({
  ...a,
  couple: decodeEntities(a.couple),
  location: decodeEntities(a.location),
  date_label: decodeEntities(a.date_label),
  description: decodeEntities(a.description),
});

const specLine = (c: Collection) =>
  [c.location, c.date_label].filter(Boolean).join(" · ");

export default function PremiumAlbumsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  React.useEffect(() => { const q = new URLSearchParams(window.location.search).get("q"); if (q) setSearchQuery(q); }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Detail view — the collection currently opened for photo management
  const [openCollection, setOpenCollection] = useState<Collection | null>(null);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ done: number; total: number } | null>(null);

  // Create / edit modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [form, setForm] = useState<CollectionForm>(EMPTY_FORM);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ── Data loading ──

  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await albumsAPI.list({ type: ALBUM_TYPE, all: true });
      setCollections(((res as { albums: Collection[] }).albums || []).map(decodeCollection));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collections");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchCollections(); }, [fetchCollections]);

  const openDetail = async (collection: Collection) => {
    setOpenCollection(collection);
    setIsLoadingPhotos(true);
    try {
      const fresh = decodeCollection(await albumsAPI.get(collection.id) as Collection);
      setOpenCollection(fresh);
      setPhotos(fresh.photos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collection");
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const refreshOpen = async (id: number) => {
    const fresh = decodeCollection(await albumsAPI.get(id) as Collection);
    setOpenCollection(fresh);
    setPhotos(fresh.photos || []);
  };

  const filtered = collections.filter(c =>
    c.couple.toLowerCase().includes(searchQuery.toLowerCase()) ||
    specLine(c).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Create / edit ──

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCoverFile(null);
    setCoverPreview("");
    setShowModal(true);
  };

  const openEdit = (c: Collection) => {
    setEditing(c);
    setForm({
      couple: c.couple,
      location: c.location || "",
      date_label: c.date_label || "",
      description: c.description || "",
    });
    setCoverFile(null);
    setCoverPreview(c.cover_thumb ? assetUrl(c.cover_thumb) : "");
    setShowModal(true);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { setError("Thumbnail must be under 64MB"); return; }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.couple.trim()) { setError("Collection name is required"); return; }
    setIsSaving(true);
    setError("");
    try {
      if (editing) {
        await albumsAPI.update(editing.id, { ...form, type: ALBUM_TYPE });
        if (coverFile) {
          const fd = new FormData();
          fd.append("cover", coverFile);
          await albumsAPI.setCover(editing.id, fd);
        }
        if (openCollection?.id === editing.id) await refreshOpen(editing.id);
      } else {
        const fd = new FormData();
        fd.append("type", ALBUM_TYPE);
        fd.append("couple", form.couple);
        fd.append("location", form.location);
        fd.append("date_label", form.date_label);
        fd.append("description", form.description);
        if (coverFile) fd.append("cover", coverFile);
        await albumsAPI.create(fd);
      }
      setShowModal(false);
      fetchCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Collection actions ──

  const toggleActive = async (c: Collection) => {
    try {
      await albumsAPI.update(c.id, { is_active: c.is_active ? 0 : 1 });
      setCollections(prev => prev.map(a => a.id === c.id ? { ...a, is_active: a.is_active ? 0 : 1 } : a));
    } catch (err) { setError(err instanceof Error ? err.message : "Update failed"); }
  };

  const handleDelete = async (c: Collection) => {
    if (!confirm(`Delete the "${c.couple}" collection and all ${c.photo_count} of its photos? This cannot be undone.`)) return;
    try {
      await albumsAPI.delete(c.id);
      setCollections(prev => prev.filter(a => a.id !== c.id));
      if (openCollection?.id === c.id) setOpenCollection(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  };

  const handleCollectionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = collections.findIndex(a => a.id === active.id);
    const newIndex = collections.findIndex(a => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(collections, oldIndex, newIndex);
    setCollections(reordered);
    try {
      await albumsAPI.reorder(reordered.map((a, i) => ({ id: a.id, sort_order: i + 1 })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reorder failed");
      fetchCollections();
    }
  };

  // ── Photo actions ──

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !openCollection) return;

    const oversized = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length) {
      setError(`These files exceed 64MB: ${oversized.map(f => f.name).join(", ")}`);
      return;
    }

    setError("");
    setUploadQueue({ done: 0, total: files.length });
    const failures: string[] = [];

    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("photos[]", file);
        await albumsAPI.addPhotos(openCollection.id, fd);
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
      }
      setUploadQueue(prev => prev ? { ...prev, done: prev.done + 1 } : prev);
    }

    setUploadQueue(null);
    try { await refreshOpen(openCollection.id); } catch { /* list refresh below still runs */ }
    fetchCollections();
    if (failures.length) {
      setError(`${failures.length} of ${files.length} photos failed — ${failures.join("; ")}`);
    }
  };

  const handleDeletePhoto = async (photo: AlbumPhoto) => {
    if (!confirm("Delete this photo?")) return;
    try {
      await galleryAPI.delete(photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      fetchCollections();
    } catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  };

  const handlePhotoDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photos.findIndex(p => p.id === active.id);
    const newIndex = photos.findIndex(p => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(photos, oldIndex, newIndex);
    setPhotos(reordered);
    try {
      await galleryAPI.reorder(reordered.map((p, i) => ({ id: p.id, sort_order: i + 1 })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reorder failed");
      if (openCollection) refreshOpen(openCollection.id);
    }
  };

  // ── Render ──

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          {openCollection ? (
            <>
              <button onClick={() => setOpenCollection(null)} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2">
                <ArrowLeft className="h-4 w-4" /> All Premium Albums
              </button>
              <h1 className="dash-h1">{openCollection.couple}</h1>
              <p className="text-[14px] text-muted-foreground mt-1">
                {specLine(openCollection) || "Manage this collection's photos."}
              </p>
            </>
          ) : (
            <>
              <h1 className="dash-h1">Premium Albums</h1>
              <p className="text-[14px] text-muted-foreground mt-1">Your handcrafted album &amp; print collections shown on the Premium Albums page.</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {openCollection ? (
            <>
              <Button onClick={() => openEdit(openCollection)} variant="outline" className="h-10 px-4 rounded-xl">
                <Pencil className="h-4 w-4 mr-2" /> Edit Details
              </Button>
              <label className={`inline-flex items-center h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm ${uploadQueue ? "opacity-60 pointer-events-none" : "cursor-pointer hover:opacity-90"}`}>
                <ImagePlus className="h-4 w-4 mr-2" /> Add Photos
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} disabled={!!uploadQueue} />
              </label>
            </>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search collections..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-[220px] pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <Button onClick={openCreate} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> New Collection
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium flex items-center justify-between gap-3">
          <span className="break-words min-w-0">{error}</span>
          <button onClick={() => setError("")} className="shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Upload progress */}
      {uploadQueue && (
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Uploading photos… {uploadQueue.done} of {uploadQueue.total}
            </span>
            <span className="text-sm text-muted-foreground">{Math.round((uploadQueue.done / uploadQueue.total) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${(uploadQueue.done / uploadQueue.total) * 100}%` }} />
          </div>
        </div>
      )}

      {openCollection ? (
        /* ═══════════ DETAIL VIEW — photo grid ═══════════ */
        isLoadingPhotos ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">No photos in this collection yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add photos of the finished pieces — the first one becomes the thumbnail automatically.</p>
            <label className="mt-4 inline-flex items-center h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:opacity-90">
              <ImagePlus className="h-4 w-4 mr-2" /> Add Photos
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />
            </label>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-muted-foreground -mt-2">
              {photos.length} photo{photos.length === 1 ? "" : "s"} — drag to set the order they appear on the website.
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePhotoDragEnd}>
              <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 pb-12">
                  {photos.map(photo => (
                    <SortablePhotoCard key={photo.id} photo={photo} onDelete={() => handleDeletePhoto(photo)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )
      ) : (
        /* ═══════════ LIST VIEW — collection grid ═══════════ */
        isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">No premium album collections yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create a collection (e.g. 12 × 12 Albums), then fill it with photos of finished pieces.</p>
            <Button onClick={openCreate} className="mt-4 rounded-xl bg-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" /> New Collection
            </Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCollectionDragEnd}>
            <SortableContext items={filtered.map(a => a.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-12">
                {filtered.map(collection => (
                  <SortableCollectionCard
                    key={collection.id}
                    collection={collection}
                    onOpen={() => openDetail(collection)}
                    onEdit={() => openEdit(collection)}
                    onDelete={() => handleDelete(collection)}
                    onToggleActive={() => toggleActive(collection)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-[560px] border border-border/50 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{editing ? "Edit Collection" : "New Collection"}</h2>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Collection Name *</label>
                <input type="text" value={form.couple} onChange={(e) => setForm(f => ({ ...f, couple: e.target.value }))} placeholder="12 × 12 Albums"
                  className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Format</label>
                  <input type="text" value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Lay-Flat Spreads"
                    className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
                  <p className="text-[11px] text-muted-foreground mt-1.5">First spec line on the card.</p>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Material &amp; Finish</label>
                  <input type="text" value={form.date_label} onChange={(e) => setForm(f => ({ ...f, date_label: e.target.value }))} placeholder="Leather &amp; Linen"
                    className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
                  <p className="text-[11px] text-muted-foreground mt-1.5">Second spec line on the card.</p>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Description</label>
                <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={4}
                  placeholder="Our most-loved heirloom format — twelve by twelve inches of lay-flat, edge-to-edge spreads…"
                  className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Thumbnail {editing ? "(replace)" : "(optional — first photo is used if empty)"}
                </label>
                <label className="block cursor-pointer">
                  <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${coverPreview ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}>
                    {coverPreview ? (
                      <img src={coverPreview} alt="Thumbnail preview" className="max-h-[160px] mx-auto rounded-lg object-contain" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                        <p className="text-[12px] text-muted-foreground">JPEG, PNG, WebP — max 64MB</p>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                </label>
              </div>
              <Button onClick={handleSave} disabled={isSaving || !form.couple.trim()} className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold">
                {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : editing ? "Save Changes" : "Create Collection"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ── Sortable collection card ── */
function SortableCollectionCard({ collection, onOpen, onEdit, onDelete, onToggleActive }: {
  collection: Collection;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: collection.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const spec = [collection.location, collection.date_label].filter(Boolean).join(" · ");

  return (
    <div ref={setNodeRef} style={style}
      className={`dash-card overflow-hidden group ${isDragging ? "z-10 shadow-2xl opacity-90" : ""} ${!collection.is_active ? "opacity-50" : ""}`}>
      <button onClick={onOpen} className="block w-full aspect-[3/2] bg-muted overflow-hidden relative cursor-pointer text-left">
        {collection.cover_thumb || collection.cover ? (
          <img src={assetUrl(collection.cover_thumb || collection.cover)} alt={collection.couple}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-semibold">
          {collection.photo_count} photo{collection.photo_count === 1 ? "" : "s"}
        </span>
      </button>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onOpen} className="min-w-0 text-left cursor-pointer">
            <p className="text-[15px] font-bold text-foreground truncate">{collection.couple}</p>
            <p className="text-[12px] text-muted-foreground truncate mt-0.5">{spec || "—"}</p>
          </button>
          <span {...attributes} {...listeners} className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing" title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <button onClick={onToggleActive}
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${collection.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-400"}`}>
            {collection.is_active ? "Live" : "Hidden"}
          </button>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit collection">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500" title="Delete collection">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ── Sortable photo card ── */
function SortablePhotoCard({ photo, onDelete }: { photo: AlbumPhoto; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`dash-card overflow-hidden group relative cursor-grab active:cursor-grabbing ${isDragging ? "z-10 shadow-2xl opacity-90" : ""}`}>
      <div className="aspect-square bg-muted overflow-hidden">
        <img src={assetUrl(photo.thumbnail_path || photo.file_path)} alt=""
          className="w-full h-full object-cover" loading="lazy" draggable={false} />
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 h-8 w-8 rounded-lg bg-white/90 text-foreground hover:bg-red-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm"
        title="Delete photo">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
