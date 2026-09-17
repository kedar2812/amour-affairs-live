/* ============================================================
   CASE-STUDY-INIT.JS — /case-studies/<slug>/ story template
   Amour Affairs · Premium Wedding Photography
   ============================================================ */

import '../styles/reset.css';
import '../styles/variables.css';
import '../styles/typography.css';
import '../styles/components.css';
import '../styles/sections/hero.css';
import '../styles/sections/contact.css';
import '../styles/info-page.css';
import '../styles/content-pages.css';
import '../styles/sections/inquiry.css';
import '../styles/buttons.css';
import '../styles/section-headers.css'; // one section-header identity — must load after the page CSS
import './testimonial-marquee.js'; // shared "Words From Our Couples" marquee above the enquiry form (dashboard-driven)

import { fetchFromAPI, assetUrl } from './api.js';
import {
  createLenis, finishBoot, renderMarkdown, plainText, escapeHtml,
  injectJsonLd, setMeta, decodeDeep, initAnchorScroll,
} from './content-page.js';
import { initLeadForm } from './lead-form.js';
import { initLightbox } from './lightbox.js';

const SITE = 'https://www.amouraffairs.in';

function getSlug() {
  const qs = new URLSearchParams(location.search).get('slug');
  if (qs) return qs;
  const m = location.pathname.match(/\/case-studies\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : '';
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return '';
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function setNoIndex() {
  let m = document.querySelector('meta[name="robots"]');
  if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'robots'); document.head.appendChild(m); }
  m.setAttribute('content', 'noindex, follow');
}

function factsMarkup(cs) {
  const facts = [
    ['Location', cs.location],
    ['Date', formatDate(cs.event_date)],
    ['Guests', cs.guest_count],
    ['Services', cs.services],
  ].filter(([, v]) => v);
  if (facts.length === 0) return '';
  return `<div class="cp-facts">${facts.map(([k, v]) =>
    `<div class="cp-facts__item"><div class="cp-facts__label">${escapeHtml(k)}</div><div class="cp-facts__value">${escapeHtml(v)}</div></div>`
  ).join('')}</div>`;
}

function galleryMarkup(gallery, cs) {
  if (!Array.isArray(gallery) || gallery.length === 0) return '';
  // Truthful, descriptive alt: couple + real venue/location from the CMS
  // (e.g. "Riya & Arjun — wedding photography at The Corinthians, Pune").
  const alt = escapeHtml(
    `${cs.couple || 'Wedding'} — wedding photography${cs.location ? ` at ${cs.location}` : ''}`
  );
  return `<div class="cp-gallery">${gallery.map((p, i) =>
    `<img src="${assetUrl(p)}" alt="${alt} — photograph ${i + 1}" loading="lazy">`).join('')}</div>`;
}

function filmMarkup(id) {
  if (!id) return '';
  return `<div class="cp-film"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(id)}" title="Wedding film" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
}

async function render() {
  const root = document.getElementById('cpArticle');
  if (!root) return;

  const slug = getSlug();
  if (!slug) { root.innerHTML = notFound(); setNoIndex(); return; }

  // Decode the API's HTML-encoded fields once (the renderer re-escapes for safety).
  const cs = decodeDeep(await fetchFromAPI(`case_studies.php?slug=${encodeURIComponent(slug)}`));
  if (!cs || !cs.title) { root.innerHTML = notFound(); setNoIndex(); return; }

  const cover = cs.cover_path
    ? `<img class="cp-article__cover" src="${assetUrl(cs.cover_path)}" alt="${escapeHtml(`${cs.couple} — wedding photography${cs.location ? ` at ${cs.location}` : ''}`)}">`
    : '';
  const eyebrow = [cs.event_type, cs.location].filter(Boolean).join(' · ');

  root.innerHTML = `
    <a class="cp-article__back" href="/case-studies/">&larr; All Real Weddings</a>
    <p class="cp-article__eyebrow">${escapeHtml(eyebrow || 'Real Wedding')}</p>
    <h1 class="cp-article__title">${escapeHtml(cs.couple)}</h1>
    <p class="cp-hero__sub" style="margin:0 0 1.5rem;text-align:left">${escapeHtml(cs.title)}</p>
    ${cover}
    ${factsMarkup(cs)}
    <div class="cp-prose">${renderMarkdown(cs.body)}</div>
    ${filmMarkup(cs.film_youtube_id)}
    ${galleryMarkup(cs.gallery, cs)}`;

  // Click-to-view: cover, gallery and any prose images open in the zoomable lightbox.
  initLightbox(root, '.cp-article__cover, .cp-gallery img, .cp-prose img');

  // Tag the enquiry form (static in the template) with the exact story so the
  // dashboard sees which case study the lead came from.
  const form = document.getElementById('inquiryForm');
  if (form) form.dataset.page = `/case-studies/${cs.slug}/`;

  const description = cs.meta_description || cs.summary || plainText(cs.body, 155);
  const url = `${SITE}/case-studies/${cs.slug}/`;

  setMeta({
    title: cs.meta_title || `${cs.couple} — ${cs.title} | Amour Affairs`,
    description,
    canonical: url,
  });

  injectJsonLd('case-article', {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${cs.couple} — ${cs.title}`,
    description,
    image: cs.cover_path ? assetUrl(cs.cover_path) : `${SITE}/logo-full.png`,
    datePublished: cs.published_at || undefined,
    dateModified: cs.updated_at || cs.published_at || undefined,
    author: { '@type': 'Organization', name: 'Amour Affairs' },
    publisher: {
      '@type': 'Organization',
      name: 'Amour Affairs',
      logo: { '@type': 'ImageObject', url: `${SITE}/logo-full.png` },
    },
    mainEntityOfPage: url,
  });

  injectJsonLd('case-breadcrumb', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Real Weddings', item: `${SITE}/case-studies/` },
      { '@type': 'ListItem', position: 3, name: cs.couple, item: url },
    ],
  });
}

function notFound() {
  return `
    <a class="cp-article__back" href="/case-studies/">&larr; All Real Weddings</a>
    <div class="cp-empty">
      <p>We couldn't find that story. It may have moved or been unpublished.</p>
      <p><a href="/case-studies/" style="color:var(--color-accent)">Browse all real weddings &rarr;</a></p>
    </div>`;
}

async function init() {
  const lenis = createLenis();
  await render();
  initLeadForm();
  initAnchorScroll(lenis);
  await finishBoot(lenis);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
