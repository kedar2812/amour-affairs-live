/**
 * ============================================================
 * Backup ZIP format — shared by the exporter and the importer
 * ============================================================
 *
 *   amour-affairs-backup-2026-11-18-1430.zip
 *   ├── manifest.json            what is inside + checksums (read first)
 *   ├── README.txt               plain-English explanation
 *   ├── database/_schema.json    table definitions (to rebuild a fresh server)
 *   ├── database/<table>.json    { table, columns: [...], rows: [[...], ...] }
 *   ├── files/uploads/<path>     every uploaded photo / PDF, unchanged
 *   └── files/spool/inquiries.jsonl   enquiries not yet saved (only if any)
 *
 * Values are strings or null exactly as MySQL stores them; binary values
 * travel as { "b64": "…" }. Pure functions only — no network, no DOM — so
 * this file is unit-tested (format.test.ts).
 * ============================================================
 */

export const BACKUP_FORMAT = 'amour-affairs-backup';
export const BACKUP_VERSION = 1;

export const MANIFEST_NAME = 'manifest.json';
export const SCHEMA_NAME = 'database/_schema.json';
export const SPOOL_NAME = 'files/spool/inquiries.jsonl';
export const UPLOADS_PREFIX = 'files/uploads/';
export const tableEntryName = (table: string) => `database/${table}.json`;

/** Must match bk_fileExtensions() in api/backup.php. */
export const FILE_EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png', 'gif', 'avif', 'pdf', 'mp4', 'webm'];

export type CellValue = string | null | { b64: string };

export interface TableData {
  table: string;
  columns: string[];
  rows: CellValue[][];
}

export interface ManifestFile {
  path: string;   // relative to uploads/
  size: number;
  crc32: string;  // 8 lowercase hex chars
}

export interface Manifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  created_at: string;          // ISO-8601
  created_at_ist: string;      // human-readable, India time
  source: string;              // e.g. https://amouraffairs.in
  created_by: string;          // dashboard user email
  tables: Record<string, number>;   // table → row count
  files: ManifestFile[];
  totals: { rows: number; files: number; bytes: number };
  spool_lines: number;
  server?: { php?: string; mysql?: string };
}

/** Same rules as bk_cleanPath() on the server: no traversal, no dotfiles, known types. */
export function isSafeUploadPath(path: string): boolean {
  if (!path || path.length > 400 || path.includes('\0') || path.includes('\\') || path.startsWith('/')) return false;
  const parts = path.split('/');
  for (const seg of parts) {
    if (!seg || seg === '.' || seg === '..' || seg.startsWith('.')) return false;
    if (!/^[A-Za-z0-9][A-Za-z0-9 ._()-]*$/.test(seg)) return false;
  }
  if (parts[0] === '_w') return false;
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return FILE_EXTENSIONS.includes(ext);
}

export const crcHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');

export function backupFileName(date = new Date()): string {
  // India time in the name, because that is the studio's clock.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `amour-affairs-backup-${get('year')}-${get('month')}-${get('day')}-${get('hour')}${get('minute')}.zip`;
}

export function buildManifest(input: {
  createdAt: Date;
  source: string;
  createdBy: string;
  tables: Record<string, number>;
  files: ManifestFile[];
  spoolLines: number;
  server?: Manifest['server'];
}): Manifest {
  const rows = Object.values(input.tables).reduce((a, b) => a + b, 0);
  const bytes = input.files.reduce((a, f) => a + f.size, 0);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    created_at: input.createdAt.toISOString(),
    created_at_ist: input.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' }),
    source: input.source,
    created_by: input.createdBy,
    tables: input.tables,
    files: input.files,
    totals: { rows, files: input.files.length, bytes },
    spool_lines: input.spoolLines,
    server: input.server,
  };
}

/** What the ZIP's central directory says about one entry. */
export interface ZipEntryInfo {
  name: string;
  size: number;
  crc32: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];    // the backup cannot be restored
  warnings: string[];  // it can, but the person should know
}

/**
 * Check a parsed manifest against the ZIP's actual contents before anything
 * is sent to the server. Catches the wrong file, a truncated download, a
 * tampered archive or a backup from a newer, unknown format.
 */
