/* ============================================================
   CONTACT-INIT.JS — Dedicated init for the Contact page
   Amour Affairs · Premium Wedding Photography
   Beige hero + direct-contact cards + enquiry form + map.
   Reuses the shared nav, footer, lead form and studio-profile
   wiring; contact details stay editable from the dashboard.
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
import '../styles/contact-page.css';
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
import { initLeadForm } from './lead-form.js';

gsap.registerPlugin(ScrollTrigger);

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


/* ── Hero entrance (plays once on load) ── */
function initHeroEntrance() {
  const tl = gsap.timeline({ delay: 0.15 });
  tl.from('.contact-hero__eyebrow', { y: 20, opacity: 0, duration: 1.0, ease: 'power3.out' });
  tl.from('.contact-hero__title', { y: 34, opacity: 0, duration: 1.2, ease: 'power3.out' }, '-=0.7');
  tl.from('.contact-hero__sub', { y: 22, opacity: 0, duration: 1.0, ease: 'power3.out' }, '-=0.7');
}

/* ── Scroll reveals for the details + form blocks ── */
function initScrollReveals() {
  const groups = [
    '.contact-reassure__item',
    '.contact-aside__heading',
    '.contact-aside__text',
    '.contact-card',
    '.contact-formwrap',
    '.contact-map',
  ];

  groups.forEach((selector) => {
    const els = document.querySelectorAll(selector);
    if (!els.length) return;
    gsap.from(els, {
      opacity: 0,
      y: 26,
      duration: 0.9,
      ease: 'power2.out',
      stagger: 0.1,
      scrollTrigger: {
        trigger: els[0],
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    });
  });
}


/* ═══════════════════════════════════════════════════════
   BOOT SEQUENCE
   ═══════════════════════════════════════════════════════ */

async function init() {
  await initPreloader();   // hide the preloader first — never gate it on the API
  initNav(lenis);          // nav + footer + studio-profile + rating + notice
  initHeroEntrance();
  initScrollReveals();
  initLeadForm();          // wires #inquiryForm to the leads pipeline
  ScrollTrigger.refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
