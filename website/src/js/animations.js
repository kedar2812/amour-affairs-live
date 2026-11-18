/* ============================================================
   ANIMATIONS.JS — All ScrollTrigger Animations
   Amour Affairs · Premium Wedding Photography
   ============================================================ */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ── Text Reveal Animation for headlines ── */
export function initTextReveals() {
  // Split text into words for animation, preserving <em> emphasis per word
  document.querySelectorAll('.text-reveal').forEach((el) => {
    const buildWords = (text, emphasize) =>
      text.split(' ').filter(w => w.length > 0).map((word) =>
        `<span class="word"><span class="word-inner">${emphasize ? `<em>${word}</em>` : word}</span></span>`
      );
    const parts = [];
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(...buildWords(node.textContent, false));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        parts.push(...buildWords(node.textContent, node.tagName === 'EM'));
      }
    });
    el.innerHTML = parts.join(' ');
  });

  // Animate each text-reveal on scroll
  document.querySelectorAll('.text-reveal').forEach((el) => {
    const wordInners = el.querySelectorAll('.word-inner');
    gsap.set(wordInners, { y: '110%', opacity: 0 });

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      onEnter: () => {
        gsap.to(wordInners, {
          y: '0%',
          opacity: 1,
          duration: 1.0,
          ease: 'power3.out',
          stagger: 0.06,
        });
      },
      once: true,
    });
  });
}

/* ── Fade Up Reveals ── */
export function initFadeReveals() {
  gsap.utils.toArray('.fade-up').forEach((el) => {
    gsap.from(el, {
      y: 60,
      opacity: 0,
      duration: 1.0,
      ease: 'power3.out',
      clearProps: 'transform',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    });
  });
}

/* ── Fade In from sides ── */
export function initSlideReveals() {
  gsap.utils.toArray('.slide-left').forEach((el) => {
    gsap.from(el, {
      x: -60,
      opacity: 0,
      duration: 1.0,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    });
  });

  gsap.utils.toArray('.slide-right').forEach((el) => {
    gsap.from(el, {
      x: 60,
      opacity: 0,
      duration: 1.0,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none none',
      },
    });
  });
}

