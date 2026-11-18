# Backup & restore

**Dashboard → Settings → Data & Backup.**

## For the studio

* **Export full backup** — downloads one ZIP with everything the website and dashboard
  store: every enquiry, client, booking, payment, album, film, guide, case study, FAQ,
  testimonial, CRM family and wish, website text and settings, dashboard accounts and
  analytics — plus every uploaded photo and PDF, byte-for-byte.
  In Chrome/Edge you choose where to save it and it streams straight to disk.
* **Restore from a backup** — choose a backup ZIP. It is checked on your computer first
  (every file has a checksum). Then:
  * **Verify only** rehearses the whole restore on the server and rolls it back —
    nothing changes. Use it to confirm a backup is good.
  * **Restore this backup** asks you to type RESTORE and your password, saves the current
    data as an undo point, then replaces the content with the backup.
* **Undo last restore** puts back the data (and any replaced photos) from just before the
  last restore. An undo can itself be reversed.

Keep backups somewhere other than this computer (Google Drive, an external disk). They
contain client contact details and the encrypted dashboard passwords — keep them private.

## ZIP format (version 1)

```
manifest.json            format, version, date, table row counts, every file's size + CRC-32
README.txt               plain-English explanation
database/_schema.json    CREATE TABLE + column definitions (to rebuild a fresh server)
database/<table>.json    { "table", "columns": [...], "rows": [[...], ...] }
files/uploads/<path>     uploaded files, stored uncompressed
files/spool/inquiries.jsonl   enquiries waiting to be saved (only if any)
```

Values are strings or `null` exactly as MySQL stores them; binary values are
`{"b64": "…"}`. `rate_limits` and `refresh_tokens` (sign-in bookkeeping) are not backed up.

## How it works

The browser does the heavy lifting so no single request has to hold the whole site —
the host limits uploads to 64 MB and PHP time per request.

* **Export:** `api/backup.php` serves the database one table page (2,000 rows) at a time,
  gzip-compressed; the browser downloads each upload directly from `/uploads/` (falling
  back to the API) and writes the ZIP with zip.js.
* **Restore:** the browser sends each missing/changed upload on its own (server re-checks
  its CRC-32) and each table in compressed chunks; all of it is **staged** in a private
  session folder (`api/backups/staging/`). Nothing live changes until **commit**, which:
  1. checks every chunk arrived (row counts must match the manifest),
  2. creates any table/column the backup has but this database lacks,
  3. saves an undo snapshot of the current data (`api/backups/snapshots/`, last 3 kept),
  4. replaces every table inside **one transaction** — all or nothing,
  5. then moves the staged uploads into place (copying any file it replaces into the
     snapshot), clears old sign-in sessions, and logs the restore.
* Table data travels gzip-compressed (as a file part / base64), so the host's firewall
  (ModSecurity) never sees raw article text or SQL it could mistake for an attack.

## Tested

`_local/backup-tests/` (private) holds the end-to-end suite used before release: seeded
every table with hostile values (emoji, Devanagari, quotes, HTML, SQL-like text, NULLs,
300 KB text, 5,000-row tables), then via the real dashboard UI: export (memory + disk),
wrong password, verify, cancel mid-restore, restore (database compared value-for-value
with the ZIP), undo, tampered / truncated / foreign / future-version ZIPs, oversize file,
and restore onto a bare server missing a table and a column. Plus 47 hostile-request API
checks (auth, path traversal, script uploads, SQL in names). Unit tests:
`npx tsx dashboard/src/lib/backup/format.test.ts`.
