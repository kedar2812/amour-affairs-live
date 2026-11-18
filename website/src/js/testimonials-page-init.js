/* ============================================================
   TESTIMONIALS-PAGE-INIT.JS — Dedicated init for Testimonials page
   Amour Affairs · Premium Wedding Photography
   Lenis smooth-scroll, GSAP ScrollTrigger, minimal animations
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
import '../styles/testimonials-page.css';
import '../styles/buttons.css'; // unified button identity — must load last
import '../styles/section-headers.css'; // one section-header identity — must load after the page CSS

// ── Libraries ──
import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ── Modules ──
import { initNav } from './nav.js';
import { initPreloader } from './animations.js';
import { initLeadForm } from './lead-form.js';
import { marqueeRowHTML } from './testimonial-cards.js';
import { fallbackTestimonialRows } from './testimonials-page-data.js';
import { loadTestimonialRows } from './api.js';

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════
   MARQUEE ROWS
   CMS rows when available, bundled archive otherwise.
   Direction alternates by row position (left, right, left, ...)
   inside marqueeRowHTML — never stored, never breakable.
   ═══════════════════════════════════════════════════════ */

// Stock couple photos stand in for CMS testimonials saved without one
const STOCK_PHOTOS = fallbackTestimonialRows.flat().map((t) => t.src);

function renderMarqueeRows(rows) {
  const mount = document.getElementById('testiRows');
  if (!mount) return;
  mount.innerHTML = rows
    .filter((row) => row.length > 0)
    .map((row, i) => marqueeRowHTML(row, i))
    .join('');
}

// Paint the bundled archive immediately so the page never looks empty…
renderMarqueeRows(fallbackTestimonialRows);

// …then swap in the CMS rows once (and if) they arrive.
loadTestimonialRows(STOCK_PHOTOS)
  .then((rows) => {
    if (rows) {
      renderMarqueeRows(rows);
      ScrollTrigger.refresh();
    }
  })
  .catch(() => { /* fallback already on screen */ });

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
   ANIMATIONS
   ═══════════════════════════════════════════════════════ */

/* Hero entrance */
function initHeroReveal() {
  const tl = gsap.timeline({ delay: 0.3 });

  tl.from('.tpage-hero__title', {
    opacity: 0, y: 30, duration: 1, ease: 'power3.out',
  });

  tl.from('.tpage-hero__sub', {
    opacity: 0, y: 20, duration: 0.8, ease: 'power3.out',
  }, '-=0.6');
}

/* CTA reveal */
function initCtaReveal() {
  gsap.from('.tpage-cta__label, .tpage-cta__heading, .tpage-cta__btn', {
    opacity: 0, y: 25, duration: 0.9, ease: 'power2.out', stagger: 0.15,
    scrollTrigger: {
      trigger: '.tpage-cta',
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
   BOOT SEQUENCE
   ═══════════════════════════════════════════════════════ */

async function init() {
  await initPreloader();
  initNav(lenis);
  initPageNav();
  initHeroReveal();
  initCtaReveal();
  initLeadForm();

  ScrollTrigger.refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
