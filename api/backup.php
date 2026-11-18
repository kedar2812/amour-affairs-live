<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — Full backup & restore
 * ============================================================
 * Powers Dashboard → Settings → Data & Backup.
 *
 * EXPORT  The dashboard builds the backup ZIP in the browser. This endpoint
 *         hands it the database one table page at a time and the list of
 *         uploaded files (which the browser downloads directly), so no
 *         request ever has to hold the whole site in memory or time.
 *
 * RESTORE The browser reads the ZIP locally and sends it back in small
 *         pieces: each uploaded file on its own (checked against its CRC-32),
 *         each table in chunks (gzip-compressed, so the host's firewall never
 *         sees raw article text it might mistake for an attack). Both are
 *         staged in a private session folder; nothing on the live site
 *         changes until "commit", which:
 *           1. re-checks every chunk arrived,
 *           2. adds any table/column the backup has but this database lacks,
 *           3. saves a snapshot of the current data (undo point),
 *           4. swaps all tables inside ONE transaction — all or nothing,
 *           5. only then moves the staged files into uploads/ (keeping a
 *              copy of any file it replaces, for undo).
 *         A dry run does steps 1–4 and then rolls back: it proves a backup
 *         restores cleanly without changing anything.
 *
 * Every action requires a signed-in dashboard user; starting a restore or
 * undoing one also re-checks that user's password.
 *
 * PHP 7.3-compatible: the live host runs 7.3.33.
 * ============================================================
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/upload.php';

handleCORS();
setJSONHeaders();
header('Cache-Control: no-store');

define('BK_FORMAT', 'amour-affairs-backup');
define('BK_VERSION', 1);
define('BK_DIR', __DIR__ . '/backups');
define('BK_PAGE_ROWS', 2000);
define('BK_KEEP_SNAPSHOTS', 3);
define('BK_SESSION_TTL', 6 * 3600);

/** Sessions/throttling bookkeeping: meaningless in a backup, unsafe to restore. */
function bk_skipTables(): array {
    return array('rate_limits', 'refresh_tokens');
}

/** File types a backup carries (everything the dashboard can upload). */
function bk_fileExtensions(): array {
    return array('webp', 'jpg', 'jpeg', 'png', 'gif', 'avif', 'pdf', 'mp4', 'webm');
}

$authUser = requireAuth();
$userId = (int)$authUser['sub'];
@set_time_limit(0);

// ── Helpers ──────────────────────────────────────────────────

/** A connection of its own: every value comes back as a string (or null), so
 *  numbers, decimals and dates round-trip byte-for-byte. */
function bk_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET),
            DB_USER,
            DB_PASS,
            array(
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_NUM,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_STRINGIFY_FETCHES  => true,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+05:30'",
            )
        );
    }
    return $pdo;
}

function bk_q(string $ident): string {
    return '`' . str_replace('`', '``', $ident) . '`';
}

function bk_validTableName($name): bool {
    return is_string($name) && preg_match('/^[A-Za-z0-9_]{1,64}$/', $name) === 1;
}

/** Make a private folder (with a deny-all .htaccess) and return its path. */
function bk_dir(string $path): string {
    if (!is_dir($path) && !@mkdir($path, 0750, true) && !is_dir($path)) {
        throw new RuntimeException('Cannot create ' . basename($path) . ' on the server.');
    }
    $guard = BK_DIR . '/.htaccess';
    if (!is_file($guard)) {
        @file_put_contents($guard, "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n  Order Allow,Deny\n  Deny from all\n</IfModule>\n");
    }
    return $path;
}

function bk_rrmdir(string $dir): void {
    if (!is_dir($dir)) return;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($it as $f) {
        if ($f->isDir()) @rmdir($f->getPathname()); else @unlink($f->getPathname());
    }
    @rmdir($dir);
}

/** Base tables in this database, minus the bookkeeping ones. */
function bk_tables(PDO $db): array {
    $out = array();
    foreach ($db->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_NUM) as $row) {
        if (!in_array($row[0], bk_skipTables(), true)) $out[] = $row[0];
    }
    sort($out);
    return $out;
}

/** Column metadata in table order. */
function bk_columns(PDO $db, string $table): array {
    $stmt = $db->prepare(
        'SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION'
    );
    $stmt->execute(array($table));
    $cols = array();
    foreach ($stmt->fetchAll(PDO::FETCH_NUM) as $r) {
        $cols[] = array(
            'name'     => $r[0],
            'type'     => $r[1],
            'binary'   => in_array(strtolower($r[2]), array('binary', 'varbinary', 'tinyblob', 'blob', 'mediumblob', 'longblob', 'bit'), true),
            'nullable' => $r[3] === 'YES',
            'default'  => $r[4],
            'extra'    => $r[5],
        );
    }
    return $cols;
}

