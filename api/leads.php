<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — Leads API
 * ============================================================
 * GET    /api/leads.php                  — List leads (auth)
 * GET    /api/leads.php?id=X             — Get single (auth)
 * POST   /api/leads.php                  — Create lead (auth)
 * POST   /api/leads.php?action=inquiry   — Website contact form (PUBLIC,
 *                                          rate-limited + honeypot + strict validation)
 * PUT    /api/leads.php?id=X             — Update lead (auth)
 * DELETE /api/leads.php?id=X             — Delete lead (auth)
 * ============================================================
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/inquiry-store.php';

handleCORS();
setJSONHeaders();

$method = getMethod();
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;
$action = $_GET['action'] ?? '';

/**
 * Public website inquiry — the only unauthenticated write in the API,
 * so everything is validated, length-capped and rate-limited, and the
 * stage/source/assignment fields are forced server-side.
 */
function handlePublicInquiry(): void {
    // 8 per 10 min per IP. Deliberately not tighter: Indian mobile networks put
    // thousands of subscribers behind one CGNAT address (the studio's own office
    // shows up as 45.112.0.16 and 45.112.0.82 on the same day), so a strict
    // per-IP cap turns into "Too many requests" for a real couple who happen to
    // share an exit node with someone else who just enquired.
    checkRateLimit('lead_inquiry', 8, 600);

    $body = getJSONBody();

    // Honeypot — bots fill every field. Pretend success, store nothing.
    if (!empty($body['website'])) {
        sendJSON(['message' => 'Thank you! Your inquiry was sent successfully.'], 201);
    }

    $clientName = sanitize($body['client_name'] ?? '');
    $phone = sanitize($body['phone'] ?? '');
    $email = trim((string)($body['email'] ?? ''));
    $message = trim((string)($body['message'] ?? ''));
    $eventType = (string)($body['event_type'] ?? 'Wedding');
    $eventDate = trim((string)($body['event_date'] ?? ''));
    $venue = sanitize($body['venue'] ?? '');
    $budgetRange = sanitize($body['budget_range'] ?? '');
    $guestCount = sanitize($body['guest_count'] ?? '');

    if (mb_strlen($clientName) < 2 || mb_strlen($clientName) > 200) {
        sendError('Please enter your name', 400);
    }
    if ($phone === '' && $email === '') {
        sendError('Please provide a phone number or email so we can reach you', 400);
    }
    if ($phone !== '' && !preg_match('/^[0-9+\-\s().]{7,20}$/', $phone)) {
        sendError('Please enter a valid phone number', 400);
    }
    if ($email !== '') {
        if (!isValidEmail($email) || mb_strlen($email) > 255) {
            sendError('Please enter a valid email address', 400);
        }
    }
    if (mb_strlen($message) > 2000) {
        sendError('Message is too long (2000 characters max)', 400);
    }

    $allowedEventTypes = ['Wedding', 'Pre-Wedding', 'Couple Shoot', 'Engagement', 'Corporate', 'Other'];
    if (!in_array($eventType, $allowedEventTypes, true)) {
        $eventType = 'Wedding';
    }

    // Which page the enquiry form sits on — whitelisted so the value is always
    // a known, display-safe label. Anything unrecognised falls back to "Website".
    $allowedSources = [
        'Website',
        'Website (Home)', 'Website (Weddings)', 'Website (Couples)',
        'Website (Films)', 'Website (Premium Albums)', 'Website (Testimonials)',
        'Website (About)', 'Website (Guides)', 'Website (Case Studies)',
        'Website (Contact)',
    ];
    $source = (string)($body['source'] ?? 'Website');
    if (!in_array($source, $allowedSources, true)) {
        $source = 'Website';
    }

    if ($eventDate !== '') {
        $parsed = DateTime::createFromFormat('Y-m-d', $eventDate);
        if (!$parsed || $parsed->format('Y-m-d') !== $eventDate) {
            sendError('Please enter a valid event date', 400);
        }
    }

    // Optional detail fields — length-capped, never required
    if (mb_strlen($venue) > 255)      { $venue = mb_substr($venue, 0, 255); }
    if (mb_strlen($budgetRange) > 100) { $budgetRange = mb_substr($budgetRange, 0, 100); }
    if (mb_strlen($guestCount) > 50)   { $guestCount = mb_substr($guestCount, 0, 50); }

    $notes = [];
    if ($message !== '') {
        $notes[] = [
            'content' => sanitize($message),
            'author' => 'Website Form',
            'date' => date('Y-m-d H:i:s'),
        ];
    }

    // Exact article path the form sat on (guide / case-study templates send it)
    // — recorded as a note so the team can see which page converted. Only a
    // plain site-relative path is accepted.
    $page = trim((string)($body['page'] ?? ''));
    if ($page !== '' && mb_strlen($page) <= 160 && preg_match('#^/[a-zA-Z0-9/_\-]*$#', $page)) {
        $notes[] = [
            'content' => 'Enquiry sent from ' . $page,
            'author' => 'Website Form',
            'date' => date('Y-m-d H:i:s'),
        ];
    }

    $lead = [
        'client_name'  => $clientName,
        'phone'        => $phone,
        'email'        => sanitize($email),
        'event_type'   => $eventType,
        'event_date'   => $eventDate !== '' ? $eventDate : null,
        'venue'        => $venue !== '' ? $venue : null,
        'guest_count'  => $guestCount !== '' ? $guestCount : null,
        'budget_range' => $budgetRange !== '' ? $budgetRange : null,
        'source'       => $source,
        'notes'        => $notes,
    ];

    // ── The enquiry must survive from here on, whatever the database does ──
    // This whole block used to be bare: one transient PDOException (a dropped
    // connection, a lock wait) became a PHP fatal, an empty 500, and a lost
    // booking that nothing recorded. Now: retry, then park it on disk.
    try {
        $leadRef = persistInquiry($lead);
    } catch (Throwable $e) {
        error_log('AA-INQUIRY database write failed: ' . $e->getMessage() . ' | ' . json_encode([
            'name' => $lead['client_name'], 'phone' => $lead['phone'], 'email' => $lead['email'],
        ], JSON_UNESCAPED_UNICODE));

        if (spoolInquiry($lead)) {
            // Captured on disk and replayed into the CRM by the next healthy
            // request. From the visitor's side this genuinely did get through,
            // so tell them so rather than turning a real booking away.
            sendJSON(['message' => 'Thank you! Your inquiry was sent successfully.', 'lead_ref' => ''], 201);
        }

        // Disk failed too — now we really cannot hold it. Say so honestly, and
        // in a shape the website can read, so it shows the WhatsApp handoff.
        sendError('We could not save your enquiry just now. Please try again in a moment.', 503);
    }

    // Public response stays minimal — never expose the full lead record
    sendJSON(['message' => 'Thank you! Your inquiry was sent successfully.', 'lead_ref' => $leadRef], 201);
}

