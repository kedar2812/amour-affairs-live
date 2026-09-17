/* ============================================================
   HERO-CANVAS.JS — Couple model canvas scroll scrubbing
   Amour Affairs · Premium Wedding Photography

   Architecture:
   ┌─────────────────────────────────────────────────────────┐
   │  ShaderGradient   z:0  — interactive React gradient bg  │
   │  #coupleCanvas    z:1  — 3D model (transparent WebP seq)│
   └─────────────────────────────────────────────────────────┘

   The background landscape canvas has been removed in favor
   of the ShaderGradient React component.
   ============================================================ */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ─── Constants ─────────────────────────────────────────── */
const TOTAL_FRAMES = 120;

// Phones can't afford the per-frame canvas shadows/tints below while scrubbing
// 120 frames — it makes the scroll stutter. On touch/small screens we draw a
// single lightweight image per tick (and cap DPR) so the scrub stays smooth.
const IS_MOBILE = (typeof window !== 'undefined') &&
  (window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches);

/* ─── Shared scroll state ────────────────────────────────── */
const scrollObj = { frame: 0, scale: 1.20 };

/* ─── Model canvas ───────────────────────────────────────── */
const modelFrames = new Array(TOTAL_FRAMES);
let modelCtx      = null;
let modelEl       = null;

/* ─── Helpers ────────────────────────────────────────────── */
function pad(n) { return String(n).padStart(4, '0'); }

function getDpr() { return Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2); }

function sizeCanvas(el, ctx) {
  const dpr  = getDpr();
  const rect = el.getBoundingClientRect();
  el.width   = rect.width  * dpr;
  el.height  = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: rect.width, h: rect.height };
}

