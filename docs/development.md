# Local development

## Website only (fastest)

```bash
npm install
npm run dev        # http://localhost:3000 — pages show their bundled fallback content
```

`website/.env.development` points the site at a local API (`VITE_API_URL`); without one
running, pages simply keep their bundled content.

## Full stack: website + API + database + dashboard

Needs PHP 8.x (with `pdo_mysql`, `gd`, `zlib`) and MariaDB/MySQL. Keep the dashboard on a
static build — `next dev` holds hundreds of MB of RAM and is not how production runs.

```bash
# 1. Database
mysql -uroot -e "CREATE DATABASE aa_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -uroot aa_local < database/schema.sql
mysql -uroot aa_local < database/migrations.sql        # safe to re-run
# set $ADMIN_PASSWORD in database/seed.php (locally only), then:
php database/seed.php

# 2. API secrets — copy api/config.secrets.example.php to api/config.secrets.php
#    (gitignored) and point AA_DB_* at aa_local.

# 3. Website + API on one origin (php -S ignores .htaccess/.user.ini, hence the -d flags)
npm run build
php -d upload_max_filesize=64M -d post_max_size=512M -d memory_limit=512M \
    -S localhost:8080 scripts/serve-router.php

# 4. Dashboard, built against the local API
cd dashboard
NEXT_PUBLIC_API_URL=http://localhost:8080/api npm run build
npm run serve                                          # http://localhost:8081
```

`scripts/serve-router.php` mirrors the live server: it serves `dist/`, runs `api/*.php`,
serves `/uploads` the way `server/uploads/.htaccess` does, and creates responsive image
sizes through `api/img.php`.

**Before deploying the dashboard, rebuild it without the local API URL**
(`npm run build` uses `.env.production`).

## Tests

```bash
npm test                                         # website (submit retry, album sections)
php api/tests/inquiry-store.test.php             # enquiry store (run with no database reachable)
cd dashboard
npx tsx src/lib/families.test.ts                 # CRM wish routing
npx tsx src/lib/leadTemplates.test.ts            # WhatsApp presets
npx tsx src/lib/backup/format.test.ts            # backup format & validation
npx tsc --noEmit -p . && npx eslint src          # types + lint
```

## Images

```bash
npm run images -- path/to/photo.jpg website/public/services/name   # → name-640/960/1400.webp
npm run frames                                                     # rebuild hero frames from the 3D renders
```
