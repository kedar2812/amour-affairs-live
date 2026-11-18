/* ============================================================
   ANALYTICS.JS — Google tag (GA4) events
   Amour Affairs · Premium Wedding Photography

   The gtag.js snippet itself lives in each page's <head> so it
   loads before the bundle. This module only *sends* events on top
   of it: enquiry submissions, guide downloads, and the contact
   intents (WhatsApp / call / email) that matter commercially.

   Every call is defensive — if the tag is blocked by an ad-blocker,
   a consent tool, or a flaky network, it silently no-ops. Analytics
   must never break the site.
   ============================================================ */

export const GA_MEASUREMENT_ID = 'G-F9MZ2ZETYL'; // Google tag "Amour Affairs - GA4" (alias GT-57Z7KGW)

/**
 * Send a GA4 event. Falls back to a raw dataLayer push if gtag.js
 * hasn't finished loading yet — the queue is replayed on load.
 */
export function gaEvent(name, params = {}) {
  const payload = { page_path: location.pathname, ...params };
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, payload);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, ...payload });
    }
  } catch {
    /* analytics must never break the page */
  }
}

/**
 * Send a Meta Pixel standard event (Lead, Contact, …). The base code in each
 * page's <head> queues calls until fbevents.js loads, and holds them back
 * until the visitor accepts cookies. No-ops if the pixel is blocked.
 */
export function metaEvent(name, params = {}) {
  try {
    if (typeof window.fbq === 'function') window.fbq('track', name, params);
  } catch {
    /* analytics must never break the page */
  }
}

// Best-effort label for *where* on the page a link was clicked, so the
// same WhatsApp number in the nav, the hero and the footer stay distinct.
function linkLocation(el) {
  const nav = el.closest('.nav, .nav__mobile-menu');
  if (nav) return 'nav';
  const footer = el.closest('footer, .footer, .contact');
  if (footer) return 'footer';
  const section = el.closest('section[id], [id]');
  return (section && section.id) || 'page';
}

/**
 * One delegated listener for the whole document — covers links that are
 * rendered later by the CMS just as well as the ones baked into the HTML.
 */
export function initOutboundTracking() {
  document.addEventListener(
    'click',
    (e) => {
      const link = e.target.closest && e.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href') || '';
      const params = { link_url: href, link_location: linkLocation(link) };

      if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/i.test(href)) {
        gaEvent('contact_whatsapp', params);
        metaEvent('Contact', { content_category: 'whatsapp' });
      } else if (/^tel:/i.test(href)) {
        gaEvent('contact_call', params);
        metaEvent('Contact', { content_category: 'call' });
      } else if (/^mailto:/i.test(href)) {
        gaEvent('contact_email', params);
        metaEvent('Contact', { content_category: 'email' });
      }
    },
    true, // capture — fires even when a handler stops propagation
  );
}