/* ─── Draw model frame — height-based scale ─────────────── */
function drawModelFrame(idx, scale) {
  const img = modelFrames[Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(idx)))];
  if (!img || !modelCtx) return;

  const dpr = getDpr();
  const cw  = modelEl.width  / dpr;
  const ch  = modelEl.height / dpr;
  const ia  = img.naturalWidth / img.naturalHeight;

  let dh = ch * scale;
  let dw = dh * ia;
  if (dw > cw * 0.98) { dw = cw * 0.98; dh = dw / ia; }

  const dx  = (cw - dw) / 2;
  const dy  = ch * 0.44 - dh / 2;   // center-of-model at 44% height

  // Feet position (bottom of the drawn model area, offset slightly up)
  const feetY = dy + dh * 0.97;
  const cx    = cw / 2;

  modelCtx.clearRect(0, 0, cw, ch);

  // ── Mobile draw ──────────────────────────────────────────────────────────
  // The model frame is a 1440² square in which the couple occupies only ~32%
  // width / ~60% height (lots of transparent padding). The desktop path fits
  // the WHOLE square to the canvas, which on a narrow phone renders the couple
  // tiny (~120px). Instead, size the draw so the couple FILLS the screen — the
  // transparent margins simply overflow the sides (FILL tuned to 1.85). We also
  // apply the warm ground-shadow + amber tint so the couple reads as warm
  // carved stone matching the parchment bg, NOT a cold grey cut-out. The
  // expensive shadowBlur drop-shadow is intentionally omitted here so the
  // scroll scrub stays buttery on touch devices.
  if (IS_MOBILE) {
    const FILL  = 1.72;
    const SHIFT = -0.05;                    // nudge left: the dress flares right, so
                                            // centring the bounding box reads right-heavy
    const mdw   = cw * FILL * (scale / 1.20);
    const mdh   = mdw / ia;
    const mdx   = (cw - mdw) / 2 + cw * SHIFT;
    const mdy   = ch * 0.34 - mdh * 0.50;   // couple sits in the UPPER zone so the text
                                            // below it stays clear (a scrim fades the gap)
    const mcx   = cw / 2 + cw * SHIFT;
    const feetY = mdy + mdh * 0.80;         // couple's feet ≈ 80% down the frame

    // Ground shadow ellipse — anchors the couple to the scene.
    const rX = mdw * 0.20, rY = mdh * 0.022;
    const grad = modelCtx.createRadialGradient(mcx, feetY, 0, mcx, feetY, rX);
    grad.addColorStop(0,   'rgba(90, 55, 20, 0.52)');
    grad.addColorStop(0.5, 'rgba(90, 55, 20, 0.22)');
    grad.addColorStop(1,   'rgba(90, 55, 20, 0)');
    modelCtx.save();
    modelCtx.scale(1, rY / rX);
    modelCtx.fillStyle = grad;
    modelCtx.beginPath();
    modelCtx.arc(mcx, feetY * (rX / rY), rX, 0, Math.PI * 2);
    modelCtx.fill();
    modelCtx.restore();

    // The model.
    modelCtx.drawImage(img, mdx, mdy, mdw, mdh);

    // Warm amber tint — source-atop tints only the model's opaque pixels, so
    // the cool render takes on the hero's parchment warmth (no bg bleed).
    modelCtx.save();
    modelCtx.globalCompositeOperation = 'source-atop';
    modelCtx.fillStyle = 'rgba(223, 203, 170, 0.24)';
    modelCtx.fillRect(0, 0, cw, ch);
    modelCtx.fillStyle = 'rgba(74, 48, 22, 0.12)';
    modelCtx.fillRect(0, 0, cw, ch);
    modelCtx.restore();
    return;
  }

  // ── 1. Ground shadow ellipse — warm brown, anchors model to landscape ──
  const shadowRadX = dw * 0.26;
  const shadowRadY = dh * 0.028;
  const shadowGrad = modelCtx.createRadialGradient(
    cx, feetY, 0,
    cx, feetY, shadowRadX
  );
  shadowGrad.addColorStop(0,   'rgba(90, 55, 20, 0.48)');
  shadowGrad.addColorStop(0.5, 'rgba(90, 55, 20, 0.20)');
  shadowGrad.addColorStop(1,   'rgba(90, 55, 20, 0)');
  modelCtx.save();
  modelCtx.scale(1, shadowRadY / shadowRadX);   // squash into an ellipse
  modelCtx.fillStyle = shadowGrad;
  modelCtx.beginPath();
  modelCtx.arc(cx, feetY * (shadowRadX / shadowRadY), shadowRadX, 0, Math.PI * 2);
  modelCtx.fill();
  modelCtx.restore();

  // ── 2. Drop shadow — warm amber-brown, directional from top-right ──
  modelCtx.save();
  modelCtx.shadowColor    = 'rgba(100, 65, 25, 0.52)';
  modelCtx.shadowBlur     = 30;
  modelCtx.shadowOffsetX  = 8;
  modelCtx.shadowOffsetY  = 16;
  modelCtx.drawImage(img, dx, dy, dw, dh);
  modelCtx.restore();

  // ── 3. Warm amber tint — source-atop only tints existing canvas pixels ──
  // 'source-atop' paints only where the model was drawn (opaque pixels),
  // leaving the transparent background untouched — no orange bg bleed.
  // Muted warm-beige tint matches the hero bg (#F5EDE2) so the model
  // feels carved from the same stone — shadows provide the 3D pop.
  modelCtx.save();
  modelCtx.globalCompositeOperation = 'source-atop';
  modelCtx.fillStyle = 'rgba(223, 203, 170, 0.24)';
  modelCtx.fillRect(0, 0, cw, ch);
  // Deepen the stone a couple of shades so the model reads richer and
  // stands out from the light hero background — warm brown keeps it realistic.
  modelCtx.fillStyle = 'rgba(74, 48, 22, 0.12)';
  modelCtx.fillRect(0, 0, cw, ch);
  modelCtx.restore();
}

/* ─── Draw call ──────────────────────────────────────────── */
function drawAll() {
  drawModelFrame(scrollObj.frame, scrollObj.scale);
}

// On phones we load only every Nth frame (the lightweight draw keeps the
// previous frame for skipped indices, so the scrub still reads smoothly) —
// this roughly halves the hero's image payload, the page's biggest cost.
const FRAME_STEP = IS_MOBILE ? 2 : 1;

// How many frames must arrive before we reveal the hero. On phones we reveal
// much sooner (≈0.8 MB instead of ≈1.8 MB) — the rest stream in behind the
// scrub, so the page feels fast on mobile networks without losing any frames.
const EARLY_COUNT = IS_MOBILE ? 16 : 35;

