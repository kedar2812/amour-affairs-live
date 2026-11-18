/* ============================================================
   NAV.JS — Navigation Behavior
   Amour Affairs · Premium Wedding Photography
   ============================================================ */

import { loadStudioProfile } from './api.js';
import { applyStudioProfile } from './site-content.js';
import { initNotice } from './notice.js';
import './track.js'; // first-party pageview beacon — self-fires once on load
import { initOutboundTracking } from './analytics.js';
import { initConsent } from './consent.js';

export function initNav(lenisInstance) {
  const nav = document.querySelector('.nav');

  // GA4 contact-intent events (WhatsApp / call / email) + the cookie consent
  // banner. Both run before the `!nav` bail-out so they cover every page.
  initOutboundTracking();
  initConsent();

  // Studio profile (contact details + map) is editable from the dashboard
  // Settings → apply it to the footer/contact on every page. Non-blocking.
  loadStudioProfile().then(applyStudioProfile).catch(() => {});

  // Urgency / availability notice (announcement bar + homepage badge),
  // dashboard-driven. Non-blocking — never holds up the nav.
  initNotice().catch(() => {});

  const hamburger = document.querySelector('.nav__hamburger');
  const mobileMenu = document.querySelector('.nav__mobile-menu');
  const mobileLinks = document.querySelectorAll('.nav__mobile-link');
  const mobileFooter = document.querySelector('.nav__mobile-footer');

  if (!nav) return;

  // ── Scroll-based background transition ──
  // Home page has a 350vh hero pin spacer — detect it and use the correct threshold.
  // All other pages use a simple 60px threshold for the frosted glass effect.
  const isHomePage = !!document.querySelector('.hero--canvas');

  function getNavThreshold() {
    if (isHomePage) {
      // 3.55× viewport height covers the hero pin spacer (end: '+=350%') + small buffer
      return window.innerHeight * 3.55;
    }
    return 60;
  }

  let isDarkMode = false; // tracks footer intersection state

  function updateNav() {
    const currentScroll = window.scrollY || document.documentElement.scrollTop;
    const shouldScroll = currentScroll > getNavThreshold();

    // Apply scrolled class (frosted glass) — but never remove nav--dark, it takes precedence
    nav.classList.toggle('scrolled', shouldScroll);
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav(); // Initial check

  // ── Dark nav when footer is in view ──────────────────────────────────
  // When the footer enters the viewport, nav goes dark brown.
  // This overrides the normal 'scrolled' frosted-glass state visually via CSS specificity.
  const footer = document.querySelector('.footer');
  if (footer) {
    const footerObserver = new IntersectionObserver(
      (entries) => {
        isDarkMode = entries[0].isIntersecting;
        nav.classList.toggle('nav--dark', isDarkMode);
      },
      // Trigger as soon as even 1px of the footer enters the viewport
      { rootMargin: '0px 0px 0px 0px', threshold: 0 }
    );
    footerObserver.observe(footer);
  }

  // ── Smooth scroll for ALL internal anchor links (including #contact) ──
  // Selects any nav link whose href starts with "#" OR contains "/#"
  // so that clicking Contact scrolls to the footer on the current page.
  const allNavLinks = document.querySelectorAll('.nav__link, .nav__mobile-link');

  allNavLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href) return;

      // Pure anchor link (e.g. "#contact", "#hero")
      if (href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target && lenisInstance) {
          lenisInstance.scrollTo(target, { offset: -80 });
        }
        return;
      }

      // Cross-page anchor that matches current page root (e.g. "/#contact" when on "/")
      // Resolve against current origin
      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin &&
            url.pathname === window.location.pathname &&
            url.hash) {
          e.preventDefault();
          const target = document.querySelector(url.hash);
          if (target && lenisInstance) {
            lenisInstance.scrollTo(target, { offset: -80 });
          }
        }
      } catch (_) {
        // Not a valid URL — let the browser handle it
      }
    });
  });

  // ── Mobile hamburger toggle ──
  if (!hamburger || !mobileMenu) return;

  let isOpen = false;

  // Remove the social links from the mobile overlay (they live in the footer).
  mobileMenu.querySelector('.nav__mobile-footer')?.remove();

  // Inject a dedicated X close button into the overlay.
  let closeBtn = mobileMenu.querySelector('.nav__mobile-close');
  if (!closeBtn) {
    closeBtn = document.createElement('button');
    closeBtn.className = 'nav__mobile-close';
    closeBtn.setAttribute('aria-label', 'Close menu');
    closeBtn.innerHTML = '<span></span><span></span>';
    mobileMenu.appendChild(closeBtn);
  }
  closeBtn.addEventListener('click', () => { isOpen = false; toggleMobileMenu(false); });

  hamburger.addEventListener('click', () => {
    isOpen = !isOpen;
    toggleMobileMenu(isOpen);
  });

  function toggleMobileMenu(open) {
    hamburger.classList.toggle('active', open);

    if (open) {
      mobileMenu.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (lenisInstance) lenisInstance.stop();

      // Staggered animation using GSAP (imported dynamically)
      import('gsap').then(({ gsap }) => {
        gsap.to(mobileLinks, {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power3.out',
          delay: 0.2,
        });

        if (mobileFooter) {
          gsap.to(mobileFooter, {
            y: 0,
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
            delay: 0.5,
          });
        }
      });
    } else {
      // Reset and close
      import('gsap').then(({ gsap }) => {
        gsap.to(mobileLinks, {
          y: 40,
          opacity: 0,
          duration: 0.3,
          stagger: 0.04,
          ease: 'power2.in',
        });

        if (mobileFooter) {
          gsap.to(mobileFooter, {
            y: 20,
            opacity: 0,
            duration: 0.3,
            ease: 'power2.in',
          });
        }

        setTimeout(() => {
          mobileMenu.classList.remove('open');
          document.body.style.overflow = '';
          if (lenisInstance) lenisInstance.start();
        }, 400);
      });
    }
  }
}
