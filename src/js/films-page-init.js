/* ============================================================
   FILMS-PAGE-INIT.JS — Dedicated init for Films page
   Amour Affairs · Premium Wedding Photography
   Lenis smooth-scroll, GSAP ScrollTrigger, random featured film
   ============================================================ */

// ── Styles ──
import '../styles/reset.css';
import '../styles/variables.css';
import '../styles/typography.css';
import '../styles/components.css';
import '../styles/sections/hero.css';
import '../styles/sections/contact.css';
import '../styles/sections/inquiry.css';
import '../styles/service-pages.css';
import '../styles/films-page.css';
import '../styles/buttons.css'; // unified button identity — must load last
import '../styles/section-headers.css'; // one section-header identity — must load after the page CSS
import './testimonial-marquee.js'; // shared "Words From Our Couples" marquee above the enquiry form (dashboard-driven)

// ── Libraries ──
import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ── Modules ──
import { initNav } from './nav.js';
import { initPreloader } from './animations.js';
import { initFooterTyping } from './footer-typing.js';
import { initLeadForm } from './lead-form.js';
import { loadFilms } from './api.js';

gsap.registerPlugin(ScrollTrigger);

// Start loading CMS films immediately — awaited during boot
const filmsPromise = loadFilms();

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


/* ═══════════════════════════════════════════════════════
   RANDOM FEATURED FILM
   ═══════════════════════════════════════════════════════ */

// Fallback pool when the CMS is unreachable
const FEATURED_FILMS = [
  { id: 'p38a2BZKXLQ', title: 'Annie & Shyam', type: 'Wedding Trailer' },
  { id: 'H-9VEi9q1NI', title: 'Taniya & Neeraj', type: 'Della Resorts, Lonavla' },
  { id: '53z3LB8dXo0', title: 'Neha & Gaurav', type: 'Wedding Teaser' },
  { id: 'gvlezU6RDC0', title: 'Medini & Abishal', type: 'Haldi Highlight' },
  { id: '8GXP7T-o72U', title: 'Annie & Shyam', type: 'Final Trailer' },
  { id: 'cHWYpSlPYE8', title: 'Disha & Kunal', type: 'Prewedding Film' },
];

function initFeaturedFilm(pool) {
  const iframe = document.getElementById('featuredIframe');
  const titleEl = document.getElementById('featuredTitle');
  const typeEl = document.getElementById('featuredType');

  if (!iframe) return;

  const film = pool[Math.floor(Math.random() * pool.length)];

  iframe.src = `https://www.youtube.com/embed/${film.id}?rel=0&modestbranding=1&color=white`;
  iframe.title = `${film.title} — ${film.type}`;

  if (titleEl) titleEl.textContent = film.title;
  if (typeEl) typeEl.textContent = film.type;
}


/* ═══════════════════════════════════════════════════════
   CMS GALLERY GRID
   Replaces the static fallback cards when films exist
   in the CMS. Must run before initVideoModal so the new
   cards get click handlers.
   ═══════════════════════════════════════════════════════ */

function renderFilmsGrid(films) {
  const grid = document.querySelector('.fpage-gallery__grid');
  if (!grid || !films.length) return;

  grid.innerHTML = films
    .map((film) => `
      <div class="fpage-card" data-video-id="${film.id}" role="button" tabindex="0">
        <div class="fpage-card__thumb">
          <img src="https://img.youtube.com/vi/${film.id}/maxresdefault.jpg" alt="${film.title.replace(/"/g, '&quot;')}" loading="lazy" />
          <div class="fpage-card__play"><svg viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19" fill="currentColor"/></svg></div>
        </div>
        <div class="fpage-card__body">
          <span class="fpage-card__title"></span>
          <span class="fpage-card__caption"></span>
        </div>
      </div>
    `)
    .join('');

  // Titles/captions as text — avoids HTML injection through CMS fields
  grid.querySelectorAll('.fpage-card').forEach((card, i) => {
    card.querySelector('.fpage-card__title').textContent = films[i].title;
    card.querySelector('.fpage-card__caption').textContent = films[i].type;
  });
}


