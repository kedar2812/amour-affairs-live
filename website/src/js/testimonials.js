/* ============================================================
   TESTIMONIALS.JS — Homepage testimonials carousel
   Amour Affairs · Premium Wedding Photography

   Stacked photo cards on the left, the quote crossfading on the
   right, user-controlled navigation only (no autoplay).

   Plain DOM + GSAP. This used to be a React + Framer Motion island,
   which shipped ~190 KB of framework code to every homepage visitor
   for one widget; the markup, class names, easing and timings are
   unchanged, so testimonials.css styles it exactly as before.
   ============================================================ */

import { gsap } from 'gsap';
import { loadTestimonials } from './api.js';

// Fallback slides when the CMS has no featured testimonials yet
export const FALLBACK_TESTIMONIALS = [
  {
    quote: 'Planning a wedding can be a very stressful time, but Taher immediately put our minds at ease with his calm, measured approach. On the day he blended into the background, capturing an array of shots we didn’t think were possible. The end results are truly amazing, something we will cherish for the rest of our lives together. You are utterly brilliant, and we are already recommending you to others.',
    name: 'Sarrah & Aliasgar',
    location: 'Pune',
    src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80&auto=format&fit=crop',
  },
  {
    quote: 'Amour Affairs is the perfect combination of everything a team of wedding photographers should be. Taher and his team surpassed every expectation. Not only were they magically present wherever a shot was required, they were punctual and worked well with the family and guests. The photographs take you back to the almost fairytale-like dream that the wedding was. The images are crisp, the colours vibrant, and the moments unforgettable.',
    name: 'Tasneem & Ammar',
    location: 'Dubai',
    src: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=800&q=80&auto=format&fit=crop',
  },
  {
    quote: 'As a little girl I dreamed of piecing my wedding together bit by bit as I flipped through vintage photographs of my parents — picturing what it would be like one day for me. Amour Affairs has given us just that. We will always cherish the moments captured of our big day and I’m certain so will our little ones. Amour Affairs did a remarkable job in capturing the essence of our wedding — the laughter, the tears, promises made — we couldn’t ask for anything better.',
    name: 'Shaista & Ali',
    location: 'Abu Dhabi',
    src: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=800&q=80&auto=format&fit=crop',
  },
  {
    quote: 'We wanted to thank Amour Affairs for their incredible ability to capture the essence of our wedding day in such an enchanting way. We have gotten some unbelievable comments from friends and family — they say we look like we are in a movie, out of a magazine. Our wedding photographs captured and preserved our many memories of our magical day. We couldn’t be happier with the choice of photographer that we made.',
    name: 'Prianca & Karan',
    location: 'Mumbai',
    src: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&q=80&auto=format&fit=crop',
  },
  {
    quote: 'Taher and team added a lot of thought process, effort and planning even before arriving for the shoot. Innumerable candid shots bring detail to the memories and we will cherish them for life. Amour Affairs felt like family. All the pictures are truly mesmerizing and a wonderful reminder of an amazing time we had. The team is highly professional and always try to attain perfection.',
    name: 'Zoya & Azhar',
    location: 'U.S.',
    src: 'https://images.unsplash.com/photo-1604017011826-d3b4c23f8914?w=800&q=80&auto=format&fit=crop',
  },
];

/** CSS-style cubic-bezier(x1, y1, x2, y2) as an easing function GSAP accepts. */
function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {           // Newton–Raphson
      const d = sampleX(t) - x;
      const s = slopeX(t);
      if (Math.abs(d) < 1e-6 || Math.abs(s) < 1e-6) break;
      t -= d / s;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}

