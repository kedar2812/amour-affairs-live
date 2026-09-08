/* ============================================================
   API.JS — Website ↔ CMS API bridge
   Amour Affairs · Premium Wedding Photography

   Fetches content published from the dashboard. Every helper
   is fail-safe: on any network/server problem it returns null
   so callers can keep the bundled fallback content — the site
   must never break because the API is unreachable.

   In production the API lives on the same domain (/api).
   For local development set VITE_API_URL in .env.development.
   ============================================================ */

import { postWithRetry } from './submit-retry.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// /uploads/... paths are served by the API host, not the Vite dev server
const ASSET_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

const FETCH_TIMEOUT_MS = 8000;

// The enquiry POST gets its own, longer budget. Content fetches are allowed to
// give up quickly because the page has bundled fallbacks; a booking enquiry has
// no fallback, so it waits — a visitor who pressed "Send" will wait 15s far more
// happily than they will retype the form.
const SUBMIT_TIMEOUT_MS = 15000;

/** Resolve an /uploads/... path returned by the API to a full URL. */
export function assetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${ASSET_ORIGIN}${path}`;
}

/** The PHP API stores text HTML-encoded — decode for JS rendering.
    PHP's ENT_QUOTES|ENT_HTML5 emits &apos; for apostrophes. */
function decodeEntities(value) {
  if (!value) return '';
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * GET a JSON endpoint with a hard timeout.
 * Returns the parsed body, or null on any failure.
 */
export async function fetchFromAPI(endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Submit a website inquiry to the leads pipeline.
 * Returns { ok: true, leadRef } on success,
 * { ok: false, error } on validation/rate-limit errors (error is user-safe),
 * { ok: false, error: null, unreachable: true } when it never landed.
 *
 * Transport faults and 5xx get retried with backoff (see submit-retry.js).
 * The server de-duplicates repeat submissions, so a retry after a response we
 * never saw returns the original lead rather than filing a second one.
 */
export async function submitInquiry(payload) {
  const attempt = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/leads.php?action=inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);

      if (response.ok) return { kind: 'ok', leadRef: data?.lead_ref || '' };

      // A readable reason from the server is the visitor's answer — show it,
      // don't retry it. Anything else (5xx, or a body we couldn't parse, which
      // is what an uncaught PHP fatal looks like) is worth another attempt.
      if (data && data.error) return { kind: 'rejected', status: response.status, error: data.error };
      return { kind: 'server-error', status: response.status };
    } catch {
      return { kind: 'transport-error' };
    } finally {
      clearTimeout(timer);
    }
  };

  const outcome = await postWithRetry(attempt);

  if (outcome.kind === 'ok') return { ok: true, leadRef: outcome.leadRef };
  if (outcome.kind === 'rejected') return { ok: false, error: outcome.error };
  return { ok: false, error: null, unreachable: true };
}

/**
 * Load albums for an archive page ('wedding' | 'couple_shoot' | 'premium_album'),
 * mapped to the shape archive-page.js expects. Returns the fallback when the
 * API is unreachable or has no usable albums yet.
 */
export async function loadArchiveAlbums(type, fallback) {
  const data = await fetchFromAPI(`albums.php?type=${type}&with_photos=1`);
  if (!data || !Array.isArray(data.albums)) return fallback;

  const albums = data.albums
    .filter((a) => Array.isArray(a.photos) && a.photos.length > 0)
    .map((a) => ({
      couple: decodeEntities(a.couple),
      location: decodeEntities(a.location),
      date: decodeEntities(a.date_label),
      description: decodeEntities(a.description),
      film: a.film_youtube_id || '',
      cover: assetUrl(a.cover),
      // Ritual/segment filters inside the folder (Haldi, Mehendi, …).
      // Empty for folders the studio hasn't sectioned — the archive page
      // then renders no filter row at all.
      sections: Array.isArray(a.sections)
        ? a.sections.map((s) => ({ id: Number(s.id), name: decodeEntities(s.name) }))
        : [],
      // Objects rather than bare URLs so each photo carries its section.
      // archive-page.js accepts both shapes, so the bundled fallback albums
      // (plain URL strings) keep working unchanged.
      photos: a.photos.map((p) => ({
        src: assetUrl(p.file_path),
        section: p.section_id == null ? null : Number(p.section_id),
      })),
    }));

  // An empty archive looks broken — keep the fallback until real albums exist
  return albums.length > 0 ? albums : fallback;
}

/**
 * Load the film library: { featured, gallery } or null.
 * `featured` is the "Now Showing" pool; `gallery` is every active film.
 */
export async function loadFilms() {
  const data = await fetchFromAPI('films.php');
  if (!data || !Array.isArray(data.films) || data.films.length === 0) return null;

  const films = data.films.map((f) => ({
    id: f.youtube_id,
    title: decodeEntities(f.title),
    type: decodeEntities(f.caption),
  }));

  const featured = data.films
    .filter((f) => Number(f.is_featured) === 1)
    .map((f) => ({
      id: f.youtube_id,
      title: decodeEntities(f.title),
      type: decodeEntities(f.caption),
    }));

  return { featured: featured.length > 0 ? featured : films, gallery: films };
}

/**
 * Load featured testimonials for the home carousel, or null.
 * `stockPhotos` fills in for testimonials saved without a photo.
 */
export async function loadTestimonials(stockPhotos = []) {
  const data = await fetchFromAPI('testimonials.php?featured=1');
  if (!data || !Array.isArray(data.testimonials) || data.testimonials.length === 0) return null;

  return data.testimonials.map((t, i) => ({
    quote: decodeEntities(t.review_text),
    name: decodeEntities(t.client_name),
    location: decodeEntities(t.city || t.event_type || ''),
    src: t.photo_path
      ? assetUrl(t.photo_path)
      : stockPhotos[i % Math.max(stockPhotos.length, 1)] || '',
  }));
}

/**
 * Load testimonials flagged for the weddings-page marquee, or null.
 * Mirrors the testimonials-page card shape ({ quote, name, location, src }).
 * Testimonials saved without a photo borrow a stock couple shot so every
 * marquee card keeps its image.
 */
export async function loadWeddingsTestimonials(stockPhotos = []) {
  const data = await fetchFromAPI('testimonials.php?weddings=1');
  if (!data || !Array.isArray(data.testimonials) || data.testimonials.length === 0) return null;

  return data.testimonials.map((t, i) => ({
    quote: decodeEntities(t.review_text),
    name: decodeEntities(t.client_name),
    location: decodeEntities(t.city || ''),
    src: t.photo_path
      ? assetUrl(t.photo_path)
      : stockPhotos[i % Math.max(stockPhotos.length, 1)] || '',
  }));
}

/**
 * Load every active testimonial grouped into marquee rows for the
 * Testimonials page, or null. Returns an array of rows (each an array
 * of { quote, name, location, src }) ordered by row number; empty rows
 * are dropped. Scroll direction is NOT part of the data — pages derive
 * it from row position so the alternating pattern can never break.
 * `stockPhotos` fills in for testimonials saved without a photo.
 */
export async function loadTestimonialRows(stockPhotos = []) {
  const data = await fetchFromAPI('testimonials.php');
  if (!data || !Array.isArray(data.testimonials) || data.testimonials.length === 0) return null;

  const byRow = new Map();
  data.testimonials.forEach((t, i) => {
    // The page renders two marquee rows — fold any higher row back in.
    const row = Math.min(2, Math.max(1, parseInt(t.marquee_row, 10) || 1));
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push({
      quote: decodeEntities(t.review_text),
      name: decodeEntities(t.client_name),
      location: decodeEntities(t.city || ''),
      src: t.photo_path
        ? assetUrl(t.photo_path)
        : stockPhotos[i % Math.max(stockPhotos.length, 1)] || '',
    });
  });

  const rows = [...byRow.keys()].sort((a, b) => a - b).map((k) => byRow.get(k));

  // A sparse marquee looks broken — keep the bundled archive until the
  // CMS holds a healthy amount of reviews.
  const total = rows.reduce((sum, r) => sum + r.length, 0);
  return total >= 9 ? rows : null;
}

/**
 * Load dashboard-editable website copy (settings group `site_content`),
 * or null. Values arrive HTML-encoded from the PHP API — they are
 * decoded here; keys ending in `_json` are parsed into objects.
 */
export async function loadSiteContent() {
  const data = await fetchFromAPI('settings.php?group=site_content');
  if (!data || !data.settings || typeof data.settings !== 'object') return null;

  const content = {};
  for (const [key, raw] of Object.entries(data.settings)) {
    const value = decodeEntities(raw);
    if (key.endsWith('_json')) {
      try { content[key] = JSON.parse(value); } catch { /* skip malformed */ }
    } else if (value !== '') {
      content[key] = value;
    }
  }
  return Object.keys(content).length > 0 ? content : null;
}

/**
 * Load the studio profile (settings group `profile`: studio_name, studio_email,
 * studio_phone, studio_whatsapp, studio_address, studio_map_embed), or null.
 * Drives the footer/contact details + map across every page so the client can
 * edit them once in the dashboard Settings and have the site update.
 */
export async function loadStudioProfile() {
  const data = await fetchFromAPI('settings.php?group=profile');
  if (!data || !data.settings || typeof data.settings !== 'object') return null;
  const p = {};
  for (const [key, raw] of Object.entries(data.settings)) {
    const value = decodeEntities(raw);
    if (value !== '') p[key] = value;
  }
  return Object.keys(p).length > 0 ? p : null;
}

/**
 * Load the urgency / booking-availability notice (settings group `notice`), or
 * null. Drives the site-wide announcement bar + the homepage floating badge.
 * Values arrive HTML-encoded from the PHP API and are decoded here. Returns
 * null on any failure so the site simply shows no notice.
 */
export async function loadNotice() {
  const data = await fetchFromAPI('settings.php?group=notice');
  if (!data || !data.settings || typeof data.settings !== 'object') return null;
  const n = {};
  for (const [key, raw] of Object.entries(data.settings)) {
    n[key] = decodeEntities(raw);
  }
  return Object.keys(n).length > 0 ? n : null;
}

/**
 * Load active FAQs grouped by category ({ before, during, after }), or null.
 * Each item is { question, answer }. Used to let the dashboard drive the FAQs
 * page; when null the page keeps its bundled (hardcoded) questions.
 */
export async function loadFaqs() {
  const data = await fetchFromAPI('faqs.php');
  if (!data || !Array.isArray(data.faqs) || data.faqs.length === 0) return null;

  const groups = { before: [], during: [], after: [] };
  data.faqs.forEach((f) => {
    const cat = ['before', 'during', 'after'].includes(f.category) ? f.category : 'before';
    const question = decodeEntities(f.question);
    const answer = decodeEntities(f.answer);
    if (question && answer) groups[cat].push({ question, answer });
  });

  const total = groups.before.length + groups.during.length + groups.after.length;
  return total > 0 ? groups : null;
}

/**
 * Load active team members (with photos) for the about-page marquee, or null.
 */
export async function loadTeam() {
  const data = await fetchFromAPI('team.php');
  if (!data || !Array.isArray(data.team)) return null;

  const members = data.team
    .filter((m) => m.photo_path)
    .map((m) => ({
      name: decodeEntities(m.name),
      role: decodeEntities(m.role),
      photo: assetUrl(m.photo_path),
    }));

  // Show whatever the studio has added — the marquee renderer repeats a small
  // roster to keep the scroll seamless, so even 1–3 members display instead of
  // silently falling back to the bundled placeholder cards.
  return members.length >= 1 ? members : null;
}
