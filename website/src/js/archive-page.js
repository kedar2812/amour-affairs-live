/* ============================================================
   ARCHIVE-PAGE.JS — Shared "folder archive" page behaviour
   Amour Affairs · Premium Wedding Photography

   Used by the Weddings and Couple Shoots pages: renders the
   folder card grid, drives the full-page album view and the
   photo lightbox, and runs the standard page animations.

   The page supplies its albums data and a class prefix
   (e.g. 'wpage' / 'cpage'); element IDs are shared across
   pages (archiveGrid, albumOverlay, lightbox, ...).
   ============================================================ */

import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initNav } from './nav.js';
import { initPreloader } from './animations.js';
import { photoSrc, usableSections, filterPhotos } from './album-sections.js';
import { responsiveAttrs } from './api.js';

gsap.registerPlugin(ScrollTrigger);

const pad2 = (n) => String(n + 1).padStart(2, '0');

// "Aarohi & Vedant" → "Aarohi <em>&</em> Vedant"
const formatCouple = (couple) => couple.replace(' & ', ' <em>&amp;</em> ');

// CMS albums may omit location or date — join whatever exists
const albumMeta = (album) =>
  [album.location, album.date, `${album.photos.length} Photographs`]
    .filter(Boolean)
    .join(' &middot; ');

const escapeAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Normalise a YouTube URL or bare ID to its 11-char video id ('' if none)
const youtubeId = (input) => {
  if (!input) return '';
  const s = String(input).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
};

