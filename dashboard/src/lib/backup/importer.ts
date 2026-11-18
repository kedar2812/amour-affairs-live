/**
 * Restore from a backup ZIP.
 *
 * The ZIP is read locally (only its index is loaded up front, so even a huge
 * file opens instantly) and checked against its manifest before anything is
 * sent. The server then receives it piece by piece — each file with its
 * CRC-32, each table in compressed chunks — and only the final "commit" swaps
 * the data, in one transaction, after saving an undo snapshot.
 *
 * `verifyOnly` runs the same path but rolls the database back at the end and
 * uploads no files: a full rehearsal that changes nothing.
 */
import {
  chunkRows, crcHex, MANIFEST_NAME, SCHEMA_NAME, SPOOL_NAME, tableEntryName, UPLOADS_PREFIX, validateBackup,
  type Manifest, type TableData, type ValidationResult, type ZipEntryInfo,
} from './format';
import { backupPost, gzipText, pack, pool, throwIfAborted, withRetry } from './transport';
import type { Progress } from './exporter';

type ZipModule = typeof import('@zip.js/zip.js');
type AnyEntry = Awaited<ReturnType<InstanceType<ZipModule['ZipReader']>['getEntries']>>[number];
type Entry = Extract<AnyEntry, { directory: false }>;

export interface InspectedBackup {
  file: File;
  manifest: Manifest | null;
  validation: ValidationResult;
  entries: Map<string, Entry>;
  close: () => Promise<void>;
}

async function loadZip(): Promise<ZipModule> {
  const zip = await import('@zip.js/zip.js');
  zip.configure({ useWebWorkers: false });
  return zip;
}

/** Open a ZIP and check it thoroughly against its manifest (no network). */
export async function inspectBackup(file: File, uploadMax = 0): Promise<InspectedBackup> {
  const zip = await loadZip();
  const reader = new zip.ZipReader(new zip.BlobReader(file));
  const fail = (msg: string): InspectedBackup => ({
    file, manifest: null, entries: new Map(), close: () => reader.close(),
    validation: { ok: false, errors: [msg], warnings: [] },
  });

  let list: AnyEntry[];
  try {
    list = await reader.getEntries();
  } catch {
    return fail('This file is not a valid ZIP archive (it may be incomplete or damaged).');
  }
  const entries = new Map(list.filter((e): e is Entry => !e.directory).map((e) => [e.filename, e]));
  const manifestEntry = entries.get(MANIFEST_NAME);
  if (!manifestEntry) return fail('This ZIP is not an Amour Affairs backup (it has no manifest).');

  let manifest: Manifest;
  try {
    manifest = JSON.parse(await manifestEntry.getData(new zip.TextWriter(), { checkSignature: true }));
  } catch {
    return fail('The backup manifest is damaged.');
  }

  const infos: ZipEntryInfo[] = [...entries.values()].map((e) => ({
    name: e.filename,
    size: e.uncompressedSize,
    crc32: crcHex(e.signature ?? 0),
  }));
  return { file, manifest, entries, validation: validateBackup(manifest, infos, uploadMax), close: () => reader.close() };
}

export interface RestoreResult {
  dry_run: boolean;
  tables: Record<string, number>;
  created_tables: string[];
  added_columns: string[];
  untouched: string[];
  snapshot: string | null;
  spool_added: number;
  files_uploaded: number;
  files_unchanged: number;
  files_checked: number;
}

