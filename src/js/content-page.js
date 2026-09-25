/* ============================================================
   CONTENT-PAGE.JS — Shared boot + helpers for the content
   sections (Guides, Case Studies). Amour Affairs.

   Provides the smooth-scroll + nav + preloader + reveal setup
   used by the listing and article templates, plus a tiny
   Markdown-ish renderer and HTML-escape helper so dashboard
   content renders safely.
   ============================================================ */

import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initNav } from './nav.js';
import { initPreloader } from './animations.js';

gsap.registerPlugin(ScrollTrigger);

/** Create the Lenis instance wired to ScrollTrigger (mirrors info-page-init). */
export function createLenis() {
  const lenis = new Lenis({
    duration: 1.4,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    smoothWheel: true,
    touchMultiplier: 2,
  });

  window.__lenis = lenis;
  gsap.ticker.add((time) => { lenis.raf(time * 1000); });
  lenis.on('scroll', () => ScrollTrigger.update());

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
  return lenis;
}

/** Hero entrance + scroll reveals shared by content pages. */
export function initReveals() {
  const tl = gsap.timeline({ delay: 0.1 });
  if (document.querySelector('.cp-hero__eyebrow')) tl.from('.cp-hero__eyebrow', { y: 20, opacity: 0, duration: 0.9, ease: 'power3.out' });
  if (document.querySelector('.cp-hero__title')) tl.from('.cp-hero__title', { y: 35, opacity: 0, duration: 1.1, ease: 'power3.out' }, '-=0.6');
  if (document.querySelector('.cp-hero__sub')) tl.from('.cp-hero__sub', { y: 20, opacity: 0, duration: 0.9, ease: 'power3.out' }, '-=0.6');

  gsap.utils.toArray('.cp-reveal').forEach((el) => {
    gsap.from(el, {
      scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' },
      y: 32, opacity: 0, duration: 0.9, ease: 'power2.out',
    });
  });
}

/** Finish boot: preloader off, nav live, reveals, refresh. Call after render. */
export async function finishBoot(lenis) {
  await initPreloader();
  initNav(lenis);
  initReveals();
  ScrollTrigger.refresh();
}

/**
 * Smooth-scroll same-page hash links (e.g. "tell us about your wedding" →
 * the #enquire form) through Lenis, so anchors honour the smooth-scroll
 * setup instead of jumping. Delegated, so it also catches links rendered
 * after init (the empty-state CTA).
 */
export function initAnchorScroll(lenis) {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    // Clear the fixed nav so a jumped-to heading isn't hidden under it
    const navH = document.getElementById('nav')?.offsetHeight || 0;
    if (lenis) lenis.scrollTo(target, { offset: -(navH + 20), duration: 1.2 });
    else target.scrollIntoView({ behavior: 'smooth' });
  });
}

/** Escape text for safe HTML insertion. */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Decode the HTML entities the PHP API stores (it runs every field through
 * htmlspecialchars with ENT_QUOTES|ENT_HTML5). Without this the content is
 * escaped a SECOND time at render, so apostrophes/ampersands show as literal
 * &#039; / &amp;. `&amp;` is decoded last so "&amp;lt;" → "&lt;" not "<".
 */
export function decodeEntities(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Recursively decode entity-encoded strings in an API payload (objects,
    arrays and plain strings). Non-strings pass through untouched. */
export function decodeDeep(value) {
  if (Array.isArray(value)) return value.map(decodeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = decodeDeep(v);
    return out;
  }
  return decodeEntities(value);
}

/** Inline formatting: **bold**, *italic*, [text](url). Input is already escaped. */
function inlineFormat(escaped) {
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
}

/**
 * Render a light Markdown subset to HTML:
 *   ## Heading        → <h2>
 *   ### Heading       → <h3>
 *   - item / * item   → <ul><li>
 *   1. item           → <ol><li>
 *   > quote           → <blockquote>
 *   blank line        → new <p>
 * Everything is HTML-escaped first, so stored content cannot inject markup.
 */
export function renderMarkdown(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let listType = null; // 'ul' | 'ol'
  let para = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inlineFormat(escapeHtml(para.join(' ')))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === '') { flushPara(); closeList(); continue; }

    // Headings — the space after the hashes is optional so "##Heading" works
    // just as well as "## Heading".
    let m;
    if ((m = trimmed.match(/^###\s*(.+)$/))) { flushPara(); closeList(); html.push(`<h3>${inlineFormat(escapeHtml(m[1].trim()))}</h3>`); continue; }
    if ((m = trimmed.match(/^##\s*(.+)$/)))  { flushPara(); closeList(); html.push(`<h2>${inlineFormat(escapeHtml(m[1].trim()))}</h2>`); continue; }
    if ((m = trimmed.match(/^#\s*(.+)$/)))   { flushPara(); closeList(); html.push(`<h2>${inlineFormat(escapeHtml(m[1].trim()))}</h2>`); continue; }
    if ((m = trimmed.match(/^>\s+(.*)$/)))   { flushPara(); closeList(); html.push(`<blockquote>${inlineFormat(escapeHtml(m[1]))}</blockquote>`); continue; }

    if ((m = trimmed.match(/^[-*•]\s+(.*)$/))) {
      flushPara();
      if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul'; }
      html.push(`<li>${inlineFormat(escapeHtml(m[1]))}</li>`);
      continue;
    }
    if ((m = trimmed.match(/^\d+\.\s+(.*)$/))) {
      flushPara();
      if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol'; }
      html.push(`<li>${inlineFormat(escapeHtml(m[1]))}</li>`);
      continue;
    }

    closeList();
    para.push(trimmed);
  }
  flushPara();
  closeList();
  return html.join('\n');
}

/** Plain-text version of body content for meta descriptions / schema. */
export function plainText(text, max = 300) {
  const t = String(text ?? '')
    .replace(/[#>*_`-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

/** Inject (or replace) a JSON-LD script with the given id. */
export function injectJsonLd(id, data) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/** Set document title + meta description + canonical at runtime. */
export function setMeta({ title, description, canonical }) {
  if (title) document.title = title;
  if (description) {
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
    m.setAttribute('content', description);
  }
  if (canonical) {
    let l = document.querySelector('link[rel="canonical"]');
    if (!l) { l = document.createElement('link'); l.setAttribute('rel', 'canonical'); document.head.appendChild(l); }
    l.setAttribute('href', canonical);
  }
}
