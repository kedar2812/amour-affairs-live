/* ============================================================
   FOOTER-TYPING.JS — Premium Typing Effect for Footer Tagline
   Amour Affairs · Premium Wedding Photography
   ============================================================ */

export function initFooterTyping() {
  const el = document.querySelector('.footer__tagline');
  if (!el) return;

  // The two parts: plain text and italic/champagne text
  const plain  = "Let's Create Something ";
  const styled = "Beautiful";

  // Build the final HTML once — italic span for "Beautiful"
  const targetHTML = `${plain}<em>${styled}</em>`;

  // ─── Type character by character ────────────────────────────
  let charIndex = 0;
  const fullText = plain + styled; // raw text for iteration
  let rafId = null;
  let lastTime = 0;
  const CHAR_DELAY = 55; // ms per character — slower = more premium feel

  // Cursor element
  el.innerHTML = '<span class="footer__cursor" aria-hidden="true"></span>';
  el.setAttribute('aria-label', plain + styled);

  // Track whether we've started (triggered by IntersectionObserver)
  let started = false;

  function renderFrame(timestamp) {
    if (timestamp - lastTime < CHAR_DELAY) {
      rafId = requestAnimationFrame(renderFrame);
      return;
    }
    lastTime = timestamp;

    charIndex++;

    const typed = fullText.slice(0, charIndex);

    // Apply styling: everything inside the "styled" portion gets wrapped in <em>
    let html = '';
    if (charIndex <= plain.length) {
      html = typed;
    } else {
      const styledPart = typed.slice(plain.length);
      html = plain + `<em>${styledPart}</em>`;
    }

    // Keep the blinking cursor at the end
    el.innerHTML = html + '<span class="footer__cursor" aria-hidden="true"></span>';

    if (charIndex < fullText.length) {
      rafId = requestAnimationFrame(renderFrame);
    } else {
      // Typing done — remove cursor after a short pause
      setTimeout(() => {
        el.innerHTML = targetHTML;
      }, 900);
    }
  }

  // ─── Only start when the footer enters the viewport ─────────
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !started) {
        started = true;
        observer.disconnect();
        // Small delay before typing starts so it feels intentional
        setTimeout(() => {
          rafId = requestAnimationFrame(renderFrame);
        }, 300);
      }
    },
    { threshold: 0.25 }
  );

  observer.observe(el);
}