export function validateBackup(manifest: unknown, entries: ZipEntryInfo[], uploadMax = 0): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const m = manifest as Partial<Manifest> | null;

  if (!m || typeof m !== 'object' || m.format !== BACKUP_FORMAT) {
    return { ok: false, errors: ['This is not an Amour Affairs backup file.'], warnings };
  }
  if (typeof m.version !== 'number' || m.version > BACKUP_VERSION) {
    return { ok: false, errors: [`This backup was made by a newer version of the dashboard (format ${m.version}). Update the dashboard first.`], warnings };
  }
  if (!m.tables || typeof m.tables !== 'object' || !Array.isArray(m.files)) {
    return { ok: false, errors: ['The backup manifest is incomplete.'], warnings };
  }

  const byName = new Map(entries.map((e) => [e.name, e]));

  for (const [table, rows] of Object.entries(m.tables)) {
    if (!/^[A-Za-z0-9_]{1,64}$/.test(table)) errors.push(`Invalid table name "${table}".`);
    else if (!byName.has(tableEntryName(table))) errors.push(`Table "${table}" is listed but missing from the ZIP.`);
    if (!Number.isInteger(rows) || (rows as number) < 0) errors.push(`Table "${table}" has an invalid row count.`);
  }
  if (Object.keys(m.tables).length === 0) errors.push('The backup contains no database tables.');
  if (!byName.has(SCHEMA_NAME)) warnings.push('The backup has no table definitions; it can only be restored onto an existing installation.');

  const seen = new Set<string>();
  for (const f of m.files) {
    if (!f || typeof f.path !== 'string' || !isSafeUploadPath(f.path)) {
      errors.push(`Unsafe or unsupported file path in backup: ${String(f?.path)}`);
      continue;
    }
    if (seen.has(f.path)) { errors.push(`File listed twice: ${f.path}`); continue; }
    seen.add(f.path);
    const entry = byName.get(UPLOADS_PREFIX + f.path);
    if (!entry) { errors.push(`Missing from the ZIP: ${f.path}`); continue; }
    if (entry.size !== f.size) errors.push(`Damaged (size differs): ${f.path}`);
    else if (entry.crc32 !== f.crc32) errors.push(`Damaged (checksum differs): ${f.path}`);
    if (uploadMax > 0 && f.size > uploadMax) {
      errors.push(`${f.path} is ${formatBytes(f.size)}, larger than this server accepts (${formatBytes(uploadMax)}). Upload it by FTP, then restore without it.`);
    }
  }

  const extra = entries.filter((e) => e.name.startsWith(UPLOADS_PREFIX) && !seen.has(e.name.slice(UPLOADS_PREFIX.length)));
  if (extra.length) warnings.push(`${extra.length} file(s) in the ZIP are not listed in its manifest and will be ignored.`);

  if (m.spool_lines && !byName.has(SPOOL_NAME)) warnings.push('Unsaved enquiries are listed but missing from the ZIP.');

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Split rows into upload-sized chunks: at most `maxRows` rows and roughly
 * `maxBytes` of JSON each (one huge article never makes an oversized request).
 */
export function chunkRows<T>(rows: T[], maxRows = 1500, maxBytes = 1_500_000): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const row of rows) {
    const size = JSON.stringify(row).length;
    if (current.length && (current.length >= maxRows || bytes + size > maxBytes)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row);
    bytes += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

/** Friendly names for the tables people recognise; others keep their name. */
export const TABLE_LABELS: Record<string, string> = {
  leads: 'Enquiries (leads)',
  clients: 'Clients',
  bookings: 'Bookings',
  invoices: 'Invoices',
  transactions: 'Payments',
  packages: 'Packages',
  albums: 'Albums',
  gallery_images: 'Album photos',
  album_sections: 'Album sections (Haldi, Mehendi…)',
  films: 'Films',
  testimonials: 'Testimonials',
  team_members: 'Team',
  settings: 'Website & studio settings',
  faqs: 'FAQs',
  guides: 'Guides',
  case_studies: 'Case studies',
  lead_magnets: 'Lead magnets',
  families: 'CRM families',
  family_members: 'CRM family members',
  family_greetings: 'CRM wishes sent',
  client_dates: 'Client special dates',
  festivals: 'Festivals',
  crm_greetings: 'CRM greetings log',
  page_views: 'Website analytics',
  audit_log: 'Activity log',
  admin_users: 'Dashboard accounts',
};

export const README_TEXT = (m: Manifest) => `AMOUR AFFAIRS — FULL SITE BACKUP
================================

Created:  ${m.created_at_ist} (India time)
From:     ${m.source}
By:       ${m.created_by}

What is inside
--------------
• ${m.totals.rows.toLocaleString('en-IN')} database records across ${Object.keys(m.tables).length} tables —
  enquiries, clients, bookings, payments, albums, films, testimonials,
  guides, case studies, FAQs, CRM families, website text and settings,
  dashboard accounts and analytics.
• ${m.totals.files.toLocaleString('en-IN')} uploaded files (${formatBytes(m.totals.bytes)}) — every photo and PDF
  uploaded through the dashboard, byte-for-byte.

How to restore
--------------
Dashboard → Settings → Data & Backup → Restore from backup, then choose this
ZIP file. The dashboard checks the file, shows what it contains, and asks for
your password before changing anything. The current data is saved first, so
a restore can be undone from the same screen.

Keep this file somewhere safe and private: it contains client contact
details and the (encrypted) dashboard passwords.

Do not edit or re-zip this file — every item is checksummed and an edited
backup will be refused.
`;