function bk_primaryKey(PDO $db, string $table): array {
    $stmt = $db->prepare(
        "SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
          ORDER BY ORDINAL_POSITION"
    );
    $stmt->execute(array($table));
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

/** JSON-safe value: strings stay strings; binary / non-UTF-8 travel as {"b64": …}. */
function bk_encodeValue($value, bool $binary) {
    if ($value === null) return null;
    if ($binary || preg_match('//u', $value) !== 1) return array('b64' => base64_encode($value));
    return $value;
}

function bk_decodeValue($value) {
    if (is_array($value) && isset($value['b64'])) return base64_decode($value['b64'], true);
    if ($value === null || is_string($value)) return $value;
    if (is_bool($value)) return $value ? '1' : '0';
    if (is_int($value) || is_float($value)) return (string)$value;
    throw new InvalidArgumentException('Unexpected value in backup data.');
}

/** gzip + base64 JSON (keeps big text bodies compact and firewall-proof). */
function bk_pack($data): string {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) throw new RuntimeException('Could not encode backup data: ' . json_last_error_msg());
    return base64_encode(gzencode($json, 6));
}

function bk_readGzJson(string $file) {
    $raw = @file_get_contents($file);
    $json = ($raw === false) ? false : @gzdecode($raw);
    $data = ($json === false) ? null : json_decode($json, true);
    if (!is_array($data)) throw new RuntimeException('A stored backup chunk is unreadable: ' . basename($file));
    return $data;
}

/** One page of a table, ordered by primary key (keyset paging when possible). */
function bk_tablePage(PDO $db, string $table, $after, int $limit): array {
    $cols = bk_columns($db, $table);
    if (!$cols) throw new InvalidArgumentException('Unknown table');
    $pk = bk_primaryKey($db, $table);
    $names = array();
    foreach ($cols as $c) $names[] = bk_q($c['name']);

    // Plain query (MySQL's text protocol), not a prepared statement: every
    // value then arrives exactly as MySQL prints it — no float rounding.
    $sql = 'SELECT ' . implode(', ', $names) . ' FROM ' . bk_q($table);
    if ($pk) {
        $pkq = array();
        foreach ($pk as $p) $pkq[] = bk_q($p);
        if (is_array($after) && count($after) === count($pk)) {
            $lit = array();
            foreach ($after as $v) $lit[] = $db->quote((string)$v);
            $sql .= ' WHERE (' . implode(', ', $pkq) . ') > (' . implode(', ', $lit) . ')';
        }
        $sql .= ' ORDER BY ' . implode(', ', $pkq) . ' LIMIT ' . (int)$limit;
    } else {
        $offset = is_array($after) && isset($after['offset']) ? (int)$after['offset'] : 0;
        $sql .= ' LIMIT ' . (int)$limit . ' OFFSET ' . $offset;
    }
    $stmt = $db->query($sql);

    $rows = array();
    $pkIndex = array();
    foreach ($pk as $p) {
        foreach ($cols as $i => $c) if ($c['name'] === $p) $pkIndex[] = $i;
    }
    $last = null;
    while ($r = $stmt->fetch(PDO::FETCH_NUM)) {
        $last = $r;
        $out = array();
        foreach ($r as $i => $v) $out[] = bk_encodeValue($v, $cols[$i]['binary']);
        $rows[] = $out;
    }

    $next = null;
    if (count($rows) === $limit) {
        if ($pk) {
            $next = array();
            foreach ($pkIndex as $i) $next[] = $last[$i];
        } else {
            $offset = is_array($after) && isset($after['offset']) ? (int)$after['offset'] : 0;
            $next = array('offset' => $offset + $limit);
        }
    }
    $columnNames = array();
    foreach ($cols as $c) $columnNames[] = $c['name'];
    return array('table' => $table, 'columns' => $columnNames, 'rows' => $rows, 'next' => $next);
}

/** Validate a path relative to uploads/. Returns the clean path or null. */
function bk_cleanPath($path): ?string {
    if (!is_string($path) || $path === '' || strlen($path) > 400) return null;
    $path = str_replace('\\', '/', $path);
    if (strpos($path, "\0") !== false || $path[0] === '/') return null;
    $parts = explode('/', $path);
    foreach ($parts as $seg) {
        if ($seg === '' || $seg === '.' || $seg === '..' || $seg[0] === '.') return null;
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9 ._()\-]*$/', $seg)) return null;
    }
    if ($parts[0] === '_w') return null;                       // regenerated image sizes
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if (!in_array($ext, bk_fileExtensions(), true)) return null;
    return $path;
}

/** Every backed-up file under uploads/: [path, size, mtime]. */
function bk_listFiles(): array {
    $root = realpath(UPLOAD_DIR);
    $out = array();
    if ($root === false) return $out;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if (!$f->isFile()) continue;
        $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($root) + 1));
        if (bk_cleanPath($rel) === null) continue;
        $out[] = array('path' => $rel, 'size' => $f->getSize(), 'mtime' => $f->getMTime());
    }
    usort($out, function ($a, $b) { return strcmp($a['path'], $b['path']); });
    return $out;
}

