/* ============================================================
   SITE-CONTENT.JS — Dashboard-editable page copy
   Amour Affairs · Premium Wedding Photography

   Defaults + DOM helpers for the copy blocks an admin can edit
   from the dashboard's "Website Content" page (settings group
   `site_content`): the enquiry sections inside the Weddings and
   Couple Shoots folders, and the couple-shoot session packages.

   Every page renders its bundled defaults first; when the CMS
   returns overrides they are applied on top, so the site reads
   perfectly even when the API is unreachable.

   Convention: text wrapped in *asterisks* renders italic accent
   (<em>), e.g. "Book Your *Wedding*".
   ============================================================ */

import { escapeHTML } from './testimonial-cards.js';

/** "Book Your *Wedding*" → "Book Your <em>Wedding</em>" (escaped first). */
export const emphasize = (value) =>
  escapeHTML(value).replace(/\*([^*]+)\*/g, '<em>$1</em>');

/* ── Studio profile (settings group `profile`) → footer/contact + map ──
   Applied on every page so the studio edits contact details + the map embed
   once in the dashboard Settings and the whole site reflects it. */
export function applyStudioProfile(p) {
  if (!p) return;

  // WhatsApp links (Book Now / CTAs / footer) → wa.me/<number>
  if (p.studio_whatsapp) {
    const num = String(p.studio_whatsapp).replace(/[^0-9]/g, '');
    if (num) {
      document.querySelectorAll('a[href*="wa.me"]').forEach((a) => {
        const query = (a.getAttribute('href') || '').split('?')[1];
        a.href = `https://wa.me/${num}${query ? `?${query}` : ''}`;
      });
    }
  }

  // Email links → mailto + visible text. Only rewrite the text of SIMPLE links
  // (no child elements) so rich cards like the Contact-page method cards keep
  // their icon/label markup; their value is updated via [data-studio] below.
  if (p.studio_email) {
    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      a.href = `mailto:${p.studio_email}`;
      if (!a.querySelector('*') && a.textContent && a.textContent.includes('@')) {
        a.textContent = p.studio_email;
      }
    });
    document.querySelectorAll('[data-studio="email"]').forEach((el) => { el.textContent = p.studio_email; });
  }

  // Phone: tel: links + the footer/inquiry phone-number link text
  if (p.studio_phone) {
    document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
      a.href = `tel:${String(p.studio_phone).replace(/\s/g, '')}`;
      if (!a.querySelector('*')) a.textContent = p.studio_phone; // simple links only
    });
    document.querySelectorAll('.footer__contact-links a[href*="wa.me"], .inquiry__contact-link[href*="wa.me"]')
      .forEach((a) => { a.textContent = p.studio_phone; });
    document.querySelectorAll('[data-studio="phone"]').forEach((el) => { el.textContent = p.studio_phone; });
  }

  // Address. The multi-line footer block is only rewritten when the studio has
  // entered explicit line breaks (WYSIWYG — one line per line). A single-line
  // value (the common case) is left to the correctly-grouped address baked into
  // the page markup: splitting it on every comma wrongly orphans parts like "5"
  // and "Finance Road" — or "Pune" and "Maharashtra" — onto separate lines.
  // Compact [data-studio="address"] targets always reflect the current value,
  // flattened to a single comma-separated line.
  if (p.studio_address) {
    const raw = escapeHTML(p.studio_address);
    const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length > 1) {
      document.querySelectorAll('.footer__address').forEach((addr) => {
        addr.innerHTML = lines.join('<br>');
      });
    }
    const inline = raw.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
    document.querySelectorAll('[data-studio="address"]').forEach((el) => {
      el.textContent = inline.join(', ');
    });
  }

  // Google Maps embed — accepts a raw embed URL or a pasted <iframe …> snippet
  if (p.studio_map_embed) {
    const m = String(p.studio_map_embed).match(/src=["']([^"']+)["']/);
    const src = m ? m[1] : (/^https?:\/\//.test(String(p.studio_map_embed).trim()) ? String(p.studio_map_embed).trim() : '');
    if (src) document.querySelectorAll('iframe[src*="google.com/maps"], .footer__map iframe').forEach((f) => { f.src = src; });
  }

  // Google rating — keep BOTH the homepage's structured data (#business
  // aggregateRating) and the visible rating badge in sync with the studio's
  // real Google rating, edited in the dashboard. No-ops where neither exists.
  if (p.studio_rating_value || p.studio_review_count) {
    applyRatingToSchema(p.studio_rating_value, p.studio_review_count);
    updateRatingBadge(p.studio_rating_value, p.studio_review_count);
  }
}

