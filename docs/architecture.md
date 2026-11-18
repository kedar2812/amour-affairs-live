# Architecture

## The three parts

**Website (`website/`)** — a Vite multi-page site. Every folder with an `index.html` is a
page; `vite.config.js` discovers them automatically. Each page loads one entry script
(`src/js/*-init.js`, or `src/main.js` for the homepage) that imports its CSS and modules.

**Dashboard (`dashboard/`)** — a Next.js app exported to static files (`output: "export"`).
It is a client-side app: every screen reads and writes through `src/lib/api.ts`.

**API (`api/`)** — one PHP file per resource (`albums.php`, `leads.php`, `guides.php`, …),
sharing `config.php` (database, CORS, JSON helpers, error handling) and `middleware.php`
(JWT auth, rate limiting). Must stay **PHP 7.3-compatible** — that is what the host runs.

## Content flow

```
Dashboard ──(JWT, JSON)──▶ api/*.php ──▶ MySQL  +  uploads/
                                │
Website  ◀──(public GET, JSON)──┘     (pages render bundled content first,
                                       then apply CMS content on top)
```

* Editable website copy lives in the `settings` table (groups `site_content`, `profile`,
  `notice`, `crm`); keys ending in `_json` hold JSON.
* Uploaded photos are stored as WebP in `uploads/<area>/`. The website asks for sized
  copies at `/uploads/_w/<480|800|1200|1600>/<path>` — `api/img.php` makes each size once
  and Apache serves it statically afterwards.
* Most endpoints HTML-encode text on write (`sanitize()`), so every display decodes it.

## Website conventions

* Design tokens: `src/styles/variables.css`. Heading system: `src/styles/section-headers.css`.
* Fonts are self-hosted variable fonts (`@fontsource-variable/*`); the build preloads the
  two files every first screen needs (see `vite.config.js`).
* Images: use WebP, give `width`/`height`, `loading="lazy"` below the fold, and `srcset`
  for anything wider than a phone. `npm run images -- <src> <out-prefix>` makes the sizes.
* Analytics (GA4 + Meta Pixel) are queued inline in each page's `<head>` and their
  libraries load after the page is ready; nothing is sent before cookie consent.
* The floating WhatsApp button is on every page (`.floating-whatsapp`); clicks are tracked
  as GA4 `contact_whatsapp` and Meta `Contact` by `src/js/analytics.js`.

## Server layout (web root on the host)

```
/                 dist/ (website build)          ← server/web-root/.htaccess
/api/             api/*.php                      ← api/.htaccess, api/.user.ini
/api/backups/     restore staging + undo points  (runtime, private)
/uploads/         client uploads (never deploy over it) ← server/uploads/.htaccess
/amour-admin/     dashboard build = admin.amouraffairs.in ← server/admin/.htaccess
```
