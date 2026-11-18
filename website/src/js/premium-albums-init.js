/* ============================================================
   PREMIUM-ALBUMS-INIT.JS — Dedicated init for Premium Albums page
   Amour Affairs · Premium Wedding Photography
   Albums & Prints: collection grid → gallery view → lightbox
   ============================================================ */

// ── Styles ──
import '../styles/reset.css';
import '../styles/variables.css';
import '../styles/typography.css';
import '../styles/components.css';
import '../styles/sections/hero.css';
import '../styles/sections/contact.css';
import '../styles/sections/inquiry.css';
import '../styles/service-pages.css';
import '../styles/premium-albums-page.css';
import '../styles/buttons.css'; // unified button identity — must load last
import '../styles/section-headers.css'; // one section-header identity — must load after the page CSS
import './testimonial-marquee.js'; // shared "Words From Our Couples" marquee above the enquiry form (dashboard-driven)

// ── Shared archive page behaviour + data ──
import { initArchivePage } from './archive-page.js';
import { initLeadForm } from './lead-form.js';
import { albums as fallbackAlbums } from './premium-albums-data.js';
import { loadArchiveAlbums } from './api.js';

// CMS albums first; bundled stock data if the API is unreachable
loadArchiveAlbums('premium_album', fallbackAlbums).then((albums) => initArchivePage({
  albums,
  prefix: 'ppage',
  folderWord: 'Collection',
  openWord: 'View Collection',
  photoWord: 'premium wedding album',
  onReady({ gsap }) {
    // Standing enquiry form before the footer — same lead pipeline
    initLeadForm();

    // Craftsmanship steps reveal (section unique to this page)
    if (document.querySelector('.ppage-craft')) {
      gsap.from('.ppage-craft__inner > *', {
        scrollTrigger: {
          trigger: '.ppage-craft',
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
