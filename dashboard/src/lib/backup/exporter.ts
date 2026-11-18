/**
 * Full-site export: builds the backup ZIP in the browser.
 *
 * The database comes from api/backup.php one table page at a time; uploaded
 * files are downloaded straight from /uploads (falling back to the API if a
 * direct download fails). Photos are stored as-is (already compressed), the
 * database JSON is deflated. With the File System Access API (Chrome / Edge)
 * the ZIP streams straight to disk, so even a multi-GB backup never has to
 * fit in memory; other browsers build it in memory and download it.
 */
import { assetUrl } from '@/lib/api';
import {
  buildManifest, backupFileName, crcHex, isSafeUploadPath, MANIFEST_NAME, README_TEXT, SCHEMA_NAME,
  SPOOL_NAME, tableEntryName, UPLOADS_PREFIX, type Manifest, type ManifestFile, type TableData,
} from './format';
import { backupDownloadFile, backupGet, bytesToBase64, pool, throwIfAborted, unpack, withRetry } from './transport';

export interface BackupInfo {
  tables: { name: string; rows: number }[];
  files: { count: number; bytes: number };
  spool: number;
  snapshots: { id: string; created: string; reason: string; rows: number; files: number }[];
  upload_max: number;
  server: { php: string; mysql: string; time: string };
}

export interface Progress {
  phase: 'database' | 'files' | 'finishing' | 'uploading' | 'checking' | 'applying' | 'done';
  label: string;
  done: number;
  total: number;
}

export const getBackupInfo = () => backupGet<BackupInfo>({ action: 'info' });

type SaveTarget = { kind: 'disk'; handle: FileSystemFileHandle } | { kind: 'memory' };

interface ShowSaveFilePicker {
  (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }): Promise<FileSystemFileHandle>;
}

/**
 * Ask where to save BEFORE any await (browsers only allow the picker during
 * the click itself). Returns null if the person cancels the picker.
 */
export async function chooseSaveTarget(fileName: string): Promise<SaveTarget | null> {
  const picker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker;
  if (!picker) return { kind: 'memory' };
  try {
    const handle = await picker({ suggestedName: fileName, types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }] });
    return { kind: 'disk', handle };
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return null;
    return { kind: 'memory' }; // picker blocked (e.g. inside an iframe) — fall back
  }
}

export interface ExportResult {
  fileName: string;
  bytes: number;
  manifest: Manifest;
  savedToDisk: boolean;
}

