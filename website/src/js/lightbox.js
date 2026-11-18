/* ============================================================
   LIGHTBOX.JS — Click-to-view image viewer with zoom & pan
   Amour Affairs · Premium Wedding Photography

   Shared by the Guides / Case Studies article templates: any
   image wired via initLightbox() opens full-screen on click and
   can be zoomed (wheel / double-click / pinch / buttons) and
   panned by dragging. Esc, the × button or the backdrop close it.
   Styles live in content-pages.css (.lb-*).
   ============================================================ */

const MIN_SCALE = 1;
const MAX_SCALE = 4;

let overlay = null;
let stage = null;
let imgEl = null;
let captionEl = null;
let counterEl = null;
let prevBtn = null;
let nextBtn = null;

let items = [];   // [{ src, alt }]
let index = 0;
let scale = 1;
let tx = 0;
let ty = 0;

// Pointer state (drag pan + two-finger pinch)
const pointers = new Map();
let pinchStartDist = 0;
let pinchStartScale = 1;
let dragStart = null; // { x, y, tx, ty, moved }

function apply() {
  imgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  stage.classList.toggle('is-zoomed', scale > 1.01);
}

function resetView() {
  scale = 1; tx = 0; ty = 0;
  apply();
}

/** Keep the image from being panned completely out of view. */
function clampPan() {
  const limitX = (stage.clientWidth * (scale - 1)) / 2 + stage.clientWidth * 0.25;
  const limitY = (stage.clientHeight * (scale - 1)) / 2 + stage.clientHeight * 0.25;
  tx = Math.max(-limitX, Math.min(limitX, tx));
  ty = Math.max(-limitY, Math.min(limitY, ty));
}

/** Zoom towards a viewport point so the spot under the cursor stays put. */
function zoomTo(nextScale, cx, cy) {
  const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
  const rect = stage.getBoundingClientRect();
  const ox = cx - rect.left - rect.width / 2;
  const oy = cy - rect.top - rect.height / 2;
  const ratio = clamped / scale;
  tx = ox - (ox - tx) * ratio;
  ty = oy - (oy - ty) * ratio;
  scale = clamped;
  if (scale <= 1.01) { tx = 0; ty = 0; }
  clampPan();
  apply();
}

function show(i) {
  index = (i + items.length) % items.length;
  const item = items[index];
  imgEl.src = item.src;
  imgEl.alt = item.alt || '';
  captionEl.textContent = item.alt || '';
  captionEl.style.display = item.alt ? '' : 'none';
  const many = items.length > 1;
  prevBtn.style.display = many ? '' : 'none';
  nextBtn.style.display = many ? '' : 'none';
  counterEl.textContent = many ? `${index + 1} / ${items.length}` : '';
  resetView();
}

function close() {
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (window.__lenis) window.__lenis.start();
  pointers.clear();
  dragStart = null;
}

function onKeydown(e) {
  if (!overlay || !overlay.classList.contains('is-open')) return;
  if (e.key === 'Escape') close();
  else if (e.key === 'ArrowLeft' && items.length > 1) show(index - 1);
  else if (e.key === 'ArrowRight' && items.length > 1) show(index + 1);
  else if (e.key === '+' || e.key === '=') zoomTo(scale * 1.4, window.innerWidth / 2, window.innerHeight / 2);
  else if (e.key === '-') zoomTo(scale / 1.4, window.innerWidth / 2, window.innerHeight / 2);
}

function build() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.className = 'lb-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="lb-backdrop"></div>
    <button type="button" class="lb-btn lb-close" aria-label="Close viewer">&times;</button>
    <button type="button" class="lb-btn lb-nav lb-prev" aria-label="Previous image">&larr;</button>
    <button type="button" class="lb-btn lb-nav lb-next" aria-label="Next image">&rarr;</button>
    <div class="lb-stage">
      <img class="lb-img" src="" alt="" draggable="false">
    </div>
    <div class="lb-footer">
      <div class="lb-zoombar">
        <button type="button" class="lb-btn lb-zoom-out" aria-label="Zoom out">&minus;</button>
        <button type="button" class="lb-btn lb-zoom-reset" aria-label="Reset zoom">1:1</button>
        <button type="button" class="lb-btn lb-zoom-in" aria-label="Zoom in">+</button>
      </div>
      <p class="lb-caption"></p>
      <span class="lb-counter"></span>
    </div>`;
  document.body.appendChild(overlay);

  stage = overlay.querySelector('.lb-stage');
  imgEl = overlay.querySelector('.lb-img');
  captionEl = overlay.querySelector('.lb-caption');
  counterEl = overlay.querySelector('.lb-counter');
  prevBtn = overlay.querySelector('.lb-prev');
  nextBtn = overlay.querySelector('.lb-next');

  overlay.querySelector('.lb-close').addEventListener('click', close);
  overlay.querySelector('.lb-backdrop').addEventListener('click', close);
  prevBtn.addEventListener('click', () => show(index - 1));
  nextBtn.addEventListener('click', () => show(index + 1));
  overlay.querySelector('.lb-zoom-in').addEventListener('click', () => zoomTo(scale * 1.4, window.innerWidth / 2, window.innerHeight / 2));
  overlay.querySelector('.lb-zoom-out').addEventListener('click', () => zoomTo(scale / 1.4, window.innerWidth / 2, window.innerHeight / 2));
  overlay.querySelector('.lb-zoom-reset').addEventListener('click', resetView);

  // Wheel = zoom (never scrolls the page behind)
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomTo(scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX, e.clientY);
  }, { passive: false });

  // Double-click / double-tap toggles zoom at that point
  stage.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (scale > 1.01) resetView();
    else zoomTo(2.5, e.clientX, e.clientY);
  });

  // Drag to pan + two-pointer pinch to zoom
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStartScale = scale;
      dragStart = null;
    } else if (pointers.size === 1) {
      dragStart = { x: e.clientX, y: e.clientY, tx, ty, moved: false };
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchStartDist > 0) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo(pinchStartScale * (dist / pinchStartDist), (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (pointers.size === 1 && dragStart && scale > 1.01) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragStart.moved = true;
      tx = dragStart.tx + dx;
      ty = dragStart.ty + dy;
      clampPan();
      apply();
    }
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStartDist = 0;
    if (pointers.size === 0) dragStart = null;
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  document.addEventListener('keydown', onKeydown);
}

function open(list, i) {
  if (!Array.isArray(list) || list.length === 0) return;
  build();
  items = list;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (window.__lenis) window.__lenis.stop();
  show(i);
}

/**
 * Make every image matching `selector` inside `root` open in the viewer.
 * All matched images become one gallery (prev/next navigates between them).
 */
export function initLightbox(root, selector) {
  const imgs = [...(root || document).querySelectorAll(selector)].filter((el) => el.src);
  if (imgs.length === 0) return;
  const list = imgs.map((el) => ({ src: el.currentSrc || el.src, alt: el.alt }));
  imgs.forEach((el, i) => {
    el.classList.add('lb-zoomable');
    el.addEventListener('click', () => open(list, i));
  });
}