/** Largest single file this server accepts in one request, in bytes. */
function bk_uploadMax(): int {
    $toBytes = function ($v) {
        $v = trim((string)$v);
        if ($v === '') return 0;
        $n = (float)$v;
        switch (strtolower(substr($v, -1))) {
            case 'g': $n *= 1024; // fall through
            case 'm': $n *= 1024; // fall through
            case 'k': $n *= 1024;
        }
        return (int)$n;
    };
    $limits = array_filter(array($toBytes(ini_get('upload_max_filesize')), $toBytes(ini_get('post_max_size'))));
    return $limits ? (int)min($limits) : 0;
}

/** Re-check the signed-in user's password before anything destructive. */
function bk_requirePassword(int $userId, $password): void {
    checkRateLimit('backup_password', 5, 900);
    $stmt = getDB()->prepare('SELECT password_hash FROM admin_users WHERE id = ?');
    $stmt->execute(array($userId));
    $hash = $stmt->fetchColumn();
    if (!is_string($password) || $password === '' || !$hash || !password_verify($password, $hash)) {
        sendError('That password is not correct.', 403);
    }
    resetRateLimit('backup_password');
}

function bk_sessionDir(string $id): string {
    return BK_DIR . '/staging/' . $id;
}

/** Load and check a restore session started by this user. */
function bk_session($id, int $userId): array {
    if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/', $id)) sendError('Invalid restore session.', 400);
    $meta = @json_decode((string)@file_get_contents(bk_sessionDir($id) . '/session.json'), true);
    if (!is_array($meta) || (int)$meta['user'] !== $userId) sendError('This restore session has expired — please start again.', 410);
    if (time() - (int)$meta['created'] > BK_SESSION_TTL) sendError('This restore session has expired — please start again.', 410);
    return $meta;
}

/** Remove abandoned restore sessions (and any half-made snapshot folder). */
function bk_pruneSessions(): void {
    foreach (glob(BK_DIR . '/staging/*', GLOB_ONLYDIR) ?: array() as $dir) {
        if (time() - (int)@filemtime($dir) > BK_SESSION_TTL) bk_rrmdir($dir);
    }
    foreach (glob(BK_DIR . '/snapshots/*', GLOB_ONLYDIR) ?: array() as $dir) {
        if (!is_file($dir . '/snapshot.json') && time() - (int)@filemtime($dir) > BK_SESSION_TTL) bk_rrmdir($dir);
    }
}

function bk_listSnapshots(): array {
    $out = array();
    foreach (glob(BK_DIR . '/snapshots/*', GLOB_ONLYDIR) ?: array() as $dir) {
        $meta = @json_decode((string)@file_get_contents($dir . '/snapshot.json'), true);
        if (!is_array($meta) || empty($meta['complete'])) continue;
        $out[] = array(
            'id'      => basename($dir),
            'created' => $meta['created'],
            'reason'  => $meta['reason'],
            'rows'    => array_sum($meta['tables']),
            'files'   => isset($meta['files']) ? (int)$meta['files'] : 0,
        );
    }
    usort($out, function ($a, $b) { return strcmp($b['created'], $a['created']); });
    return $out;
}

function bk_pruneSnapshots(): void {
    $all = bk_listSnapshots();
    foreach (array_slice($all, BK_KEEP_SNAPSHOTS) as $s) bk_rrmdir(BK_DIR . '/snapshots/' . $s['id']);
}

/**
 * Write the current data of $tables into $dir/<table>/NNNNNN-<rows>.json.gz —
 * the same chunk format a restore upload uses, so a snapshot can be applied
 * by the very same code.
 */
