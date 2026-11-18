"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Search, Plus, Upload, Trash2, X, Loader2, ArrowLeft,
  Pencil, ImagePlus, FolderOpen, GripVertical, Check, SlidersHorizontal, Tags,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { albumsAPI, galleryAPI, assetUrl, type AlbumSection } from "@/lib/api";
import { decodeEntities } from "@/lib/utils";

// Premium Albums are a different product (handcrafted physical
// albums/prints) and live in their own dedicated tab — this tab is
// just the event folders shown on /weddings and /couple-shoots.
const ALBUM_TYPES = [
  { value: "wedding", label: "Weddings" },
  { value: "couple_shoot", label: "Couple Shoots" },
];

const MAX_FILE_SIZE = 64 * 1024 * 1024; // 64MB — full-res wedding photos

interface AlbumPhoto {
  id: number;
  album_id: number;
  /** null = unsorted; still shown under the website's "All" filter. */
  section_id: number | null;
  file_path: string;
  thumbnail_path: string;
  sort_order: number;
  is_active: number;
}

/** Which chip the photo grid is filtered by. */
type SectionFilter = "all" | "unsorted" | number;

interface Album {
  id: number;
  type: string;
  couple: string;
  location: string;
  date_label: string;
  description: string;
  film_youtube_id: string | null;
  cover: string | null;
  cover_thumb: string | null;
  photo_count: number;
  sort_order: number;
  is_active: number;
  created_at: string;
  photos?: AlbumPhoto[];
  sections?: AlbumSection[];
}

interface AlbumFormState {
  type: string;
  couple: string;
  location: string;
  date_label: string;
  description: string;
  film_youtube_id: string;
}

const EMPTY_FORM: AlbumFormState = { type: "wedding", couple: "", location: "", date_label: "", description: "", film_youtube_id: "" };

const getTypeLabel = (val: string) => ALBUM_TYPES.find(t => t.value === val)?.label || val;

// Decode once on load — text displays correctly and edit-save cycles
// re-encode to the same stored value (no double-encoding)
const decodeAlbum = (a: Album): Album => ({
  ...a,
  couple: decodeEntities(a.couple),
  location: decodeEntities(a.location),
  date_label: decodeEntities(a.date_label),
  description: decodeEntities(a.description),
});

// Section names go through the PHP sanitizer, so "Haldi & Mehendi" comes back
// encoded — decode on read, and the sanitizer re-encodes once on save.
const decodeSections = (list: AlbumSection[] | undefined): AlbumSection[] =>
  (list || []).map(s => ({ ...s, name: decodeEntities(s.name) }));

