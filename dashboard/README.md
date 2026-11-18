# Amour Affairs — studio dashboard

Private CMS + CRM for the studio (<https://admin.amouraffairs.in>): enquiries & leads,
clients, bookings, payments, CRM families and WhatsApp wishes, albums, films, guides,
case studies, FAQs, testimonials, website text, analytics, and full-site backups.

Next.js 16 **static export** (`output: "export"`, `trailingSlash: true`) — the host serves
`out/` as plain files; all data comes from the PHP API (`../api`) through `src/lib/api.ts`.

```
src/app/<screen>/page.tsx     one folder per dashboard screen
src/components/               layout, UI primitives, feature components
src/lib/api.ts                the only place that talks to the API
src/lib/normalize.ts          API rows → UI shapes
src/lib/backup/               full-site backup ZIP: format, exporter, importer
```

```bash
npm install
npm run build        # → out/ (uses .env.production → live API)
npm run serve        # serve out/ on http://localhost:8081
```

See the repository docs: [development](../docs/development.md),
[deployment](../docs/deployment.md), [backup & restore](../docs/backup-and-restore.md).

`AGENTS.md` / `CLAUDE.md` note that this Next.js version has breaking changes versus
older releases — check `node_modules/next/dist/docs/` before changing framework-level code.