export async function restoreBackup(opts: {
  backup: InspectedBackup;
  password: string;
  verifyOnly: boolean;
  onProgress: (p: Progress) => void;
  signal?: AbortSignal;
}): Promise<RestoreResult> {
  const { backup, onProgress, signal, verifyOnly } = opts;
  const manifest = backup.manifest;
  if (!manifest || !backup.validation.ok) throw new Error('This backup did not pass its checks and cannot be restored.');
  const zip = await loadZip();
  const entry = (name: string) => {
    const e = backup.entries.get(name);
    if (!e) throw new Error(`Missing from the ZIP: ${name}`);
    return e;
  };
  // Read one entry, re-checking its CRC-32; a corrupted entry names itself.
  const read = async <T,>(name: string, writer: Parameters<Entry['getData']>[0]): Promise<T> => {
    try {
      return (await entry(name).getData(writer, { checkSignature: true })) as T;
    } catch (e) {
      const short = name.replace(UPLOADS_PREFIX, '').replace(/^database\//, '');
      throw new Error(`The backup file is damaged: “${short}” failed its checksum (${e instanceof Error ? e.message : 'read error'}). Nothing was changed — use another copy of this backup.`);
    }
  };

  // 1 — password check + restore session (nothing has changed yet)
  onProgress({ phase: 'checking', label: 'Checking your password…', done: 0, total: 1 });
  const { session } = await backupPost<{ session: string }>('restore-begin', { password: opts.password });

  // 2 — files: compare with the server, send only what is missing or different
  const files = manifest.files;
  const toSend: typeof files = [];
  let unchanged = 0;
  for (let i = 0; i < files.length; i += 200) {
    throwIfAborted(signal);
    const batch = files.slice(i, i + 200);
    const res = await withRetry(() => backupPost<{ files: { path: string; status: string }[] }>('restore-check', { session, files: batch }), signal);
    res.files.forEach((r, k) => {
      if (r.status === 'invalid') throw new Error(`The server refused the file path ${batch[k].path}.`);
      if (r.status === 'same') unchanged++;
      else toSend.push(batch[k]);
    });
    onProgress({ phase: 'checking', label: 'Comparing photos & files with the server…', done: Math.min(i + 200, files.length), total: Math.max(files.length, 1) });
  }

  // Verify reads EVERY file back out of the ZIP (that is the point of a
  // verify); a restore only sends what the server doesn't already have.
  const toRead = verifyOnly ? files : toSend;
  const sendBytes = toRead.reduce((a, f) => a + f.size, 0) || 1;
  let sentBytes = 0;
  let uploaded = 0;
  await pool(toRead, 3, async (f) => {
    // getData re-checks the CRC-32 while reading, so a damaged ZIP stops here.
    const blob = await read<Blob>(UPLOADS_PREFIX + f.path, new zip.BlobWriter());
    if (!verifyOnly) {
      await withRetry(() => {
        const form = new FormData();
        form.append('session', session);
        form.append('path', f.path);
        form.append('size', String(f.size));
        form.append('crc32', f.crc32);
        form.append('file', blob, f.path.split('/').pop());
        return backupPost('restore-file', form);
      }, signal);
    }
    uploaded++;
    sentBytes += f.size;
    onProgress({
      phase: 'uploading',
      label: verifyOnly ? `Checking photos & files — ${uploaded} of ${toRead.length}` : `Uploading photos & files — ${uploaded} of ${toRead.length}`,
      done: Math.min(sentBytes, sendBytes), total: sendBytes,
    });
  }, signal);

  // 3 — database, table by table, in compressed chunks
  const tables = Object.entries(manifest.tables);
  const totalRows = tables.reduce((a, [, n]) => a + n, 0) || 1;
  let rowsSent = 0;
  for (const [table, expected] of tables) {
    throwIfAborted(signal);
    const data = JSON.parse(await read<string>(tableEntryName(table), new zip.TextWriter())) as TableData;
    if (data.table !== table || !Array.isArray(data.columns) || !Array.isArray(data.rows) || data.rows.length !== expected) {
      throw new Error(`The data for "${table}" does not match the backup's manifest.`);
    }
    const chunks = chunkRows(data.rows);
    for (let part = 0; part < chunks.length; part++) {
      const gz = await gzipText(JSON.stringify({ table, columns: data.columns, rows: chunks[part] }));
      await withRetry(() => {
        const form = new FormData();
        form.append('session', session);
        form.append('table', table);
        form.append('part', String(part));
        form.append('rows', String(chunks[part].length));
        form.append('data', new Blob([gz as BlobPart], { type: 'application/gzip' }), `${table}-${part}.json.gz`);
        return backupPost('restore-stage', form);
      }, signal);
      rowsSent += chunks[part].length;
      onProgress({ phase: 'uploading', label: `Uploading database — ${table}`, done: Math.min(rowsSent, totalRows), total: totalRows });
    }
  }

  // 4 — enquiries that were waiting to be saved when the backup was made
  const spool = backup.entries.get(SPOOL_NAME);
  if (spool && !verifyOnly) {
    const gz = await gzipText(await read<string>(SPOOL_NAME, new zip.TextWriter()));
    await withRetry(() => {
      const form = new FormData();
      form.append('session', session);
      form.append('data', new Blob([gz as BlobPart], { type: 'application/gzip' }), 'spool.jsonl.gz');
      return backupPost('restore-spool', form);
    }, signal);
  }

  // 5 — the switch-over (or the rehearsal of it)
  throwIfAborted(signal);
  onProgress({ phase: 'applying', label: verifyOnly ? 'Rehearsing the restore (no changes)…' : 'Saving an undo point and switching the data over…', done: 0, total: 1 });
  const schemaEntry = backup.entries.get(SCHEMA_NAME);
  const schema = schemaEntry ? JSON.parse(await read<string>(SCHEMA_NAME, new zip.TextWriter())) : null;
  const result = await backupPost<Omit<RestoreResult, 'files_uploaded' | 'files_unchanged' | 'files_checked'> & { files_failed?: string[] }>('restore-commit', {
    session,
    tables: manifest.tables,
    schema_packed: schema ? await pack(schema) : '',
    dry_run: verifyOnly,
  });
  if (result.files_failed && result.files_failed.length) {
    throw new Error(`The data was restored, but ${result.files_failed.length} file(s) could not be put in place (${result.files_failed.slice(0, 3).join(', ')}…). Use “Undo last restore” or run the restore again.`);
  }
  onProgress({ phase: 'done', label: verifyOnly ? 'Backup verified' : 'Restore complete', done: 1, total: 1 });
  return { ...result, files_uploaded: verifyOnly ? 0 : uploaded, files_unchanged: unchanged, files_checked: verifyOnly ? uploaded : 0 };
}

export interface UndoResult {
  tables: Record<string, number>;
  files_restored: number;
}

export const undoLastRestore = (password: string) => backupPost<UndoResult>('rollback', { password });

/** Read a cell for display in the summary (not used for restoring). */
export function describeManifest(m: Manifest) {
  return Object.entries(m.tables).sort((a, b) => b[1] - a[1]);
}

// Re-exported for the UI
export type { Manifest, ValidationResult };
export { throwIfAborted };
