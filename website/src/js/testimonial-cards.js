/* ============================================================
   TESTIMONIAL-CARDS.JS — Shared testimonial card + marquee row
   Amour Affairs · Premium Wedding Photography

   One source of truth for the `tcard-page` card markup and the
   `tpage-row` marquee rows, used by the Testimonials page and
   the Weddings-page marquee so both always look identical.

   Row direction is never stored anywhere: it is derived from a
   row's position (first row left, second right, ...), so the
   alternating scroll pattern survives any content change.
   ============================================================ */

import { responsiveAttrs } from './api.js';

export const escapeHTML = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// "Sana & Mustafa" → "SM"  ·  "Neha" → "NE"
export const initialsOf = (name) => {
  const words = String(name).replace(/&/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || '?').slice(0, 2).toUpperCase();
};

export const testimonialCardHTML = (t) => {
  const name = escapeHTML(t.name);
  return `
    <div class="tcard-page">
      ${t.src ? `
      <div class="tcard-page__photo">
        <img ${responsiveAttrs(t.src, '(max-width: 768px) 80vw, 360px', 480)} alt="${name}" loading="lazy" decoding="async" />
      </div>` : ''}
      <div class="tcard-page__body">
        <div class="tcard-page__icon">&ldquo;&ldquo;</div>
        <p class="tcard-page__text">${escapeHTML(t.quote)}</p>
        <div class="tcard-page__author">
          <div class="tcard-page__avatar">${escapeHTML(initialsOf(t.name))}</div>
          <div>
            <div class="tcard-page__name">${name}</div>
            ${t.location ? `<div class="tcard-page__loc">${escapeHTML(t.location)}</div>` : ''}
          </div>
        </div>
      </div>
    </div>`;
};

/** Scroll direction for the row at `index` (0-based): left, right, left, ... */
export const rowDirection = (index) => (index % 2 === 0 ? 'left' : 'right');

/**
 * A full marquee row. Cards are rendered twice so the ±50%
 * translate loop in testimonials-page.css is seamless.
 */
export const marqueeRowHTML = (testimonials, index) => {
  const cards = testimonials.map(testimonialCardHTML).join('');
  return `
    <div class="tpage-row tpage-row--${rowDirection(index)}">
      <div class="tpage-row__track">${cards}${cards}</div>
    </div>`;
};
