/* ============================================================
   COUPLE-SHOOTS-INIT.JS — Dedicated init for Couple Shoots page
   Amour Affairs · Premium Wedding Photography
   The Couples Archive: folder grid → album view (photos first,
   then the couple film, then a booking enquiry) → lightbox,
   plus the three session packages below the folders.
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
import '../styles/couple-shoots-page.css';
import '../styles/package-cards.css'; // session package cards — shared with weddings
import '../styles/buttons.css'; // unified button identity — must load last
import '../styles/section-headers.css'; // one section-header identity — must load after the page CSS
import './testimonial-marquee.js'; // shared "Words From Our Couples" marquee above the enquiry form (dashboard-driven)

// ── Shared archive page behaviour + data ──
import { initArchivePage } from './archive-page.js';
import { albums as fallbackAlbums } from './couple-shoots-albums-data.js';
import { loadArchiveAlbums, loadSiteContent } from './api.js';
import { applyEnquiryContent, renderSessionPackages } from './site-content.js';
import { initLeadForm } from './lead-form.js';

// Dashboard-editable copy (enquiry section + session packages)
const siteContentPromise = loadSiteContent().catch(() => null);

// The packages section must exist before scroll reveals are measured,
// so paint the bundled defaults immediately; CMS overrides re-render.
renderSessionPackages({});

// CMS albums first; bundled stock data if the API is unreachable
loadArchiveAlbums('couple_shoot', fallbackAlbums).then((albums) => initArchivePage({
  albums,
  prefix: 'cpage',
  filmLabel: 'The Couple Film',
  photoWord: 'pre-wedding shoot',
  cardChip: false, // no "Folder 01" chip on the grid thumbnails
  cardMetaMode: 'location', // under the couple name, show the location only
  onReady({ gsap, ScrollTrigger }) {
    // The enquiry form inside the opened folder feeds the leads pipeline
    initLeadForm();
    siteContentPromise.then((content) => {
      if (content) {
        applyEnquiryContent('site_couple_enq', content);
        renderSessionPackages(content);
        if (ScrollTrigger) ScrollTrigger.refresh();
      }
    });

    // Session packages reveal (section unique to this page)
    if (document.querySelector('.cpage-session')) {
      gsap.from('.cpage-session__inner > *', {
        scrollTrigger: {
          trigger: '.cpage-session',
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        y: 35,
        opacity: 0,
        stagger: 0.15,
        duration: 1.0,
        ease: 'power2.out',
      });
    }
  },
}));
