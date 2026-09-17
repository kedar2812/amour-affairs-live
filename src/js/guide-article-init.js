/* ============================================================
   GUIDE-ARTICLE-INIT.JS — /guides/<slug>/ article template
   Amour Affairs · Premium Wedding Photography
   Reads the slug from the URL, loads the guide from the CMS,
   renders it, and injects Article + Breadcrumb schema + meta.
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

/** Pull the slug out of /guides/<slug>/ (or ?slug= as a fallback). */
function getSlug() {
  const qs = new URLSearchParams(location.search).get('slug');
  if (qs) return qs;
  const m = location.pathname.match(/\/guides\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : '';
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return '';
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function render() {
  const root = document.getElementById('cpArticle');
  if (!root) return;

  const slug = getSlug();
  if (!slug) { root.innerHTML = notFound(); setNoIndex(); return; }

  // The API stores every field HTML-encoded — decode once here so the renderer
  // (which escapes again for safety) doesn't double-encode apostrophes/ampersands.
  const g = decodeDeep(await fetchFromAPI(`guides.php?slug=${encodeURIComponent(slug)}`));
  if (!g || !g.title) { root.innerHTML = notFound(); setNoIndex(); return; }

  const cover = g.cover_path ? `<img class="cp-article__cover" src="${assetUrl(g.cover_path)}" alt="${escapeHtml(g.title)}">` : '';
  const byline = [g.author, g.read_minutes ? `${g.read_minutes} min read` : '', formatDate(g.published_at)]
    .filter(Boolean)
    .map((x) => `<span>${escapeHtml(x)}</span>`)
    .join('');

  root.innerHTML = `
    <a class="cp-article__back" href="/guides/">&larr; All Guides</a>
    <p class="cp-article__eyebrow">${escapeHtml(g.category || 'Wedding Guide')}</p>
    <h1 class="cp-article__title">${escapeHtml(g.title)}</h1>
    <div class="cp-article__byline">${byline}</div>
    ${cover}
    <div class="cp-prose">${renderMarkdown(g.body)}</div>`;

  // Click-to-view: the cover (and any images inside the prose) open in the
  // zoomable lightbox.
  initLightbox(root, '.cp-article__cover, .cp-prose img');

  // Tag the enquiry form (static in the template) with the exact guide so the
  // dashboard sees where the lead came from.
  const form = document.getElementById('inquiryForm');
  if (form) form.dataset.page = `/guides/${g.slug}/`;

  const description = g.meta_description || g.excerpt || plainText(g.body, 155);
  const url = `${SITE}/guides/${g.slug}/`;

  setMeta({
    title: g.meta_title || `${g.title} | Amour Affairs`,
    description,
    canonical: url,
  });

  injectJsonLd('guide-article', {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description,
    image: g.cover_path ? assetUrl(g.cover_path) : `${SITE}/logo-full.png`,
    datePublished: g.published_at || undefined,
    dateModified: g.updated_at || g.published_at || undefined,
    author: { '@type': 'Organization', name: g.author || 'Amour Affairs' },
    publisher: {
      '@type': 'Organization',
      name: 'Amour Affairs',
      logo: { '@type': 'ImageObject', url: `${SITE}/logo-full.png` },
    },
    mainEntityOfPage: url,
  });

  injectJsonLd('guide-breadcrumb', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE}/guides/` },
      { '@type': 'ListItem', position: 3, name: g.title, item: url },
    ],
  });
}

/** Keep empty / missing article views out of the index. */
function setNoIndex() {
  let m = document.querySelector('meta[name="robots"]');
  if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'robots'); document.head.appendChild(m); }
  m.setAttribute('content', 'noindex, follow');
}

function notFound() {
  return `
    <a class="cp-article__back" href="/guides/">&larr; All Guides</a>
    <div class="cp-empty">
      <p>We couldn't find that guide. It may have moved or been unpublished.</p>
      <p><a href="/guides/" class="cp-card__link" style="color:var(--color-accent)">Browse all guides &rarr;</a></p>
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
