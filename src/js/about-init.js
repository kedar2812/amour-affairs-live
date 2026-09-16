/* ============================================================
   ABOUT-INIT.JS — Dedicated init for the About page
   Amour Affairs · Premium Wedding Photography
   Lenis smooth-scroll, GSAP ScrollTrigger, cinematic reveals
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
import '../styles/about-page.css';
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
import { loadTeam, loadSiteContent, assetUrl } from './api.js';

gsap.registerPlugin(ScrollTrigger);

// Start loading CMS content immediately — awaited during boot
const teamPromise = loadTeam();
const siteContentPromise = loadSiteContent();

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

/* ── 1. Intro Hero — "Entering Text" Entrance (plays once on load) ── */
function initHeroReveal() {
  const tl = gsap.timeline({ delay: 0.3 });

  // Keyword eyebrow (the page h1) fades in first
  if (document.getElementById('heroEyebrow')) {
    tl.to('#heroEyebrow', {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
    });
  }

  // Display title fades / slides up
  tl.to('#heroTitle', {
    opacity: 1,
    y: 0,
    duration: 1.2,
    ease: 'power3.out',
  }, '-=0.5');

  // Gold line draws in
  tl.to('#heroLine', {
    scaleX: 1,
    duration: 0.8,
    ease: 'power3.out',
  }, '-=0.7');

  // Tagline subline
  tl.to('#heroSub', {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: 'power3.out',
  }, '-=0.5');

}


/* ── 2. Founder Section — ScrollTrigger Reveals ── */
function initFounderReveals() {
  // Left column — photo slides in from left
  gsap.from('#founderPhoto', {
    opacity: 0,
    x: -50,
    duration: 1.2,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#founderPhoto',
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
    onComplete: () => {
      // Gold frame draws in after image settles
      gsap.to('.photo-frame::after', {
        opacity: 1,
        scaleX: 1,
        duration: 0.8,
        ease: 'power3.out',
      });
    },
  });

  // Animate the gold frame pseudo-element using a class toggle
  ScrollTrigger.create({
    trigger: '#founderPhoto',
    start: 'top 80%',
    onEnter: () => {
      // Use GSAP to animate the actual pseudo-element via CSS
      setTimeout(() => {
        const frame = document.querySelector('.photo-frame');
        if (frame) frame.classList.add('frame-revealed');
      }, 600);
    },
    once: true,
  });

  // Right column — stagger text elements
  const textElements = document.querySelectorAll(
    '.founder__name, .founder__role, .founder__pullquote, .founder__body, .founder__philosophy-quote, .founder__signature'
  );

  gsap.from(textElements, {
    opacity: 0,
    y: 25,
    duration: 0.9,
    ease: 'power2.out',
    stagger: 0.15,
    scrollTrigger: {
      trigger: '#founderText',
      start: 'top 80%',
      toggleActions: 'play none none none',
    },
  });

  // Photo caption fade up
  gsap.from('.founder__photo-caption', {
    opacity: 0,
    y: 15,
    duration: 0.8,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '.founder__photo-caption',
      start: 'top 92%',
      toggleActions: 'play none none none',
    },
  });
}


/* ── 3. Philosophy Strip ── */
function initPhilosophyReveals() {
  const blocks = document.querySelectorAll('.philosophy__block');
  const dividers = document.querySelectorAll('.philosophy__divider');

  gsap.from(blocks, {
    opacity: 0,
    y: 20,
    duration: 0.9,
    ease: 'power2.out',
    stagger: 0.2,
    scrollTrigger: {
      trigger: '.philosophy',
      start: 'top 80%',
      toggleActions: 'play none none none',
    },
  });

  gsap.from(dividers, {
    opacity: 0,
    scaleY: 0,
    duration: 0.6,
    ease: 'power2.out',
    stagger: 0.2,
    scrollTrigger: {
      trigger: '.philosophy',
      start: 'top 80%',
      toggleActions: 'play none none none',
    },
  });
}