export default function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeType, setActiveType] = useState("wedding");
  const [searchQuery, setSearchQuery] = useState("");
  React.useEffect(() => { const q = new URLSearchParams(window.location.search).get("q"); if (q) setSearchQuery(q); }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Detail view — the album currently opened for photo management
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  // Sections — the ritual filters inside a folder (Haldi, Mehendi, Sangeet…)
  const [sections, setSections] = useState<AlbumSection[]>([]);
  const [activeSection, setActiveSection] = useState<SectionFilter>("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [showSectionManager, setShowSectionManager] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [isSectionBusy, setIsSectionBusy] = useState(false);

  // Sequential photo upload queue
  const [uploadQueue, setUploadQueue] = useState<{ done: number; total: number } | null>(null);

  // Create / edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [form, setForm] = useState<AlbumFormState>(EMPTY_FORM);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ── Data loading ──

  const fetchAlbums = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await albumsAPI.list({ type: activeType, all: true });
      setAlbums(((res as { albums: Album[] }).albums || []).map(decodeAlbum));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load albums");
    } finally {
      setIsLoading(false);
    }
  }, [activeType]);

  React.useEffect(() => { fetchAlbums(); }, [fetchAlbums]);

  const openAlbumDetail = async (album: Album) => {
    setOpenAlbum(album);
    setIsLoadingPhotos(true);
    setActiveSection("all");
    setSelected([]);
    try {
      const fresh = decodeAlbum(await albumsAPI.get(album.id) as Album);
      setOpenAlbum(fresh);
      setPhotos(fresh.photos || []);
      setSections(decodeSections(fresh.sections));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load album");
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const refreshOpenAlbum = async (albumId: number) => {
    const fresh = decodeAlbum(await albumsAPI.get(albumId) as Album);
    setOpenAlbum(fresh);
    setPhotos(fresh.photos || []);
    setSections(decodeSections(fresh.sections));
  };

  const filteredAlbums = albums.filter(a =>
    a.couple.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.location || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Create / edit ──

  const openCreateModal = () => {
    setEditingAlbum(null);
    setForm({ ...EMPTY_FORM, type: activeType });
    setCoverFile(null);
    setCoverPreview("");
    setShowModal(true);
  };

  const openEditModal = (album: Album) => {
    setEditingAlbum(album);
    setForm({
      type: album.type,
      couple: album.couple,
      location: album.location || "",
      date_label: album.date_label || "",
      description: album.description || "",
      film_youtube_id: album.film_youtube_id ? `https://youtu.be/${album.film_youtube_id}` : "",
    });
    setCoverFile(null);
    setCoverPreview(album.cover_thumb ? assetUrl(album.cover_thumb) : "");
    setShowModal(true);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { setError("Cover must be under 64MB"); return; }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.couple.trim()) { setError("Album title is required"); return; }
    setIsSaving(true);
    setError("");
    try {
      if (editingAlbum) {
        await albumsAPI.update(editingAlbum.id, { ...form });
        if (coverFile) {
          const fd = new FormData();
          fd.append("cover", coverFile);
          await albumsAPI.setCover(editingAlbum.id, fd);
        }
        if (openAlbum?.id === editingAlbum.id) await refreshOpenAlbum(editingAlbum.id);
      } else {
        const fd = new FormData();
        Object.entries(form).forEach(([key, value]) => fd.append(key, value));
        if (coverFile) fd.append("cover", coverFile);
        await albumsAPI.create(fd);
      }
      setShowModal(false);
      fetchAlbums();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Album actions ──

  const toggleActive = async (album: Album) => {
    try {
      await albumsAPI.update(album.id, { is_active: album.is_active ? 0 : 1 });
      setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, is_active: a.is_active ? 0 : 1 } : a));
    } catch (err) { setError(err instanceof Error ? err.message : "Update failed"); }
  };

  const handleDeleteAlbum = async (album: Album) => {
    if (!confirm(`Delete "${album.couple}" and all ${album.photo_count} of its photos? This cannot be undone.`)) return;
    try {
      await albumsAPI.delete(album.id);
      setAlbums(prev => prev.filter(a => a.id !== album.id));
      if (openAlbum?.id === album.id) setOpenAlbum(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  };

  const handleAlbumDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Reorder over the full fetched list, not the search-filtered view,
    // so items hidden by the filter are never dropped from state.
    const oldIndex = albums.findIndex(a => a.id === active.id);
    const newIndex = albums.findIndex(a => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(albums, oldIndex, newIndex);
    setAlbums(reordered);
    try {
      await albumsAPI.reorder(reordered.map((a, i) => ({ id: a.id, sort_order: i + 1 })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reorder failed");
      fetchAlbums();
    }
  };

  // ── Sections ──

  // Counts are derived from the photos in state rather than the API's snapshot,
  // so chips update the instant a photo is moved or deleted.
  const sectionCounts = useMemo(() => {
    const counts = new Map<number, number>();
    let unsorted = 0;
    for (const p of photos) {
      if (p.section_id == null) unsorted++;
      else counts.set(p.section_id, (counts.get(p.section_id) || 0) + 1);
    }
    return { counts, unsorted };
  }, [photos]);

  const visiblePhotos = useMemo(() => {
    if (activeSection === "all") return photos;
    if (activeSection === "unsorted") return photos.filter(p => p.section_id == null);
    return photos.filter(p => p.section_id === activeSection);
  }, [photos, activeSection]);

  const activeSectionId = typeof activeSection === "number" ? activeSection : null;

  const handleCreateSection = async () => {
    const name = newSectionName.trim();
    if (!name || !openAlbum) return;
    setIsSectionBusy(true);
    setError("");
    try {
      const created = await albumsAPI.sections.create(openAlbum.id, name);
      setSections(prev => [...prev, { ...created, name: decodeEntities(created.name) }]);
      setNewSectionName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that section");
    } finally {
      setIsSectionBusy(false);
    }
  };

  const handleRenameSection = async (section: AlbumSection, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === section.name) return;
    const prev = section.name;
    setSections(list => list.map(s => s.id === section.id ? { ...s, name: trimmed } : s));
    try {
      await albumsAPI.sections.update(section.id, { name: trimmed });
    } catch (err) {
      setSections(list => list.map(s => s.id === section.id ? { ...s, name: prev } : s));
      setError(err instanceof Error ? err.message : "Rename failed");
    }
  };

  const handleDeleteSection = async (section: AlbumSection) => {
    const count = sectionCounts.counts.get(section.id) || 0;
    const msg = count
      ? `Remove the "${section.name}" section? Its ${count} photo${count === 1 ? "" : "s"} stay in the folder and become unsorted — nothing is deleted.`
      : `Remove the "${section.name}" section?`;
    if (!confirm(msg)) return;
    try {
      await albumsAPI.sections.remove(section.id);
      setSections(list => list.filter(s => s.id !== section.id));
      // Mirror the server's SET NULL locally so the grid updates immediately.
      setPhotos(list => list.map(p => p.section_id === section.id ? { ...p, section_id: null } : p));
      if (activeSection === section.id) setActiveSection("all");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that section");
    }
  };

  const handleSectionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !openAlbum) return;
    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(sections, oldIndex, newIndex);
    setSections(reordered);
    try {
      await albumsAPI.sections.reorder(openAlbum.id, reordered.map((s, i) => ({ id: s.id, sort_order: i + 1 })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reorder failed");
      refreshOpenAlbum(openAlbum.id);
    }
  };

  /** Move the current selection into a section (or back to unsorted). */
  const handleAssignSelected = async (sectionId: number | null) => {
    if (!openAlbum || selected.length === 0) return;
    const ids = [...selected];
    const before = photos;
    setPhotos(list => list.map(p => ids.includes(p.id) ? { ...p, section_id: sectionId } : p));
    setSelected([]);
    try {
      await albumsAPI.sections.assign(openAlbum.id, ids, sectionId);
    } catch (err) {
      setPhotos(before);
      setError(err instanceof Error ? err.message : "Couldn't move those photos");
    }
  };

  const toggleSelected = (photoId: number) =>
    setSelected(prev => prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]);

  // ── Photo actions (detail view) ──

  // Upload one file per request: keeps each request small (shared-hosting
  // post limits), gives real progress, and lets one bad file fail alone.
  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !openAlbum) return;

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
        // Uploading with a section open files the batch straight into it.
        if (activeSectionId !== null) fd.append("section_id", String(activeSectionId));
        await albumsAPI.addPhotos(openAlbum.id, fd);
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
      }
      setUploadQueue(prev => prev ? { ...prev, done: prev.done + 1 } : prev);
    }

    setUploadQueue(null);
    try { await refreshOpenAlbum(openAlbum.id); } catch { /* list refresh below still runs */ }
    fetchAlbums();
    if (failures.length) {
      setError(`${failures.length} of ${files.length} photos failed — ${failures.join("; ")}`);
    }
  };

  const handleDeletePhoto = async (photo: AlbumPhoto) => {
    if (!confirm("Delete this photo?")) return;
    try {
      await galleryAPI.delete(photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      setSelected(prev => prev.filter(id => id !== photo.id));
      fetchAlbums();
    } catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  };

  const handlePhotoDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Drag happens within the filtered view, but sort_order is album-wide.
    // Reorder the visible subset, then write it back into the slots those
    // photos already occupy in the full list — photos hidden by the current
    // filter keep their positions and never get shuffled by a section edit.
    const oldIndex = visiblePhotos.findIndex(p => p.id === active.id);
    const newIndex = visiblePhotos.findIndex(p => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedVisible = arrayMove(visiblePhotos, oldIndex, newIndex);
    const visibleIds = new Set(visiblePhotos.map(p => p.id));
    let cursor = 0;
    const merged = photos.map(p => (visibleIds.has(p.id) ? reorderedVisible[cursor++] : p));

    const before = photos;
    setPhotos(merged);
    try {
      await galleryAPI.reorder(merged.map((p, i) => ({ id: p.id, sort_order: i + 1 })));
    } catch (err) {
      setPhotos(before);
      setError(err instanceof Error ? err.message : "Reorder failed");
    }
  };

  // ── Render ──

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          {openAlbum ? (
            <>
              <button onClick={() => setOpenAlbum(null)} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2">
                <ArrowLeft className="h-4 w-4" /> All {getTypeLabel(openAlbum.type)}
              </button>
              <h1 className="dash-h1">{openAlbum.couple}</h1>
              <p className="text-[14px] text-muted-foreground mt-1">
                {[openAlbum.location, openAlbum.date_label].filter(Boolean).join(" · ") || "Manage this album's photos."}
              </p>
            </>
          ) : (
            <>
              <h1 className="dash-h1">Albums</h1>
              <p className="text-[14px] text-muted-foreground mt-1">Wedding, couple shoot and premium album archives shown on the website.</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {openAlbum ? (
            <>
              <Button onClick={() => openEditModal(openAlbum)} variant="outline" className="h-10 px-4 rounded-xl">
                <Pencil className="h-4 w-4 mr-2" /> Edit Details
              </Button>
              <label className={`inline-flex items-center h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm ${uploadQueue ? "opacity-60 pointer-events-none" : "cursor-pointer hover:opacity-90"}`}>
                <ImagePlus className="h-4 w-4 mr-2" />
                {activeSectionId !== null
                  ? `Add to ${sections.find(s => s.id === activeSectionId)?.name || "section"}`
                  : "Add Photos"}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} disabled={!!uploadQueue} />
              </label>
            </>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search albums..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-[220px] pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <Button onClick={openCreateModal} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> New Album
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

      {openAlbum ? (
        /* ═══════════ DETAIL VIEW — sections + photo grid ═══════════ */
        isLoadingPhotos ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : photos.length === 0 && sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">No photos in this album yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add photos — the first one becomes the cover automatically.</p>
            <label className="mt-4 inline-flex items-center h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:opacity-90">
              <ImagePlus className="h-4 w-4 mr-2" /> Add Photos
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />
            </label>
          </div>
        ) : (
          <>
            {/* Section rail — the same filters visitors will see on the website */}
            <div className="flex items-center gap-2 flex-wrap">
              <SectionChip
                label="All photos"
                count={photos.length}
                active={activeSection === "all"}
                onClick={() => setActiveSection("all")}
              />
              {sections.map(s => (
                <SectionChip
                  key={s.id}
                  label={s.name}
                  count={sectionCounts.counts.get(s.id) || 0}
                  active={activeSection === s.id}
                  onClick={() => setActiveSection(s.id)}
                />
              ))}
              {/* Only worth showing once sections exist — before that, everything is unsorted */}
              {sections.length > 0 && sectionCounts.unsorted > 0 && (
                <SectionChip
                  label="Unsorted"
                  count={sectionCounts.unsorted}
                  active={activeSection === "unsorted"}
                  muted
                  onClick={() => setActiveSection("unsorted")}
                />
              )}
              <button
                onClick={() => setShowSectionManager(true)}
                className="h-8 px-3 rounded-full border border-dashed border-border text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center gap-1.5"
              >
                {sections.length ? <SlidersHorizontal className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {sections.length ? "Manage sections" : "Add sections"}
              </button>
            </div>

            <p className="text-[13px] text-muted-foreground -mt-2">
              {sections.length === 0 ? (
                <>
                  {photos.length} photo{photos.length === 1 ? "" : "s"} — drag to set the order they appear on the website.
                  {" "}Add sections (Haldi, Mehendi, Sangeet…) to give visitors filters inside this folder.
                </>
              ) : (
                <>
                  Showing {visiblePhotos.length} of {photos.length} photo{photos.length === 1 ? "" : "s"} — drag to reorder,
                  or select photos to file them under a section.
                </>
              )}
            </p>

            {visiblePhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl">
                <Tags className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-[15px] font-semibold text-foreground">Nothing filed here yet</p>
                <p className="text-[13px] text-muted-foreground mt-1 max-w-[420px]">
                  Switch to <button onClick={() => setActiveSection("all")} className="text-primary font-semibold hover:underline">All photos</button>,
                  select the ones that belong here, and move them across — or upload straight into this section.
                </p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePhotoDragEnd}>
                <SortableContext items={visiblePhotos.map(p => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 pb-28">
                    {visiblePhotos.map(photo => (
                      <SortablePhotoCard
                        key={photo.id}
                        photo={photo}
                        sectionName={photo.section_id != null ? sections.find(s => s.id === photo.section_id)?.name : undefined}
                        showSectionBadge={sections.length > 0 && activeSection === "all"}
                        selected={selected.includes(photo.id)}
                        selectionMode={selected.length > 0}
                        onToggleSelect={() => toggleSelected(photo.id)}
                        onDelete={() => handleDeletePhoto(photo)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Selection action bar — appears only when something is selected */}
            {selected.length > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border shadow-2xl">
                <span className="text-[13px] font-bold text-foreground whitespace-nowrap">
                  {selected.length} selected
                </span>
                <span className="h-5 w-px bg-border" />
                <label className="text-[12px] text-muted-foreground whitespace-nowrap">Move to</label>
                <select
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") return;
                    handleAssignSelected(v === "unsorted" ? null : Number(v));
                  }}
                  className="h-9 px-3 bg-muted/40 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 max-w-[200px]"
                >
                  <option value="">Choose a section…</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="unsorted">Unsorted</option>
                </select>
                <button
                  onClick={() => setSelected([])}
                  className="h-9 px-3 rounded-lg text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </>
        )
      ) : (
        /* ═══════════ LIST VIEW — album grid ═══════════ */
        <>
          <div className="flex items-center gap-1 bg-card/50 border border-border/50 p-1 rounded-xl w-max">
            {ALBUM_TYPES.map(t => (
              <button key={t.value} onClick={() => setActiveType(t.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeType === t.value ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : filteredAlbums.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold text-foreground">No {getTypeLabel(activeType).toLowerCase()} albums yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create an album, then fill it with photos.</p>
              <Button onClick={openCreateModal} className="mt-4 rounded-xl bg-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" /> New Album
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAlbumDragEnd}>
              <SortableContext items={filteredAlbums.map(a => a.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-12">
                  {filteredAlbums.map(album => (
                    <SortableAlbumCard
                      key={album.id}
                      album={album}
                      onOpen={() => openAlbumDetail(album)}
                      onEdit={() => openEditModal(album)}
                      onDelete={() => handleDeleteAlbum(album)}
                      onToggleActive={() => toggleActive(album)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      {/* Section manager — add, rename, reorder, remove */}
      {showSectionManager && openAlbum && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSectionManager(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-[480px] border border-border/50 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border/50 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-foreground">Sections</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Filters visitors can tap inside <span className="font-semibold text-foreground">{openAlbum.couple}</span> — Haldi,
                  Mehendi, Sangeet, Reception…
                </p>
              </div>
              <button onClick={() => setShowSectionManager(false)} className="h-8 w-8 shrink-0 rounded-lg hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateSection(); } }}
                  placeholder="Haldi"
                  maxLength={80}
                  className="flex-1 h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50"
                />
                <Button
                  onClick={handleCreateSection}
                  disabled={isSectionBusy || !newSectionName.trim()}
                  className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-bold shrink-0"
                >
                  {isSectionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>

              {sections.length === 0 ? (
                <p className="text-[13px] text-muted-foreground text-center py-6">
                  No sections yet. Every photo shows under &ldquo;All&rdquo; until you add some.
                </p>
              ) : (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Drag to set the order visitors see
                  </p>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                    <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {sections.map(s => (
                          <SortableSectionRow
                            key={s.id}
                            section={s}
                            count={sectionCounts.counts.get(s.id) || 0}
                            onRename={(name) => handleRenameSection(s, name)}
                            onDelete={() => handleDeleteSection(s)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <p className="text-[12px] text-muted-foreground">
                    Removing a section keeps its photographs — they just become unsorted.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-[560px] border border-border/50 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{editingAlbum ? "Edit Album" : "New Album"}</h2>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Collection</label>
                  <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50">
                    {ALBUM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Album Title *</label>
                  <input type="text" value={form.couple} onChange={(e) => setForm(f => ({ ...f, couple: e.target.value }))} placeholder="Aarohi & Vedant"
                    className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Location</label>
                  <input type="text" value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Pune"
                    className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Date Label</label>
                  <input type="text" value={form.date_label} onChange={(e) => setForm(f => ({ ...f, date_label: e.target.value }))} placeholder="December 2025"
                    className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Description</label>
                <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                  placeholder="A two-day celebration at a heritage wada…"
                  className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none" />
              </div>
              {(form.type === "wedding" || form.type === "couple_shoot") && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                    {form.type === "wedding" ? "Wedding Film (optional)" : "Couple Film (optional)"}
                  </label>
                  <input type="text" value={form.film_youtube_id} onChange={(e) => setForm(f => ({ ...f, film_youtube_id: e.target.value }))}
                    placeholder="Paste a YouTube link, e.g. https://youtu.be/abc123…"
                    className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Shown inside this folder, below the photographs, on the {form.type === "wedding" ? "Weddings" : "Couple Shoots"} page. Paste a YouTube link or video ID — leave blank for no film.
                  </p>
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Cover Image {editingAlbum ? "(replace)" : "(optional — first photo is used if empty)"}
                </label>
                <label className="block cursor-pointer">
                  <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${coverPreview ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}>
                    {coverPreview ? (
                      <img src={coverPreview} alt="Cover preview" className="max-h-[160px] mx-auto rounded-lg object-contain" />
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
                {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : editingAlbum ? "Save Changes" : "Create Album"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ── Sortable album card ── */
function SortableAlbumCard({ album, onOpen, onEdit, onDelete, onToggleActive }: {
  album: Album;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: album.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}
      className={`dash-card overflow-hidden group ${isDragging ? "z-10 shadow-2xl opacity-90" : ""} ${!album.is_active ? "opacity-50" : ""}`}>
      <button onClick={onOpen} className="block w-full aspect-[3/2] bg-muted overflow-hidden relative cursor-pointer text-left">
        {album.cover_thumb || album.cover ? (
          <img src={assetUrl(album.cover_thumb || album.cover)} alt={album.couple}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-semibold">
          {album.photo_count} photo{album.photo_count === 1 ? "" : "s"}
        </span>
      </button>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onOpen} className="min-w-0 text-left cursor-pointer">
            <p className="text-[15px] font-bold text-foreground truncate">{album.couple}</p>
            <p className="text-[12px] text-muted-foreground truncate mt-0.5">
              {[album.location, album.date_label].filter(Boolean).join(" · ") || "—"}
            </p>
          </button>
          <span {...attributes} {...listeners} className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing" title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <button onClick={onToggleActive}
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${album.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-400"}`}>
            {album.is_active ? "Live" : "Hidden"}
          </button>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit album">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500" title="Delete album">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ── Section filter chip ── */
function SectionChip({ label, count, active, muted = false, onClick }: {
  label: string;
  count: number;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 pl-3 pr-2 rounded-full text-[12px] font-semibold flex items-center gap-2 border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : muted
            ? "bg-muted/30 text-muted-foreground border-border/50 hover:text-foreground"
            : "bg-card text-foreground border-border/50 hover:border-primary/40"
      }`}
    >
      <span className="truncate max-w-[160px]">{label}</span>
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-black/15" : "bg-muted"}`}>
        {count}
      </span>
    </button>
  );
}


/* ── Section row in the manager modal ── */
function SortableSectionRow({ section, count, onRename, onDelete }: {
  section: AlbumSection;
  count: number;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [draft, setDraft] = useState(section.name);

  // Follow renames that land from elsewhere (e.g. a failed save rolling back).
  const [lastName, setLastName] = useState(section.name);
  if (section.name !== lastName) {
    setLastName(section.name);
    setDraft(section.name);
  }

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-2 p-2 rounded-xl bg-muted/20 border border-border/50 ${isDragging ? "z-10 shadow-xl opacity-90" : ""}`}>
      <span {...attributes} {...listeners}
        className="h-8 w-7 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing"
        title="Drag to reorder">
        <GripVertical className="h-4 w-4" />
      </span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onRename(draft)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        maxLength={80}
        className="flex-1 min-w-0 h-8 px-2 bg-transparent border border-transparent hover:border-border/50 focus:border-primary/50 focus:bg-background rounded-lg text-sm font-semibold text-foreground focus:outline-none"
      />
      <span className="shrink-0 text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
        {count}
      </span>
      <button onClick={onDelete}
        className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
        title="Remove section (photos are kept)">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}


/* ── Sortable photo card ── */
function SortablePhotoCard({ photo, sectionName, showSectionBadge, selected, selectionMode, onToggleSelect, onDelete }: {
  photo: AlbumPhoto;
  sectionName?: string;
  showSectionBadge: boolean;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  // The card body stays the drag handle; the checkbox and delete button stop
  // pointer events so a click on them never starts a drag.
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`dash-card overflow-hidden group relative cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging ? "z-10 shadow-2xl opacity-90" : ""
      } ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="aspect-square bg-muted overflow-hidden">
        <img src={assetUrl(photo.thumbnail_path || photo.file_path)} alt=""
          className="w-full h-full object-cover" loading="lazy" draggable={false} />
      </div>

      {/* Select — always visible once a selection is running, so the bar can be trusted */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        onPointerDown={stop}
        className={`absolute top-2 left-2 h-7 w-7 rounded-lg flex items-center justify-center border transition-all shadow-sm ${
          selected
            ? "bg-primary text-primary-foreground border-primary opacity-100"
            : `bg-white/90 text-transparent border-white/60 hover:text-foreground ${selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`
        }`}
        title={selected ? "Deselect" : "Select"}>
        <Check className="h-4 w-4" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        onPointerDown={stop}
        className="absolute top-2 right-2 h-8 w-8 rounded-lg bg-white/90 text-foreground hover:bg-red-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm"
        title="Delete photo">
        <Trash2 className="h-4 w-4" />
      </button>

      {showSectionBadge && (
        <span className={`absolute bottom-2 left-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold truncate text-center ${
          sectionName ? "bg-black/60 text-white" : "bg-amber-500/85 text-white"
        }`}>
          {sectionName || "Unsorted"}
        </span>
      )}
    </div>
  );
}