/* Update every visible Google-rating element from the dashboard values —
   the homepage testimonials badge AND the Contact-page reassurance strip
   (both use [data-rating-value]/[data-rating-count]). Bundled fallbacks stay
   for any field the dashboard hasn't set. */
function updateRatingBadge(ratingValue, reviewCount) {
  const rating = ratingValue ? Number(ratingValue) : null;
  const count = reviewCount ?? null;

  if (rating && rating > 0) {
    document.querySelectorAll('[data-rating-value]').forEach((el) => { el.textContent = rating.toFixed(1); });
    document.querySelectorAll('[data-rating-stars]').forEach((stars) => {
      stars.style.setProperty('--pct', `${Math.min(100, (rating / 5) * 100)}%`);
    });
  }
  if (count) document.querySelectorAll('[data-rating-count]').forEach((el) => { el.textContent = count; });

  const badge = document.querySelector('[data-rating-badge]');
  if (badge) {
    const shownRating = rating && rating > 0 ? rating.toFixed(1) : badge.querySelector('[data-rating-value]')?.textContent;
    const shownCount = count || badge.querySelector('[data-rating-count]')?.textContent;
    badge.setAttribute('aria-label', `Rated ${shownRating} out of 5 from ${shownCount} Google reviews`);
  }
}

/* Patch the aggregateRating of the LocalBusiness node inside the page's
   JSON-LD. Leaves the bundled fallback values in place for any field the
   dashboard hasn't set, and silently does nothing if the page has no
   #business schema (every page but the homepage). */
function applyRatingToSchema(ratingValue, reviewCount) {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let data;
    try { data = JSON.parse(script.textContent); } catch { continue; }
    const graph = Array.isArray(data['@graph']) ? data['@graph'] : [data];
    const business = graph.find(
      (node) => typeof node?.['@id'] === 'string' && node['@id'].endsWith('#business')
    );
    if (!business || !business.aggregateRating) continue;
    if (ratingValue) business.aggregateRating.ratingValue = String(ratingValue);
    if (reviewCount) business.aggregateRating.reviewCount = String(reviewCount);
    script.textContent = JSON.stringify(data);
    return;
  }
}

/* ── Defaults (mirrors the seed values in api/database.sql) ── */