/* ─── Preload frame set ──────────────────────────────────── */
function preloadFrameSet({ frames, urlFn, step, earlyCount, onProgress }) {
  return new Promise((resolve) => {
    const indices = [];
    for (let i = 0; i < TOTAL_FRAMES; i += step) indices.push(i);
    const target = indices.length;
    const early = Math.min(earlyCount, target);
    let loaded = 0, resolved = false;

    indices.forEach((i) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        frames[i] = img;
        loaded++;
        onProgress(loaded, target);
        if (!resolved && loaded >= early) { resolved = true; resolve(); }
        if (!resolved && loaded === target) { resolved = true; resolve(); }
      };
      img.onerror = () => {
        loaded++;
        if (!resolved && loaded >= early) { resolved = true; resolve(); }
      };
      img.src = urlFn(i + 1);
    });
  });
}

/* ─── Loading bar ────────────────────────────────────────── */
function createLoadingBar(heroEl) {
  const bar = document.createElement('div');
  bar.className = 'canvas-loader';
  bar.innerHTML = `
    <div class="canvas-loader__track">
      <div class="canvas-loader__fill" id="canvasLoaderFill"></div>
    </div>
    <span class="canvas-loader__label" id="canvasLoaderLabel">Loading…</span>
  `;
  heroEl.appendChild(bar);
  return {
    bar,
    fill:  bar.querySelector('#canvasLoaderFill'),
    label: bar.querySelector('#canvasLoaderLabel'),
  };
}

/* ─── MAIN ───────────────────────────────────────────────── */
export async function initHeroCanvas() {
  const heroEl = document.querySelector('.hero');
  const bodyEl = document.querySelector('.hero__body');
  modelEl      = document.getElementById('coupleCanvas');

  if (!heroEl || !modelEl) return;

  modelCtx = modelEl.getContext('2d');
  sizeCanvas(modelEl, modelCtx);

  gsap.set(bodyEl, { opacity: 0 });

  // ── ScrollTrigger created synchronously (pin-spacer must exist immediately) ──
  const scrubTl = gsap.timeline().to(scrollObj, {
    frame: TOTAL_FRAMES - 1,
    scale: 0.72,
    ease:  'none',
    onUpdate: drawAll,
  });

  ScrollTrigger.create({
    animation:     scrubTl,
    trigger:       heroEl,
    start:         'top top',
    // Shorter pinned scrub on phones — 350% of finger-travel feels sluggish and
    // janky on touch; 175% covers the same frame + text reveal with far less
    // scrolling, so the hero reads as snappy rather than "stuck". Slightly more
    // scrub smoothing on mobile softens the lower frame cadence.
    end:           IS_MOBILE ? '+=175%' : '+=350%',
    scrub:         IS_MOBILE ? 0.7 : 0.5,
    pin:           true,
    pinSpacing:    true,
    anticipatePin: 1,
    onUpdate: (self) => updateHeroTextLayers(self.progress, bodyEl),
  });

  setupTextLayerAnimations(bodyEl);

  // ── Resize ──
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      sizeCanvas(modelEl, modelCtx);
      drawAll();
    }, 100);
  });

  // ── Loading bar ──
  const loader = createLoadingBar(heroEl);
  let mdDone = 0, mdTarget = TOTAL_FRAMES;

  function updateLoader() {
    const pct = mdTarget ? mdDone / mdTarget : 1;
    loader.fill.style.width  = `${pct * 100}%`;
    loader.label.textContent = pct < 1 ? `${Math.round(pct * 100)}%` : 'Ready';
    if (modelFrames[0]) drawModelFrame(0, 1.20);
  }

  // ── Preload model frames, resolve early at 35 frames ──
  await preloadFrameSet({
    frames:     modelFrames,
    urlFn:      (n) => `/frames/frame-${pad(n)}.webp`,
    step:       FRAME_STEP,
    earlyCount: EARLY_COUNT,
    onProgress: (n, target) => { mdDone = n; mdTarget = target; updateLoader(); },
  });

  // ── Hide loader ──
  gsap.to(loader.bar, {
    opacity: 0, duration: 0.5, ease: 'power2.out',
    onComplete: () => loader.bar.remove(),
  });

  // ── Fade in model canvas ──
  gsap.fromTo(
    modelEl,
    { opacity: 0 },
    { opacity: 1, duration: 1.0, ease: 'power2.out' }
  );

  drawAll();
}