export function initArchivePage({
  albums,
  prefix,
  onReady,
  folderWord = 'Folder',
  openWord = 'Open Folder',
  filmLabel = 'The Wedding Film',
  photoWord = 'wedding photography',
  cardChip = true, // show the "Folder 01" chip on each grid thumbnail
  cardMetaMode = 'full', // 'full' = location · date · count; 'location' = location only
}) {
  const p = prefix;

  // Descriptive, truthful alt text: couple + service + real shoot location
  // (e.g. "Aarohi & Vedant — wedding photography at The Corinthians, Pune").
  const altFor = (album) =>
    `${album.couple} — ${photoWord}${album.location ? ` at ${album.location}` : ''}`;

  // ── Lenis Smooth Scroll ──
  const lenis = new Lenis({
    duration: 1.4,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    smoothWheel: true,
    touchMultiplier: 2,
  });

  window.__lenis = lenis;

  gsap.ticker.add((time) => { lenis.raf(time * 1000); });

  lenis.on('scroll', () => { ScrollTrigger.update(); });

  ScrollTrigger.scrollerProxy(document.body, {
    scrollTop(value) {
      if (arguments.length) lenis.scrollTo(value, { immediate: true });
      return lenis.scroll;
    },
    getBoundingClientRect() {
      return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    },
    pinType: document.body.style.transform ? 'transform' : 'fixed',
  });

  ScrollTrigger.addEventListener('refresh', () => lenis.resize());
  ScrollTrigger.defaults({ scroller: document.body });

  // ── Elements ──
  const albumView = document.getElementById('albumOverlay');
  const albumScroll = document.getElementById('albumOverlayScroll');
  const masonry = document.getElementById('albumMasonry');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCounter = document.getElementById('lightboxCounter');

  let currentAlbumIndex = -1;
  let currentPhotoIndex = 0;
  let lastFocusedCard = null;
  // The photographs actually on screen — the whole album, or one section of it.
  // The lightbox walks this list, so prev/next never jump to a hidden photo.
  let currentPhotos = [];
  let currentFilter = 'all';

  /* ── Folder grid ── */

  function renderArchive() {
    const grid = document.getElementById('archiveGrid');
    if (!grid) return;

    grid.innerHTML = albums
      .map((album, i) => {
        const chip = cardChip ? `<span class="${p}-card__chip">${folderWord} ${pad2(i)}</span>` : '';
        const caption = cardMetaMode === 'location' ? (album.location || '') : albumMeta(album);
        return `
        <article class="${p}-card" data-album="${i}" tabindex="0" role="button"
                 aria-label="${openWord}: ${album.couple}">
          <div class="${p}-card__thumb">
            <img ${responsiveAttrs(album.cover, '(max-width: 600px) 92vw, (max-width: 1024px) 46vw, 31vw')} alt="${altFor(album)}" ${i < 3 ? `loading="eager"${i === 0 ? ' fetchpriority="high"' : ''}` : 'loading="lazy"'} decoding="async" />
            ${chip}
            <span class="${p}-card__open">${openWord} <span aria-hidden="true">&#8594;</span></span>
          </div>
          <div class="${p}-card__body">
            <span class="${p}-card__title">${formatCouple(album.couple)}</span>
            ${caption ? `<span class="${p}-card__caption">${caption}</span>` : ''}
          </div>
        </article>
      `;
      })
      .join('');

    grid.querySelectorAll(`.${p}-card`).forEach((card) => {
      const open = () => openAlbum(Number(card.dataset.album), card);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  /* ── Folder film (optional) ──
     Shown below the photographs — the images are the folder's main
     content, the film follows them. Renders a lightweight click-to-play
     facade so YouTube's player is only loaded when the visitor actually
     wants to watch. Returns true when a film was shown. Safe on pages
     without a #overlayFilm slot. */
  function renderAlbumFilm(album) {
    const wrap = document.getElementById('overlayFilm');
    if (!wrap) return false;

    const id = youtubeId(album && album.film);
    if (!id) {
      wrap.hidden = true;
      wrap.innerHTML = '';
      return false;
    }

    wrap.hidden = false;
    wrap.innerHTML = `
      <span class="${p}-album__film-label">${filmLabel}</span>
      <button class="${p}-album__film-frame" type="button"
              aria-label="Play the film for ${album.couple}">
        <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" />
        <span class="${p}-album__film-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </button>`;

    const frame = wrap.querySelector(`.${p}-album__film-frame`);
    frame.addEventListener('click', () => {
      const player = document.createElement('div');
      player.className = `${p}-album__film-frame ${p}-album__film-frame--playing`;
      player.innerHTML = `
        <iframe
          src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1"
          title="Film for ${album.couple}"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>`;
      frame.replaceWith(player);
    });

    return true;
  }

  /* ── Section filters (Haldi, Mehendi, Sangeet…) ──
     The row is built once and reused; it lives directly above the masonry and
     is hidden entirely for folders the studio hasn't sectioned. */

  let filterRow = null;

  function ensureFilterRow() {
    if (filterRow || !masonry || !masonry.parentNode) return filterRow;
    filterRow = document.createElement('div');
    filterRow.className = `${p}-album__filters`;
    filterRow.setAttribute('role', 'group');
    filterRow.setAttribute('aria-label', 'Filter photographs by ritual');
    masonry.parentNode.insertBefore(filterRow, masonry);
    return filterRow;
  }

  function renderFilters(album) {
    const sections = usableSections(album);
    const row = ensureFilterRow();
    if (!row) return sections;

    if (sections.length === 0) {
      row.hidden = true;
      row.innerHTML = '';
      return sections;
    }

    row.hidden = false;
    const chip = (key, label, count, isActive) => `
      <button class="${p}-album__filter${isActive ? ' is-active' : ''}"
              type="button" data-filter="${escapeAttr(key)}" aria-pressed="${isActive}">
        ${escapeAttr(label)} <span class="${p}-album__filter-count">${count}</span>
      </button>`;

    row.innerHTML = [
      chip('all', 'All', album.photos.length, currentFilter === 'all'),
      ...sections.map((s) => chip(String(s.id), s.name, s.count, currentFilter === String(s.id))),
    ].join('');

    row.querySelectorAll(`.${p}-album__filter`).forEach((btn) => {
      btn.addEventListener('click', () => applyFilter(album, btn.dataset.filter));
    });
    return sections;
  }

  /** Switch the visible set without reopening the folder. */
  function applyFilter(album, key) {
    if (currentFilter === key) return;
    currentFilter = key;

    const row = filterRow;
    if (row) {
      row.querySelectorAll(`.${p}-album__filter`).forEach((btn) => {
        const on = btn.dataset.filter === key;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', String(on));
      });
    }

    renderMasonry(album);
    gsap.fromTo(
      `.${p}-album__photo`,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.035, duration: 0.6, ease: 'power3.out' }
    );
  }

  /** Paint the masonry from the current filter and cache the visible list. */
  function renderMasonry(album) {
    currentPhotos = filterPhotos(album, currentFilter);

    masonry.innerHTML = currentPhotos
      .map((photo, i) => `
        <button class="${p}-album__photo" data-photo="${i}" aria-label="View photograph ${i + 1} of ${escapeAttr(album.couple)}">
          <img ${responsiveAttrs(photoSrc(photo), '(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw')} alt="${escapeAttr(altFor(album))} — photograph ${i + 1}" loading="lazy" decoding="async" />
        </button>
      `)
      .join('');

    masonry.querySelectorAll(`.${p}-album__photo`).forEach((btn) => {
      btn.addEventListener('click', () => openLightbox(Number(btn.dataset.photo)));
    });
  }

  /* ── Album view (the opened folder) ── */

  function openAlbum(index, sourceCard = null) {
    const album = albums[index];
    if (!album || !albumView) return;

    currentAlbumIndex = index;
    if (sourceCard) lastFocusedCard = sourceCard;

    const folderLabel = document.getElementById('overlayFolderLabel');
    if (folderLabel) folderLabel.textContent = `${folderWord} ${pad2(index)}`;
    document.getElementById('overlayTitle').innerHTML = formatCouple(album.couple);
    document.getElementById('overlayMeta').innerHTML = albumMeta(album);
    document.getElementById('overlayDesc').textContent = album.description;

    const hasFilm = renderAlbumFilm(album);

    const next = albums[(index + 1) % albums.length];
    document.getElementById('overlayNext').innerHTML =
      `${next.couple} <span aria-hidden="true">&#8594;</span>`;

    // Every folder opens on "All" — a remembered filter from the previous
    // folder would silently hide photographs here.
    currentFilter = 'all';
    renderFilters(album);
    renderMasonry(album);

    albumScroll.scrollTop = 0;
    albumView.classList.add('is-open');
    albumView.setAttribute('aria-hidden', 'false');
    lenis.stop();

    gsap.fromTo(
      `.${p}-album__head > *`,
      { y: 26, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.08, duration: 0.8, ease: 'power3.out', delay: 0.15 }
    );
    gsap.fromTo(
      `.${p}-album__photo`,
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.05, duration: 0.85, ease: 'power3.out', delay: 0.3 }
    );
    if (hasFilm) {
      // The film sits below the photographs — reveal it after them
      gsap.fromTo(
        '#overlayFilm',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, ease: 'power3.out', delay: 0.5 }
      );
    }

    document.getElementById('overlayClose').focus({ preventScroll: true });
  }

  function closeAlbum() {
    if (!albumView || !albumView.classList.contains('is-open')) return;
    albumView.classList.remove('is-open');
    albumView.setAttribute('aria-hidden', 'true');
    currentAlbumIndex = -1;
    lenis.start();
    if (lastFocusedCard) lastFocusedCard.focus({ preventScroll: true });
  }

  /* ── Photo lightbox ── */

  // Walks the *visible* set, so with a section filter on, prev/next stay
  // inside that ritual and the counter reads "3 / 12", not "3 / 240".
  function showPhoto(index) {
    const album = albums[currentAlbumIndex];
    if (!album || currentPhotos.length === 0) return;
    const total = currentPhotos.length;
    currentPhotoIndex = ((index % total) + total) % total;
    lightboxImg.src = photoSrc(currentPhotos[currentPhotoIndex]);
    lightboxImg.alt = `${album.couple} — photograph ${currentPhotoIndex + 1}`;
    lightboxCounter.textContent = `${currentPhotoIndex + 1} / ${total}`;
    gsap.fromTo(lightboxImg, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
  }

  function openLightbox(index) {
    showPhoto(index);
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
  }

  function initOverlayControls() {
    if (!albumView || !lightbox) return;

    document.getElementById('overlayClose').addEventListener('click', closeAlbum);
    document.getElementById('overlayNext').addEventListener('click', () => {
      openAlbum((currentAlbumIndex + 1) % albums.length);
    });

    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    document.getElementById('lightboxPrev').addEventListener('click', () => showPhoto(currentPhotoIndex - 1));
    document.getElementById('lightboxNext').addEventListener('click', () => showPhoto(currentPhotoIndex + 1));
    lightbox.querySelector(`.${p}-lightbox__backdrop`).addEventListener('click', closeLightbox);

    document.addEventListener('keydown', (e) => {
      if (lightbox.classList.contains('is-open')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') showPhoto(currentPhotoIndex - 1);
        if (e.key === 'ArrowRight') showPhoto(currentPhotoIndex + 1);
        return;
      }
      if (albumView.classList.contains('is-open') && e.key === 'Escape') closeAlbum();
    });
  }

  /* ── Animations ── */

  function initHeroEntrance() {
    const tl = gsap.timeline({ delay: 0.15 });

    tl.from(`.${p}-hero__eyebrow`, {
      y: 20, opacity: 0, duration: 1.0, ease: 'power3.out'
    });
    tl.from(`.${p}-hero__title`, {
      y: 35, opacity: 0, duration: 1.2, ease: 'power3.out'
    }, '-=0.7');
    tl.from(`.${p}-hero__sub`, {
      y: 20, opacity: 0, duration: 1.0, ease: 'power3.out'
    }, '-=0.7');
  }

  function initScrollReveals() {
    if (document.querySelector(`.${p}-archive__header`)) {
      gsap.from(`.${p}-archive__header > *`, {
        scrollTrigger: {
          trigger: `.${p}-archive`,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        y: 30,
        opacity: 0,
        stagger: 0.12,
        duration: 1.0,
        ease: 'power2.out'
      });
    }

    gsap.utils.toArray(`.${p}-card`).forEach((card) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: 'top 95%',
          toggleActions: 'play none none none',
        },
        y: 45,
        opacity: 0,
        duration: 1.0,
        ease: 'power3.out'
      });
    });

    if (document.querySelector(`.${p}-cta`)) {
      gsap.from(`.${p}-cta > *`, {
        scrollTrigger: {
          trigger: `.${p}-cta`,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        y: 35,
        opacity: 0,
        stagger: 0.15,
        duration: 1.0,
        ease: 'power2.out'
      });
    }
  }

  /* ── Boot sequence ── */

  async function init() {
    renderArchive();
    initOverlayControls();
    await initPreloader();
    initNav(lenis);
    initHeroEntrance();
    initScrollReveals();
    if (typeof onReady === 'function') onReady({ gsap, ScrollTrigger, lenis });
    ScrollTrigger.refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