switch ($method) {

    case 'GET':
        $auth = requireAuth();
        $db = getDB();

        if ($id) {
            $stmt = $db->prepare('SELECT * FROM leads WHERE id = ?');
            $stmt->execute([$id]);
            $lead = $stmt->fetch();
            if (!$lead) sendError('Lead not found', 404);
            $lead['notes'] = json_decode($lead['notes'] ?? '[]', true);
            sendJSON($lead);
        }

        $stage = $_GET['stage'] ?? '';
        $source = $_GET['source'] ?? '';
        $where = [];
        $params = [];

        if ($stage) { $where[] = 'stage = ?'; $params[] = $stage; }
        if ($source) { $where[] = 'source = ?'; $params[] = $source; }

        $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $stmt = $db->prepare("SELECT * FROM leads {$whereSQL} ORDER BY created_at DESC");
        $stmt->execute($params);
        $leads = $stmt->fetchAll();
        foreach ($leads as &$l) {
            $l['notes'] = json_decode($l['notes'] ?? '[]', true);
        }
        sendJSON(['leads' => $leads, 'total' => count($leads)]);
        break;


    case 'POST':
        if ($action === 'inquiry') {
            handlePublicInquiry();
            break;
        }

        $auth = requireAuth();
        $body = getJSONBody();

        $clientName = sanitize($body['client_name'] ?? '');
        if (empty($clientName)) sendError('Client name is required', 400);

        $db = getDB();
        // Placeholder now, real ref derived from the auto-increment id after the
        // insert — the same scheme the website form uses, via leadRefForId().
        $leadRef = 'tmp-' . bin2hex(random_bytes(8));

        // Referrer name only meaningful when the source is a referral
        $sourceIn = sanitize($body['source'] ?? 'Website');
        $referrerName = (stripos($sourceIn, 'Referral') !== false)
            ? sanitize($body['referrer_name'] ?? '') : null;

        $stmt = $db->prepare(
            'INSERT INTO leads (lead_ref, client_name, phone, email, instagram, event_type, event_date, venue, guest_count, budget_range,
                                bride_name, bride_phone, bride_whatsapp, groom_name, groom_phone, groom_whatsapp, referrer_name,
                                source, stage, assigned_to, last_activity, moved_to_stage_at, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)'
        );
        $stmt->execute([
            $leadRef,
            $clientName,
            sanitize($body['phone'] ?? ''),
            sanitize($body['email'] ?? ''),
            sanitize($body['instagram'] ?? ''),
            sanitize($body['event_type'] ?? 'Wedding'),
            $body['event_date'] ?? null,
            sanitize($body['venue'] ?? ''),
            sanitize($body['guest_count'] ?? ''),
            sanitize($body['budget_range'] ?? ''),
            sanitize($body['bride_name'] ?? ''),
            sanitize($body['bride_phone'] ?? ''),
            sanitize($body['bride_whatsapp'] ?? ''),
            sanitize($body['groom_name'] ?? ''),
            sanitize($body['groom_phone'] ?? ''),
            sanitize($body['groom_whatsapp'] ?? ''),
            $referrerName,
            $sourceIn,
            sanitize($body['stage'] ?? 'New Inquiry'),
            $body['assigned_to'] ?? null,
            json_encode($body['notes'] ?? [])
        ]);

        $newId = (int)$db->lastInsertId();
        $leadRef = leadRefForId($newId);
        $stmt = $db->prepare('UPDATE leads SET lead_ref = ? WHERE id = ?');
        $stmt->execute([$leadRef, $newId]);

        auditLog('create', 'leads', $newId, ['ref' => $leadRef], $auth['sub']);

        $stmt = $db->prepare('SELECT * FROM leads WHERE id = ?');
        $stmt->execute([$newId]);
        $lead = $stmt->fetch();
        $lead['notes'] = json_decode($lead['notes'] ?? '[]', true);
        sendJSON($lead, 201);
        break;


    case 'PUT':
        $auth = requireAuth();
        if (!$id) sendError('Lead ID is required', 400);

        $db = getDB();
        $stmt = $db->prepare('SELECT * FROM leads WHERE id = ?');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) sendError('Lead not found', 404);

        $body = getJSONBody();
        $fields = [];
        $params = [];

        $stringFields = ['client_name', 'phone', 'email', 'instagram', 'event_type', 'venue', 'guest_count', 'budget_range', 'source', 'stage',
            'bride_name', 'bride_phone', 'bride_whatsapp', 'groom_name', 'groom_phone', 'groom_whatsapp', 'referrer_name'];
        $dateFields = ['event_date', 'last_activity', 'moved_to_stage_at'];
        $numericFields = ['assigned_to'];
        $jsonFields = ['notes'];

        foreach ($stringFields as $f) {
            if (array_key_exists($f, $body)) { $fields[] = "{$f} = ?"; $params[] = sanitize($body[$f]); }
        }
        foreach ($dateFields as $f) {
            if (array_key_exists($f, $body)) { $fields[] = "{$f} = ?"; $params[] = $body[$f]; }
        }
        foreach ($numericFields as $f) {
            if (array_key_exists($f, $body)) { $fields[] = "{$f} = ?"; $params[] = $body[$f]; }
        }
        foreach ($jsonFields as $f) {
            if (array_key_exists($f, $body)) { $fields[] = "{$f} = ?"; $params[] = json_encode($body[$f]); }
        }

        // Auto-set moved_to_stage_at when stage changes
        if (array_key_exists('stage', $body) && $body['stage'] !== $existing['stage']) {
            $fields[] = 'moved_to_stage_at = NOW()';
        }

        // Always update last_activity on any change
        $fields[] = 'last_activity = NOW()';

        if (empty($fields)) sendError('No fields to update', 400);

        $params[] = $id;
        $stmt = $db->prepare('UPDATE leads SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($params);

        auditLog('update', 'leads', $id, $body, $auth['sub']);

        $stmt = $db->prepare('SELECT * FROM leads WHERE id = ?');
        $stmt->execute([$id]);
        $lead = $stmt->fetch();
        $lead['notes'] = json_decode($lead['notes'] ?? '[]', true);
        sendJSON($lead);
        break;


    case 'DELETE':
        $auth = requireAuth();
        if (!$id) sendError('Lead ID is required', 400);

        $db = getDB();
        $stmt = $db->prepare('SELECT id FROM leads WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) sendError('Lead not found', 404);

        $stmt = $db->prepare('DELETE FROM leads WHERE id = ?');
        $stmt->execute([$id]);

        auditLog('delete', 'leads', $id, null, $auth['sub']);
        sendJSON(['message' => 'Lead deleted']);
        break;

    default:
        sendError('Method not allowed', 405);
}
