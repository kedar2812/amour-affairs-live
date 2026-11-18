/* ============================================================
   LEAD-FORM.JS — Website inquiry form
   Amour Affairs · Premium Wedding Photography

   Validates and submits the home-page contact form to the
   CMS lead pipeline. Mirrors the server's rules so almost
   every error is caught before the request; if the API is
   unreachable the visitor is pointed to WhatsApp instead.
   ============================================================ */

import { submitInquiry } from './api.js';
import { gaEvent, metaEvent } from './analytics.js';

const STUDIO_WHATSAPP = '919921000052';

/**
 * Last resort. If the API could not be reached even after retries, the visitor
 * must not be left retyping their details into WhatsApp by hand — that is how a
 * booking gets lost. Hand them a WhatsApp link already carrying everything they
 * filled in, so one tap still delivers the enquiry.
 */
function whatsappHandoff(values) {
  const lines = [
    'Hi Amour Affairs, I tried the website enquiry form but it didn’t go through. Here are my details:',
    '',
    `Name: ${values.client_name}`,
    values.phone ? `Phone: ${values.phone}` : '',
    values.email ? `Email: ${values.email}` : '',
    values.event_type ? `Event: ${values.event_type}` : '',
    values.event_date ? `Date: ${values.event_date}` : '',
    values.venue ? `Venue: ${values.venue}` : '',
    values.guest_count ? `Guests: ${values.guest_count}` : '',
    values.budget_range ? `Budget: ${values.budget_range}` : '',
    values.message ? `\n${values.message}` : '',
  ].filter(Boolean);

  return `https://wa.me/${STUDIO_WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/* ── International enquiries ───────────────────────────────────────────────
   Couples abroad (NRI families, destination weddings) need three things the
   original form assumed away: a dialling code, a venue country, and an
   explicit currency. Every inquiry form shares this module, so the extra
   controls are added here rather than hand-copied into each page's HTML.
   The API contract is unchanged: the code is folded into `phone` and the
   country into `venue` before submitting. */

const DIAL_CODES = [
  ['India', '+91'],
  ['UAE', '+971'],
  ['USA / Canada', '+1'],
  ['United Kingdom', '+44'],
  ['Australia', '+61'],
  ['Singapore', '+65'],
  ['New Zealand', '+64'],
  ['Saudi Arabia', '+966'],
  ['Qatar', '+974'],
  ['Kuwait', '+965'],
  ['Oman', '+968'],
  ['Bahrain', '+973'],
  ['Germany', '+49'],
  ['France', '+33'],
  ['Netherlands', '+31'],
  ['Ireland', '+353'],
  ['Switzerland', '+41'],
  ['Italy', '+39'],
  ['Spain', '+34'],
  ['Sweden', '+46'],
  ['Hong Kong', '+852'],
  ['Malaysia', '+60'],
  ['Thailand', '+66'],
  ['Indonesia', '+62'],
  ['Japan', '+81'],
  ['South Africa', '+27'],
  ['Kenya', '+254'],
  ['Mauritius', '+230'],
  ['Nepal', '+977'],
  ['Sri Lanka', '+94'],
  ['Bangladesh', '+880'],
];

const VENUE_COUNTRIES = [
  'India', 'UAE', 'Thailand', 'Indonesia (Bali)', 'Sri Lanka', 'Maldives',
  'Nepal', 'Mauritius', 'Singapore', 'Malaysia', 'Vietnam', 'Oman', 'Qatar',
  'Turkey', 'Italy', 'France', 'Greece', 'Portugal', 'Spain',
  'United Kingdom', 'Ireland', 'USA', 'Canada', 'Australia', 'New Zealand',
];

const OTHER_COUNTRY = 'Other';

/** A native <select> laid invisibly over a short visible "face", so the
 *  closed control stays compact ("+91") while the open list reads in full. */
function makePicker({ name, label, options }) {
  const picker = document.createElement('span');
  picker.className = 'inquiry__picker';

  const face = document.createElement('span');
  face.className = 'inquiry__picker-face';
  face.setAttribute('aria-hidden', 'true');

  const select = document.createElement('select');
  select.className = 'inquiry__picker-select';
  select.name = name;
  select.setAttribute('aria-label', label);
  options.forEach(([text, value]) => select.add(new Option(text, value)));

  const sync = () => { face.textContent = select.value; };
  select.addEventListener('change', sync);
  sync();

  picker.append(face, select);
  return picker;
}

/** Put `picker` in front of `input`, joined into one control. */
function comboWrap(input, picker) {
  const combo = document.createElement('div');
  combo.className = 'inquiry__combo';
  input.replaceWith(combo);
  combo.append(picker, input);
}

/** Replace a label's leading text, keeping its "(optional)" span. */
function relabel(label, text) {
  if (label?.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.nodeValue = text;
}

function enhanceInternational(form) {
  const phone = form.elements.phone;
  if (phone && !form.elements.phone_cc) {
    comboWrap(phone, makePicker({
      name: 'phone_cc',
      label: 'Country code',
      options: DIAL_CODES.map(([country, code]) => [`${country} (${code})`, code]),
    }));
    phone.maxLength = 15; // + the longest code still fits the API's 20-char rule
    phone.placeholder = 'Mobile number';
  }

  const venue = form.elements.venue;
  if (venue && !form.elements.venue_country) {
    comboWrap(venue, makePicker({
      name: 'venue_country',
      label: 'Venue country',
      options: [...VENUE_COUNTRIES, OTHER_COUNTRY].map((c) => [c, c]),
    }));
    venue.maxLength = 200; // leaves room for ", <country>" within 255
    relabel(form.querySelector(`label[for="${venue.id}"]`), 'Country & Venue ');
  }

  const budget = form.elements.budget_range;
  if (budget && !form.querySelector('.inquiry__hint')) {
    relabel(form.querySelector(`label[for="${budget.id}"]`), 'Budget in INR (₹) ');
    const hint = document.createElement('span');
    hint.className = 'inquiry__hint';
    hint.textContent = 'All packages are quoted in Indian Rupees (INR). ₹1,00,000 = 1 lakh ≈ US$1,150.';
    budget.after(hint);
  }
}

/** Phone as the studio should dial it: "+44 7700 900123". A number already
 *  written internationally (+…, 00…, or the code typed in front) is kept. */
function composePhone(raw, code) {
  const number = raw.trim();
  if (!number || !code || /^(\+|00)/.test(number)) return number;
  const digits = number.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith(code.replace(/\D/g, ''))) return `+${digits}`;
  return `${code} ${number.replace(/^0+/, '')}`;
}

/** Venue with its country appended: "Taj, Goa, India". */
function composeVenue(place, country) {
  const where = place.trim();
  if (!country || country === OTHER_COUNTRY) return where;
  if (!where) return country === 'India' ? '' : country; // India is the untouched default
  return where.toLowerCase().includes(country.toLowerCase()) ? where : `${where}, ${country}`;
}

// Wire every inquiry form on the page. A page may carry more than one
// (e.g. the Weddings page has a folder-overlay form and a page-foot form);
// each is bound independently with its own submit button and status line.
//
// Safe to call repeatedly: pages call it from their boot sequence, and the
// module also binds itself on load (see the bottom of this file).
export function initLeadForm() {
  document.querySelectorAll('form.inquiry__form').forEach(bindLeadForm);
}

function bindLeadForm(form) {
  // Idempotent — every page's init() also calls initLeadForm(), and binding a
  // second handler would submit the enquiry twice.
  if (form.dataset.leadFormBound === '1') return;

  const submitBtn = form.querySelector('.inquiry__submit');
  const status = form.querySelector('.inquiry__status');
  if (!submitBtn || !status) return;

  form.dataset.leadFormBound = '1';
  enhanceInternational(form);
  let isSubmitting = false;

  const fieldEl = (input) => input.closest('.inquiry__field');

  function setFieldError(input, message) {
    const field = fieldEl(input);
    if (!field) return;
    field.classList.toggle('has-error', !!message);
    const errorEl = field.querySelector('.inquiry__field-error');
    if (errorEl) errorEl.textContent = message || '';
  }

  function clearErrors() {
    form.querySelectorAll('.inquiry__field-error').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
    status.textContent = '';
    status.classList.remove('is-error');
  }

  // Mirrors the server-side rules in api/leads.php
  function validate() {
    const name = form.client_name.value.trim();
    const phone = composePhone(form.phone.value, form.elements.phone_cc?.value);
    const email = form.email.value.trim();
    let firstInvalid = null;

    const fail = (input, message) => {
      setFieldError(input, message);
      if (!firstInvalid) firstInvalid = input;
    };

    if (name.length < 2) {
      fail(form.client_name, 'Please enter your name');
    }
    if (!phone && !email) {
      fail(form.phone, 'A phone number or email is required');
    }
    if (phone && !/^[0-9+\-\s().]{7,20}$/.test(phone)) {
      fail(form.phone, 'Please enter a valid phone number');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail(form.email, 'Please enter a valid email address');
    }
    if (form.message.value.length > 2000) {
      fail(form.message, 'Message is too long (2000 characters max)');
    }

    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function showSuccess() {
    form.innerHTML = `
      <div class="inquiry__success">
        <span class="inquiry__success-title">Thank you — we received your inquiry.</span>
        <p class="inquiry__success-text">
          Our team will get back to you within 24 hours. Can’t wait?
          Reach us anytime on <a class="inquiry__contact-link" href="https://wa.me/919921000052"
          target="_blank" rel="noopener">WhatsApp</a>.
        </p>
      </div>
    `;
  }

  // Clear a field's error as soon as the visitor edits it
  form.querySelectorAll('.inquiry__input').forEach((input) => {
    input.addEventListener('input', () => setFieldError(input, ''));
  });
  form.querySelectorAll('.inquiry__picker-select').forEach((select) => {
    select.addEventListener('change', () => setFieldError(select, ''));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    clearErrors();
    if (!validate()) return;

    isSubmitting = true;
    submitBtn.disabled = true;
    const originalLabel = submitBtn.innerHTML;
    submitBtn.textContent = 'Sending…';

    // Read defensively — a form variant that omits an optional field must
    // never throw here (that would leave the button stuck on "Sending…").
    const val = (name) => (form.elements[name]?.value ?? '');

    const values = {
      client_name: val('client_name').trim(),
      phone: composePhone(val('phone'), val('phone_cc')),
      email: val('email').trim(),
      event_type: val('event_type'),
      event_date: val('event_date'),
      venue: composeVenue(val('venue'), val('venue_country')),
      guest_count: val('guest_count'),
      budget_range: val('budget_range'),
      message: val('message').trim(),
      source: form.dataset.source || 'Website', // which page this form sits on
      page: form.dataset.page || '', // exact article path (guide/case-study), if any
      website: val('website'), // honeypot — empty for humans
    };

    const result = await submitInquiry(values);

    if (result.ok) {
      // GA4 conversion — which page/form produced the enquiry, and for what
      gaEvent('generate_lead', {
        form_source: form.dataset.source || 'Website',
        event_type: val('event_type') || '',
        article_page: form.dataset.page || '',
      });
      metaEvent('Lead', { content_name: form.dataset.source || 'Website' });
      showSuccess();
      return;
    }

    isSubmitting = false;
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalLabel;
    status.classList.add('is-error');
    if (result.error) {
      status.textContent = result.error; // server validation / rate-limit message
      return;
    }

    // Unreachable even after retries. The visitor's answers are still in the
    // form (nothing is cleared), and the WhatsApp link below carries them, so
    // the enquiry can still reach the studio in one tap.
    status.innerHTML =
      'We couldn’t reach our booking system just now. Your details are safe below — ' +
      `<a class="inquiry__contact-link" href="${whatsappHandoff(values)}" target="_blank" rel="noopener">` +
      'send them to us on WhatsApp</a> (one tap, already filled in) or call ' +
      '<a class="inquiry__contact-link" href="tel:+919921000052">+91 99210 00052</a>. ' +
      'You can also press Send again.';
  });
}

/* ── Bind as early as the DOM allows ───────────────────────────────────────
   Every page also calls initLeadForm() from its own boot sequence, but those
   sit behind `await initPreloader()` and the animation setup. Until the handler
   is attached, pressing Send performs a NATIVE form submission: the page
   navigates to itself with the visitor's name, phone and email pasted into the
   query string, and the enquiry is never sent. Binding here, at module
   evaluation, closes that window — bindLeadForm() is idempotent, so the later
   initLeadForm() calls are no-ops. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeadForm, { once: true });
} else {
  initLeadForm();
}