/* ═══════════════════════════════════════════════════════
   ANIMATIONS
   ═══════════════════════════════════════════════════════ */

/* Hero entrance */
function initHeroReveal() {
  const tl = gsap.timeline({ delay: 0.3 });

  tl.from('.fpage-hero__eyebrow', {
    opacity: 0, y: -15, duration: 0.7, ease: 'power3.out',
  });

  tl.from('.fpage-hero__title', {
    opacity: 0, y: 30, duration: 1, ease: 'power3.out',
  }, '-=0.4');

  tl.from('.fpage-hero__sub', {
    opacity: 0, y: 20, duration: 0.8, ease: 'power3.out',
  }, '-=0.6');
}

/* Featured film reveal */
function initFeaturedReveal() {
  gsap.from('.fpage-featured__inner', {
    opacity: 0, y: 50, duration: 1.2, ease: 'power3.out',
    scrollTrigger: {
      trigger: '.fpage-featured',
      start: 'top 80%',
      toggleActions: 'play none none none',
    },
  });
}

/* Gallery cards stagger.
   Opacity-only (no y-transform): a `from` tween that moves `y` can leave an
   un-cleared translateY on individual cards after ScrollTrigger.refresh(),
   which knocks the 2-column grid cards out of vertical alignment. Fading in
   keeps the reveal without ever shifting layout. */
function initGalleryReveal() {
  gsap.from('.fpage-card', {
    opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12,
    clearProps: 'opacity',
    scrollTrigger: {
      trigger: '.fpage-gallery__grid',
      start: 'top 82%',
      toggleActions: 'play none none none',
    },
  });
}

/* Gallery section header */
function initGalleryHeaderReveal() {
  gsap.from('.fpage-gallery__header', {
    opacity: 0, y: 30, duration: 0.9, ease: 'power3.out',
    scrollTrigger: {
      trigger: '.fpage-gallery__header',
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
  });
}

/* CTA reveal */
function initCtaReveal() {
  gsap.from('.fpage-cta__label, .fpage-cta__heading, .fpage-cta__btn', {
    opacity: 0, y: 25, duration: 0.9, ease: 'power2.out', stagger: 0.15,
    scrollTrigger: {
      trigger: '.fpage-cta',
      start: 'top 80%',
      toggleActions: 'play none none none',
    },
  });
}

/* Nav scroll behavior */
function initPageNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  function updateNav() {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();
}


/* ═══════════════════════════════════════════════════════
   VIDEO MODAL
   ═══════════════════════════════════════════════════════ */

function initVideoModal() {
  const modal = document.getElementById('videoModal');
  const modalIframe = document.getElementById('modalIframe');
  const closeBtn = modal?.querySelector('.fpage-modal__close');
  const backdrop = modal?.querySelector('.fpage-modal__backdrop');

  if (!modal || !modalIframe) return;

  function openModal(videoId) {
    modalIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
    lenis.stop();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    lenis.start();
    // Clear iframe after transition to stop playback
    setTimeout(() => { modalIframe.src = ''; }, 400);
  }

  // Card clicks
  document.querySelectorAll('.fpage-card[data-video-id]').forEach(card => {
    card.addEventListener('click', () => {
      openModal(card.dataset.videoId);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(card.dataset.videoId);
      }
    });
  });

  // Close handlers
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });
}


/* ═══════════════════════════════════════════════════════
   BOOT SEQUENCE
   ═══════════════════════════════════════════════════════ */

async function init() {
  // Hide the preloader FIRST — never gate it on the CMS API (a slow/failed
  // request must not hold the whole page on the loading screen).
  await initPreloader();
  initNav(lenis);
  initPageNav();
  // CMS film library, or null to keep the static fallback markup
  let cms = null;
  try { cms = await filmsPromise; } catch (e) { console.error('films CMS', e); }
  if (cms) renderFilmsGrid(cms.gallery);
  initFeaturedFilm(cms ? cms.featured : FEATURED_FILMS);
  initVideoModal();
  initHeroReveal();
  initFeaturedReveal();
  initGalleryHeaderReveal();
  initGalleryReveal();
  initCtaReveal();
  initFooterTyping();
  initLeadForm();

  ScrollTrigger.refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