function bk_dumpTables(PDO $db, array $tables, string $dir): array {
    $counts = array();
    foreach ($tables as $t) {
        $tdir = bk_dir($dir . '/' . $t);
        $after = null;
        $part = 0;
        $total = 0;
        do {
            $page = bk_tablePage($db, $t, $after, BK_PAGE_ROWS);
            $n = count($page['rows']);
            if ($n > 0 || $part === 0) {
                $file = sprintf('%s/%06d-%d.json.gz', $tdir, $part, $n);
                $json = json_encode(array('table' => $t, 'columns' => $page['columns'], 'rows' => $page['rows']),
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if ($json === false || @file_put_contents($file, gzencode($json, 6)) === false) {
                    throw new RuntimeException('Could not write the safety snapshot (is the server disk full?).');
                }
                $part++;
                $total += $n;
            }
            $after = $page['next'];
        } while ($after !== null);
        $counts[$t] = $total;
    }
    return $counts;
}

/** Rows staged for a table, from the chunk file names. */
function bk_stagedCount(string $tableDir): int {
    $n = 0;
    foreach (glob($tableDir . '/*.json.gz') ?: array() as $f) {
        if (preg_match('/-(\d+)\.json\.gz$/', $f, $m)) $n += (int)$m[1];
    }
    return $n;
}

/** Is a column definition from a backup safe to replay in ALTER TABLE? */
function bk_safeColumnType($type): bool {
    return is_string($type) && strlen($type) < 2000
        && preg_match("/^[a-z]+(\\((\\d+(,\\d+)?|('([^'\\\\]|''|\\\\.)*'(,'([^'\\\\]|''|\\\\.)*')*))\\))?( unsigned)?( zerofill)?$/i", $type) === 1;
}

/** CREATE TABLE statement from a backup, accepted only in its plain form. */
function bk_safeCreate($sql, string $table): bool {
    return is_string($sql)
        && strpos($sql, 'CREATE TABLE ' . bk_q($table) . ' (') === 0
        && strpos($sql, ';') === false;
}

/**
 * Apply staged/snapshot chunks to the database.
 *   $src      folder holding <table>/NNNNNN-<rows>.json.gz
 *   $expected table => row count the backup says it has
 *   $schema   table => {create, columns[]} from the backup (null for snapshots)
 *   $dryRun   do everything, then roll back
 *   $snapId   when set, save a snapshot of the current data first
 */
function bk_apply(PDO $db, string $src, array $expected, ?array $schema, bool $dryRun, ?string $snapId, int $userId, string $reason): array {
    try {
        return bk_applyInner($db, $src, $expected, $schema, $dryRun, $snapId, $userId, $reason);
    } finally {
        $db->exec('SET FOREIGN_KEY_CHECKS = 1');
    }
}

function bk_applyInner(PDO $db, string $src, array $expected, ?array $schema, bool $dryRun, ?string $snapId, int $userId, string $reason): array {
    // 1 — every chunk arrived?
    foreach ($expected as $t => $rows) {
        if (!bk_validTableName($t)) throw new InvalidArgumentException('Invalid table name in backup: ' . $t);
        $have = bk_stagedCount($src . '/' . $t);
        if ($have !== (int)$rows) {
            throw new RuntimeException("The upload of table \"$t\" is incomplete ($have of $rows rows). Nothing was changed — please try again.");
        }
    }

    // 2 — tables/columns the backup has but this database lacks
    // (foreign keys off first: a new table may reference one created later)
    $db->exec("SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO'");
    $db->exec('SET FOREIGN_KEY_CHECKS = 0');
    $current = bk_tables($db);
    $created = array();
    $addedColumns = array();
    $plans = array();
    foreach ($expected as $t => $rows) {
        if (!in_array($t, $current, true)) {
            $create = $schema && isset($schema[$t]['create']) ? $schema[$t]['create'] : null;
            if (!bk_safeCreate($create, $t)) throw new RuntimeException("This database has no \"$t\" table and the backup's definition for it can't be used.");
            if (!$dryRun) $db->exec($create);
            $created[] = $t;
        } elseif ($schema && isset($schema[$t]['columns']) && is_array($schema[$t]['columns'])) {
            $have = array();
            foreach (bk_columns($db, $t) as $c) $have[$c['name']] = true;
            foreach ($schema[$t]['columns'] as $c) {
                if (!is_array($c) || !isset($c['name'], $c['type']) || isset($have[$c['name']])) continue;
                if (!preg_match('/^[A-Za-z0-9_]{1,64}$/', $c['name']) || !bk_safeColumnType($c['type'])) {
                    throw new RuntimeException("The backup's column \"{$t}.{$c['name']}\" has a definition that can't be applied.");
                }
                if (!$dryRun) $db->exec('ALTER TABLE ' . bk_q($t) . ' ADD COLUMN ' . bk_q($c['name']) . ' ' . $c['type'] . ' NULL');
                $addedColumns[] = $t . '.' . $c['name'];
            }
        }
    }

    // 3 — undo point
    $snapshot = null;
    if (!$dryRun && $snapId !== null) {
        $sdir = bk_dir(BK_DIR . '/snapshots/' . $snapId);
        $meta = array('created' => date('c'), 'reason' => $reason, 'user' => $userId, 'complete' => false);
        @file_put_contents($sdir . '/snapshot.json', json_encode($meta));
        $meta['tables'] = bk_dumpTables($db, bk_tables($db), $sdir . '/db');
        $meta['files'] = count(glob($sdir . '/files/*') ?: array());
        $meta['complete'] = true;
        file_put_contents($sdir . '/snapshot.json', json_encode($meta));
        $snapshot = $snapId;
    }

    // 4 — swap every table in one transaction
    $hasRefreshTokens = (bool)$db->query("SHOW TABLES LIKE 'refresh_tokens'")->fetchColumn();
    $result = array();
    $db->beginTransaction();
    try {
        foreach ($expected as $t => $rows) {
            $target = array();
            foreach (bk_columns($db, $t) as $c) {
                if (stripos($c['extra'], 'GENERATED') === false) $target[$c['name']] = true;
            }
            $db->exec('DELETE FROM ' . bk_q($t));
            $files = glob($src . '/' . $t . '/*.json.gz') ?: array();
            sort($files);
            foreach ($files as $file) {
                $chunk = bk_readGzJson($file);
                if (!isset($chunk['columns'], $chunk['rows']) || !is_array($chunk['columns']) || !is_array($chunk['rows'])) {
                    throw new RuntimeException('A backup chunk for "' . $t . '" is malformed.');
                }
                $keep = array();
                foreach ($chunk['columns'] as $i => $name) if (isset($target[$name])) $keep[$i] = $name;
                if (!$keep || !$chunk['rows']) continue;
                $colSql = array();
                foreach ($keep as $name) $colSql[] = bk_q($name);
                $rowSql = '(' . implode(', ', array_fill(0, count($keep), '?')) . ')';
                $perStmt = max(1, min(500, (int)floor(60000 / count($keep))));
                foreach (array_chunk($chunk['rows'], $perStmt) as $batch) {
                    $params = array();
                    foreach ($batch as $row) {
                        if (!is_array($row) || count($row) !== count($chunk['columns'])) {
                            throw new RuntimeException('A row in the backup of "' . $t . '" has the wrong number of values.');
                        }
                        foreach ($keep as $i => $name) $params[] = bk_decodeValue($row[$i]);
                    }
                    $stmt = $db->prepare('INSERT INTO ' . bk_q($t) . ' (' . implode(', ', $colSql) . ') VALUES '
                        . implode(', ', array_fill(0, count($batch), $rowSql)));
                    $stmt->execute($params);
                }
            }
            $now = (int)$db->query('SELECT COUNT(*) FROM ' . bk_q($t))->fetchColumn();
            if ($now !== (int)$rows) {
                throw new RuntimeException("Table \"$t\" ended up with $now rows instead of $rows. Nothing was changed.");
            }
            $result[$t] = $now;
        }
        if (!$dryRun && $hasRefreshTokens) {
            // Old sign-in sessions must not outlive a restore of the accounts.
            $db->exec('DELETE FROM refresh_tokens');
        }
        if ($dryRun) $db->rollBack(); else $db->commit();
    } catch (Exception $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }

    $untouched = array_values(array_diff(bk_tables($db), array_keys($expected)));
    return array(
        'tables'         => $result,
        'created_tables' => $created,
        'added_columns'  => $addedColumns,
        'untouched'      => $untouched,
        'snapshot'       => $snapshot,
    );
}

/**
 * Move a session's staged files into uploads/. Any file being replaced is
 * first copied into the snapshot, so "Undo last restore" can put it back.
 * Returns [moved, failed paths].
 */
function bk_publishStagedFiles(string $stagingFiles, string $snapshotDir): array {
    $moved = 0;
    $failed = array();
    if (!is_dir($stagingFiles)) return array(0, $failed);
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($stagingFiles, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if (!$f->isFile()) continue;
        $rel = bk_cleanPath(str_replace('\\', '/', substr($f->getPathname(), strlen($stagingFiles) + 1)));
        if ($rel === null) continue;
        $target = UPLOAD_DIR . $rel;
        if (is_file($target)) {
            if (hash_file('crc32b', $target) === hash_file('crc32b', $f->getPathname())) { $moved++; continue; }
            $keep = $snapshotDir . '/files/' . $rel;
            bk_dir(dirname($keep));
            if (!@copy($target, $keep)) { $failed[] = $rel; continue; }
        } elseif (!is_dir(dirname($target)) && !@mkdir(dirname($target), 0755, true) && !is_dir(dirname($target))) {
            $failed[] = $rel;
            continue;
        }
        $part = $target . '.' . bin2hex(random_bytes(4)) . '.part';
        if (@rename($f->getPathname(), $part) && @rename($part, $target)) {
            @chmod($target, 0644);
            deleteSizedCopies(UPLOAD_URL_PREFIX . $rel);
            $moved++;
        } else {
            @unlink($part);
            $failed[] = $rel;
        }
    }
    return array($moved, $failed);
}

/** Take the restore lock (one restore at a time). */
function bk_lock() {
    bk_dir(BK_DIR);
    $fh = fopen(BK_DIR . '/restore.lock', 'c');
    if (!$fh || !flock($fh, LOCK_EX | LOCK_NB)) sendError('Another restore is already running. Please wait for it to finish.', 409);
    return $fh;
}

/** Append spooled (not-yet-saved) enquiries from a backup, skipping any already queued. */
function bk_mergeSpool(string $file): int {
    $lines = array_filter(array_map('trim', explode("\n", (string)@file_get_contents($file))));
    if (!$lines) return 0;
    if (!is_dir(AA_SPOOL_DIR)) @mkdir(AA_SPOOL_DIR, 0750, true);
    $existing = is_file(AA_SPOOL_FILE) ? array_flip(array_map('trim', file(AA_SPOOL_FILE))) : array();
    $add = array();
    foreach ($lines as $l) if (!isset($existing[$l])) $add[] = $l;
    if ($add) file_put_contents(AA_SPOOL_FILE, implode("\n", $add) . "\n", FILE_APPEND | LOCK_EX);
    return count($add);
}

// ── Routing ─────────────────────────────────────────────────

$method = getMethod();
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    $db = bk_db();

    // ── EXPORT ──────────────────────────────────────────────
    if ($method === 'GET' && $action === 'info') {
        $tables = array();
        foreach (bk_tables($db) as $t) {
            $tables[] = array('name' => $t, 'rows' => (int)$db->query('SELECT COUNT(*) FROM ' . bk_q($t))->fetchColumn());
        }
        $files = bk_listFiles();
        $bytes = 0;
        foreach ($files as $f) $bytes += $f['size'];
        $spool = is_file(AA_SPOOL_FILE) ? count(array_filter(array_map('trim', file(AA_SPOOL_FILE)))) : 0;
        sendJSON(array(
            'format'    => BK_FORMAT,
            'version'   => BK_VERSION,
            'server'    => array('php' => PHP_VERSION, 'mysql' => $db->query('SELECT VERSION()')->fetchColumn(), 'time' => date('c')),
            'tables'    => $tables,
            'files'     => array('count' => count($files), 'bytes' => $bytes),
            'spool'     => $spool,
            'snapshots' => bk_listSnapshots(),
            'upload_max'=> bk_uploadMax(),
        ));
    }

    if ($method === 'GET' && $action === 'schema') {
        $schema = array();
        foreach (bk_tables($db) as $t) {
            $create = $db->query('SHOW CREATE TABLE ' . bk_q($t))->fetch(PDO::FETCH_NUM);
            $schema[$t] = array('create' => $create[1], 'columns' => bk_columns($db, $t), 'primary_key' => bk_primaryKey($db, $t));
        }
        sendJSON(array('packed' => bk_pack($schema)));
    }

    if ($method === 'GET' && $action === 'table') {
        $name = isset($_GET['name']) ? $_GET['name'] : '';
        if (!bk_validTableName($name) || !in_array($name, bk_tables($db), true)) sendError('Unknown table', 404);
        // The paging cursor travels base64-encoded (no quotes/brackets in the URL).
        $after = isset($_GET['after']) && $_GET['after'] !== '' ? json_decode((string)base64_decode($_GET['after'], true), true) : null;
        sendJSON(array('packed' => bk_pack(bk_tablePage($db, $name, $after, BK_PAGE_ROWS))));
    }

    if ($method === 'GET' && $action === 'files') {
        sendJSON(array('files' => bk_listFiles()));
    }

    if ($method === 'GET' && $action === 'file') {
        // Fallback download path for one upload (the browser normally fetches
        // /uploads/… directly, which is faster).
        $rel = bk_cleanPath(isset($_GET['path']) ? $_GET['path'] : '');
        $full = $rel === null ? false : realpath(UPLOAD_DIR . $rel);
        $root = realpath(UPLOAD_DIR);
        if ($full === false || $root === false || strpos($full, $root . DIRECTORY_SEPARATOR) !== 0 || !is_file($full)) {
            sendError('File not found', 404);
        }
        header('Content-Type: application/octet-stream');
        header('Content-Length: ' . filesize($full));
        readfile($full);
        exit;
    }

    if ($method === 'GET' && $action === 'spool') {
        sendJSON(array('content' => is_file(AA_SPOOL_FILE) ? (string)file_get_contents(AA_SPOOL_FILE) : ''));
    }

    if ($method === 'GET' && $action === 'snapshots') {
        sendJSON(array('snapshots' => bk_listSnapshots()));
    }

    // ── RESTORE ─────────────────────────────────────────────
    if ($method === 'POST' && $action === 'restore-begin') {
        $body = getJSONBody();
        bk_requirePassword($userId, isset($body['password']) ? $body['password'] : '');
        bk_dir(BK_DIR . '/staging');
        bk_pruneSessions();
        $id = bin2hex(random_bytes(16));
        $dir = bk_dir(bk_sessionDir($id));
        file_put_contents($dir . '/session.json', json_encode(array('user' => $userId, 'created' => time())));
        auditLog('backup_restore_started', 'system', null, array('session' => $id), $userId);
        sendJSON(array('session' => $id));
    }

    if ($method === 'POST' && $action === 'restore-check') {
        $body = getJSONBody();
        bk_session(isset($body['session']) ? $body['session'] : '', $userId);
        $files = isset($body['files']) && is_array($body['files']) ? $body['files'] : array();
        if (count($files) > 500) sendError('Too many files in one check (max 500).', 400);
        $out = array();
        foreach ($files as $f) {
            $rel = bk_cleanPath(isset($f['path']) ? $f['path'] : '');
            $path = isset($f['path']) ? (string)$f['path'] : '';
            if ($rel === null) { $out[] = array('path' => $path, 'status' => 'invalid'); continue; }
            $full = UPLOAD_DIR . $rel;
            if (!is_file($full)) { $out[] = array('path' => $rel, 'status' => 'missing'); continue; }
            $same = filesize($full) === (int)$f['size'] && hash_file('crc32b', $full) === strtolower((string)$f['crc32']);
            $out[] = array('path' => $rel, 'status' => $same ? 'same' : 'differs');
        }
        sendJSON(array('files' => $out));
    }

    if ($method === 'POST' && $action === 'restore-file') {
        $sessionId = isset($_POST['session']) ? $_POST['session'] : '';
        bk_session($sessionId, $userId);
        $rel = bk_cleanPath(isset($_POST['path']) ? $_POST['path'] : '');
        if ($rel === null) sendError('This file path or type is not allowed in uploads.', 400);
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($_FILES['file']['tmp_name'])) {
            sendError('The file did not arrive (upload error ' . (isset($_FILES['file']) ? (int)$_FILES['file']['error'] : -1) . ').', 400);
        }
        $tmp = $_FILES['file']['tmp_name'];
        $crc = strtolower(isset($_POST['crc32']) ? (string)$_POST['crc32'] : '');
        if (filesize($tmp) !== (int)(isset($_POST['size']) ? $_POST['size'] : -1) || hash_file('crc32b', $tmp) !== $crc) {
            sendError('The file arrived damaged (size or checksum mismatch). It will be retried.', 422);
        }
        // Staged inside the restore session — the live uploads folder is only
        // touched at commit, so a cancelled, failed or rehearsed restore
        // changes no file at all.
        $staged = bk_sessionDir($sessionId) . '/files/' . $rel;
        bk_dir(dirname($staged));
        if (!@move_uploaded_file($tmp, $staged)) sendError('Could not store the file on the server (is the disk full?).', 500);
        sendJSON(array('ok' => true, 'status' => 'staged'));
    }

    if ($method === 'POST' && $action === 'restore-stage') {
        $sessionId = isset($_POST['session']) ? $_POST['session'] : '';
        bk_session($sessionId, $userId);
        $table = isset($_POST['table']) ? $_POST['table'] : '';
        $part = isset($_POST['part']) ? (int)$_POST['part'] : -1;
        $rows = isset($_POST['rows']) ? (int)$_POST['rows'] : -1;
        if (!bk_validTableName($table) || $part < 0 || $part > 999999 || $rows < 0) sendError('Invalid chunk details.', 400);
        if (!isset($_FILES['data']) || $_FILES['data']['error'] !== UPLOAD_ERR_OK) sendError('The data chunk did not arrive.', 400);
        $raw = file_get_contents($_FILES['data']['tmp_name']);
        $json = @gzdecode($raw);
        $chunk = $json === false ? null : json_decode($json, true);
        if (!is_array($chunk) || !isset($chunk['table'], $chunk['columns'], $chunk['rows']) || $chunk['table'] !== $table
            || !is_array($chunk['columns']) || !is_array($chunk['rows']) || count($chunk['rows']) !== $rows) {
            sendError('The data chunk arrived damaged. It will be retried.', 422);
        }
        foreach ($chunk['columns'] as $c) {
            if (!is_string($c) || !preg_match('/^[A-Za-z0-9_]{1,64}$/', $c)) sendError('The data chunk names an invalid column.', 422);
        }
        $dir = bk_dir(bk_sessionDir($sessionId) . '/db/' . $table);
        foreach (glob(sprintf('%s/%06d-*.json.gz', $dir, $part)) ?: array() as $old) @unlink($old); // retried chunk
        file_put_contents(sprintf('%s/%06d-%d.json.gz', $dir, $part, $rows), $raw);
        sendJSON(array('ok' => true));
    }

    if ($method === 'POST' && $action === 'restore-spool') {
        $sessionId = isset($_POST['session']) ? $_POST['session'] : '';
        bk_session($sessionId, $userId);
        if (!isset($_FILES['data']) || $_FILES['data']['error'] !== UPLOAD_ERR_OK) sendError('The enquiry queue did not arrive.', 400);
        $content = @gzdecode(file_get_contents($_FILES['data']['tmp_name']));
        if ($content === false) sendError('The enquiry queue arrived damaged.', 422);
        file_put_contents(bk_sessionDir($sessionId) . '/spool.jsonl', $content);
        sendJSON(array('ok' => true));
    }

    if ($method === 'POST' && $action === 'restore-commit') {
        $body = getJSONBody();
        $sessionId = isset($body['session']) ? $body['session'] : '';
        bk_session($sessionId, $userId);
        $expected = isset($body['tables']) && is_array($body['tables']) ? $body['tables'] : array();
        // Packed (gzip + base64): raw CREATE TABLE text in a request body is
        // exactly what a web-application firewall is built to block.
        $schema = null;
        if (!empty($body['schema_packed'])) {
            $schema = json_decode((string)@gzdecode((string)base64_decode((string)$body['schema_packed'], true)), true);
            if (!is_array($schema)) sendError('The backup schema arrived damaged.', 422);
        }
        $dryRun = !empty($body['dry_run']);
        if (!$expected) sendError('The backup contains no tables.', 400);

        $lock = bk_lock();
        ignore_user_abort(true);
        $result = bk_apply($db, bk_sessionDir($sessionId) . '/db', $expected, $schema, $dryRun, $dryRun ? null : $sessionId, $userId, 'before restore');

        $result['files_written'] = 0;
        $result['files_failed'] = array();
        if (!$dryRun) {
            $snapDir = BK_DIR . '/snapshots/' . $sessionId;
            list($result['files_written'], $result['files_failed']) = bk_publishStagedFiles(bk_sessionDir($sessionId) . '/files', $snapDir);
            $meta = json_decode((string)@file_get_contents($snapDir . '/snapshot.json'), true);
            if (is_array($meta)) {
                $meta['files'] = is_dir($snapDir . '/files') ? iterator_count(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($snapDir . '/files', FilesystemIterator::SKIP_DOTS))) : 0;
                @file_put_contents($snapDir . '/snapshot.json', json_encode($meta));
            }
        }

        $spoolFile = bk_sessionDir($sessionId) . '/spool.jsonl';
        $result['spool_added'] = (!$dryRun && is_file($spoolFile)) ? bk_mergeSpool($spoolFile) : 0;
        $result['dry_run'] = $dryRun;

        bk_rrmdir(bk_sessionDir($sessionId));
        if (!$dryRun) {
            bk_pruneSnapshots();
            auditLog('backup_restored', 'system', null, array('tables' => $result['tables'], 'snapshot' => $result['snapshot']), $userId);
        }
        flock($lock, LOCK_UN);
        sendJSON($result);
    }

    if ($method === 'POST' && $action === 'rollback') {
        $body = getJSONBody();
        bk_requirePassword($userId, isset($body['password']) ? $body['password'] : '');
        $snapshots = bk_listSnapshots();
        $id = isset($body['snapshot']) ? (string)$body['snapshot'] : ($snapshots ? $snapshots[0]['id'] : '');
        if (!preg_match('/^[a-f0-9]{32}$/', $id) || !is_dir(BK_DIR . '/snapshots/' . $id)) sendError('There is no restore to undo.', 404);
        $sdir = BK_DIR . '/snapshots/' . $id;
        $meta = json_decode((string)file_get_contents($sdir . '/snapshot.json'), true);

        $lock = bk_lock();
        ignore_user_abort(true);
        // The undo itself gets an undo point, so it can be reversed too.
        $result = bk_apply($db, $sdir . '/db', $meta['tables'], null, false, bin2hex(random_bytes(16)), $userId, 'before undo');

        // Put back any upload the restore replaced.
        $restoredFiles = 0;
        $fdir = $sdir . '/files';
        if (is_dir($fdir)) {
            $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($fdir, FilesystemIterator::SKIP_DOTS));
            foreach ($it as $f) {
                if (!$f->isFile()) continue;
                $rel = bk_cleanPath(str_replace('\\', '/', substr($f->getPathname(), strlen($fdir) + 1)));
                if ($rel === null) continue;
                $target = UPLOAD_DIR . $rel;
                if (!is_dir(dirname($target))) @mkdir(dirname($target), 0755, true);
                if (@copy($f->getPathname(), $target)) { $restoredFiles++; deleteSizedCopies(UPLOAD_URL_PREFIX . $rel); }
            }
        }
        bk_rrmdir($sdir);   // used up — the new "before undo" snapshot replaces it
        bk_pruneSnapshots();
        auditLog('backup_restore_undone', 'system', null, array('snapshot' => $id), $userId);
        flock($lock, LOCK_UN);
        $result['files_restored'] = $restoredFiles;
        sendJSON($result);
    }

    sendError('Unknown backup action', 404);
} catch (PDOException $e) {
    error_log('AA-BACKUP db error: ' . $e->getMessage());
    sendError('Database error during backup: ' . $e->getMessage(), 500);
} catch (InvalidArgumentException $e) {
    sendError($e->getMessage(), 400);
} catch (RuntimeException $e) {
    error_log('AA-BACKUP: ' . $e->getMessage());
    sendError($e->getMessage(), 500);
}
