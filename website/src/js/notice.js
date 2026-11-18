/* ============================================================
   NOTICE.JS — Urgency / booking-availability notice
   Amour Affairs · Premium Wedding Photography

   Renders a site-wide announcement bar and (on the homepage) a
   floating availability badge. Every aspect — copy, CTA, colours,
   position, on/off, dismissibility — is driven by the dashboard
   (settings group `notice`). Fail-safe: any problem = no notice,
   the site is never blocked.
   ============================================================ */

import '../styles/sections/notice.css';
import { loadNotice } from './api.js';

const DISMISS_KEY = 'aa_notice_dismissed';
const BADGE_DISMISS_KEY = 'aa_notice_badge_dismissed';
const isOn = (v) => String(v) === '1' || String(v).toLowerCase() === 'true';

// Kick the fetch off at module load — well before the preloader finishes — so
// the data is ready the instant initNotice() runs and the bar paints on reveal,
// instead of being queued behind the homepage's heavy 3D-hero initialisation.
const noticePromise = loadNotice().catch(() => null);

/** Allow only safe link targets; anything else becomes a plain anchor. */
function safeLink(value) {
  const v = String(value || '').trim();
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(v)) return v;
  return '';
}

/** Validate a CSS hex colour, else return the fallback. */
function safeColor(value, fallback) {
  const v = String(value || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : fallback;
}

/* ── Season years ──
   The notice copy names the seasons being booked ("Now booking 2026 & 2027
   weddings", "Limited 2026 dates"). Those numbers have to roll over on
   1 January IST — the studio's clock, not the visitor's — without anyone
   opening the dashboard, and the bar and badge must never disagree.

   Two ways to write a year in the dashboard copy:
     · {year} / {year+1}  — tokens, always resolved to the current IST year
     · a literal "2026"   — left exactly as typed until it falls into the
                            past, at which point every literal year across
                            both strings shifts by the same amount, so
                            "2026 & 2027" becomes "2027 & 2028".
   A literal year still in the future is somebody's deliberate choice, so
   it is never touched. */
const YEAR_RE = /\b(20\d{2})\b/g;

/** The current year in Asia/Kolkata, whatever timezone the visitor is in. */
function istYear() {
  try {
    const y = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata', year: 'numeric',
    }).format(new Date()), 10);
    if (y >= 2000) return y;
  } catch { /* no tz data in this engine — fall through */ }
  // IST is a flat UTC+5:30 and has never observed DST.
  return new Date(Date.now() + 5.5 * 3600 * 1000).getUTCFullYear();
}

/** Resolve {year} / {year+1} / {year-1} against the IST year. */
function resolveYearTokens(text, year) {
  return String(text || '').replace(
    /\{\s*year\s*([+-]\s*\d+)?\s*\}/gi,
    (_, offset) => String(year + (offset ? parseInt(offset.replace(/\s+/g, ''), 10) : 0)),
  );
}

/** Shift the literal years in every string by one shared delta, so that the
    earliest of them is never behind `year`. Returns the strings in order. */
function syncYears(texts, year) {
  let earliest = Infinity;
  for (const text of texts) {
    for (const match of text.matchAll(YEAR_RE)) {
      earliest = Math.min(earliest, parseInt(match[1], 10));
    }
  }
  const delta = earliest === Infinity ? 0 : Math.max(0, year - earliest);
  if (delta === 0) return texts;
  return texts.map((text) => text.replace(YEAR_RE, (y) => String(parseInt(y, 10) + delta)));
}


export async function initNotice() {
  let n;
  try { n = await noticePromise; } catch { return; }
  if (!n || !isOn(n.notice_enabled)) return;

  // Bar and badge share one delta so their years can never drift apart.
  const year = istYear();
  const [message, badgeCopy] = syncYears([
    resolveYearTokens(n.notice_message, year),
    resolveYearTokens(n.notice_badge_text, year),
  ], year).map((text) => text.trim());

  const ctaLabel = (n.notice_cta_label || '').trim();
  const ctaLink = safeLink(n.notice_cta_link);
  const bg = safeColor(n.notice_bg_color, '#2A1E16');
  const fg = safeColor(n.notice_text_color, '#F5EDE2');

  if (isOn(n.notice_bar_enabled) && message) {
    renderBar({ message, ctaLabel, ctaLink, bg, fg, position: n.notice_bar_position, dismissible: isOn(n.notice_dismissible) });
  }

  // Floating badge — homepage only (where the hero lives).
  if (isOn(n.notice_badge_enabled) && document.querySelector('.hero--canvas')) {
    const badgeText = badgeCopy || message;
    if (badgeText) renderBadge({ badgeText, ctaLink, bg, fg });
  }
}