const EASE = cubicBezier(0.32, 0.72, 0, 1); // same curve the Framer version used
const CHEVRON = (points) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="${points}"/></svg>`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const randomRotate = () => Math.floor(Math.random() * 14) - 7;

function buildCarousel(mount, testimonials) {
  const total = testimonials.length;
  let active = 0;

  const root = el('div', 'testi__carousel');

  // LEFT — stacked photo cards
  const photos = el('div', 'testi__photos');
  const stack = el('div', 'testi__photo-stack');
  const cards = testimonials.map((t) => {
    const card = el('div', 'testi__photo-card');
    card.style.cssText = 'position:absolute;inset:0;transform-origin:center bottom';
    const img = el('img');
    img.src = t.src;
    img.alt = t.name;
    img.draggable = false;
    img.loading = 'lazy';
    img.decoding = 'async';
    card.appendChild(img);
    stack.appendChild(card);
    return card;
  });
  photos.appendChild(stack);

  // RIGHT — quote + navigation
  const content = el('div', 'testi__content');
  const slot = el('div');
  slot.setAttribute('aria-live', 'polite');
  content.appendChild(slot);

  const nav = el('div', 'testi__nav');
  const arrows = el('div', 'testi__arrows');
  const prev = el('button', 'testi__arrow testi__arrow--prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous testimonial');
  prev.innerHTML = CHEVRON('15 18 9 12 15 6');
  const next = el('button', 'testi__arrow testi__arrow--next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next testimonial');
  next.innerHTML = CHEVRON('9 6 15 12 9 18');
  arrows.append(prev, next);

  const dotsWrap = el('div', 'testi__dots');
  const dots = testimonials.map((_, i) => {
    const dot = el('button', 'testi__dot');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Go to testimonial ${i + 1}`);
    dot.addEventListener('click', () => go(i));
    dotsWrap.appendChild(dot);
    return dot;
  });

  const more = el('a', 'testi__read-more', 'Read All Love Stories ');
  more.href = '/testimonials/';
  const moreArrow = el('span', 'testi__read-more-arrow', '→');
  moreArrow.setAttribute('aria-hidden', 'true');
  more.appendChild(moreArrow);

  nav.append(arrows, dotsWrap, more);
  content.appendChild(nav);
  root.append(photos, content);
  mount.replaceChildren(root);

  function renderQuote(animate) {
    const t = testimonials[active];
    const slide = el('div', 'testi__slide-content');
    slide.append(el('span', 'testi__quote-mark', '“'), el('p', 'testi__quote', t.quote));
    const author = el('div', 'testi__author');
    const line = el('div', 'testi__author-line');
    line.style.transformOrigin = 'left';
    const info = el('div', 'testi__author-info');
    info.append(el('span', 'testi__name', t.name), el('span', 'testi__location', t.location));
    author.append(line, info);
    slide.appendChild(author);

    const old = slot.firstElementChild;
    const enter = () => {
      slot.replaceChildren(slide);
      if (!animate) return;
      gsap.fromTo(slide,
        { opacity: 0, y: 24, filter: 'blur(4px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: EASE, clearProps: 'filter' });
      gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.6, delay: 0.2, ease: EASE });
    };
    // mode="wait": the old quote leaves before the new one enters
    if (old && animate) {
      gsap.to(old, { opacity: 0, y: -16, filter: 'blur(4px)', duration: 0.3, ease: EASE, onComplete: enter });
    } else {
      enter();
    }
  }

  function renderCards(animate) {
    cards.forEach((card, i) => {
      const isActive = i === active;
      const distance = Math.abs(i - active);
      card.style.zIndex = String(isActive ? total : total - distance);
      const state = {
        opacity: isActive ? 1 : 0.4,
        scale: isActive ? 1 : 0.88,
        rotate: isActive ? 0 : randomRotate(),
        y: isActive ? 0 : 20,
      };
      if (animate) gsap.to(card, { ...state, duration: 0.7, ease: EASE });
      else gsap.set(card, state);
    });
    dots.forEach((dot, i) => dot.classList.toggle('active', i === active));
  }

  function go(i) {
    const target = ((i % total) + total) % total;
    if (target === active) return;
    active = target;
    renderCards(true);
    renderQuote(true);
  }

  prev.addEventListener('click', () => go(active - 1));
  next.addEventListener('click', () => go(active + 1));

  renderCards(false);
  renderQuote(false);
}

export async function initTestimonials() {
  const mount = document.getElementById('testimonials-carousel');
  if (!mount) return;

  // Testimonials saved without a photo borrow the bundled stock shots
  const stockPhotos = FALLBACK_TESTIMONIALS.map((t) => t.src);
  let cms = null;
  try { cms = await loadTestimonials(stockPhotos); } catch { /* keep fallback */ }
  const list = cms && cms.length ? cms : FALLBACK_TESTIMONIALS;
  buildCarousel(mount, list);
}
