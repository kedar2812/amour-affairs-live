<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — Inquiry store
 * ============================================================
 * Everything between "a validated website enquiry" and "a row in
 * the leads table", kept separate from the request routing in
 * leads.php so it can be unit-tested (see inquiry-store.test.php).
 *
 * The guiding rule, learned on 2026-09-08: a wedding enquiry is
 * never allowed to disappear. If the database will not take it,
 * it goes to disk and is replayed later — but it is never lost
 * and never silently discarded.
 * ============================================================
 */

// Definitions only — this file is included by leads.php, never requested.
// config.php supplies sanitize()/auditLog()/getDB() and the AA_SPOOL_* paths.
if (!function_exists('sanitize')) {
    http_response_code(404);
    exit;
}



/**
 * The one place a website enquiry becomes a lead row.
 *
 * Retries once, because the faults that hit this endpoint on shared hosting
 * ("MySQL server has gone away", lock wait timeout) are transient by nature and
 * a second attempt a moment later almost always lands.
 */
function persistInquiry(array $lead): string {
    $lastError = null;

    for ($attempt = 1; $attempt <= 2; $attempt++) {
        try {
            $db = getDB();

            // Anything parked on disk by an earlier outage goes in first, so the
            // CRM self-heals the moment the database is well again.
            replaySpooledInquiries($db);

            // De-duplicate. The website retries a submission whose response it
            // never saw, and visitors double-tap Send; neither should file a
            // second lead. An identical enquiry within 10 minutes IS the same one.
            $existing = findRecentDuplicate($db, $lead);
            if ($existing !== null) {
                return normaliseLeadRef($db, (int)$existing['id'], $existing['lead_ref']);
            }

            return insertLeadRow($db, $lead);
        } catch (Throwable $e) {
            $lastError = $e;
            error_log('AA-INQUIRY attempt ' . $attempt . ' failed: ' . $e->getMessage());
            if ($attempt === 1) usleep(250000); // 0.25s — ride out the blip
        }
    }

    throw $lastError;
}


/**
 * Insert the lead and give it its reference.
 *
 * The ref is derived from the auto-increment id AFTER insertion, which is the
 * only scheme immune to two visitors submitting at the same instant.
 */
function insertLeadRow(PDO $db, array $lead): string {
    $stmt = $db->prepare(
        'INSERT INTO leads (lead_ref, client_name, phone, email, event_type, event_date, venue, guest_count, budget_range, source, stage, last_activity, moved_to_stage_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)'
    );
    $stmt->execute([
        'tmp-' . bin2hex(random_bytes(8)),
        $lead['client_name'],
        $lead['phone'],
        $lead['email'],
        $lead['event_type'],
        $lead['event_date'],
        $lead['venue'],
        $lead['guest_count'],
        $lead['budget_range'],
        $lead['source'],
        'New Inquiry',
        json_encode($lead['notes'], JSON_UNESCAPED_UNICODE),
    ]);

    $newId = (int)$db->lastInsertId();
    $leadRef = leadRefForId($newId);
    $stmt = $db->prepare('UPDATE leads SET lead_ref = ? WHERE id = ?');
    $stmt->execute([$leadRef, $newId]);

    auditLog('create', 'leads', $newId, ['ref' => $leadRef, 'via' => 'website_inquiry'], null);

    return $leadRef;
}


/**
 * An identical enquiry filed in the last 10 minutes, or null.
 * Matched on name plus whichever contact detail the visitor gave.
 */
function findRecentDuplicate(PDO $db, array $lead): ?array {
    $phone = (string)$lead['phone'];
    $email = (string)$lead['email'];
    if ($phone === '' && $email === '') return null;

    $contact = [];
    $params  = [$lead['client_name']];
    if ($phone !== '') { $contact[] = 'phone = ?'; $params[] = $phone; }
    if ($email !== '') { $contact[] = 'email = ?'; $params[] = $email; }

    $stmt = $db->prepare(
        'SELECT id, lead_ref FROM leads
         WHERE client_name = ? AND (' . implode(' OR ', $contact) . ')
           AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
         ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute($params);
    $row = $stmt->fetch();

    return $row ? $row : null;
}


/**
 * Repair a row still carrying its placeholder ref — which happens if an outage
 * struck between the INSERT and the UPDATE that names it.
 */
function normaliseLeadRef(PDO $db, int $id, string $currentRef): string {
    if (strpos($currentRef, 'tmp-') !== 0) return $currentRef;

    $leadRef = leadRefForId($id);
    $stmt = $db->prepare('UPDATE leads SET lead_ref = ? WHERE id = ?');
    $stmt->execute([$leadRef, $id]);
    return $leadRef;
}


/**
 * Append an enquiry we could not write to the database.
 *
 * A flat JSON-lines file: no dependencies, no schema, survives a database that
 * is entirely down. Returns false only if the disk refused us too.
 */
function spoolInquiry(array $lead): bool {
    if (!is_dir(AA_SPOOL_DIR)) { @mkdir(AA_SPOOL_DIR, 0750, true); }
    if (!is_dir(AA_SPOOL_DIR)) return false;

    if (!is_file(AA_SPOOL_DIR . '/.htaccess')) {
        @file_put_contents(
            AA_SPOOL_DIR . '/.htaccess',
            "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n  Order Allow,Deny\n  Deny from all\n</IfModule>\n"
        );
    }

    $line = json_encode($lead, JSON_UNESCAPED_UNICODE);
    if ($line === false) return false;

    $written = @file_put_contents(AA_SPOOL_FILE, $line . "\n", FILE_APPEND | LOCK_EX);
    if ($written === false) return false;

    error_log('AA-INQUIRY spooled to disk for replay: ' . $lead['client_name']);
    return true;
}


/**
 * Drain the spool into the CRM. Cheap no-op in the normal case.
 * Anything that still won't insert stays in the file rather than being dropped.
 */
function replaySpooledInquiries(?PDO $db, callable $insert = null): void {
    if ($insert === null) $insert = 'insertLeadRow';
    if (!is_file(AA_SPOOL_FILE) || filesize(AA_SPOOL_FILE) === 0) return;

    $fh = @fopen(AA_SPOOL_FILE, 'c+');
    if (!$fh) return;

    // Another request already draining it — leave them to it.
    if (!flock($fh, LOCK_EX | LOCK_NB)) { fclose($fh); return; }

    $remaining = [];
    while (($line = fgets($fh)) !== false) {
        $line = trim($line);
        if ($line === '') continue;

        $lead = json_decode($line, true);
        if (!is_array($lead) || !isset($lead['client_name'])) {
            error_log('AA-INQUIRY dropping unreadable spool line: ' . substr($line, 0, 200));
            continue;
        }

        try {
            $insert($db, $lead);
            error_log('AA-INQUIRY replayed from spool: ' . $lead['client_name']);
        } catch (Throwable $e) {
            $remaining[] = $line;   // still broken — keep it for next time
        }
    }

    ftruncate($fh, 0);
    rewind($fh);
    if (!empty($remaining)) fwrite($fh, implode("\n", $remaining) . "\n");
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
}
