/* ============================================================
   CONSENT.JS — Cookie / analytics consent
   Amour Affairs · Premium Wedding Photography

   Google Consent Mode v2. The *defaults* are set in the inline
   gtag snippet in each page's <head> — they have to be, since they
   must be queued before the first page_view — and a returning
   visitor's stored answer is restored there too. This module only
   handles the visible half: showing the banner to someone who
   hasn't answered yet, and pushing the consent update when they do.

   Storage: localStorage key `aa_consent` = 'granted' | 'denied'.
   If storage is blocked the banner simply shows each visit and
   analytics stays denied — the privacy-safe direction to fail.
   ============================================================ */

import '../styles/sections/consent.css';

const STORAGE_KEY = 'aa_consent';
const PRIVACY_URL = '/privacy-policy/';

function storedChoice() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

function remember(choice) {
  try { localStorage.setItem(STORAGE_KEY, choice); } catch { /* storage blocked */ }
}

/** Tell the Google tag and the Meta Pixel what the visitor decided. */
function applyConsent(choice) {
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: choice });
    }
    if (typeof window.fbq === 'function') {
      window.fbq('consent', choice === 'granted' ? 'grant' : 'revoke');
    }
  } catch { /* consent must never break the page */ }
}

function bannerMarkup() {
  const el = document.createElement('section');
  el.className = 'aa-consent';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-label', 'Cookie preferences');
  el.innerHTML = `
    <div class="aa-consent__body">
      <h2 class="aa-consent__title">
        <span class="aa-consent__spark" aria-hidden="true">&#10022;</span>
        A note on cookies
      </h2>
      <p class="aa-consent__text">
        We use analytics and Meta (Facebook / Instagram) cookies to understand
        how couples find our work and to measure our ads — never sold on. Read more in our
        <a class="aa-consent__link" href="${PRIVACY_URL}">Privacy Policy</a>.
      </p>
    </div>
    <div class="aa-consent__actions">
      <button type="button" class="aa-consent__btn aa-consent__btn--decline" data-consent="denied">Decline</button>
      <button type="button" class="aa-consent__btn aa-consent__btn--accept" data-consent="granted">Accept</button>
    </div>
  `;
  return el;
}

let banner = null;

function close() {
  if (!banner) return;
  const el = banner;
  banner = null;
  document.documentElement.classList.remove('aa-consent-open');
  document.documentElement.style.removeProperty('--aa-consent-h');
  el.classList.remove('is-in');
  el.classList.add('is-out');
  setTimeout(() => el.remove(), 650);
}

function show() {
  if (banner) return;
  banner = bannerMarkup();
  document.body.appendChild(banner);
  document.documentElement.classList.add('aa-consent-open');

  banner.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-consent]');
    if (!btn) return;
    const choice = btn.dataset.consent;
    remember(choice);
    applyConsent(choice);
    close();
  });

  requestAnimationFrame(() => {
    if (!banner) return;
    // The WhatsApp button lifts above the card instead of hiding behind it.
    document.documentElement.style.setProperty('--aa-consent-h', `${banner.offsetHeight}px`);
    banner.classList.add('is-in');
  });
}

export function initConsent() {
  // Anyone who has already answered never sees the banner again — their
  // stored answer was applied by the <head> snippet before the first hit.
  if (storedChoice()) return;

  // Let the page reveal settle first; the banner should feel like it
  // arrived, not like it was part of the load.
  setTimeout(show, 1200);
}

// Lets the visitor change their mind later: any element with
// data-consent-open (e.g. a footer or privacy-policy link) reopens this.
document.addEventListener('click', (e) => {
  const trigger = e.target.closest && e.target.closest('[data-consent-open]');
  if (!trigger) return;
  e.preventDefault();
  show();
});
