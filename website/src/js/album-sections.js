/* ============================================================
   ALBUM-SECTIONS.JS — Folder section (ritual) filtering
   Amour Affairs · Premium Wedding Photography

   Pure helpers behind the "Haldi / Mehendi / Sangeet" filters
   inside an opened folder. Kept free of DOM and GSAP so the
   rules can be reasoned about — and tested — on their own:
     node src/js/album-sections.test.mjs
   ============================================================ */

/* Photo shape — CMS albums deliver { src, section }; the bundled fallback
   albums are plain URL strings. Every reader goes through these two, so both
   shapes work and neither data file has to know about the other. */
export const photoSrc = (photo) => (typeof photo === 'string' ? photo : photo.src);

export const photoSection = (photo) =>
  (typeof photo === 'string' ? null : (photo.section ?? null));

/**
 * The sections worth offering as filters: named, and holding at least one
 * photograph. An empty section would be a chip that leads to a blank wall,
 * which is worse than no chip at all.
 * Returns each section with its `count`.
 */
export function usableSections(album) {
  if (!album || !Array.isArray(album.sections) || album.sections.length === 0) return [];
  const photos = Array.isArray(album.photos) ? album.photos : [];

  const counts = new Map();
  photos.forEach((p) => {
    const id = photoSection(p);
    if (id != null) counts.set(String(id), (counts.get(String(id)) || 0) + 1);
  });

  return album.sections
    .filter((s) => s && s.name && counts.get(String(s.id)) > 0)
    .map((s) => ({ ...s, count: counts.get(String(s.id)) }));
}

/**
 * Photographs visible under a filter key. 'all' returns everything —
 * including unsorted photos, which must never become unreachable just
 * because some of their siblings were filed into a section.
 * An unknown key falls back to the full album rather than an empty wall.
 */
export function filterPhotos(album, key) {
  const photos = (album && Array.isArray(album.photos)) ? album.photos : [];
  if (!key || key === 'all') return photos;

  const match = photos.filter((p) => String(photoSection(p)) === String(key));
  return match.length > 0 ? match : photos;
}
