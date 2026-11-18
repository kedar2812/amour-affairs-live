/**
 * Network helpers for backup & restore: gzip, base64, retries and calls to
 * api/backup.php through the dashboard's normal authenticated client (so an
 * expired sign-in refreshes itself exactly like everywhere else).
 */
import { apiRequest } from '@/lib/api';

export class BackupHttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export class BackupCancelled extends Error {
  constructor() {
    super('Cancelled');
  }
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new BackupCancelled();
}

/* ── compression ─────────────────────────────────────────── */

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function gzipText(text: string): Promise<Uint8Array> {
  const input = new Blob([text]).stream();
  return streamToBytes(input.pipeThrough(new CompressionStream('gzip')));
}

export async function gunzipToText(bytes: Uint8Array): Promise<string> {
  const input = new Blob([bytes as BlobPart]).stream();
  return new Response(input.pipeThrough(new DecompressionStream('gzip'))).text();
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Server responses packed as base64(gzip(JSON)). */
export async function unpack<T>(packed: string): Promise<T> {
  return JSON.parse(await gunzipToText(base64ToBytes(packed))) as T;
}

export async function pack(value: unknown): Promise<string> {
  return bytesToBase64(await gzipText(JSON.stringify(value)));
}

/* ── requests ────────────────────────────────────────────── */

async function call<T>(endpoint: string, init: { method: 'GET' | 'POST'; body?: Record<string, unknown> | FormData }): Promise<T> {
  let res: Response;
  try {
    res = await apiRequest<Response>(endpoint, { ...init, raw: true });
  } catch (e) {
    // Network failure (or an expired sign-in that could not be refreshed)
    throw new BackupHttpError(e instanceof Error ? e.message : 'Network error', 0);
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* non-JSON (proxy / firewall page) */ }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error
      || (res.status === 403 || res.status === 406 || res.status === 412
        ? `The server's firewall refused the request (HTTP ${res.status}).`
        : `Server error (HTTP ${res.status}).`);
    throw new BackupHttpError(msg, res.status);
  }
  if (data === null) throw new BackupHttpError('The server sent an unreadable reply.', res.status);
  return data as T;
}

export const backupGet = <T>(params: Record<string, string>) =>
  call<T>(`backup.php?${new URLSearchParams(params)}`, { method: 'GET' });

export const backupPost = <T>(action: string, body: Record<string, unknown> | FormData) =>
  call<T>(`backup.php?action=${encodeURIComponent(action)}`, { method: 'POST', body });

/** Raw download of one upload through the API (fallback path). */
export async function backupDownloadFile(path: string): Promise<Blob> {
  const res = await apiRequest<Response>(`backup.php?${new URLSearchParams({ action: 'file', path })}`, { raw: true });
  if (!res.ok) throw new BackupHttpError(`Could not download ${path} (HTTP ${res.status}).`, res.status);
  return res.blob();
}

/** Errors worth retrying: network, server overload, damaged-in-transit. */
const retryable = (e: unknown) =>
  !(e instanceof BackupCancelled) &&
  (!(e instanceof BackupHttpError) || e.status === 0 || e.status === 422 || e.status === 429 || e.status >= 500);

export async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    throwIfAborted(signal);
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!retryable(e) || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i));
    }
  }
  throw last;
}

/** Run `worker` over `items` with at most `limit` in flight. */
export async function pool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>, signal?: AbortSignal) {
  let next = 0;
  let failed: unknown = null;
  const run = async () => {
    while (next < items.length && !failed) {
      throwIfAborted(signal);
      const i = next++;
      try { await worker(items[i], i); } catch (e) { failed = failed ?? e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  if (failed) throw failed;
}
