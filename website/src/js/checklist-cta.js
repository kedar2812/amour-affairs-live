/* ============================================================
   CHECKLIST-CTA.JS — Free Pune Wedding Photography Checklist
   Amour Affairs · Premium Wedding Photography

   Lead magnet: any element with [data-checklist-open] opens a
   popup asking for first name + email (+ optional wedding date).
   api/checklist.php files the couple as a CRM lead (source
   "Website (Checklist)"), emails them the PDF link, and returns
   the link so the thank-you state can offer it straight away.

   Importing this module is enough — it injects the popup once and
   binds every trigger on the page. The band markup (.ckl-band)
   lives in each page's HTML so it is visible without JS.
   ============================================================ */

import '../styles/checklist-cta.css';
import { gaEvent, metaEvent } from './analytics.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const PDF_PATH = '/downloads/Amour-Affairs-Pune-Wedding-Photography-Checklist.pdf';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function modalMarkup() {
  return `
    <div class="ckl-modal" id="cklModal" aria-hidden="true" data-lenis-prevent>
      <div class="ckl-modal__backdrop" data-ckl-close></div>
      <div class="ckl-modal__panel" role="dialog" aria-modal="true" aria-labelledby="cklTitle">
        <button class="ckl-modal__close" type="button" data-ckl-close aria-label="Close">&times;</button>

        <div class="ckl-form">
          <h2 class="ckl-modal__title" id="cklTitle">Get Your Free Pune Wedding Photography Checklist &#129293;</h2>
          <p class="ckl-modal__text">Planning your wedding in Pune? Download our free checklist to make sure you don&rsquo;t miss the important photography details before your big day.</p>

          <form id="cklForm" novalidate>
            <div class="ckl-hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>

            <label class="ckl-field" for="cklFirstName">
              <span class="ckl-field__label">First Name *</span>
              <input class="ckl-input" id="cklFirstName" type="text" name="first_name" autocomplete="given-name" maxlength="100" required>
            </label>
            <label class="ckl-field" for="cklEmail">
              <span class="ckl-field__label">Email Address *</span>
              <input class="ckl-input" id="cklEmail" type="email" name="email" autocomplete="email" inputmode="email" maxlength="255" required>
            </label>
            <label class="ckl-field" for="cklDate">
              <span class="ckl-field__label">Wedding Date <small>(optional)</small></span>
              <input class="ckl-input" id="cklDate" type="date" name="wedding_date">
            </label>

            <button class="ckl-submit" type="submit" id="cklSubmit">Get My Free Checklist</button>
            <p class="ckl-status" id="cklStatus" role="status" aria-live="polite"></p>
            <p class="ckl-consent">By submitting, you agree that Amour Affairs may email you the checklist and contact you about your wedding photography. We never share your details. See our <a href="/privacy-policy/" target="_blank" rel="noopener">Privacy Policy</a>.</p>
          </form>
        </div>

        <div class="ckl-done" role="status" aria-live="polite">
          <div class="ckl-done__icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <h2 class="ckl-modal__title">Thank you! Your Pune Wedding Photography Checklist is on its way. &#129293;</h2>
          <p class="ckl-done__text" id="cklDoneText"></p>
          <a class="ckl-done__download" id="cklDownload" href="${PDF_PATH}" target="_blank" rel="noopener" download>
            Download the Checklist <span aria-hidden="true">&darr;</span>
          </a>
        </div>
      </div>
    </div>`;
}

/** POST with one quiet retry when the request never really landed. */
async function postChecklist(payload) {
  const send = () => fetch(`${API_BASE}/checklist.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let res;
  try {
    res = await send();
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  } catch {
    await new Promise((r) => setTimeout(r, 900));
    res = await send();
  }
  const body = await res.json().catch(() => null);
  return { ok: res.ok, body };
}

export function initChecklistCta() {
  const triggers = document.querySelectorAll('[data-checklist-open]');
  if (!triggers.length || document.getElementById('cklModal')) return;

  document.body.insertAdjacentHTML('beforeend', modalMarkup());
  const modal = document.getElementById('cklModal');
  const form = document.getElementById('cklForm');
  const submit = document.getElementById('cklSubmit');
  const status = document.getElementById('cklStatus');
  const doneText = document.getElementById('cklDoneText');
  const download = document.getElementById('cklDownload');
  let lastTrigger = null;

  const open = (trigger) => {
    lastTrigger = trigger;
    modal.classList.remove('is-done');
    status.textContent = '';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    window.__lenis?.stop?.();
    gaEvent('checklist_open', { cta_location: trigger?.dataset.checklistOpen || 'page' });
    setTimeout(() => form.first_name.focus({ preventScroll: true }), 60);
  };
  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    window.__lenis?.start?.();
    lastTrigger?.focus?.({ preventScroll: true });
  };

  triggers.forEach((t) => t.addEventListener('click', (e) => { e.preventDefault(); open(t); }));
  modal.querySelectorAll('[data-ckl-close]').forEach((el) => el.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });

  const fail = (msg, field) => {
    status.textContent = msg;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  };

  form.addEventListener('input', (e) => e.target.removeAttribute?.('aria-invalid'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    const firstName = form.first_name.value.trim();
    const email = form.email.value.trim();
    const weddingDate = form.wedding_date.value;

    if (firstName.length < 2) return fail('Please enter your first name.', form.first_name);
    if (!EMAIL_RE.test(email)) return fail('Please enter a valid email address.', form.email);

    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = 'Sending…';

    try {
      const { ok, body } = await postChecklist({
        first_name: firstName,
        email,
        wedding_date: weddingDate,
        page: location.pathname,
        website: form.website.value, // honeypot
      });
      if (!ok) {
        fail((body && body.error) || 'Something went wrong. Please try again.');
        return;
      }
      gaEvent('generate_lead', { form_source: 'Checklist', cta_location: lastTrigger?.dataset.checklistOpen || 'page' });
      gaEvent('file_download', { file_name: 'Pune Wedding Photography Checklist' });
      metaEvent('Lead', { content_name: 'Checklist' });

      download.href = (body && body.download_url) || PDF_PATH;
      doneText.textContent = body && body.emailed
        ? `We've emailed it to ${email}. You can also download it right now:`
        : 'Download it right now:';
      modal.classList.add('is-done');
      form.reset();
    } catch {
      // Could not reach the API at all — still hand over the checklist.
      download.href = PDF_PATH;
      doneText.textContent = 'Download it right now:';
      modal.classList.add('is-done');
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChecklistCta);
} else {
  initChecklistCta();
}
