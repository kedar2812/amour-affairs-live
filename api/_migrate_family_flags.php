<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — One-time CRM family follow-ups migration
 * ============================================================
 * Idempotent and STRICTLY ADDITIVE:
 *   • families: adds album_given / album_given_at /
 *     testimonial_given / testimonial_given_at.
 * Existing families start as "No" (0 / NULL). Nothing is
 * dropped, truncated or reseeded.
 *
 * Run ONCE over HTTPS with the token, then DELETE this file:
 *   https://amouraffairs.in/api/_migrate_family_flags.php?token=THE_TOKEN
 *
 * Must stay PHP 7.3 compatible (live host).
 * ============================================================
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$TOKEN = 'aa-famflags-migrate-2026-7c3e91d05b';
if (($_GET['token'] ?? '') !== $TOKEN) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$db = getDB();
$actions = [];

/** ADD COLUMN only when it doesn't exist yet (MySQL 5.x-safe idempotency). */
function ensureColumn(PDO $db, array &$actions, $table, $column, $definition) {
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $stmt->execute([$table, $column]);
    if ((int)$stmt->fetchColumn() > 0) {
        $actions[] = "Column {$table}.{$column} already exists — skipped";
        return;
    }
    $db->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
    $actions[] = "Added column {$table}.{$column}";
}

try {
    ensureColumn($db, $actions, 'families', 'album_given',          'TINYINT(1) NOT NULL DEFAULT 0');
    ensureColumn($db, $actions, 'families', 'album_given_at',       'DATE DEFAULT NULL');
    ensureColumn($db, $actions, 'families', 'testimonial_given',    'TINYINT(1) NOT NULL DEFAULT 0');
    ensureColumn($db, $actions, 'families', 'testimonial_given_at', 'DATE DEFAULT NULL');

    $count = (int)$db->query('SELECT COUNT(*) FROM families')->fetchColumn();
    echo json_encode(['ok' => true, 'actions' => $actions, 'families' => $count], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'actions' => $actions, 'error' => $e->getMessage()], JSON_PRETTY_PRINT);
}
