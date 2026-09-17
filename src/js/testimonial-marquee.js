/* ============================================================
   TESTIMONIAL-MARQUEE.JS — Shared marquee above the enquiry form
   Amour Affairs · Premium Wedding Photography

   The weddings-page "Words From Our Couples" marquee, placed right
   above the enquiry form on every other page that has one (not the
   homepage, which has its own testimonials section, and not the
   weddings page, which keeps its own curation).

   Every copy is driven by the same dashboard data, so one edit
   updates them all:
     • reviews  — testimonials ticked "Show in the enquiry-form
                  marquees" (testimonials.show_on_pages)
     • eyebrow  — setting site_testi_marquee_eyebrow
     • heading  — setting site_testi_marquee_heading (*word* = gold italic)

   Importing this module is enough: it mounts itself before the
   page's #enquire section (or the contact page's form block).
   ============================================================ */

import '../styles/testimonials-page.css'; // card + track design
import '../styles/testimonial-marquee.css'; // section shell

import { loadPageMarqueeTestimonials, loadSiteContent } from './api.js';
import { fallbackWeddingsTestimonials } from './weddings-testimonials-data.js';
import { testimonialCardHTML, escapeHTML } from './testimonial-cards.js';
import { emphasize } from './site-content.js';

export const MARQUEE_DEFAULTS = {
  eyebrow: 'Loved By Couples',
  heading: 'Words From *Our Couples*',
};

const MAX_CARDS = 15;
// A short list is repeated up to this many cards before the seamless
// doubling, so the track never runs out of cards on a wide screen.
const MIN_TRACK_CARDS = 8;

// Stock couple shots fill in for any testimonial saved without a photo
const STOCK_PHOTOS = fallbackWeddingsTestimonials.map((t) => t.src);

// Fisher–Yates shuffle on a copy — keeps the marquee feeling fresh per visit
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function findAnchor() {
  return document.getElementById('enquire') || document.querySelector('.contact-main');
}

function mountShell(anchor) {
  const section = document.createElement('section');
  section.className = 'wpage-testi';
  section.id = 'pageTestimonials';
  section.setAttribute('aria-label', 'What couples say');
  section.innerHTML = `
    <div class="wpage-testi__header">
      <span class="wpage-testi__eyebrow">${escapeHTML(MARQUEE_DEFAULTS.eyebrow)}</span>
      <h2 class="wpage-testi__heading">${emphasize(MARQUEE_DEFAULTS.heading)}</h2>
    </div>
    <div class="wpage-testi__marquee"></div>`;
  anchor.parentNode.insertBefore(section, anchor);
  return section;
}

function renderCards(section, testimonials) {
  let list = shuffle(testimonials).slice(0, MAX_CARDS);
  if (list.length === 0) {
    section.remove();
    return;
  }
  const base = list;
  while (list.length < MIN_TRACK_CARDS) list = list.concat(base);

  // Cards rendered twice so the marqueeLeft (-50%) loop is seamless
  const cards = list.map(testimonialCardHTML).join('');
  section.querySelector('.wpage-testi__marquee').innerHTML = `
    <div class="tpage-marquee-wrap">
      <div class="tpage-row tpage-row--left">
        <div class="tpage-row__track">${cards}${cards}</div>
      </div>
    </div>`;
}

function applyCopy(section, content) {
  if (!content) return;
  const eyebrow = content.site_testi_marquee_eyebrow;
  const heading = content.site_testi_marquee_heading;
  if (eyebrow) section.querySelector('.wpage-testi__eyebrow').textContent = eyebrow;
  if (heading) section.querySelector('.wpage-testi__heading').innerHTML = emphasize(heading);
}

export function initTestimonialMarquee() {
  if (document.getElementById('pageTestimonials')) return; // idempotent
  const anchor = findAnchor();
  if (!anchor || !anchor.parentNode) return;

  const section = mountShell(anchor);

  loadSiteContent()
    .then((content) => applyCopy(section, content))
    .catch(() => {});

  loadPageMarqueeTestimonials(STOCK_PHOTOS)
    .catch(() => null)
    .then((cms) => {
      renderCards(section, cms || fallbackWeddingsTestimonials);
      // The marquee changes page height — let ScrollTrigger/Lenis re-measure
      window.dispatchEvent(new Event('resize'));
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTestimonialMarquee, { once: true });
} else {
  initTestimonialMarquee();
}
