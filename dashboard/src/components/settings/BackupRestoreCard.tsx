"use client";

/* ─────────────────────────────────────────────────────────────
   DATA & BACKUP — full-site backup ZIP, restore, undo, reports
   Everything the website and dashboard store (database + every
   uploaded photo/PDF) goes into one ZIP the studio keeps safe.
   The same ZIP restores it all, with a dry-run "verify", a
   password check, and an automatic undo point.
   ───────────────────────────────────────────────────────────── */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DatabaseBackup, Download, Upload, Loader2, CheckCircle2, AlertTriangle, XCircle, RotateCcw,
  ShieldCheck, FileArchive, FileSpreadsheet, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { useBookings, useLeads, useClients, useTeam, usePackages } from '@/lib/useData';
import { flattenBookings, flattenLeads, flattenClients, flattenTeam, flattenPackages } from '@/lib/exportUtils';
import { formatISTDateTime } from '@/lib/datetime';
import { backupFileName, formatBytes, TABLE_LABELS } from '@/lib/backup/format';
import type { BackupInfo, ExportResult, Progress } from '@/lib/backup/exporter';
import type { InspectedBackup, RestoreResult, UndoResult } from '@/lib/backup/importer';

type Busy = null | 'export' | 'inspect' | 'restore' | 'verify' | 'undo';

const errText = (e: unknown) =>
  e instanceof Error ? (e.message === 'Cancelled' ? 'Cancelled — nothing was changed.' : e.message) : 'Something went wrong.';