export async function exportBackup(opts: {
  fileName?: string;
  target: SaveTarget;
  createdBy: string;
  onProgress: (p: Progress) => void;
  signal?: AbortSignal;
}): Promise<ExportResult> {
  const { onProgress, signal } = opts;
  const fileName = opts.fileName ?? backupFileName();
  const zip = await import('@zip.js/zip.js');
  zip.configure({ useWebWorkers: false });

  onProgress({ phase: 'database', label: 'Reading what to back up…', done: 0, total: 1 });
  const info = await withRetry(() => getBackupInfo(), signal);
  const totalRows = info.tables.reduce((a, t) => a + t.rows, 0);

  let writable: FileSystemWritableFileStream | null = null;
  let blobWriter: InstanceType<typeof zip.BlobWriter> | null = null;
  if (opts.target.kind === 'disk') writable = await opts.target.handle.createWritable();
  else blobWriter = new zip.BlobWriter('application/zip');
  const writer = new zip.ZipWriter(writable ?? blobWriter!, { bufferedWrite: true });

  try {
    // ── database ──
    const schemaRes = await withRetry(() => backupGet<{ packed: string }>({ action: 'schema' }), signal);
    const schema = await unpack<Record<string, unknown>>(schemaRes.packed);
    await writer.add(SCHEMA_NAME, new zip.TextReader(JSON.stringify(schema, null, 1)));

    const tableCounts: Record<string, number> = {};
    let rowsDone = 0;
    for (const t of info.tables) {
      throwIfAborted(signal);
      const data: TableData = { table: t.name, columns: [], rows: [] };
      let after: unknown = null;
      do {
        const params: Record<string, string> = { action: 'table', name: t.name };
        if (after !== null) params.after = bytesToBase64(new TextEncoder().encode(JSON.stringify(after)));
        const res = await withRetry(() => backupGet<{ packed: string }>(params), signal);
        const page = await unpack<TableData & { next: unknown }>(res.packed);
        data.columns = page.columns;
        data.rows.push(...page.rows);
        rowsDone += page.rows.length;
        onProgress({ phase: 'database', label: `Database — ${t.name}`, done: Math.min(rowsDone, totalRows), total: Math.max(totalRows, 1) });
        after = page.next ?? null;
      } while (after !== null);
      tableCounts[t.name] = data.rows.length;
      await writer.add(tableEntryName(t.name), new zip.TextReader(JSON.stringify(data)));
    }

    // ── uploaded files ──
    throwIfAborted(signal);
    const list = await withRetry(() => backupGet<{ files: { path: string; size: number }[] }>({ action: 'files' }), signal);
    const files = list.files.filter((f) => isSafeUploadPath(f.path));
    const totalBytes = files.reduce((a, f) => a + f.size, 0) || 1;
    const manifestFiles: ManifestFile[] = new Array(files.length);
    let bytesDone = 0;
    const stamp = Date.now();

    await pool(files, 3, async (f, i) => {
      const blob = await withRetry(async () => {
        // Direct static download first (fast); the API is the fallback.
        try {
          const url = assetUrl(`/uploads/${f.path.split('/').map(encodeURIComponent).join('/')}`) + `?bk=${stamp}`;
          const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal });
          if (res.ok) {
            const b = await res.blob();
            if (b.size === f.size) return b;
          }
        } catch (e) {
          if (signal?.aborted) throw e;
        }
        return backupDownloadFile(f.path);
      }, signal);
      const entry = await writer.add(UPLOADS_PREFIX + f.path, new zip.BlobReader(blob), { level: 0 });
      manifestFiles[i] = { path: f.path, size: blob.size, crc32: crcHex(entry.signature ?? 0) };
      bytesDone += f.size;
      onProgress({ phase: 'files', label: `Photos & files — ${i + 1} of ${files.length}`, done: Math.min(bytesDone, totalBytes), total: totalBytes });
    }, signal);

    // ── enquiries waiting to be saved (normally none) ──
    let spoolLines = 0;
    if (info.spool > 0) {
      const spool = await withRetry(() => backupGet<{ content: string }>({ action: 'spool' }), signal);
      spoolLines = spool.content.split('\n').filter((l) => l.trim()).length;
      if (spoolLines) await writer.add(SPOOL_NAME, new zip.TextReader(spool.content));
    }

    // ── manifest + readme ──
    onProgress({ phase: 'finishing', label: 'Finishing the ZIP…', done: 1, total: 1 });
    const manifest = buildManifest({
      createdAt: new Date(),
      source: assetUrl('/').replace(/\/$/, ''),
      createdBy: opts.createdBy,
      tables: tableCounts,
      files: manifestFiles,
      spoolLines,
      server: { php: info.server?.php, mysql: info.server?.mysql },
    });
    await writer.add(MANIFEST_NAME, new zip.TextReader(JSON.stringify(manifest, null, 1)));
    await writer.add('README.txt', new zip.TextReader(README_TEXT(manifest)));

    const out = await writer.close();
    let bytes = 0;
    if (blobWriter) {
      const blob = out as Blob;
      bytes = blob.size;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    } else if (opts.target.kind === 'disk') {
      bytes = (await opts.target.handle.getFile()).size;
    }
    onProgress({ phase: 'done', label: 'Backup complete', done: 1, total: 1 });
    return { fileName: opts.target.kind === 'disk' ? opts.target.handle.name : fileName, bytes, manifest, savedToDisk: opts.target.kind === 'disk' };
  } catch (e) {
    // Leave no half-written file pretending to be a backup.
    if (writable) {
      try { await writable.abort(); } catch { /* stream already locked/closed */ }
      if (opts.target.kind === 'disk') {
        try { const w = await opts.target.handle.createWritable(); await w.truncate(0); await w.close(); } catch { /* best effort */ }
      }
    }
    throw e;
  }
}
