/* ============================================================
   INFO-PAGE-INIT.JS — Shared init for the five utility pages
   (privacy-policy, disclaimer, terms-and-conditions, faqs,
   careers). Amour Affairs · Premium Wedding Photography
   Preloader, standard nav, scroll reveals, FAQ tabs/accordion.
   ============================================================ */

// ── Styles ──
import '../styles/reset.css';
import '../styles/variables.css';
import '../styles/typography.css';
import '../styles/components.css';
import '../styles/sections/hero.css';
import '../styles/sections/contact.css';
import '../styles/info-page.css';
import '../styles/buttons.css'; // unified button identity — must load last
import '../styles/section-headers.css'; // one section-header identity — must load after the page CSS

// ── Libraries ──
import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ── Modules ──
import { initNav } from './nav.js';
import { initPreloader } from './animations.js';
import { loadFaqs } from './api.js';

gsap.registerPlugin(ScrollTrigger);

// ── Lenis Smooth Scroll ──
const lenis = new Lenis({
  duration: 1.4,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: 'vertical',
  smoothWheel: true,
  touchMultiplier: 2,
});

window.__lenis = lenis;

gsap.ticker.add((time) => { lenis.raf(time * 1000); });

lenis.on('scroll', () => { ScrollTrigger.update(); });

ScrollTrigger.scrollerProxy(document.body, {
  scrollTop(value) {
    if (arguments.length) lenis.scrollTo(value, { immediate: true });
    return lenis.scroll;
  },
  getBoundingClientRect() {
    return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
  },
  pinType: document.body.style.transform ? 'transform' : 'fixed',
});

ScrollTrigger.addEventListener('refresh', () => lenis.resize());
ScrollTrigger.defaults({ scroller: document.body });


/* ═══════════════════════════════════════════════════════
   FAQ TABS + ACCORDION (only present on the FAQs page)
   ═══════════════════════════════════════════════════════ */

function initFaqTabs() {
  const tabs = document.querySelectorAll('.ipage-tab');
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      document.querySelectorAll('.ipage-tabpanel').forEach((panel) => {
        panel.classList.toggle('is-active', panel.id === `tab-${tab.dataset.tab}`);
      });
    });
  });
}

function initFaqAccordion() {
  document.querySelectorAll('.ipage-faq').forEach((item) => {
    const q = item.querySelector('.ipage-faq__q');
    const a = item.querySelector('.ipage-faq__a');
    if (!q || !a) return;

    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      item.classList.toggle('is-open', !isOpen);
      q.setAttribute('aria-expanded', String(!isOpen));
      a.style.maxHeight = isOpen ? '0' : `${a.scrollHeight}px`;
    });
  });
}

/* Build a single .ipage-faq accordion item from CMS data. */
function faqItemMarkup(question, answer) {
  const paras = String(answer)
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('') || `<p>${escapeHtml(answer)}</p>`;

  return `
    <div class="ipage-faq">
      <button class="ipage-faq__q" aria-expanded="false">
        <span class="ipage-faq__q-text">${escapeHtml(question)}</span>
        <span class="ipage-faq__icon"><svg viewBox="0 0 10 10" fill="none" stroke-width="1.5"><line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/></svg></span>
      </button>
      <div class="ipage-faq__a"><div class="ipage-faq__a-inner">${paras}</div></div>
    </div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* Replace the bundled FAQ panels with dashboard-managed content, if any. */
async function renderFaqsFromCms() {
  const beforePanel = document.getElementById('tab-before');
  if (!beforePanel) return; // not the FAQs page

  const groups = await loadFaqs();
  if (!groups) return; // keep bundled fallback when the CMS has none

  const map = { before: 'tab-before', during: 'tab-during', after: 'tab-after' };
  for (const [cat, panelId] of Object.entries(map)) {
    const panel = document.getElementById(panelId);
    if (!panel) continue;
    const items = groups[cat] || [];
    if (items.length === 0) continue; // leave the bundled questions for empty categories
    panel.innerHTML = items.map((f) => faqItemMarkup(f.question, f.answer)).join('');
  }
}

/* Inject a FAQPage JSON-LD block built from whatever questions are on the page
   (CMS or bundled), so the structured data always matches the visible content. */
function injectFaqSchema() {
  const items = [...document.querySelectorAll('.ipage-faq')]
    .map((item) => {
      const q = item.querySelector('.ipage-faq__q-text')?.textContent?.trim();
      const a = item.querySelector('.ipage-faq__a-inner')?.textContent?.replace(/\s+/g, ' ').trim();
      if (!q || !a) return null;
      return {
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      };
    })
    .filter(Boolean);

  if (items.length === 0) return;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items,
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}


/* ═══════════════════════════════════════════════════════
   ANIMATIONS
   ═══════════════════════════════════════════════════════ */

function initHeroEntrance() {
  const tl = gsap.timeline({ delay: 0.15 });

  tl.from('.ipage-hero__eyebrow', {
    y: 20, opacity: 0, duration: 1.0, ease: 'power3.out'
  });
  tl.from('.ipage-hero__title', {
    y: 35, opacity: 0, duration: 1.2, ease: 'power3.out'
  }, '-=0.7');
  if (document.querySelector('.ipage-hero__sub')) {
    tl.from('.ipage-hero__sub', {
      y: 20, opacity: 0, duration: 1.0, ease: 'power3.out'
    }, '-=0.7');
  }
}

function initScrollReveals() {
  gsap.utils.toArray('.ipage-reveal').forEach((el) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: 'top 95%',
        toggleActions: 'play none none none',
      },
      y: 35,
      opacity: 0,
      duration: 1.0,
      ease: 'power2.out'
    });
  });
}


/* ═══════════════════════════════════════════════════════
   BOOT SEQUENCE
   ═══════════════════════════════════════════════════════ */

async function init() {
  await initPreloader();       // hide preloader first — never gate it on the FAQ API
  initNav(lenis);
  try { await renderFaqsFromCms(); } catch (e) { console.error('faqs CMS', e); } // swap in dashboard-managed FAQs before binding
  initFaqTabs();
  initFaqAccordion();
  injectFaqSchema();           // structured data matches whatever rendered
  initHeroEntrance();
  initScrollReveals();
  ScrollTrigger.refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