function ProgressBar({ p }: { p: Progress }) {
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex justify-between text-[12px] text-muted-foreground">
        <span className="truncate pr-3">{p.label}</span>
        <span className="tabular-nums">{p.phase === 'done' ? '100' : pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${p.phase === 'done' ? 100 : pct}%` }} />
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'ok' | 'warn' | 'error'; children: React.ReactNode }) {
  const styles = {
    ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
    warn: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25',
    error: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25',
  }[tone];
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : XCircle;
  return (
    <div className={`flex gap-2.5 rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${styles}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

/** Password (and optional typed confirmation) dialog. */
function ConfirmDialog(props: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  requireWord?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [word, setWord] = useState('');
  const ready = password.length > 0 && (!props.requireWord || word.trim().toUpperCase() === props.requireWord);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={props.title}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={props.onCancel} />
      <form
        className="relative w-full max-w-[480px] dash-card p-6 space-y-4"
        onSubmit={(e) => { e.preventDefault(); if (ready) props.onConfirm(password); }}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-foreground">{props.title}</h3>
          <button type="button" onClick={props.onCancel} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="text-[13px] text-muted-foreground leading-relaxed space-y-2">{props.body}</div>
        {props.requireWord && (
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type {props.requireWord} to confirm</span>
            <input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off"
              className="mt-1.5 w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50" />
          </label>
        )}
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Your dashboard password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus={!props.requireWord}
            className="mt-1.5 w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50" />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={props.onCancel} className="rounded-xl">Cancel</Button>
          {/* onClick, not type="submit": the base-ui Button primitive does not submit forms */}
          <Button type="button" disabled={!ready} onClick={() => { if (ready) props.onConfirm(password); }}
            className={`rounded-xl font-bold ${props.destructive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-primary text-primary-foreground'}`}>
            {props.confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function BackupRestoreCard({ userEmail }: { userEmail: string }) {
  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [infoError, setInfoError] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState('');

  const [backup, setBackup] = useState<InspectedBackup | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [dialog, setDialog] = useState<null | 'restore' | 'verify' | 'undo'>(null);
  const [undoResult, setUndoResult] = useState<UndoResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadInfo = useCallback(async () => {
    try {
      const { getBackupInfo } = await import('@/lib/backup/exporter');
      setInfo(await getBackupInfo());
      setInfoError('');
    } catch (e) {
      setInfoError(errText(e));
    }
  }, []);

  useEffect(() => { void loadInfo(); }, [loadInfo]);

  // Leaving mid-way would abandon a backup or restore — ask first.
  useEffect(() => {
    if (!busy || busy === 'inspect') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const totalRows = useMemo(() => (info ? info.tables.reduce((a, t) => a + t.rows, 0) : 0), [info]);

  /* ── export ── */
  const startExport = async () => {
    setExportError(''); setExportResult(null);
    const { chooseSaveTarget, exportBackup } = await import('@/lib/backup/exporter');
    const name = backupFileName();
    const target = await chooseSaveTarget(name);
    if (!target) return; // picker cancelled
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy('export');
    try {
      const result = await exportBackup({ fileName: name, target, createdBy: userEmail, onProgress: setProgress, signal: ac.signal });
      setExportResult(result);
    } catch (e) {
      setExportError(errText(e));
    } finally {
      setBusy(null); setProgress(null); abortRef.current = null;
    }
  };

  /* ── restore: pick + inspect ── */
  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setRestoreError(''); setRestoreResult(null); setUndoResult(null);
    if (backup) { await backup.close().catch(() => {}); setBackup(null); }
    setBusy('inspect');
    try {
      const { inspectBackup } = await import('@/lib/backup/importer');
      setBackup(await inspectBackup(file, info?.upload_max ?? 0));
    } catch (e) {
      setRestoreError(errText(e));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const runRestore = async (password: string, verifyOnly: boolean) => {
    if (!backup) return;
    setDialog(null); setRestoreError(''); setRestoreResult(null);
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(verifyOnly ? 'verify' : 'restore');
    try {
      const { restoreBackup } = await import('@/lib/backup/importer');
      setRestoreResult(await restoreBackup({ backup, password, verifyOnly, onProgress: setProgress, signal: ac.signal }));
      if (!verifyOnly) await loadInfo();
    } catch (e) {
      setRestoreError(errText(e));
    } finally {
      setBusy(null); setProgress(null); abortRef.current = null;
    }
  };

  const runUndo = async (password: string) => {
    setDialog(null); setRestoreError(''); setUndoResult(null);
    setBusy('undo');
    try {
      const { undoLastRestore } = await import('@/lib/backup/importer');
      setUndoResult(await undoLastRestore(password));
      setRestoreResult(null);
      await loadInfo();
    } catch (e) {
      setRestoreError(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const m = backup?.manifest;
  const lastSnapshot = info?.snapshots?.[0];
  // After an undo, the newest undo point is the restored data: offer to bring it back.
  const isRedo = lastSnapshot?.reason === 'before undo';

  return (
    <div className="dash-card p-8 space-y-7">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <DatabaseBackup className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground">Data &amp; Backup</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            One file with everything — keep it safe, and you can rebuild the website and dashboard from it.
          </p>
        </div>
      </div>

      {/* ── Full backup ── */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 max-w-[520px]">
            <h3 className="font-bold text-foreground flex items-center gap-2"><FileArchive className="h-4 w-4 text-primary" /> Full backup (ZIP)</h3>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              {info
                ? <>Every enquiry, client, booking, payment, album, film, guide, testimonial, CRM record and website setting — <b className="text-foreground">{totalRows.toLocaleString('en-IN')} records</b> — plus <b className="text-foreground">{info.files.count.toLocaleString('en-IN')} uploaded photos &amp; files ({formatBytes(info.files.bytes)})</b>.</>
                : infoError
                  ? <span className="text-red-500">Couldn&apos;t reach the server: {infoError}</span>
                  : 'Checking what there is to back up…'}
            </p>
          </div>
          <Button onClick={startExport} disabled={!!busy || !info}
            className="rounded-xl px-5 h-10 bg-primary text-primary-foreground font-bold shadow-md shrink-0">
            {busy === 'export' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Export full backup
          </Button>
        </div>
        {busy === 'export' && progress && (
          <div className="space-y-2">
            <ProgressBar p={progress} />
            <button type="button" onClick={() => abortRef.current?.abort()} className="text-[12px] text-muted-foreground hover:text-foreground underline">Cancel</button>
          </div>
        )}
        {exportResult && (
          <Notice tone="ok">
            Backup saved as <b>{exportResult.fileName}</b> ({formatBytes(exportResult.bytes)}) —{' '}
            {exportResult.manifest.totals.rows.toLocaleString('en-IN')} records and {exportResult.manifest.totals.files} files.
            Store it somewhere other than this computer too (Google Drive, an external drive). It contains client details, so keep it private.
          </Notice>
        )}
        {exportError && <Notice tone="error">Backup did not finish: {exportError}</Notice>}
      </section>

      <div className="border-t border-border/50" />

      {/* ── Restore ── */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 max-w-[520px]">
            <h3 className="font-bold text-foreground flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> Restore from a backup</h3>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              Choose a backup ZIP. It is checked on this computer first; nothing on the site changes until you confirm with your password.
              The current data is saved before restoring, so a restore can be undone.
            </p>
          </div>
          <input ref={fileInput} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={!!busy} className="rounded-xl px-5 h-10 font-bold shrink-0">
            {busy === 'inspect' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Choose backup file…
          </Button>
        </div>

        {backup && (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{backup.file.name}</p>
                <p className="text-[12px] text-muted-foreground">
                  {formatBytes(backup.file.size)}{m && <> · made {m.created_at_ist} by {m.created_by} · from {m.source}</>}
                </p>
              </div>
              <button type="button" disabled={!!busy} onClick={async () => { await backup.close().catch(() => {}); setBackup(null); setRestoreResult(null); }}
                className="text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label="Remove file"><X className="h-4 w-4" /></button>
            </div>

            {backup.validation.errors.length > 0 && (
              <Notice tone="error">
                <b>This file can&apos;t be restored.</b>
                <ul className="list-disc pl-4 mt-1">{backup.validation.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>
                {backup.validation.errors.length > 8 && <p className="mt-1">…and {backup.validation.errors.length - 8} more.</p>}
              </Notice>
            )}
            {backup.validation.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}

            {m && backup.validation.ok && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-[13px]">
                  {Object.entries(m.tables).sort((a, b) => b[1] - a[1]).map(([t, n]) => {
                    const now = info?.tables.find((x) => x.name === t)?.rows;
                    return (
                      <div key={t} className="flex justify-between gap-2 min-w-0">
                        <span className="text-muted-foreground truncate" title={t}>{TABLE_LABELS[t] ?? t}</span>
                        <span className="tabular-nums text-foreground" title={now !== undefined ? `Live site now: ${now}` : 'Not on the live site'}>
                          {n.toLocaleString('en-IN')}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between gap-2 font-semibold">
                    <span className="text-muted-foreground">Photos &amp; files</span>
                    <span className="tabular-nums text-foreground">{m.totals.files} ({formatBytes(m.totals.bytes)})</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="outline" disabled={!!busy} onClick={() => setDialog('verify')} className="rounded-xl h-10 font-bold">
                    {busy === 'verify' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    Verify only (no changes)
                  </Button>
                  <Button disabled={!!busy} onClick={() => setDialog('restore')} className="rounded-xl h-10 font-bold bg-red-600 hover:bg-red-700 text-white">
                    {busy === 'restore' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                    Restore this backup
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {(busy === 'restore' || busy === 'verify') && progress && (
          <div className="space-y-2">
            <ProgressBar p={progress} />
            {progress.phase !== 'applying' && (
              <button type="button" onClick={() => abortRef.current?.abort()} className="text-[12px] text-muted-foreground hover:text-foreground underline">Cancel</button>
            )}
            <p className="text-[12px] text-muted-foreground">Keep this tab open until it finishes.</p>
          </div>
        )}

        {restoreResult && (
          restoreResult.dry_run ? (
            <Notice tone="ok">
              <b>Backup verified.</b> All {restoreResult.files_checked} files passed their checksums and all {Object.values(restoreResult.tables).reduce((a, b) => a + b, 0).toLocaleString('en-IN')} records
              loaded cleanly in a rehearsal that was then rolled back — nothing on the site changed.
              {restoreResult.files_unchanged > 0 && <> {restoreResult.files_unchanged} of the backup&apos;s files are already identical on the server.</>}
              {restoreResult.created_tables.length > 0 && <> A restore would also create: {restoreResult.created_tables.join(', ')}.</>}
            </Notice>
          ) : (
            <Notice tone="ok">
              <b>Restore complete.</b> {Object.values(restoreResult.tables).reduce((a, b) => a + b, 0).toLocaleString('en-IN')} records restored
              across {Object.keys(restoreResult.tables).length} tables; {restoreResult.files_uploaded} files uploaded
              ({restoreResult.files_unchanged} were already identical).
              {restoreResult.spool_added > 0 && <> {restoreResult.spool_added} unsaved enquiries were queued and will be saved automatically.</>}
              {restoreResult.untouched.length > 0 && <> Left as they were (not in this backup): {restoreResult.untouched.join(', ')}.</>}
              {' '}Dashboard accounts were restored too — if you are signed out, sign in with the password that was in use when the backup was made.
              <div className="mt-2"><Button size="sm" variant="outline" className="rounded-lg" onClick={() => window.location.reload()}>Reload dashboard</Button></div>
            </Notice>
          )
        )}
        {undoResult && (
          <Notice tone="ok">
            <b>Restore undone.</b> The data from before the restore is back ({Object.values(undoResult.tables).reduce((a, b) => a + b, 0).toLocaleString('en-IN')} records
            {undoResult.files_restored > 0 && <>, {undoResult.files_restored} replaced files put back</>}).
            <div className="mt-2"><Button size="sm" variant="outline" className="rounded-lg" onClick={() => window.location.reload()}>Reload dashboard</Button></div>
          </Notice>
        )}
        {restoreError && <Notice tone="error">{restoreError}</Notice>}

        {lastSnapshot && (
          <div className="flex items-center justify-between gap-4 flex-wrap rounded-xl border border-border/50 px-4 py-3">
            <p className="text-[13px] text-muted-foreground">
              {isRedo
                ? <>The restore was undone on {formatISTDateTime(lastSnapshot.created)}. You can bring the restored data back.</>
                : <>Undo point saved {formatISTDateTime(lastSnapshot.created)}, just before the last restore ({lastSnapshot.rows.toLocaleString('en-IN')} records).</>}
            </p>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setDialog('undo')} className="rounded-lg font-bold">
              {busy === 'undo' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              {isRedo ? 'Reverse the undo' : 'Undo last restore'}
            </Button>
          </div>
        )}
      </section>

      <div className="border-t border-border/50" />

      {/* ── Readable reports ── */}
      <ReportsRow />

      {dialog === 'verify' && (
        <ConfirmDialog
          title="Verify this backup"
          confirmLabel="Verify"
          onCancel={() => setDialog(null)}
          onConfirm={(pw) => runRestore(pw, true)}
          body={<p>The whole restore is rehearsed on the server and then rolled back. Nothing on the website or dashboard changes.</p>}
        />
      )}
      {dialog === 'restore' && m && (
        <ConfirmDialog
          title="Restore this backup?"
          confirmLabel="Restore now"
          requireWord="RESTORE"
          destructive
          onCancel={() => setDialog(null)}
          onConfirm={(pw) => runRestore(pw, false)}
          body={<>
            <p>The website and dashboard content will be <b className="text-foreground">replaced with this backup from {m.created_at_ist}</b>.
              Anything added after that date — enquiries, edits, uploads — will no longer appear.</p>
            <p>An undo point is saved first, so you can reverse this from this screen afterwards.</p>
          </>}
        />
      )}
      {dialog === 'undo' && lastSnapshot && (
        <ConfirmDialog
          title={isRedo ? 'Reverse the undo?' : 'Undo the last restore?'}
          confirmLabel={isRedo ? 'Bring it back' : 'Undo restore'}
          destructive
          onCancel={() => setDialog(null)}
          onConfirm={runUndo}
          body={<p>The data saved at {formatISTDateTime(lastSnapshot.created)} comes back, and files the restore replaced are put back.
            The current data is saved first, so this can be reversed too.</p>}
        />
      )}
    </div>
  );
}

/** The human-readable Excel / PDF export (not a restorable backup). */
function ReportsRow() {
  const { data: bookingsData } = useBookings();
  const { data: leadsData } = useLeads();
  const { data: clientsData } = useClients();
  const { data: teamData } = useTeam(true);
  const { data: packagesData } = usePackages();
  const datasets = useMemo(
    () => [flattenBookings(bookingsData), flattenLeads(leadsData), flattenClients(clientsData), flattenTeam(teamData), flattenPackages(packagesData)],
    [bookingsData, leadsData, clientsData, teamData, packagesData]
  );
  return (
    <section className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0 max-w-[520px]">
        <h3 className="font-bold text-foreground flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /> Readable report (Excel / PDF)</h3>
        <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
          Bookings, enquiries, clients, team and packages as a spreadsheet or PDF — for reading and sharing. To keep a copy you can restore from, use the full backup above.
        </p>
      </div>
      <ExportMenu datasets={datasets} filename="amour-affairs-report" pdfTitle="Amour Affairs — CRM Report" variant="inline" />
    </section>
  );
}