/* ─── Text layer state machine ───────────────────────────── */
let textState = -1;

/* Split the headline's second line into per-char <span>s for the blur shimmer.
   The whole line "we capture the eternal." shimmers in, while only the <em>
   keyword stays gold — so the split walks every text node inside the reveal
   span and keeps the <em> wrapper intact. (Splitting only the <em> left
   "we capture the" without the effect once the gold narrowed to one word.) */
function splitEmChars(bodyEl) {
  const line =
    bodyEl.querySelector('.hero__headline-reveal') ||
    bodyEl.querySelector('.hero__headline em');
  if (!line || line.dataset.split) return;
  line.dataset.split = 'true';

  const charSpan = (ch) => {
    const span = document.createElement('span');
    span.className = 'em-char';
    span.textContent = ch;
    span.style.display = 'inline-block';
    span.style.whiteSpace = 'pre';
    return span;
  };

  const splitTextNode = (node) => {
    const frag = document.createDocumentFragment();
    // Words stay unbreakable (nowrap wrapper); spaces stay real, breakable text
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
      const word = document.createElement('span');
      word.style.display = 'inline-block';
      word.style.whiteSpace = 'nowrap';
      part.split('').forEach((ch) => word.appendChild(charSpan(ch)));
      frag.appendChild(word);
    });
    node.replaceWith(frag);
  };

  const walk = (el) => {
    [...el.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent.trim()) splitTextNode(child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };
  walk(line);

  // Set initial blur state
  gsap.set(line.querySelectorAll('.em-char'), { opacity: 0, filter: 'blur(12px)' });
}

function setupTextLayerAnimations(bodyEl) {
  splitEmChars(bodyEl);
  gsap.set(
    bodyEl.querySelectorAll('.hero__eyebrow, .hero__headline, .hero__desc, .hero__cta, .hero__proof'),
    { opacity: 0, y: 30 }
  );
  gsap.to(bodyEl, { opacity: 1, duration: 0.8, ease: 'power2.out', delay: 0.3 });
}

function updateHeroTextLayers(p, bodyEl) {
  const q = (sel) => bodyEl.querySelector(sel);

  const show = (el, delay = 0) =>
    gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', delay });
  const hide = (el) =>
    gsap.to(el, { opacity: 0, y: 30, duration: 0.4 });

  if (p > 0.05 && textState < 0)  { textState = 0; show(q('.hero__eyebrow')); }
  if (p <= 0.05 && textState >= 0) { textState = -1; hide(q('.hero__eyebrow')); }

  if (p > 0.18 && textState < 1) {
    textState = 1;
    const headline = q('.hero__headline');
    show(headline, 0.05);
    // ── Per-char blur shimmer on the em (framer-motion blur preset equivalent) ──
    gsap.to(headline.querySelectorAll('.em-char'), {
      opacity: 1,
      filter:   'blur(0px)',
      duration: 0.55,
      stagger:  0.04,
      ease:     'power2.out',
      delay:    0.3,
    });
  }
  if (p <= 0.18 && textState >= 1) {
    textState = 0;
    const headline = q('.hero__headline');
    hide(headline);
    // Reset chars for next entrance
    gsap.set(headline.querySelectorAll('.em-char'), { opacity: 0, filter: 'blur(12px)' });
  }

  if (p > 0.38 && textState < 2)  { textState = 2; show(q('.hero__desc')); }
  if (p <= 0.38 && textState >= 2) { textState = 1; hide(q('.hero__desc')); }

  if (p > 0.50 && textState < 3)  { textState = 3; show(q('.hero__cta')); }
  if (p <= 0.50 && textState >= 3) { textState = 2; hide(q('.hero__cta')); }

  if (p > 0.68 && textState < 4)  { textState = 4; show(q('.hero__proof')); }
  if (p <= 0.68 && textState >= 4) { textState = 3; hide(q('.hero__proof')); }
}