export const SITE_CONTENT_DEFAULTS = {
  // Homepage "by the numbers" strip. Mirrors the values baked into index.html.
  site_stats_json: {
    stats: [
      { number: '15', suffix: '+', label: 'Years of Experience' },
      { number: '500', suffix: '+', label: 'Weddings Captured' },
      { number: '10', suffix: '', label: 'Press Features' },
      { number: '1000', suffix: '+', label: 'Happy Couples' },
    ],
  },

  site_weddings_enq_label: 'Begin Your Story',
  site_weddings_enq_title: 'Book Your *Wedding*',
  site_weddings_enq_text:
    'Loved what you found in this folder? Tell us about your celebration and ' +
    'we’ll get back within 24 hours — with ideas, availability and a fair quote.',
  site_weddings_enq_button: 'Send Inquiry',

  site_couple_enq_label: 'Your Story, Before The Wedding',
  site_couple_enq_title: 'Book Your *Couple Shoot*',
  site_couple_enq_text:
    'Pictured yourselves in one of these folders? Share a few details about ' +
    'the two of you and we’ll get back within 24 hours with dates, locations and ideas.',
  site_couple_enq_button: 'Send Inquiry',

  site_weddings_pkg_eyebrow: 'What We Offer',
  site_weddings_pkg_heading: 'Wedding *Collections*',
  site_weddings_packages_json: {
    packages: [
      {
        name: 'The Ceremony Collection',
        tagline: 'One wedding day',
        rows: [
          { label: 'Coverage', value: 'One wedding day' },
          { label: 'Team', value: '2 photographers' },
          { label: 'Deliverables', value: '400–500 fully edited images' },
          { label: 'Turnaround', value: '6–8 weeks' },
          { label: 'Album', value: 'One fine-art album, 30 spreads' },
        ],
      },
      {
        name: 'The Celebration Collection',
        tagline: 'Photographs + cinematic film',
        rows: [
          { label: 'Coverage', value: 'Up to 3 functions' },
          { label: 'Team', value: '2 photographers + 1 cinematographer' },
          { label: 'Deliverables', value: '700–900 images + a 5–7 minute film' },
          { label: 'Turnaround', value: '8–10 weeks' },
          { label: 'Album', value: 'One fine-art album, 40 spreads' },
        ],
      },
      {
        name: 'The Heirloom Collection',
        tagline: 'Every function, start to finish',
        rows: [
          { label: 'Coverage', value: 'All functions, multi-city' },
          { label: 'Team', value: '3 photographers + 2 cinematographers' },
          { label: 'Deliverables', value: '1200+ images, feature film + teaser' },
          { label: 'Turnaround', value: '10–12 weeks' },
          { label: 'Album', value: 'Two fine-art albums + parent copies' },
        ],
      },
    ],
  },

  site_couple_pkg_eyebrow: 'What to Expect',
  site_couple_pkg_heading: 'Choose Your *Session*',
  site_couple_packages_json: {
    packages: [
      {
        name: 'The Stills Collection',
        tagline: 'Photographs only',
        rows: [
          { label: 'Coverage', value: '2–3 hours' },
          { label: 'Deliverables', value: '80–120 fully edited images' },
          { label: 'Turnaround', value: '2–3 weeks' },
          { label: 'Locations', value: 'Pune + outstation on request' },
          { label: 'Outfit Changes', value: 'Up to 2 included' },
        ],
      },
      {
        name: 'The Cinema Collection',
        tagline: 'A cinematic couple film',
        rows: [
          { label: 'Coverage', value: '2–3 hours' },
          { label: 'Deliverables', value: 'A 60–90 second cinematic film' },
          { label: 'Turnaround', value: '3–4 weeks' },
          { label: 'Locations', value: 'Pune + outstation on request' },
          { label: 'Outfit Changes', value: 'Up to 2 included' },
        ],
      },
      {
        name: 'The Signature Collection',
        tagline: 'Photographs + cinematic film',
        rows: [
          { label: 'Coverage', value: '4–5 hours' },
          { label: 'Deliverables', value: '80–120 edited images + cinematic film' },
          { label: 'Turnaround', value: '3–4 weeks' },
          { label: 'Locations', value: 'Pune + outstation on request' },
          { label: 'Outfit Changes', value: 'Up to 3 included' },
        ],
      },
    ],
  },
};

/* ── Homepage "by the numbers" stat strip ──
   Updates the four About-section stats (number + suffix + label) from the CMS
   (settings group `site_content` → site_stats_json). Writes the real figure
   straight into the visible text so the strip is correct even if the count-up
   animation never fires, and refreshes the data-count/data-suffix attributes
   the counter animation reads. No-ops on pages without the stat strip. */
export function applyHomeStats(content = {}) {
  const cells = document.querySelectorAll('.about__stats .about__stat');
  if (!cells.length) return;

  const data = content.site_stats_json;
  const stats =
    data && Array.isArray(data.stats) && data.stats.length > 0
      ? data.stats
      : SITE_CONTENT_DEFAULTS.site_stats_json.stats;

  cells.forEach((cell, i) => {
    const stat = stats[i];
    if (!stat) return; // fewer CMS entries than cells → keep the baked value

    const numEl = cell.querySelector('.about__stat-number');
    const labelEl = cell.querySelector('.about__stat-label');
    const number = String(stat.number ?? '').trim();
    const suffix = String(stat.suffix ?? '').trim();

    if (numEl && number) {
      numEl.dataset.count = number;
      numEl.dataset.suffix = suffix;
      numEl.textContent = number + suffix;
    }
    if (labelEl && stat.label) labelEl.textContent = stat.label;
  });
}

