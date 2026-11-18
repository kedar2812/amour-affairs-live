/* ============================================================
   HERO.JS — Homepage hero "Scroll" cue
   Amour Affairs · Premium Wedding Photography

   The hero's pinned 3D-model scrub lives in hero-canvas.js; this
   only wires the "Scroll" indicator to glide down to #about.
   ============================================================ */

export function initHero() {
  const scrollCTA = document.querySelector('.scroll-indicator');
  if (!scrollCTA) return;

  scrollCTA.addEventListener('click', () => {
    const target = document.querySelector('#about');
    if (!target) return;
    if (window.__lenis) {
      window.__lenis.scrollTo(target, { offset: -80 });
    } else {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
}
