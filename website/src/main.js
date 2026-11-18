/* ============================================================
   MAIN.JS — Entry Point
   Amour Affairs · Premium Wedding Photography
   Initializes: Lenis, GSAP, ScrollTrigger, all modules
   ============================================================ */

// ── Styles ──
import './styles/reset.css';
import './styles/variables.css';
import './styles/typography.css';
import './styles/components.css';
import './styles/sections/hero.css';
import './styles/sections/about.css';
import './styles/sections/services.css';
import './styles/sections/process.css';
import './styles/sections/gallery.css';
import './styles/sections/press.css';
import './styles/sections/testimonials.css';
import './styles/sections/inquiry.css';
import './styles/sections/contact.css';
import './styles/buttons.css'; // unified button identity — must load last
import './styles/section-headers.css'; // one section-header identity — must load after the page CSS
import './js/checklist-cta.js'; // free Pune checklist lead magnet — binds [data-checklist-open] + injects the popup

// ── Libraries ──
import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ── Modules ──
import { initNav } from './js/nav.js';
import { initHero } from './js/hero.js';
import { initHeroCanvas, primeHeroFrames } from './js/hero-canvas.js';
import { initPreloader, initAllAnimations, initCounters } from './js/animations.js';
import { initInstagramFeed } from './js/gallery.js';
import { initFooterTyping } from './js/footer-typing.js';
import { initTestimonials } from './js/testimonials.js';
import { initLeadForm } from './js/lead-form.js';
import { loadSiteContent } from './js/api.js';
import { applyHomeStats } from './js/site-content.js';

// ── Register GSAP Plugins ──
gsap.registerPlugin(ScrollTrigger);

// Start the hero frame downloads now, so they overlap the preloader.
primeHeroFrames();

// ── Initialize Lenis Smooth Scroll ──
const lenis = new Lenis({
  duration: 1.4,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: 'vertical',
  smoothWheel: true,
  touchMultiplier: 2,
});

// Store globally for other modules
window.__lenis = lenis;

// CRITICAL: Connect Lenis to GSAP ticker
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

// CRITICAL: Lenis + ScrollTrigger integration for pinned sections
lenis.on('scroll', () => {
  ScrollTrigger.update();
});

// Tell ScrollTrigger to use Lenis scroll values
ScrollTrigger.scrollerProxy(document.body, {
  scrollTop(value) {
    if (arguments.length) {
      lenis.scrollTo(value, { immediate: true });
    }
    return lenis.scroll;
  },
  getBoundingClientRect() {
    return {
      top: 0, left: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  },
  pinType: document.body.style.transform ? 'transform' : 'fixed',
});

ScrollTrigger.addEventListener('refresh', () => lenis.resize());
ScrollTrigger.defaults({ scroller: document.body });

// ── Boot Sequence ──
async function init() {
  // 1. Run preloader animation
  await initPreloader();

  // 2. Initialize navigation
  initNav(lenis);

  // 3. 3D canvas scroll sequence (couple model). Its scroll pin is created
  //    synchronously, so later ScrollTriggers measure the pinned layout; the
  //    promise only waits for the first frame, so nothing below waits on it.
  const heroReady = initHeroCanvas();

  // 3.5. Hero "Scroll" cue
  initHero();

  // 4. Initialize all scroll-triggered animations
  initAllAnimations();

  // 5. Initialize custom Instagram feed
  initInstagramFeed();

  // 5.5. Initialize testimonials carousel
  initTestimonials();

  // 5.6. Initialize inquiry form (lead capture)
  initLeadForm();

  // 6. Init footer typing effect
  initFooterTyping();

  // 7. Refresh ScrollTrigger after everything is set up (and again once the
  //    hero's first frame is drawn)
  ScrollTrigger.refresh();
  await heroReady;
  ScrollTrigger.refresh();
}

// ── DOM Ready ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ── Homepage "by the numbers" strip — dashboard-editable ──
// Loaded independently of the boot chain above so the figures resolve even if
// the heavy hero-canvas preload is slow or fails. index.html already ships the
// real numbers; this applies any dashboard overrides and re-arms the count-up
// with the final targets. Fully fail-safe: on any error the baked values stand.
loadSiteContent()
  .then((content) => {
    if (content) applyHomeStats(content);
    initCounters();
  })
  .catch(() => {});

// ── About globe — lazy, and only once it is near the viewport ──
// Code-split so the renderer never lands in the initial bundle, and mounted
// only when the section approaches: the headline must paint (and be the LCP
// element) long before any canvas work starts.
(() => {
  const canvas = document.getElementById('aboutGlobe');
  if (!canvas) return;

  const mount = () => {
    import('./js/globe.js')
      .then(({ initGlobe }) => initGlobe())
      .catch(() => {}); // section reads fine without it
  };

  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    mount();
  }, { rootMargin: '400px 0px' });

  window.addEventListener('load', () => io.observe(canvas));
})();
