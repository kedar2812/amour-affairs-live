# Performance

Measured 2026-11-18 with Lighthouse 12 (mobile, simulated slow 4G + 4× CPU) and Chrome
with network throttling. "Before" = the live site that morning; "after" = this build.

## Lighthouse (mobile)

| Page | Performance | LCP | FCP | CLS | Page weight |
|---|---|---|---|---|---|
| Home — before | 60 | 7.5 s | 3.6 s | 0.016 | 8.3 MB |
| Home — after | **85** | **3.3 s** | **2.1 s** | **0** | **3.3 MB** |
| Weddings — before | 70 | 5.4 s | 3.1 s | 0 | 1.9 MB |
| Weddings — after | **83** | **3.3 s** | **2.3 s** | **0.001** | **0.9 MB** |
| About — before | 62 | 7.4 s | 4.4 s | 0 | 1.8 MB |
| About — after | **78** | **4.0 s** | **2.4 s** | **0** | **1.6 MB** |
| Films — before | 67 | 6.0 s | 3.2 s | 0.002 | 3.1 MB |
| Films — after | **86** | **3.2 s** | **2.1 s** | **0.001** | **2.0 MB** |

SEO 100 and Best Practices 100 on every page. "After" was measured on a local copy (the
live host's ~0.5–0.7 s server response time adds to it); live numbers are re-measured
after each deploy.

## Live site after deploy (2026-11-18)

| Page | Performance | LCP | FCP | CLS | Page weight |
|---|---|---|---|---|---|
| Home | **81** (was 60) | **2.4 s** (was 7.5 s) | 2.0 s | 0 | 3.3 MB (was 8.3 MB) |
| Weddings | **85** (was 70) | 3.1 s (was 5.4 s) | 2.3 s | 0 | 0.8 MB |
| About | **74** (was 62) | 4.5 s (was 7.4 s) | 2.6 s | 0 | 1.6 MB |
| Films | **84** (was 67) | 3.3 s (was 6.0 s) | 2.4 s | 0 | 2.0 MB |

SEO 100 and Best Practices 100 on all four.

## Real Chrome, throttled phone (homepage, live)

| | Before | After |
|---|---|---|
| Slow 3G — page visible | 26 s | **9.3 s** |
| Slow 3G — fully loaded | 173 s (~3 min) | **71 s** (the rest is hero frames streaming in the background) |
| Fast 4G — largest content painted | 5.1 s | **1.5 s** |
| Fast 4G — page visible | 8.9 s | **2.7 s** |
| Fast 4G — everything loaded | 11.8 s | **5.5 s** |

The "1–2 minute" load the agency saw was real on slow connections: the homepage
downloaded 8.3 MB, all at once, before its scripts could run.

## What changed

| Cause | Fix |
|---|---|
| 5 MB of service-card photos loaded eagerly (one a 2 MB PNG) | lazy, responsive WebP (24–136 KB each) |
| 120 hero frames requested at once, page waited for 16–35 of them | 6 at a time, coarse-to-fine; page waits for frame 1 only; frames 20% smaller |
| React + Framer Motion shipped for one carousel | rewritten in plain JS — homepage script 333 KB → 16 KB |
| Fixed 1.35 s preloader on every page | first visit only, ends when fonts are ready (0.6–1.8 s) |
| Render-blocking Google Fonts (2 extra servers) | self-hosted variable fonts, critical files preloaded |
| GA4 + Meta Pixel (260 KB) competing with the page | load after the page is ready; events queued, none lost |
| CMS photos served at up to 3500 px | `/uploads/_w/<width>/` sizes made once by `api/img.php` |
| YouTube player (~1 MB) loaded on /films/ | click-to-play thumbnail |
| Guides/case studies: two API calls, then the preloader | calls run in parallel with the preloader |
| Layout shifts (album grid filling in, font swap, WhatsApp button) | reserved space, font preloads, transform-based movement |

## Remaining (outside the code)

* **Server response time** (~0.6–1.0 s from India — the host is in the UK). Putting a CDN
  with Indian edge locations (e.g. Cloudflare's free plan) in front of the site would cut
  this the most. It is a DNS change for the domain owner; `/api/` must not be cached.
* About page: the bundled founder photo is replaced by the dashboard's photo once the
  CMS answers, so the largest image effectively loads twice (LCP 4.5 s). Serving the CMS
  photo directly in the page would fix it.
* Colour contrast of a few small gold-on-beige labels (Lighthouse accessibility 93–97) is
  a brand-palette decision.
