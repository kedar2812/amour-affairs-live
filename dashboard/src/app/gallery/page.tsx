"use client";

import React, { useState, useCallback } from "react";
import { Search, Plus, Upload, Trash2, Star, GripVertical, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { galleryAPI, assetUrl } from "@/lib/api";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "wedding", label: "Weddings" },
  { value: "couple_shoot", label: "Couples" },
  { value: "film", label: "Films" },
  { value: "premium_album", label: "Albums" },
  { value: "general", label: "General" },
];

interface GalleryImage {
  id: number;
  category: string;
  title: string;
  caption: string;
  file_path: string;
  thumbnail_path: string;
  is_featured: number;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  React.useEffect(() => { const q = new URLSearchParams(window.location.search).get("q"); if (q) setSearchQuery(q); }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [error, setError] = useState("");

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadCategory, setUploadCategory] = useState("wedding");
  const [uploadFeatured, setUploadFeatured] = useState(false);

  // Fetch images
  const fetchImages = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await galleryAPI.list({ category: activeCategory || undefined, all: true });
      setImages((res as { images: GalleryImage[] }).images || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load images");
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory]);

  React.useEffect(() => { fetchImages(); }, [fetchImages]);

  const filteredImages = images.filter(img =>
    (img.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (img.caption || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 64 * 1024 * 1024) { setError("File must be under 64MB"); return; }
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
  };

  // Handle upload
  const handleUpload = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("image", uploadFile);
      formData.append("title", uploadTitle);
      formData.append("caption", uploadCaption);
      formData.append("category", uploadCategory);
      formData.append("is_featured", uploadFeatured ? "1" : "0");
      await galleryAPI.upload(formData);
      setShowUploadModal(false);
      resetUploadForm();
      fetchImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadPreview("");
    setUploadTitle("");
    setUploadCaption("");
    setUploadCategory("wedding");
    setUploadFeatured(false);
  };

  // Toggle featured
  const toggleFeatured = async (img: GalleryImage) => {
    try {
      await galleryAPI.update(img.id, { is_featured: img.is_featured ? 0 : 1 });
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, is_featured: i.is_featured ? 0 : 1 } : i));
    } catch (err) { setError(err instanceof Error ? err.message : "Update failed"); }
  };

  // Toggle active
  const toggleActive = async (img: GalleryImage) => {
    try {
      await galleryAPI.update(img.id, { is_active: img.is_active ? 0 : 1 });
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, is_active: i.is_active ? 0 : 1 } : i));
    } catch (err) { setError(err instanceof Error ? err.message : "Update failed"); }
  };

  // Delete
  const handleDelete = async (img: GalleryImage) => {
    if (!confirm(`Delete "${img.title || "this image"}"?`)) return;
    try {
      await galleryAPI.delete(img.id);
      setImages(prev => prev.filter(i => i.id !== img.id));
    } catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  };

  const getCategoryLabel = (val: string) => CATEGORIES.find(c => c.value === val)?.label || val;

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="dash-h1">Gallery</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Manage your portfolio images across all categories.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search images..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-[220px] pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <Button onClick={() => setShowUploadModal(true)} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm">
            <Upload className="h-4 w-4 mr-2" /> Upload
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium flex items-center justify-between">
          {error}
          <button onClick={() => setError("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-1 bg-card/50 border border-border/50 p-1 rounded-xl w-max">
        {CATEGORIES.map(cat => (
          <button key={cat.value} onClick={() => setActiveCategory(cat.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === cat.value ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold text-foreground">No images yet</p>
          <p className="text-sm text-muted-foreground mt-1">Upload your first image to get started.</p>
          <Button onClick={() => setShowUploadModal(true)} className="mt-4 rounded-xl bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Upload Image
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
          {filteredImages.map(img => (
            <div key={img.id} className={`dash-card overflow-hidden group relative ${!img.is_active ? "opacity-50" : ""}`}>
              <div className="aspect-[4/3] bg-muted overflow-hidden relative">
                <img src={assetUrl(img.thumbnail_path || img.file_path)} alt={img.title || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                {/* Overlay controls */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button onClick={() => toggleFeatured(img)}
                    className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all ${img.is_featured ? "bg-amber-500 text-white" : "bg-white/90 text-foreground hover:bg-amber-500 hover:text-white"}`}>
                    <Star className="h-4 w-4" fill={img.is_featured ? "currentColor" : "none"} />
                  </button>
                  <button onClick={() => handleDelete(img)} className="h-9 w-9 rounded-lg bg-white/90 text-foreground hover:bg-red-500 hover:text-white flex items-center justify-center transition-all">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {img.is_featured ? <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center"><Star className="h-3 w-3 text-white" fill="currentColor" /></div> : null}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase text-primary">{getCategoryLabel(img.category)}</span>
                  <button onClick={() => toggleActive(img)} className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${img.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-400"}`}>
                    {img.is_active ? "Active" : "Hidden"}
                  </button>
                </div>
                {img.title && <p className="text-sm font-semibold text-foreground truncate">{img.title}</p>}
                {img.caption && <p className="text-[12px] text-muted-foreground truncate mt-0.5">{img.caption}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowUploadModal(false); resetUploadForm(); }} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-[520px] border border-border/50 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Upload Image</h2>
              <button onClick={() => { setShowUploadModal(false); resetUploadForm(); }} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Drop zone */}
              <label className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${uploadPreview ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}>
                  {uploadPreview ? (
                    <img src={uploadPreview} alt="Preview" className="max-h-[200px] mx-auto rounded-lg object-contain" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-semibold text-foreground">Click to upload</p>
                      <p className="text-[12px] text-muted-foreground mt-1">JPEG, PNG, WebP, GIF — max 64MB</p>
                    </>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              </label>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Title</label>
                <input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Image title (optional)"
                  className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Caption</label>
                <input type="text" value={uploadCaption} onChange={(e) => setUploadCaption(e.target.value)} placeholder="Short caption (optional)"
                  className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Category</label>
                  <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50">
                    {CATEGORIES.filter(c => c.value).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 h-10 cursor-pointer">
                    <input type="checkbox" checked={uploadFeatured} onChange={(e) => setUploadFeatured(e.target.checked)} className="rounded border-border" />
                    <span className="text-sm font-medium text-foreground">Featured</span>
                  </label>
                </div>
              </div>
              <Button onClick={handleUpload} disabled={!uploadFile || isUploading} className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold">
                {isUploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading...</> : "Upload Image"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
