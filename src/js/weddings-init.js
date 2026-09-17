/* ============================================================
   WEDDINGS-INIT.JS — Dedicated init for Weddings page
   Amour Affairs · Premium Wedding Photography
   The Wedding Archive: folder grid → album view (photos first,
   then the wedding film, then a booking enquiry) → lightbox,
   plus a love-letter testimonial marquee near the page end.
   ============================================================ */

// ── Styles ──
import '../styles/reset.css';
import '../styles/variables.css';
import '../styles/typography.css';
import '../styles/components.css';
import '../styles/sections/hero.css';
import '../styles/sections/inquiry.css'; // folder enquiry form (same design as home)
import '../styles/sections/contact.css';
import '../styles/service-pages.css';
import '../styles/testimonials-page.css'; // reuse the exact testimonial card + marquee design
import '../styles/weddings-page.css';
import '../styles/testimonial-marquee.css'; // marquee section shell — shared with the other pages
import '../styles/package-cards.css'; // Collections cards — shared with couple shoots
import '../styles/buttons.css'; // unified button identity — must load last
import '../styles/section-headers.css'; // one section-header identity — must load after the page CSS

// ── Shared archive page behaviour + data ──
import { initArchivePage } from './archive-page.js';
import { albums as fallbackAlbums } from './weddings-albums-data.js';
import { loadArchiveAlbums, loadWeddingsTestimonials, loadSiteContent } from './api.js';
import { fallbackWeddingsTestimonials } from './weddings-testimonials-data.js';
import { testimonialCardHTML } from './testimonial-cards.js';
import { applyEnquiryContent, renderWeddingPackages } from './site-content.js';
import { initLeadForm } from './lead-form.js';

/* ── Testimonial marquee ─────────────────────────────────── */

const MAX_MARQUEE_CARDS = 15;

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

function renderMarquee(testimonials) {
  const mount = document.getElementById('weddingsTestiMarquee');
  if (!mount) return;

  const list = shuffle(testimonials).slice(0, MAX_MARQUEE_CARDS);
  if (list.length === 0) {
    mount.closest('.wpage-testi')?.remove();
    return;
  }

  // Cards rendered twice so the marqueeLeft (-50%) loop is seamless
  const cards = list.map(testimonialCardHTML).join('');
  mount.innerHTML = `
    <div class="tpage-marquee-wrap">
      <div class="tpage-row tpage-row--left">
        <div class="tpage-row__track">${cards}${cards}</div>
      </div>
    </div>`;
}

/* ── Boot ────────────────────────────────────────────────── */

// Fetch CMS content in parallel with albums so nothing blocks anything
const testimonialsPromise = loadWeddingsTestimonials(STOCK_PHOTOS).catch(() => null);
const siteContentPromise = loadSiteContent().catch(() => null);

// Paint the bundled Collections cards immediately so the section is present
// before scroll reveals are measured; CMS overrides re-render below.
renderWeddingPackages({});

loadArchiveAlbums('wedding', fallbackAlbums).then((albums) => {
  initArchivePage({
    albums,
    prefix: 'wpage',
    filmLabel: 'The Wedding Film',
    cardChip: false, // no "Folder 01" chip on the grid thumbnails
    cardMetaMode: 'location', // under the couple name, show the location only

    onReady: async ({ ScrollTrigger }) => {
      // The enquiry form inside the opened folder feeds the leads pipeline
      initLeadForm();
      siteContentPromise.then((content) => {
        if (content) {
          applyEnquiryContent('site_weddings_enq', content);
          renderWeddingPackages(content);
          if (ScrollTrigger) ScrollTrigger.refresh();
        }
      });

      const cms = await testimonialsPromise;
      const testimonials = cms && cms.length >= 4 ? cms : fallbackWeddingsTestimonials;
      renderMarquee(testimonials);
      // The marquee changes page height — recompute scroll-triggered reveals
      if (ScrollTrigger) ScrollTrigger.refresh();
    },
  });
});
