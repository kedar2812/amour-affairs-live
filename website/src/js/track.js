/* ============================================================
   TRACK.JS — First-party pageview tracker
   Amour Affairs · Premium Wedding Photography

   Sends one cookieless beacon per page load to /api/track.php,
   which powers the dashboard's Website Traffic view. No cookies,
   no personal data — just a per-tab session id (sessionStorage)
   and the page/referrer/UTM. Fire-and-forget; failures are
   ignored so the site is never affected.
   ============================================================ */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function sessionId() {
  try {
    let id = sessionStorage.getItem('aa_sid');
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) ||
        ('s-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
      sessionStorage.setItem('aa_sid', id);
    }
    return id;
  } catch {
    return null;
  }
}

function trackPageview() {
  // Never track the admin dashboard, and respect explicit opt-out.
  if (/^admin\./i.test(location.hostname)) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  let utmSource = '';
  try { utmSource = new URLSearchParams(location.search).get('utm_source') || ''; } catch { /* noop */ }

  const payload = JSON.stringify({
    path: location.pathname,
    referrer: document.referrer || '',
    utm_source: utmSource,
    session_id: sessionId(),
  });

  const url = `${API_BASE}/track.php`;
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    /* analytics must never break the page */
  }
}

trackPageview();
