/**
 * Unit tests for the backup format rules.   npx tsx src/lib/backup/format.test.ts
 */
import assert from 'node:assert';
import {
  buildManifest, chunkRows, crcHex, formatBytes, isSafeUploadPath, validateBackup, backupFileName,
  MANIFEST_NAME, SCHEMA_NAME, tableEntryName, UPLOADS_PREFIX, type ZipEntryInfo,
} from './format';

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

const manifest = () => buildManifest({
  createdAt: new Date('2026-11-18T09:00:00Z'),
  source: 'https://amouraffairs.in',
  createdBy: 'info@amouraffairs.in',
  tables: { leads: 2, settings: 0 },
  files: [
    { path: 'albums/1_abc.webp', size: 10, crc32: '0000002a' },
    { path: 'lead-magnets/x.pdf', size: 5, crc32: 'deadbeef' },
  ],
  spoolLines: 0,
});
const entriesFor = (m = manifest()): ZipEntryInfo[] => [
  { name: MANIFEST_NAME, size: 1, crc32: '00000000' },
  { name: SCHEMA_NAME, size: 1, crc32: '00000000' },
  ...Object.keys(m.tables).map((t) => ({ name: tableEntryName(t), size: 1, crc32: '00000000' })),
  ...m.files.map((f) => ({ name: UPLOADS_PREFIX + f.path, size: f.size, crc32: f.crc32 })),
];

console.log('upload paths');
test('accepts normal upload paths', () => {
  for (const p of ['albums/1790340342_1dd112e3591c75df.webp', 'lead-magnets/a.pdf', 'site/My Photo (1).JPG', 'team/x.jpeg']) {
    assert.ok(isSafeUploadPath(p), p);
  }
});
test('rejects traversal, absolute, dotfiles, scripts and the size cache', () => {
  for (const p of ['../config.php', 'albums/../../x.webp', '/etc/passwd.webp', 'albums/.htaccess', '.user.ini',
    'albums/shell.php', 'albums/x.webp.php', 'albums/x.phtml', '_w/800/albums/x.webp', 'albums//x.webp',
    'albums\\x.webp', '', 'albums/x', 'a/\0.webp', 'albums/-x.webp']) {
    assert.ok(!isSafeUploadPath(p), p);
  }
});

console.log('manifest');
test('totals add up', () => {
  const m = manifest();
  assert.deepStrictEqual(m.totals, { rows: 2, files: 2, bytes: 15 });
  assert.strictEqual(m.format, 'amour-affairs-backup');
});
test('a complete backup validates', () => {
  const r = validateBackup(manifest(), entriesFor());
  assert.ok(r.ok, r.errors.join('; '));
  assert.deepStrictEqual(r.warnings, []);
});
test('rejects a non-backup', () => {
  assert.ok(!validateBackup({ hello: 1 }, []).ok);
  assert.ok(!validateBackup(null, []).ok);
});
test('rejects a newer format version', () => {
  const r = validateBackup({ ...manifest(), version: 99 }, entriesFor());
  assert.ok(!r.ok && /newer version/.test(r.errors[0]));
});
test('detects a missing table file', () => {
  const r = validateBackup(manifest(), entriesFor().filter((e) => e.name !== tableEntryName('leads')));
  assert.ok(!r.ok && r.errors.some((e) => e.includes('leads')));
});
test('detects a truncated or tampered photo', () => {
  const short = entriesFor().map((e) => (e.name.endsWith('1_abc.webp') ? { ...e, size: 9 } : e));
  assert.ok(validateBackup(manifest(), short).errors.some((e) => e.includes('size differs')));
  const swapped = entriesFor().map((e) => (e.name.endsWith('x.pdf') ? { ...e, crc32: '12345678' } : e));
  assert.ok(validateBackup(manifest(), swapped).errors.some((e) => e.includes('checksum differs')));
});
test('detects a missing photo', () => {
  const r = validateBackup(manifest(), entriesFor().filter((e) => !e.name.endsWith('x.pdf')));
  assert.ok(r.errors.some((e) => e.startsWith('Missing from the ZIP')));
});
test('refuses unsafe paths smuggled into the manifest', () => {
  const m = manifest();
  m.files.push({ path: '../api/config.php', size: 1, crc32: '00000000' });
  assert.ok(validateBackup(m, entriesFor()).errors.some((e) => e.includes('Unsafe')));
});
test('refuses duplicate file entries', () => {
  const m = manifest();
  m.files.push({ ...m.files[0] });
  assert.ok(validateBackup(m, entriesFor()).errors.some((e) => e.includes('twice')));
});
test('flags files larger than the server accepts', () => {
  assert.ok(validateBackup(manifest(), entriesFor(), 8).errors.some((e) => e.includes('larger than this server accepts')));
});
test('warns (not fails) when the schema file is absent', () => {
  const r = validateBackup(manifest(), entriesFor().filter((e) => e.name !== SCHEMA_NAME));
  assert.ok(r.ok && r.warnings.length === 1);
});
test('warns about unlisted extra files', () => {
  const r = validateBackup(manifest(), [...entriesFor(), { name: UPLOADS_PREFIX + 'albums/extra.webp', size: 1, crc32: '00000001' }]);
  assert.ok(r.ok && r.warnings.some((w) => w.includes('not listed')));
});
test('rejects invalid table names and counts', () => {
  const m = manifest();
  (m.tables as Record<string, number>)['bad; DROP'] = 1;
  (m.tables as Record<string, number>)['leads'] = -1;
  const r = validateBackup(m, entriesFor());
  assert.ok(r.errors.some((e) => e.includes('Invalid table name')) && r.errors.some((e) => e.includes('invalid row count')));
});

console.log('helpers');
test('crcHex pads and handles negatives', () => {
  assert.strictEqual(crcHex(42), '0000002a');
  assert.strictEqual(crcHex(-1), 'ffffffff');
});
test('chunkRows respects row and byte limits and loses nothing', () => {
  const rows = Array.from({ length: 3500 }, (_, i) => [String(i), 'x'.repeat(i % 7 === 0 ? 2000 : 10)]);
  const byRows = chunkRows(rows, 1500, 1e12);
  assert.deepStrictEqual(byRows.map((c) => c.length), [1500, 1500, 500]);
  const byBytes = chunkRows(rows, 100000, 50_000);
  assert.ok(byBytes.every((c) => JSON.stringify(c).length <= 50_000 + 2100));
  assert.strictEqual(byBytes.flat().length, 3500);
  assert.deepStrictEqual(byBytes.flat(), rows);
  const huge = [['y'.repeat(3_000_000)]];
  assert.strictEqual(chunkRows(huge, 10, 1000).length, 1); // a single oversized row still goes alone
  assert.deepStrictEqual(chunkRows([]), []);
});
test('formatBytes', () => {
  assert.strictEqual(formatBytes(500), '500 B');
  assert.strictEqual(formatBytes(1536), '1.5 KB');
  assert.strictEqual(formatBytes(45 * 1024 * 1024), '45 MB');
});
test('file name uses India time', () => {
  assert.strictEqual(backupFileName(new Date('2026-11-18T20:00:00Z')), 'amour-affairs-backup-2026-11-19-0130.zip');
});

console.log(`\n${passed} tests passed`);