/* ── Announcement bar ── */
function renderBar({ message, ctaLabel, ctaLink, bg, fg, position, dismissible }) {
  // Dismissal only lasts the current visit (sessionStorage) — the bar
  // returns on the next visit so the urgency message is never forgotten.
  if (dismissible) {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === message) return;
    } catch { /* storage blocked — just show it */ }
  }

  const atBottom = String(position).toLowerCase() === 'bottom';
  const bar = document.createElement('div');
  bar.className = `aa-notice-bar${atBottom ? ' aa-notice-bar--bottom' : ' aa-notice-bar--top'}`;
  bar.style.setProperty('--notice-bg', bg);
  bar.style.setProperty('--notice-fg', fg);
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Announcement');

  const inner = document.createElement('div');
  inner.className = 'aa-notice-bar__inner';

  // The same live-availability dot the floating badge wears (notice.css
  // styles both from one rule) — decorative, so it stays out of the AT tree.
  const dot = document.createElement('span');
  dot.className = 'aa-notice-bar__dot';
  dot.setAttribute('aria-hidden', 'true');
  inner.appendChild(dot);

  const msg = document.createElement('span');
  msg.className = 'aa-notice-bar__msg';
  msg.textContent = message;
  inner.appendChild(msg);

  if (ctaLabel && ctaLink) {
    const cta = document.createElement('a');
    cta.className = 'aa-notice-bar__cta';
    cta.href = ctaLink;
    cta.textContent = ctaLabel;
    if (/^https?:\/\//i.test(ctaLink)) { cta.target = '_blank'; cta.rel = 'noopener'; }
    inner.appendChild(cta);
  }

  bar.appendChild(inner);

  const offsetVar = atBottom ? '--notice-hb' : '--notice-h';

  if (dismissible) {
    const close = document.createElement('button');
    close.className = 'aa-notice-bar__close';
    close.setAttribute('aria-label', 'Dismiss announcement');
    close.innerHTML = '&times;';
    close.addEventListener('click', () => {
      try { sessionStorage.setItem(DISMISS_KEY, message); } catch { /* ignore */ }
      animateClose(bar, offsetVar);
    });
    bar.appendChild(close);
  }

  document.body.appendChild(bar);

  // Reserve space for the bar so it never overlaps the nav / hero. The page
  // reflows; tell ScrollTrigger (homepage pin) to recompute via a resize tick.
  const applyOffset = () => {
    document.documentElement.style.setProperty(offsetVar, `${bar.offsetHeight}px`);
  };
  applyOffset();
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  window.addEventListener('resize', applyOffset, { passive: true });
}

/* Collapse the bar smoothly: slide it off-screen while the page animates the
   reclaimed space shut, then remove it from the DOM. */
function animateClose(bar, offsetVar) {
  const root = document.documentElement;
  root.classList.add('aa-notice-animating');
  bar.classList.add('is-closing');
  root.style.setProperty(offsetVar, '0px');

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    bar.remove();
    root.classList.remove('aa-notice-animating');
    window.dispatchEvent(new Event('resize'));
  };
  bar.addEventListener('transitionend', (e) => {
    if (e.target === bar && e.propertyName === 'transform') finish();
  });
  setTimeout(finish, 700); // fallback if transitionend doesn't fire
}


/* ── Floating availability badge (homepage) ── */
function renderBadge({ badgeText, ctaLink, bg, fg }) {
  // Like the bar, a closed badge stays hidden only for the current visit.
  try {
    if (sessionStorage.getItem(BADGE_DISMISS_KEY) === badgeText) return;
  } catch { /* storage blocked — just show it */ }

  const tag = ctaLink ? 'a' : 'div';
  const badge = document.createElement(tag);
  badge.className = 'aa-notice-badge';
  badge.style.setProperty('--notice-bg', bg);
  badge.style.setProperty('--notice-fg', fg);
  if (ctaLink) {
    badge.href = ctaLink;
    if (/^https?:\/\//i.test(ctaLink)) { badge.target = '_blank'; badge.rel = 'noopener'; }
  }

  const dot = document.createElement('span');
  dot.className = 'aa-notice-badge__dot';
  dot.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'aa-notice-badge__label';
  label.textContent = badgeText;

  const close = document.createElement('button');
  close.className = 'aa-notice-badge__close';
  close.setAttribute('aria-label', 'Hide availability badge');
  close.innerHTML = '&times;';
  close.addEventListener('click', (e) => {
    // The badge itself may be a link — closing must not navigate.
    e.preventDefault();
    e.stopPropagation();
    try { sessionStorage.setItem(BADGE_DISMISS_KEY, badgeText); } catch { /* ignore */ }
    badge.classList.add('is-hidden');
    setTimeout(() => badge.remove(), 650);
  });

  badge.append(dot, label, close);
  document.body.appendChild(badge);

  // Reveal after a beat, then stay put while the visitor scrolls —
  // the × is how it goes away.
  requestAnimationFrame(() => badge.classList.add('is-in'));
}
