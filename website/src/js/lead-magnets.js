/* ============================================================
   LEAD-MAGNETS.JS — Free downloadable guides with lead capture
   Amour Affairs · Premium Wedding Photography

   Renders active lead magnets into #lmGrid and handles the gated
   download: a small form captures the visitor (creating a lead)
   before the PDF is delivered. Fail-safe — if the API is down the
   whole section simply hides itself.
   ============================================================ */

import { fetchFromAPI, assetUrl, responsiveAttrs } from './api.js';
import { escapeHtml, decodeDeep } from './content-page.js';
import { gaEvent, metaEvent } from './analytics.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function cardMarkup(m) {
  const cover = m.cover_path
    ? `<div class="lm-card__media"><img ${responsiveAttrs(assetUrl(m.cover_path), '(max-width: 768px) 92vw, 33vw')} alt="${escapeHtml(m.title)}" loading="lazy" decoding="async"></div>`
    : `<div class="lm-card__media lm-card__media--blank"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>`;
  return `
    <div class="lm-card cp-reveal">
      ${cover}
      <div class="lm-card__body">
        <h3 class="lm-card__title">${escapeHtml(m.title)}</h3>
        <p class="lm-card__desc">${escapeHtml(m.description || '')}</p>
        <button type="button" class="lm-card__btn" data-magnet="${m.id}" data-title="${escapeHtml(m.title)}">
          ${escapeHtml(m.button_label || 'Download Free Guide')} <span aria-hidden="true">&darr;</span>
        </button>
      </div>
    </div>`;
}

function modalMarkup() {
  return `
    <div class="lm-modal" id="lmModal" aria-hidden="true">
      <div class="lm-modal__backdrop" data-close></div>
      <div class="lm-modal__panel" role="dialog" aria-modal="true" aria-labelledby="lmModalTitle">
        <button class="lm-modal__close" type="button" data-close aria-label="Close">&times;</button>
        <span class="lm-modal__eyebrow">Free Download</span>
        <h3 class="lm-modal__title" id="lmModalTitle">Your Guide</h3>
        <p class="lm-modal__text">Tell us who you are and it's yours — instantly.</p>
        <form id="lmForm" novalidate>
          <div class="lm-hp" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
          <input class="lm-input" type="text" name="client_name" placeholder="Your name *" autocomplete="name" maxlength="200" required>
          <input class="lm-input" type="tel" name="phone" placeholder="Phone *" autocomplete="tel" maxlength="20" required>
          <input class="lm-input" type="email" name="email" placeholder="Email (optional)" autocomplete="email" maxlength="255">
          <button class="lm-submit" type="submit" id="lmSubmit">Get the Guide</button>
          <p class="lm-status" id="lmStatus" role="status" aria-live="polite"></p>
        </form>
      </div>
    </div>`;
}

export async function initLeadMagnets() {
  const section = document.getElementById('lmSection');
  const grid = document.getElementById('lmGrid');
  if (!section || !grid) return;

  const data = await fetchFromAPI('lead_magnets.php');
  const magnets = data && Array.isArray(data.lead_magnets) ? decodeDeep(data.lead_magnets) : [];
  if (magnets.length === 0) {
    section.style.display = 'none';
    return;
  }

  grid.innerHTML = magnets.map(cardMarkup).join('');
  section.insertAdjacentHTML('beforeend', modalMarkup());
  section.style.display = '';

  const modal = document.getElementById('lmModal');
  const form = document.getElementById('lmForm');
  const status = document.getElementById('lmStatus');
  const submit = document.getElementById('lmSubmit');
  const titleEl = document.getElementById('lmModalTitle');
  let currentId = null;
  let currentTitle = '';

  const open = (id, title) => {
    currentId = id;
    currentTitle = title || '';
    titleEl.textContent = title || 'Your Guide';
    status.textContent = '';
    status.classList.remove('is-error', 'is-success');
    form.reset();
    form.style.display = '';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  grid.querySelectorAll('.lm-card__btn').forEach((btn) => {
    btn.addEventListener('click', () => open(btn.dataset.magnet, btn.dataset.title));
  });
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentId) return;

    // Name + phone are required; email is optional but must be valid if given.
    const name = form.client_name.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email.value.trim();
    if (name.length < 2) { status.textContent = 'Please enter your name.'; status.classList.add('is-error'); return; }
    if (!/^[0-9+\-\s().]{7,20}$/.test(phone)) { status.textContent = 'Please enter a valid phone number.'; status.classList.add('is-error'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status.textContent = 'Please enter a valid email.'; status.classList.add('is-error'); return; }

    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = 'Sending…';
    status.textContent = '';
    status.classList.remove('is-error', 'is-success');

    try {
      const res = await fetch(`${API_BASE}/lead_magnets.php?action=download&id=${encodeURIComponent(currentId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: name,
          phone,
          email,
          website: form.website.value, // honeypot
        }),
      });
      const body = await res.json().catch(() => null);

      if (res.ok && body && body.file_url) {
        // A gated download is both a download and a new lead — report both.
        gaEvent('file_download', { file_name: currentTitle, magnet_id: currentId });
        gaEvent('generate_lead', { form_source: 'Lead Magnet', magnet_title: currentTitle });
        metaEvent('Lead', { content_name: currentTitle });
        form.style.display = 'none';
        status.classList.add('is-success');
        status.innerHTML = `Your guide is ready — <a href="${assetUrl(body.file_url)}" target="_blank" rel="noopener">open it here</a> if the download doesn't start.`;
        // Trigger the download / open
        window.open(assetUrl(body.file_url), '_blank', 'noopener');
      } else {
        status.classList.add('is-error');
        status.textContent = (body && body.error) || 'Something went wrong. Please try again.';
        submit.disabled = false;
        submit.textContent = original;
      }
    } catch {
      status.classList.add('is-error');
      status.textContent = 'Couldn’t reach the server. Please try again later.';
      submit.disabled = false;
      submit.textContent = original;
    }
  });
}
