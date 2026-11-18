# Deployment

The host serves static files and PHP — there is no Node server. Everything is built
locally and uploaded over FTP with **`scripts/deploy.sh`**, which reads the host name and
credentials from a private file (`hosting details (ignore in github)/deploy.env`, pointing
at a curl `.netrc`). Nothing secret is in this repository.

```bash
npm run build                          # website → dist/
bash scripts/deploy.sh site            # hashed assets first, pages last (add --frames when hero frames change)
bash scripts/deploy.sh verify-site     # byte-compares every deployed file with dist/

(cd dashboard && npm run build)        # dashboard → dashboard/out/ (uses .env.production)
bash scripts/deploy.sh dashboard
bash scripts/deploy.sh verify-dashboard

bash scripts/deploy.sh api             # api/*.php + api/.htaccess + api/.user.ini
bash scripts/deploy.sh server          # .htaccess files + admin robots.txt from server/
```

## Rules (each one learned from an outage)

1. After any website build, deploy **all** of `dist/assets` and **all** pages together —
   chunk names change on every build, and a page pointing at a missing chunk never loads.
   `deploy.sh site` does this, assets first.
2. Never overwrite `api/config.secrets.php`, `uploads/`, `api/spool/`, `api/logs/`,
   `api/backups/` — the script never touches them.
3. PHP must stay 7.3-compatible: no `fn()`, `match`, `str_contains`, union types, `?->`.
4. Verify by comparing bytes, not status codes — the dashboard host returns `200` with
   `index.html` for missing files.
5. Database changes go in `database/migrations.sql` (every statement guarded, safe to
   re-run). On the live host, run them through a one-time token-protected PHP runner, then
   delete the runner from the server.
6. The dashboard must be built with `dashboard/.env.local` NOT setting
   `NEXT_PUBLIC_API_URL` (it would bake a local API address into the live build —
   `deploy.sh dashboard` refuses such a build).