/* ── 5. CTA Section ── */
function initCtaReveal() {
  gsap.from('.about-cta__label, .about-cta__heading, .about-cta__buttons', {
    opacity: 0,
    y: 25,
    duration: 0.9,
    ease: 'power2.out',
    stagger: 0.15,
    scrollTrigger: {
      trigger: '.about-cta',
      start: 'top 80%',
      toggleActions: 'play none none none',
    },
  });
}


/* ── Team marquee from the CMS ──
   Replaces the static placeholder cards when real team members
   (with photos) exist. The track holds two identical sets so the
   CSS translateX(-50%) loop stays seamless. */
function renderTeamMarquee(members) {
  const track = document.querySelector('.team-marquee__track');
  if (!track || !members) return;

  // Repeat a small roster so the strip is wide enough for the translateX(-50%)
  // loop to stay seamless (a 1–3 person team would otherwise leave a gap).
  const MIN_CARDS = 6;
  const reps = Math.max(1, Math.ceil(MIN_CARDS / members.length));
  const filled = Array.from({ length: reps }, () => members).flat();

  const cardSet = (hidden) => filled
    .map((m) => `
      <div class="team-card"${hidden ? ' aria-hidden="true"' : ''}>
        <div class="team-card__img-wrap">
          <img src="${m.photo}" alt="${m.name.replace(/"/g, '&quot;')}" class="team-card__img" loading="lazy">
        </div>
        <div class="team-card__info">
          <span class="team-card__name"></span>
          <span class="team-card__role"></span>
        </div>
      </div>
    `)
    .join('');

  track.innerHTML = cardSet(false) + cardSet(true);

  // Names/roles as text — avoids HTML injection through CMS fields
  track.querySelectorAll('.team-card').forEach((card, i) => {
    const m = filled[i % filled.length];
    card.querySelector('.team-card__name').textContent = m.name;
    card.querySelector('.team-card__role').textContent = m.role;
  });
}


/* ── Founder block from the CMS ──
   Overrides the bundled founder photo + copy when the dashboard has
   published values (settings group `site_content`, keys `site_founder_*`).
   Any missing key keeps the static markup, so the page never breaks. */
function renderFounder(content) {
  if (!content) return;

  const setText = (selector, value, index = 0) => {
    if (!value) return;
    const el = document.querySelectorAll(selector)[index];
    if (el) el.textContent = value;
  };

  setText('.founder__name', content.site_founder_name);
  setText('.founder__role', content.site_founder_role);
  setText('.founder__pullquote', content.site_founder_pullquote);
  setText('.founder__body', content.site_founder_body1, 0);
  setText('.founder__body', content.site_founder_body2, 1);
  setText('.founder__philosophy-quote', content.site_founder_philosophy);
  setText('.founder__photo-caption', content.site_founder_caption);

  if (content.site_founder_photo) {
    const img = document.querySelector('#founderPhoto img');
    if (img) {
      img.src = assetUrl(content.site_founder_photo);
      if (content.site_founder_name) img.alt = content.site_founder_name;
    }
  }
}


/* ── Nav scroll behavior for about page ── */
function initAboutNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  // No hero pin spacer on this page — use a simple 60px threshold
  function updateNav() {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav(); // run once on load
}


/* ═══════════════════════════════════════════════════════
   BOOT SEQUENCE
   ═══════════════════════════════════════════════════════ */

async function init() {
  // Hide the preloader FIRST — never gate it on the CMS API (a slow/failed
  // request must not hold the whole page on the loading screen).
  await initPreloader();
  initNav(lenis);

  // CMS team + founder, applied before the reveal animations run. Wrapped so a
  // bad payload can never throw past this point and freeze the boot.
  try { renderTeamMarquee(await teamPromise); } catch (e) { console.error('team CMS', e); }
  try { renderFounder(await siteContentPromise); } catch (e) { console.error('founder CMS', e); }

  initAboutNav();
  initHeroReveal();
  initFounderReveals();
  initPhilosophyReveals();
  initCtaReveal();
  initLeadForm();

  ScrollTrigger.refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