/* ── Enquiry section copy ──
   Fills the [data-enq] slots inside an overlay enquiry section.
   `prefix` is the settings-key prefix: 'site_weddings_enq' | 'site_couple_enq'. */
export function applyEnquiryContent(prefix, content = {}) {
  const get = (suffix) =>
    content[`${prefix}_${suffix}`] || SITE_CONTENT_DEFAULTS[`${prefix}_${suffix}`];

  const slots = {
    label: document.querySelector('[data-enq="label"]'),
    title: document.querySelector('[data-enq="title"]'),
    text: document.querySelector('[data-enq="text"]'),
    button: document.querySelector('[data-enq="button"]'),
  };

  if (slots.label) slots.label.textContent = get('label');
  if (slots.title) slots.title.innerHTML = emphasize(get('title'));
  if (slots.text) slots.text.textContent = get('text');
  if (slots.button) slots.button.textContent = get('button');
}

/* ── Offering packages ──
   One card design, two sections: the couple-shoots session packages and the
   weddings collections. Both are dashboard-editable; the only differences are
   the settings keys, the mount and the BEM namespace, so they share a renderer
   rather than drifting apart. Card styling lives in package-cards.css. */

const packageCardHTML = (pkg, ns) => `
  <div class="${ns}__card">
    <div class="${ns}__head">
      <h3 class="${ns}__name">${escapeHTML(pkg.name)}</h3>
      ${pkg.tagline ? `<span class="${ns}__tagline">${escapeHTML(pkg.tagline)}</span>` : ''}
    </div>
    ${(pkg.rows || [])
      .filter((row) => row && row.label && row.value)
      .map((row) => `
        <div class="${ns}__row">
          <span class="${ns}__label">${escapeHTML(row.label)}</span>
          <span class="${ns}__value">${escapeHTML(row.value)}</span>
        </div>`)
      .join('')}
  </div>`;

function renderPackages(content, cfg) {
  const mount = document.getElementById(cfg.mountId);
  if (!mount) return;

  const data = content[cfg.jsonKey];
  const packages =
    data && Array.isArray(data.packages) && data.packages.length > 0
      ? data.packages
      : SITE_CONTENT_DEFAULTS[cfg.jsonKey].packages;

  const eyebrowEl = document.querySelector(`[${cfg.attr}="eyebrow"]`);
  const headingEl = document.querySelector(`[${cfg.attr}="heading"]`);
  if (eyebrowEl) {
    eyebrowEl.textContent =
      content[cfg.eyebrowKey] || SITE_CONTENT_DEFAULTS[cfg.eyebrowKey];
  }
  if (headingEl) {
    headingEl.innerHTML = emphasize(
      content[cfg.headingKey] || SITE_CONTENT_DEFAULTS[cfg.headingKey]
    );
  }

  mount.innerHTML = packages
    .filter((pkg) => pkg && pkg.name)
    .map((pkg) => packageCardHTML(pkg, cfg.ns))
    .join('');
}

/* Couple shoots — "What to Expect" session packages */
export function renderSessionPackages(content = {}) {
  renderPackages(content, {
    mountId: 'sessionPackages',
    ns: 'cpage-session',
    attr: 'data-pkg',
    jsonKey: 'site_couple_packages_json',
    eyebrowKey: 'site_couple_pkg_eyebrow',
    headingKey: 'site_couple_pkg_heading',
  });
}

/* Weddings — "Collections" packages */
export function renderWeddingPackages(content = {}) {
  renderPackages(content, {
    mountId: 'weddingPackages',
    ns: 'wpage-pkg',
    attr: 'data-wpkg',
    jsonKey: 'site_weddings_packages_json',
    eyebrowKey: 'site_weddings_pkg_eyebrow',
    headingKey: 'site_weddings_pkg_heading',
  });
}
