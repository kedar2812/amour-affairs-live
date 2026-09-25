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

// Hand-built article pages that live outside the Guides CMS (their own
// static URL). Listed first so the Guides index links to them too.
const STATIC_GUIDES = [
  {
    href: '/20-questions-wedding-photographer-pune/',
    title: '20 Questions Every Couple Asks a Wedding Photographer',
    excerpt: 'Style, pricing, coverage, albums, contracts and delivery: what to ask a wedding photographer in Pune before you book.',
    category: 'Wedding Planning',
    read_minutes: 12,
    cover: '/20-questions-wedding-photographer-pune/groom-first-look-at-mandap.webp',
    cover_alt: 'Candid wedding photography in Pune by Amour Affairs: the groom smiling as he sees his bride at the mandap',
  },
  {
    href: '/wedding-photography-pune-venues/',
    title: 'Wedding Photography at The Orchid Hotel Pune, Oxford Golf & The Corinthians',
    excerpt: 'Photography ideas and practical planning tips for three Pune wedding venues — and for capturing authentic moments wherever you celebrate.',
    category: 'Pune Wedding Venues',
    read_minutes: 8,
    cover: '/wedding-photography-pune-venues/couple-portrait-natural-light.webp',
    cover_alt: 'Bride and groom smiling together beneath a floral mandap in soft evening light',
  },
];

const guideHref = (g) => g.href || `/guides/${encodeURIComponent(g.slug)}/`;

function cardMarkup(g) {
  const coverSrc = g.cover || (g.cover_path ? assetUrl(g.cover_path) : '');
  const cover = coverSrc
    ? `<div class="cp-card__media"><img src="${coverSrc}" alt="${escapeHtml(g.cover_alt || g.title)}" loading="lazy"></div>`
    : '';
  const meta = [g.category, g.read_minutes ? `${g.read_minutes} min read` : ''].filter(Boolean).join(' · ');
  return `
    <a class="cp-card cp-reveal" href="${guideHref(g)}">
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
  const cmsGuides = data && Array.isArray(data.guides) ? decodeDeep(data.guides) : [];
  const guides = STATIC_GUIDES.concat(cmsGuides);

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
      url: `${SITE}${guideHref(g)}`,
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