/* ── Parallax Sections ── */
export function initParallax() {
  const isMobile = window.innerWidth < 768;
  const intensity = isMobile ? 15 : 30;

  document.querySelectorAll('.parallax-img').forEach((img) => {
    gsap.to(img, {
      yPercent: intensity,
      ease: 'none',
      scrollTrigger: {
        trigger: img.parentElement,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });
}

/* ── Service Cards Stagger ── */
export function initServiceCards() {
  const cards = gsap.utils.toArray('.service-card');

  // Prime GPU layers before animation
  gsap.set(cards, { willChange: 'opacity, transform' });

  cards.forEach((card, i) => {
    const xDir = i % 2 === 0 ? -40 : 40;
    gsap.fromTo(card,
      { x: xDir, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.9,
        ease: 'power3.out',
        clearProps: 'willChange,x',
        scrollTrigger: {
          trigger: card,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      }
    );
  });
}

/* ── Gallery Image Reveals ── */
export function initGalleryReveals() {
  gsap.utils.toArray('.gallery__item').forEach((item, i) => {
    gsap.from(item, {
      scale: 0.92,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out',
      delay: i * 0.08,
      scrollTrigger: {
        trigger: item,
        start: 'top 90%',
        toggleActions: 'play none none none',
      },
    });
  });
}

/* ── Process Steps — scroll-driven highlight with illustration reveals ── */
export function initProcessAnimation() {
  const steps = gsap.utils.toArray('.process__step');
  const lineFill = document.querySelector('.process__line-fill');
  const stepsContainer = document.querySelector('.process__steps');

  if (!stepsContainer || !steps.length) return;

  // Remove any pre-existing step-active classes
  steps.forEach((s) => s.classList.remove('step-active'));

  // Staggered entrance animation for each step's illustration + info
  steps.forEach((step, i) => {
    const illustration = step.querySelector('.process__step-illustration');
    const info = step.querySelector('.process__step-info');

    if (illustration) {
      gsap.from(illustration, {
        y: 40,
        opacity: 0,
        scale: 0.9,
        duration: 0.9,
        ease: 'power3.out',
        delay: i * 0.1,
        scrollTrigger: {
          trigger: stepsContainer,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      });
    }

    if (info) {
      gsap.from(info, {
        y: 25,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
        delay: i * 0.1 + 0.2,
        scrollTrigger: {
          trigger: stepsContainer,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      });
    }
  });

  // The highlight scrub is mapped to the section's ENTRANCE — from the strip
  // peeking in ('top 85%') to it being fully on screen ('bottom 92%') — so
  // every step and the connecting line finish revealing while the whole strip
  // is still visible. The old window ended at 'bottom 55%', which meant the
  // final steps only lit up after the top of the section had already scrolled
  // off screen.
  const revealWindow = { trigger: stepsContainer, start: 'top 85%', end: 'bottom 92%' };

  // Animate the connecting line fill with scroll scrub
  if (lineFill) {
    gsap.to(lineFill, {
      width: '100%',
      ease: 'none',
      scrollTrigger: { ...revealWindow, scrub: 1 },
    });
  }

  // For each step, activate it when the scroll line passes its midpoint
  const total = steps.length;

  ScrollTrigger.create({
    ...revealWindow,
    scrub: 1,
    onUpdate: (self) => {
      const progress = self.progress;
      steps.forEach((step, i) => {
        const threshold = i / (total - 1 + 0.5);
        const shouldBeActive = progress >= threshold;
        step.classList.toggle('step-active', shouldBeActive);
      });
    },
    onLeaveBack: () => {
      steps.forEach((s) => s.classList.remove('step-active'));
    },
  });
}

/* ── Counter Animation ──
   Safe to call more than once: any previously-created stat triggers are killed
   first so the CMS can re-arm the counters after applying dashboard-edited
   numbers. The real figure is written to the element up front, so even if the
   trigger never fires (slow boot, reduced motion, scroll already past it) the
   strip reads its true value instead of sticking at 0. */
let counterTriggers = [];
export function initCounters() {
  counterTriggers.forEach((t) => t.kill());
  counterTriggers = [];

  document.querySelectorAll('.about__stat-number').forEach((el) => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    if (isNaN(target)) return; // non-numeric CMS value → leave the baked text as-is

    el.textContent = target + suffix; // correct baseline before any animation

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to({ val: 0 }, {
          val: target,
          duration: 2,
          ease: 'power2.out',
          onUpdate: function() {
            el.textContent = Math.round(this.targets()[0].val) + suffix;
          },
        });
      },
    });
    counterTriggers.push(trigger);
  });
}

/* ── Preloader ── */
export function initPreloader() {
  return new Promise((resolve) => {
    const preloader = document.querySelector('.preloader');
    if (!preloader) {
      resolve();
      return;
    }

    const fill = preloader.querySelector('.preloader__progress-fill');

    // The branded loader plays on the FIRST page of a visit only, and only
    // for as long as the page genuinely needs (web fonts ready), bounded so
    // it never flashes (MIN) and never holds a slow phone hostage (MAX).
    // Later pages in the same visit are already cached — they skip it.
    // (It used to be a fixed 1.35 s on every single page view.)
    const MIN_MS = 600;
    const MAX_MS = 1800;
    let seen = false;
    try {
      seen = sessionStorage.getItem('aa_seen') === '1';
      sessionStorage.setItem('aa_seen', '1');
    } catch { /* private mode / storage blocked — treat as first visit */ }

    const reveal = (fadeMs) => {
      document.body.style.opacity = '0'; // hidden for the reveal transition
      gsap.to(preloader, {
        opacity: 0,
        duration: fadeMs / 1000,
        ease: 'power2.inOut',
        onComplete: () => {
          preloader.classList.add('loaded');
          preloader.remove();
          document.body.classList.remove('is-loading');
          document.body.style.opacity = ''; // CSS fades the page in
          document.body.classList.add('page-revealed');
          resolve();
        },
      });
    };

    if (seen) {
      if (fill) fill.style.transform = 'translateX(0%)';
      reveal(200);
      return;
    }

    const start = performance.now();
    let ready = false;
    const fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
    fontsReady.then(() => { ready = true; }, () => { ready = true; });

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (fill) fill.style.transform = 'translateX(0%)';
      setTimeout(() => reveal(400), 80);
    };
    const tick = () => {
      if (finished) return;
      const t = performance.now() - start;
      if ((ready && t >= MIN_MS) || t >= MAX_MS) { finish(); return; }
      // Ease the bar toward 90% while waiting; finish() completes it.
      if (fill) fill.style.transform = `translateX(-${100 - Math.min(90, (t / MIN_MS) * 90)}%)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // rAF is paused in background tabs — timers still fire there.
    setTimeout(finish, MAX_MS + 50);
  });
}

/* ── CTA Banner Animation ── */
export function initCTABanner() {
  const banner = document.querySelector('.cta-banner__inner');
  if (!banner) return;

  gsap.from(banner, {
    scale: 0.95,
    opacity: 0,
    duration: 1.0,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: banner,
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
  });
}

/* ── Initialize All Animations ── */
/* ── About intro — gold rule draws in, paragraphs follow the headline ── */
export function initAboutIntro() {
  const copy = document.querySelector('.about__copy');
  if (!copy) return;

  const rule = copy.querySelector('.about__rule');
  const paras = copy.querySelectorAll('.about__text');
  if (rule) gsap.set(rule, { scaleX: 0 });
  gsap.set(paras, { y: 24, opacity: 0 });

  ScrollTrigger.create({
    trigger: copy,
    start: 'top 85%',
    once: true,
    onEnter: () => {
      const tl = gsap.timeline({ delay: 0.35 }); // lets the headline lead
      if (rule) tl.to(rule, { scaleX: 1, duration: 0.9, ease: 'power3.out' });
      tl.to(paras, {
        y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.12,
      }, '-=0.6');
    },
  });
}

/* ── Lazy CSS backgrounds ──
   Browsers download a CSS background-image as soon as the element exists,
   wherever it sits on the page. Elements marked data-bg get theirs only when
   they come within ~1 screen of the viewport; data-bg-small is used on
   narrow screens. */
export function initLazyBackgrounds() {
  const els = document.querySelectorAll('[data-bg]');
  if (!els.length) return;
  const apply = (el) => {
    const small = el.dataset.bgSmall && window.innerWidth < 900;
    el.style.backgroundImage = `url('${small ? el.dataset.bgSmall : el.dataset.bg}')`;
    el.removeAttribute('data-bg');
  };
  if (!('IntersectionObserver' in window)) { els.forEach(apply); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      apply(e.target);
    });
  }, { rootMargin: '100% 0px' });
  els.forEach((el) => io.observe(el));
}

export function initAllAnimations() {
  initLazyBackgrounds();
  initTextReveals();
  initAboutIntro();
  initFadeReveals();
  initSlideReveals();
  initParallax();
  initServiceCards();
  initGalleryReveals();
  initProcessAnimation();
  initCounters();
  initCTABanner();
}
