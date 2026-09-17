<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — One-time testimonials "page marquee" migration
 * ============================================================
 * Idempotent and STRICTLY ADDITIVE:
 *   • testimonials: adds show_on_pages (the shared marquee above
 *     the enquiry form on every page except home + weddings).
 *   • When the column is newly created, it is seeded from
 *     show_on_weddings so the new marquees open with the same
 *     reviews the weddings page already shows.
 *
 * Run ONCE over HTTPS with the token, then DELETE this file:
 *   https://amouraffairs.in/api/_migrate_testi_pages.php?token=THE_TOKEN
 *
 * Must stay PHP 7.3 compatible (live host).
 * ============================================================
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$TOKEN = 'aa-testipages-migrate-2026-4b8e2f71c9';
if (($_GET['token'] ?? '') !== $TOKEN) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$db = getDB();
$actions = [];

try {
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $stmt->execute(['testimonials', 'show_on_pages']);
    if ((int)$stmt->fetchColumn() > 0) {
        $actions[] = 'Column testimonials.show_on_pages already exists — skipped';
    } else {
        $db->exec('ALTER TABLE `testimonials` ADD COLUMN `show_on_pages` TINYINT(1) NOT NULL DEFAULT 0 AFTER `show_on_weddings`');
        $n = $db->exec('UPDATE `testimonials` SET `show_on_pages` = `show_on_weddings`');
        $actions[] = 'Added column testimonials.show_on_pages';
        $actions[] = "Seeded from show_on_weddings ({$n} rows flagged)";
    }

    $total = (int)$db->query('SELECT COUNT(*) FROM testimonials')->fetchColumn();
    $flagged = (int)$db->query('SELECT COUNT(*) FROM testimonials WHERE show_on_pages = 1 AND is_active = 1')->fetchColumn();
    echo json_encode(['ok' => true, 'actions' => $actions, 'testimonials' => $total, 'on_pages' => $flagged], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'actions' => $actions, 'error' => $e->getMessage()], JSON_PRETTY_PRINT);
}
