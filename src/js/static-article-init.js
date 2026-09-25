/* ============================================================
   STATIC-ARTICLE-INIT.JS — hand-built article pages
   Amour Affairs · Premium Wedding Photography

   For SEO articles that live as their own static page (e.g.
   /wedding-photography-pune-venues/) instead of in the Guides
   CMS. The copy, meta and JSON-LD are all in the HTML, so the
   page is fully crawlable without JS — this entry only adds the
   shared chrome, the lightbox and the enquiry form. Reuse it for
   any further static article: same guide-article look, no CMS.
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

import { createLenis, finishBoot, initAnchorScroll } from './content-page.js';
import { initLeadForm } from './lead-form.js';
import { initLightbox } from './lightbox.js';

async function init() {
  const lenis = createLenis();
  initLeadForm();
  initLightbox(document.getElementById('cpArticle'), '.cp-article__cover, .cp-figure img');
  initAnchorScroll(lenis);
  await finishBoot(lenis);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
