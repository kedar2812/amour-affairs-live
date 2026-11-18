#!/usr/bin/env bash
# ============================================================
# deploy.sh — upload Amour Affairs to the live host over FTP
# ------------------------------------------------------------
#   bash scripts/deploy.sh site [--frames]   website  (dist/, run `npm run build` first)
#   bash scripts/deploy.sh dashboard         dashboard (dashboard/out/, run its build first)
#   bash scripts/deploy.sh api               PHP API (api/*.php + api/.htaccess + api/.user.ini)
#   bash scripts/deploy.sh server            server config (server/ → .htaccess files, admin robots)
#   bash scripts/deploy.sh verify-site       byte-compare dist/ with the live site
#   bash scripts/deploy.sh verify-dashboard  byte-compare dashboard/out/ with the live dashboard
#
# Host, root folder and credentials come from a PRIVATE file that is never
# committed (default: "hosting details (ignore in github)/deploy.env", which
# points at a curl .netrc). Override with DEPLOY_ENV=/path/to/file.
#
# Rules this script enforces (each one learned from a real outage):
#   • website: hashed assets first, HTML last, and ALL of them together —
#     a page must never reference a chunk that isn't uploaded yet
#   • never touches api/config.secrets.php, uploads/, api/spool/, api/logs/
#   • every transfer has a timeout and retries (the host throttles bursts)
#   • PHP must stay 7.3-compatible — the live host runs PHP 7.3
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.."

DEPLOY_ENV="${DEPLOY_ENV:-hosting details (ignore in github)/deploy.env}"
if [ ! -f "$DEPLOY_ENV" ]; then
  echo "Missing $DEPLOY_ENV (FTP_HOST, FTP_ROOT, NETRC, SITE_URL, ADMIN_URL)." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$DEPLOY_ENV"
: "${FTP_HOST:?}" "${FTP_ROOT:?}" "${NETRC:?}" "${SITE_URL:?}" "${ADMIN_URL:?}"

CURL=(curl -s -k --connect-timeout 30 --max-time 180 --ftp-create-dirs --netrc-file "$NETRC")
ok=0; fail=0; failed=()

put() {  # put <local file> <remote path under FTP_ROOT>
  local src="$1" dst="$2" try
  local url="ftp://${FTP_HOST}${FTP_ROOT}/${dst// /%20}"
  for try in 1 2 3 4 5; do
    if "${CURL[@]}" -T "$src" "$url"; then
      ok=$((ok + 1)); printf '  up   %s\n' "$dst"; return 0
    fi
    sleep "$try"
  done
  fail=$((fail + 1)); failed+=("$dst"); printf '  FAIL %s\n' "$dst"
}

summary() {
  echo "== uploaded: $ok   failed: $fail =="
  if [ "$fail" -gt 0 ]; then
    printf '   failed: %s\n' "${failed[@]}"
    echo "   (the host throttles bursts — re-running the same command usually clears these)"
    exit 1
  fi
}

deploy_site() {
  [ -f dist/index.html ] || { echo "dist/ not built — run: npm run build" >&2; exit 1; }
  local with_frames="${1:-}"
  echo "== 1/3 hashed assets =="
  while IFS= read -r -d '' f; do put "$f" "${f#dist/}"; sleep 0.15; done \
    < <(find dist/assets -type f -print0)
  echo "== 2/3 static files =="
  while IFS= read -r -d '' f; do
    case "${f#dist/}" in
      assets/*|*.html) continue ;;
      frames/*) [ "$with_frames" = "--frames" ] || continue ;;
    esac
    put "$f" "${f#dist/}"; sleep 0.15
  done < <(find dist -type f -print0)
  echo "== 3/3 pages (last, so they never point at missing assets) =="
  while IFS= read -r -d '' f; do put "$f" "${f#dist/}"; sleep 0.15; done \
    < <(find dist -name '*.html' -type f -print0)
  summary
}

deploy_dashboard() {
  local out=dashboard/out
  [ -f "$out/index.html" ] || { echo "$out not built — run: (cd dashboard && npm run build)" >&2; exit 1; }
  if grep -rlq "localhost:8080" "$out/_next/static/chunks" 2>/dev/null; then
    echo "REFUSING: the build has the localhost API URL baked in (check dashboard/.env.local)." >&2; exit 1
  fi
  echo "== dashboard (whole export, never stop midway) =="
  while IFS= read -r -d '' f; do
    local rel="${f#$out/}"
    [ "$rel" = ".htaccess" ] && continue          # server/admin/.htaccess is deployed by `server`
    put "$f" "amour-admin/$rel"; sleep 0.3
  done < <(find "$out" -type f -print0)
  summary
}

deploy_api() {
  echo "== API =="
  # Libraries first so an endpoint never runs against an old dependency.
  for f in api/config.php api/middleware.php api/upload.php api/inquiry-store.php api/mailer.php; do
    put "$f" "$f"; sleep 0.2
  done
  for f in api/*.php; do
    case "$f" in
      api/config.php|api/middleware.php|api/upload.php|api/inquiry-store.php|api/mailer.php) continue ;;
      api/config.secrets*.php|api/_migrate_*) continue ;;
    esac
    put "$f" "$f"; sleep 0.2
  done
  put api/.htaccess api/.htaccess
  put api/.user.ini api/.user.ini
  summary
}

deploy_server() {
  echo "== server config =="
  put server/web-root/.htaccess .htaccess
  put server/admin/.htaccess amour-admin/.htaccess
  put server/admin/robots.txt amour-admin/robots.txt
  put server/uploads/.htaccess uploads/.htaccess
  summary
}

verify() {  # verify <local dir> <base url>
  python - "$1" "$2" <<'PY'
import hashlib, os, sys, time, urllib.request
root, base = sys.argv[1], sys.argv[2].rstrip('/') + '/'
skip = ('frames/',)
bad, n = [], 0
for d, _, names in os.walk(root):
    for name in names:
        rel = os.path.relpath(os.path.join(d, name), root).replace('\\', '/')
        if rel.startswith(skip) or rel == '.htaccess':
            continue
        n += 1
        url = base + rel.replace(' ', '%20') + '?cb=%d' % time.time()
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (deploy-verify)', 'Accept-Encoding': 'identity'})
        try:
            live = urllib.request.urlopen(req, timeout=40).read()
        except Exception as e:
            bad.append((rel, str(e))); continue
        if hashlib.sha1(live).digest() != hashlib.sha1(open(os.path.join(d, name), 'rb').read()).digest():
            bad.append((rel, 'content differs'))
print(f'checked {n} files, {len(bad)} mismatched')
for rel, why in bad[:40]:
    print('  ', rel, '-', why)
sys.exit(1 if bad else 0)
PY
}

case "${1:-}" in
  site)             deploy_site "${2:-}" ;;
  dashboard)        deploy_dashboard ;;
  api)              deploy_api ;;
  server)           deploy_server ;;
  verify-site)      verify dist "$SITE_URL" ;;
  verify-dashboard) verify dashboard/out "$ADMIN_URL" ;;
  *) sed -n '2,20p' "$0"; exit 1 ;;
esac
