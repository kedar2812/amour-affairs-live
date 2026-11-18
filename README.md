# Amour Affairs — website, dashboard & API

The public website of **Amour Affairs**, a wedding photography & films studio in Pune
(<https://www.amouraffairs.in>), the studio's private dashboard (CMS + CRM,
<https://admin.amouraffairs.in>) and the PHP API both of them talk to.

```
.
├── website/      Public website — Vite multi-page site (one folder per URL)
│   ├── index.html, about/, weddings/, films/, guides/ …   the pages
│   ├── src/js/       page scripts (one *-init.js entry per page type)
│   ├── src/styles/   design tokens, shared components, per-page CSS
│   └── public/       static files copied as-is (frames, images, robots.txt)
├── dashboard/    Studio dashboard — Next.js static export (CMS, CRM, backups)
├── api/          PHP REST API (MySQL) used by the website and the dashboard
│   └── tests/    framework-free PHP tests
├── database/     schema.sql (fresh installs), migrations.sql (re-runnable), seed.php
├── server/       Apache config that lives on the host (.htaccess files, admin robots.txt)
├── scripts/      deploy.sh, image/frame builders, local dev router, checklist PDF
└── docs/         how things work: architecture, deployment, backup & restore
```

Everything in `_local/`, `_deploy/` and `hosting details (ignore in github)/` is private
working material and is never committed.

## Quick start

```bash
npm install                      # website toolchain
npm run dev                      # website on http://localhost:3000 (content from the bundled fallbacks)
npm run build                    # → dist/
npm test                         # website unit tests

cd dashboard && npm install
npm run build && npm run serve   # dashboard on http://localhost:8081 (static export)
```

A full local stack (PHP API + MariaDB) is described in [docs/development.md](docs/development.md).

## How it is built

| Part | Technology | Hosting |
|---|---|---|
| Website | Vite 8, vanilla JS, GSAP + Lenis, self-hosted variable fonts | static files on Apache |
| Dashboard | Next.js 16 static export, React 19, Tailwind 4 | static files on Apache (`admin.` subdomain) |
| API | PHP (7.3-compatible) + MySQL, JWT auth | same Apache host (`/api`) |

Pages always render their bundled content first and apply CMS content from the API on
top, so the site never waits for — or breaks without — the API.

More detail: [docs/architecture.md](docs/architecture.md) ·
[docs/deployment.md](docs/deployment.md) ·
[docs/backup-and-restore.md](docs/backup-and-restore.md) ·
[docs/performance.md](docs/performance.md)
