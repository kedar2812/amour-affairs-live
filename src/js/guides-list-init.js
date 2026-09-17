/* ============================================================
   GUIDES-LIST-INIT.JS — /guides listing page
   Amour Affairs · Premium Wedding Photography
   Renders published guides from the CMS into a card grid.
   ============================================================ */

// ── Styles ──
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
import { createLenis, finishBoot, escapeHtml, injectJsonLd, initAnchorScroll, decodeDeep } from './content-page.js';
import { initLeadMagnets } from './lead-magnets.js';
import { initLeadForm } from './lead-form.js';

const SITE = 'https://www.amouraffairs.in';

function cardMarkup(g) {
  const cover = g.cover_path
    ? `<div class="cp-card__media"><img src="${assetUrl(g.cover_path)}" alt="${escapeHtml(g.title)}" loading="lazy"></div>`
    : '';
  const meta = [g.category, g.read_minutes ? `${g.read_minutes} min read` : ''].filter(Boolean).join(' · ');
  return `
    <a class="cp-card cp-reveal" href="/guides/${encodeURIComponent(g.slug)}/">
      ${cover}
      <div class="cp-card__body">
        <span class="cp-card__meta">${escapeHtml(meta)}</span>
        <h2 class="cp-card__title">${escapeHtml(g.title)}</h2>
        <p class="cp-card__excerpt">${escapeHtml(g.excerpt || '')}</p>
        <span class="cp-card__link">Read Guide <span aria-hidden="true">&rarr;</span></span>
      </div>
    </a>`;
}

async function renderGuides() {
  const grid = document.getElementById('cpGrid');
  const empty = document.getElementById('cpEmpty');
  if (!grid) return;

  const data = await fetchFromAPI('guides.php');
  const guides = data && Array.isArray(data.guides) ? decodeDeep(data.guides) : [];

  if (guides.length === 0) {
    grid.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  grid.innerHTML = guides.map(cardMarkup).join('');
  if (empty) empty.style.display = 'none';

  // ItemList schema for the listing
  injectJsonLd('guides-itemlist', {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: guides.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}/guides/${g.slug}/`,
      name: g.title,
    })),
  });
}

async function init() {
  const lenis = createLenis();
  await renderGuides();
  await initLeadMagnets();
  initLeadForm();
  initAnchorScroll(lenis);
  await finishBoot(lenis);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
