/* ============================================================
   CASE-STUDIES-LIST-INIT.JS — /case-studies listing page
   Amour Affairs · Premium Wedding Photography
   Renders published wedding stories from the CMS as a grid.
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
import { createLenis, finishBoot, escapeHtml, injectJsonLd, initAnchorScroll, decodeDeep } from './content-page.js';
import { initLeadForm } from './lead-form.js';

const SITE = 'https://www.amouraffairs.in';

function cardMarkup(cs) {
  const cover = cs.cover_path
    ? `<div class="cp-card__media"><img src="${assetUrl(cs.cover_path)}" alt="${escapeHtml(cs.couple)}" loading="lazy"></div>`
    : '';
  const meta = [cs.event_type, cs.location].filter(Boolean).join(' · ');
  return `
    <a class="cp-card cp-reveal" href="/case-studies/${encodeURIComponent(cs.slug)}/">
      ${cover}
      <div class="cp-card__body">
        <span class="cp-card__meta">${escapeHtml(meta)}</span>
        <h2 class="cp-card__title">${escapeHtml(cs.couple)}</h2>
        <p class="cp-card__excerpt">${escapeHtml(cs.summary || cs.title || '')}</p>
        <span class="cp-card__link">Read Their Story <span aria-hidden="true">&rarr;</span></span>
      </div>
    </a>`;
}

async function renderStories() {
  const grid = document.getElementById('cpGrid');
  const empty = document.getElementById('cpEmpty');
  if (!grid) return;

  const data = await fetchFromAPI('case_studies.php');
  const stories = data && Array.isArray(data.case_studies) ? decodeDeep(data.case_studies) : [];

  if (stories.length === 0) {
    grid.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  grid.innerHTML = stories.map(cardMarkup).join('');
  if (empty) empty.style.display = 'none';

  injectJsonLd('cases-itemlist', {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: stories.map((cs, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}/case-studies/${cs.slug}/`,
      name: `${cs.couple} — ${cs.title}`,
    })),
  });
}

async function init() {
  const lenis = createLenis();
  await renderStories();
  initLeadForm();
  initAnchorScroll(lenis);
  await finishBoot(lenis);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
