/* ============================================================
   GLOBE.JS — Revolving Globe (About section)
   Amour Affairs · Premium Wedding Photography

   A sculpted ivory globe turning on the page cream, painted into
   the section's existing <canvas>.

   There is deliberately no <video> element in the document. The
   plate is fetched as an ArrayBuffer, wrapped in a Blob, and handed
   to a decoder that only ever exists inside this module's closure,
   so the page offers no player chrome, no play/pause affordance,
   no "open video in new tab" and no media entry to save. The canvas
   is pointer-events:none (see about.css), so a right-click passes
   straight through it to the section beneath.

   The plate itself is a pre-rendered studio clip:
     · its backdrop is keyed out against a measured plate, so the
       globe and its cast shadow sit on the page cream with no
       rectangle edge — the border is feathered to page colour,
     · it is re-timed to constant angular velocity (the source
       accelerated ~2x across its run),
     · and it loops as a sinusoidal ping-pong. The source only ever
       sweeps ~110° of a revolution, so it cannot be cut-looped and
       a crossfade ghosts two hemispheres over each other; easing the
       angle on a cosine keeps velocity continuous through both
       turnarounds instead.

   Degradation, in order:
     plate decodes      → the globe turns
     reduced motion     → a single still frame, no playback
     autoplay refused   → whatever frame decoded, held still
     fetch/decode fails → canvas stays hidden, section reads fine
   ============================================================ */

/* Matches --color-bg-alt, which is what the plate was composited over. */
const PAGE = '#F5EDE2';

/* Two plates: the phone column tops out at 380px CSS, so it has no use
   for the large one and should not pay 1.3MB for it. */
const PLATE_LG = '/media/aa-globe-lg.bin';
const PLATE_SM = '/media/aa-globe-sm.bin';

/* Measured on the CSS box, not the backing store: about.css caps the column at
   380px on phones and 520px on tablets, so this cleanly sends only the phone
   layout to the small plate and never punishes a high-DPR phone for its DPR. */
const LARGE_MIN_CSS = 440;

export function initGlobe() {
  const canvas = document.getElementById('aboutGlobe');
  if (!canvas) return;

  /* alpha:false is both faster and honest — the plate is fully opaque. */
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const reduced =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  /* Size the backing store to the box. Returns false while the section is
     still display:none / zero-width so we can try again later. */
  function resize() {
    /* The reveal animation scales this canvas (0.9 -> 1, and 1.26 again on
       phones), and getBoundingClientRect folds that transform in — measuring
       mid-reveal sized the backing store to 610 for a 678px box and left the
       globe permanently upscaled. clientWidth ignores the transform, which is
       right pre-reveal but too small on phones, where the canvas really is
       drawn larger than its box. Take whichever is bigger. */
    const rect = canvas.getBoundingClientRect();
    const cw = Math.max(canvas.clientWidth, Math.round(rect.width));
    const ch = Math.max(canvas.clientHeight, Math.round(rect.height));
    if (!cw || !ch) return false;
    const w = Math.round(cw * dpr());
    const h = Math.round(ch * dpr());
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      /* Resizing clears the surface — repaint the ground immediately so an
         opaque context can never flash black behind the fade-in. */
      ctx.fillStyle = PAGE;
      ctx.fillRect(0, 0, w, h);
      return true;
    }
    return false;
  }

  resize();
  ctx.fillStyle = PAGE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /* Pick the plate from the box we are actually going to fill. If the section
     has not been laid out yet, fall back to the viewport — the visual column
     only goes wide on the two-column (>=1024px) layout. */
  const boxW =
    canvas.getBoundingClientRect().width ||
    (window.innerWidth >= 1024 ? 9999 : 0);
  const plate = boxW >= LARGE_MIN_CSS ? PLATE_LG : PLATE_SM;

  /* Declared before the fetch below resolves and reads it. */
  let visible = true;
  let video = null;
  let handle = 0;
  let running = false;
  let ready = false;
  let disposed = false;

  const useRVFC = () =>
    video && typeof video.requestVideoFrameCallback === 'function';

  function paint() {
    /* HAVE_CURRENT_DATA or better, else drawImage throws and we would leave a
       canvas that a resize has just cleared blank until something repaints. */
    if (!video || !canvas.width || video.readyState < 2) return false;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch {
      return false; /* frame not decodable yet */
    }
    if (!ready) {
      ready = true;
      canvas.classList.add('is-ready');
    }
    return true;
  }

  function tick() {
    if (disposed || !running) return;
    paint();
    handle = useRVFC()
      ? video.requestVideoFrameCallback(tick)
      : requestAnimationFrame(tick);
  }

  function start() {
    if (disposed || !video || reduced) return;
    /* Always put a frame up first. A backgrounded tab gets no rAF ticks, so if
       a resize cleared the canvas while hidden the loop alone would never
       restore it — the section would come back into view blank. */
    paint();
    if (running) return;
    running = true;
    const p = video.play();
    if (p && p.catch) p.catch(() => {}); /* held still is an acceptable end state */
    tick();
  }

  function stop() {
    if (!running) return;
    running = false;
    if (handle) {
      if (useRVFC()) video.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
      handle = 0;
    }
    if (video && !video.paused) video.pause();
  }

  /* ── Load ──────────────────────────────────────────────────── */
  fetch(plate, { credentials: 'same-origin' })
    .then((res) => {
      if (!res.ok) throw new Error('plate ' + res.status);
      return res.arrayBuffer();
    })
    .then((buf) => {
      if (disposed) return;
      /* The server sends this as an opaque blob; the media type is asserted
         here rather than by the URL, which is why the file needs no
         video extension to sit behind. */
      const url = URL.createObjectURL(new Blob([buf], { type: 'video/mp4' }));

      video = document.createElement('video'); /* never appended to the DOM */
      video.muted = true;
      video.defaultMuted = true;
      video.loop = !reduced;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.preload = 'auto';

      video.addEventListener('error', () => stop(), { once: true });

      video.addEventListener(
        'loadeddata',
        () => {
          if (disposed) return;
          resize();
          if (reduced) {
            paint(); /* one frame, then nothing moves */
            return;
          }
          if (visible && !document.hidden) start();
          else paint();
        },
        { once: true },
      );

      video.src = url;
      video.load();
    })
    .catch(() => {
      /* The section reads completely without the globe. */
    });

  /* ── Only run while it is actually on screen ───────────────── */
  if ('IntersectionObserver' in window) {
    visible = false;
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible && !document.hidden) start();
        else stop();
      },
      { rootMargin: '120px 0px' },
    );
    io.observe(canvas);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
    else paint(); /* off screen but visible again — leave a correct still frame */
  });

  /* Resizing the backing store clears it, so always repaint straight after. */
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => {
      if (resize()) paint();
    });
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', () => {
      if (resize()) paint();
    });
  }

  /* The reveal settles the scale from 0.9 to its final value; a ResizeObserver
     never sees that (the layout box did not move), so re-measure here. */
  canvas.addEventListener('transitionend', () => {
    if (resize()) paint();
  });

  /* Belt and braces: the canvas is already pointer-events:none, so this only
     matters if that rule is ever relaxed. */
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
