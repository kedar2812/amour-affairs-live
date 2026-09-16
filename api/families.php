<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — CRM Families API
 * ============================================================
 * One record per family ("Vikram & Priyanka") with husband /
 * wife / child sub-entries. Powers the /crm dashboard page:
 * upcoming birthdays + anniversaries + festivals and the
 * WhatsApp wish log. People, dates and wishes only — NO money.
 *
 * GET    /api/families.php                       — list families (+members)
 * GET    /api/families.php?id=X                  — single family (+members)
 * POST   /api/families.php                       — create family (+members)
 * PUT    /api/families.php?id=X                  — update family (+members, replace)
 * DELETE /api/families.php?id=X                  — delete family (cascades)
 * GET    /api/families.php?action=upcoming&days=30 — occasions due in N days
 * POST   /api/families.php?action=log            — record a wish was sent
 *
 * Festivals + message templates are shared config, served by
 * crm.php (action=festivals / action=templates).
 *
 * NOTE: must stay PHP 7.3 compatible (live host) — no arrow
 * functions, no str_contains, no PHP 8 syntax.
 * ============================================================
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/middleware.php';

handleCORS();
setJSONHeaders();

$method = getMethod();
$action = $_GET['action'] ?? '';
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

$ROLES = ['husband', 'wife', 'child'];

/** Yes/No follow-ups on a family; each has a companion `<flag>_at` DATE. */
$FAMILY_FLAGS = ['album_given', 'testimonial_given'];

/**
 * True once _migrate_family_flags.php has run. Lets this file ship before
 * the migration without breaking family saves — the flags are just ignored.
 */
function familyFlagsSupported(PDO $db): bool {
    static $supported = null;
    if ($supported === null) {
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'families' AND COLUMN_NAME = 'testimonial_given_at'"
        );
        $stmt->execute();
        $supported = (int)$stmt->fetchColumn() > 0;
    }
    return $supported;
}

/**
 * SET fragments for the posted flags. Marking a flag "yes" stamps today's
 * date (kept on later saves); marking it "no" clears the date. $current is
 * the stored row on update, null on create.
 */
function familyFlagFields(PDO $db, array $body, $current): array {
    global $FAMILY_FLAGS;
    $fields = [];
    $params = [];
    if (!familyFlagsSupported($db)) return [$fields, $params];
    foreach ($FAMILY_FLAGS as $flag) {
        if (!array_key_exists($flag, $body)) continue;
        $on = (int)(bool)$body[$flag];
        $fields[] = "{$flag} = ?";
        $params[] = $on;
        $wasOn = $current !== null && (int)$current[$flag] === 1;
        if (!$on) {
            $fields[] = "{$flag}_at = ?"; $params[] = null;
        } elseif (!$wasOn || empty($current[$flag . '_at'])) {
            $fields[] = "{$flag}_at = ?"; $params[] = date('Y-m-d');
        }
    }
    return [$fields, $params];
}

/** Occurrence of a month/day in a year; Feb 29 → Feb 28 on non-leap years. */
function famOccurrenceInYear(int $year, int $month, int $day): DateTime {
    if ($month === 2 && $day === 29 && !checkdate(2, 29, $year)) {
        $day = 28;
    }
    return new DateTime(sprintf('%04d-%02d-%02d', $year, $month, $day));
}

/** Next occurrence of a stored DATE on/after $today → [DateTime, daysUntil]. */
function famNextOccurrence(string $dateStr, DateTime $today): array {
    $parts = explode('-', $dateStr);
    $month = (int)($parts[1] ?? 1);
    $day   = (int)($parts[2] ?? 1);
    $occ = famOccurrenceInYear((int)$today->format('Y'), $month, $day);
    if ($occ < $today) {
        $occ = famOccurrenceInYear((int)$today->format('Y') + 1, $month, $day);
    }
    $days = (int)$today->diff($occ)->format('%a');
    return [$occ, $days];
}

/** Fetch a family's members, ordered husband, wife, then children. */
function loadMembers(PDO $db, int $familyId): array {
    $stmt = $db->prepare(
        "SELECT * FROM family_members WHERE family_id = ?
         ORDER BY FIELD(role, 'husband', 'wife', 'child'), id"
    );
    $stmt->execute([$familyId]);
    $members = [];
    foreach ($stmt->fetchAll() as $m) {
        $members[] = [
            'id'             => (int)$m['id'],
            'family_id'      => (int)$m['family_id'],
            'role'           => $m['role'],
            'name'           => $m['name'],
            'dob'            => $m['dob'],
            'dob_year_known' => (int)$m['dob_year_known'],
            'phone'          => $m['phone'],
            'whatsapp'       => $m['whatsapp'],
        ];
    }
    return $members;
}

/** Shape a family row + members for the client. */
function shapeFamily(PDO $db, array $f): array {
    return [
        'id'                     => (int)$f['id'],
        'display_name'           => $f['display_name'],
        'anniversary_date'       => $f['anniversary_date'],
        'anniversary_year_known' => (int)$f['anniversary_year_known'],
        'notes'                  => $f['notes'],
        'album_given'            => (int)($f['album_given'] ?? 0),
        'album_given_at'         => $f['album_given_at'] ?? null,
        'testimonial_given'      => (int)($f['testimonial_given'] ?? 0),
        'testimonial_given_at'   => $f['testimonial_given_at'] ?? null,
        'is_active'              => (int)$f['is_active'],
        'members'                => loadMembers($db, (int)$f['id']),
    ];
}

/**
 * Replace a family's member rows from the posted array. Members carrying
 * an existing id are updated in place; new ones inserted; omitted ones
 * removed. Kept in one place so create and update stay consistent.
 */
function saveMembers(PDO $db, int $familyId, array $members): void {
    global $ROLES;

    // Existing member ids for this family
    $stmt = $db->prepare('SELECT id FROM family_members WHERE family_id = ?');
    $stmt->execute([$familyId]);
    $existing = [];
    foreach ($stmt->fetchAll() as $r) { $existing[(int)$r['id']] = true; }

    $seen = [];
    foreach ($members as $m) {
        $name = sanitize($m['name'] ?? '');
        if ($name === '') continue; // skip blank rows silently
        $role = in_array(($m['role'] ?? ''), $ROLES, true) ? $m['role'] : 'child';
        $dob  = (isset($m['dob']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $m['dob'])) ? $m['dob'] : null;
        $dobYearKnown = (int)(!isset($m['dob_year_known']) || $m['dob_year_known'] ? 1 : 0);
        $phone    = sanitize($m['phone'] ?? '');
        $whatsapp = sanitize($m['whatsapp'] ?? '');
        $mid = isset($m['id']) ? (int)$m['id'] : 0;

        if ($mid && isset($existing[$mid])) {
            $stmt = $db->prepare(
                'UPDATE family_members SET role = ?, name = ?, dob = ?, dob_year_known = ?, phone = ?, whatsapp = ?
                 WHERE id = ? AND family_id = ?'
            );
            $stmt->execute([$role, $name, $dob, $dobYearKnown, $phone, $whatsapp, $mid, $familyId]);
            $seen[$mid] = true;
        } else {
            $stmt = $db->prepare(
                'INSERT INTO family_members (family_id, role, name, dob, dob_year_known, phone, whatsapp)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([$familyId, $role, $name, $dob, $dobYearKnown, $phone, $whatsapp]);
        }
    }

    // Remove members that were dropped in the edit
    foreach (array_keys($existing) as $oldId) {
        if (!isset($seen[$oldId])) {
            $stmt = $db->prepare('DELETE FROM family_members WHERE id = ? AND family_id = ?');
            $stmt->execute([$oldId, $familyId]);
        }
    }
}

switch ($action) {

    // ────────────────────────────────────────────────────────
    // UPCOMING — birthdays + anniversaries + festivals in N days
    // ────────────────────────────────────────────────────────
    case 'upcoming':
        if ($method !== 'GET') sendError('Method not allowed', 405);
        requireAuth();
        $db = getDB();

        $days = isset($_GET['days']) ? max(1, min(365, (int)$_GET['days'])) : 30;
        $today = new DateTime('today');
        $thisYear = (int)$today->format('Y');

        // Sent state (this year + next, for Dec→Jan windows)
        $stmt = $db->prepare(
            'SELECT occasion, family_id, family_member_id, festival_id, occasion_year
             FROM family_greetings WHERE occasion_year IN (?, ?)'
        );
        $stmt->execute([$thisYear, $thisYear + 1]);
        $sent = [];
        foreach ($stmt->fetchAll() as $g) {
            // Stable key per occasion instance
            if ($g['occasion'] === 'anniversary') {
                $key = 'anniv-' . $g['family_id'] . '-' . $g['occasion_year'];
            } elseif ($g['occasion'] === 'festival') {
                $key = 'fest-' . $g['festival_id'] . '-' . $g['family_id'] . '-' . $g['occasion_year'];
            } else {
                $key = 'bday-' . $g['family_member_id'] . '-' . $g['occasion_year'];
            }
            $sent[$key] = true;
        }

        // Families + their members
        $stmt = $db->prepare('SELECT * FROM families WHERE is_active = 1');
        $stmt->execute();
        $families = [];
        foreach ($stmt->fetchAll() as $f) {
            $families[] = shapeFamily($db, $f);
        }

        $occasions = [];
        foreach ($families as $fam) {
            // Member birthdays
            foreach ($fam['members'] as $m) {
                if (!$m['dob']) continue;
                list($occ, $daysUntil) = famNextOccurrence($m['dob'], $today);
                if ($daysUntil > $days) continue;
                $occYear = (int)$occ->format('Y');
                $origYear = (int)substr($m['dob'], 0, 4);
                $age = ($m['dob_year_known'] === 1 && $origYear > 1901) ? $occYear - $origYear : null;
                $occasions[] = [
                    'kind'         => $m['role'] === 'child' ? 'child_birthday' : 'birthday',
                    'occasion'     => 'birthday',
                    'occasion_key' => 'bday-' . $m['id'] . '-' . $occYear,
                    'family_id'    => $fam['id'],
                    'family'       => $fam,
                    'member_id'    => $m['id'],
                    'member_role'  => $m['role'],
                    'person_name'  => $m['name'],
                    'source_date'  => $m['dob'],
                    'next_date'    => $occ->format('Y-m-d'),
                    'days_until'   => $daysUntil,
                    'years'        => $age,
                    'occasion_year'=> $occYear,
                    'sent'         => isset($sent['bday-' . $m['id'] . '-' . $occYear]),
                ];
            }

            // Anniversary
            if ($fam['anniversary_date']) {
                list($occ, $daysUntil) = famNextOccurrence($fam['anniversary_date'], $today);
                if ($daysUntil <= $days) {
                    $occYear = (int)$occ->format('Y');
                    $origYear = (int)substr($fam['anniversary_date'], 0, 4);
                    $years = ($fam['anniversary_year_known'] === 1 && $origYear > 1901) ? $occYear - $origYear : null;
                    $occasions[] = [
                        'kind'         => 'anniversary',
                        'occasion'     => 'anniversary',
                        'occasion_key' => 'anniv-' . $fam['id'] . '-' . $occYear,
                        'family_id'    => $fam['id'],
                        'family'       => $fam,
                        'member_id'    => null,
                        'member_role'  => null,
                        'person_name'  => null,
                        'source_date'  => $fam['anniversary_date'],
                        'next_date'    => $occ->format('Y-m-d'),
                        'days_until'   => $daysUntil,
                        'years'        => $years,
                        'occasion_year'=> $occYear,
                        'sent'         => isset($sent['anniv-' . $fam['id'] . '-' . $occYear]),
                    ];
                }
            }
        }

        // Festivals (shared calendar). Each becomes one row per festival;
        // recipients are all adult members of every family, resolved client-side.
        $stmt = $db->prepare('SELECT * FROM festivals WHERE is_active = 1');
        $stmt->execute();
        $festivals = [];
        foreach ($stmt->fetchAll() as $f) {
            list($occ, $daysUntil) = famNextOccurrence($f['festival_date'], $today);
            if ($daysUntil > $days) continue;
            $occYear = (int)$occ->format('Y');
            $festivals[] = [
                'kind'             => 'festival',
                'id'               => (int)$f['id'],
                'name'             => $f['name'],
                'emoji'            => $f['emoji'],
                'festival_date'    => $f['festival_date'],
                'next_date'        => $occ->format('Y-m-d'),
                'days_until'       => $daysUntil,
                'occasion_year'    => $occYear,
                'is_movable'       => (int)$f['is_movable'],
                'message_template' => $f['message_template'],
            ];
        }

        usort($occasions, function ($a, $b) { return $a['days_until'] - $b['days_until']; });
        usort($festivals, function ($a, $b) { return $a['days_until'] - $b['days_until']; });

        // Templates (shared, settings group 'crm')
        $stmt = $db->prepare("SELECT setting_key, setting_value FROM settings WHERE setting_group = 'crm'");
        $stmt->execute();
        $templates = [];
        foreach ($stmt->fetchAll() as $row) { $templates[$row['setting_key']] = $row['setting_value']; }

        sendJSON([
            'occasions' => $occasions,
            'festivals' => $festivals,
            'families'  => $families,
            'templates' => $templates,
            'days'      => $days,
        ]);
        break;


    // ────────────────────────────────────────────────────────
    // LOG — record that a wish was sent (idempotent per occasion/year)
    // ────────────────────────────────────────────────────────
    case 'log':
        if ($method !== 'POST') sendError('Method not allowed', 405);
        $auth = requireAuth();
        $db = getDB();
        $body = getJSONBody();

        $familyId   = isset($body['family_id']) ? (int)$body['family_id'] : 0;
        $occasion   = $body['occasion'] ?? 'birthday';
        $memberId   = isset($body['family_member_id']) ? (int)$body['family_member_id'] : null;
        $festivalId = isset($body['festival_id']) ? (int)$body['festival_id'] : null;
        $year       = (int)($body['occasion_year'] ?? date('Y'));

        if (!$familyId) sendError('family_id is required', 400);
        if (!in_array($occasion, ['birthday', 'anniversary', 'festival'], true)) sendError('Invalid occasion', 400);
        if ($occasion === 'birthday' && !$memberId) sendError('family_member_id is required for birthdays', 400);
        if ($occasion === 'festival' && !$festivalId) sendError('festival_id is required for festivals', 400);

        $stmt = $db->prepare('SELECT id FROM families WHERE id = ?');
        $stmt->execute([$familyId]);
        if (!$stmt->fetch()) sendError('Family not found', 404);

        // Idempotency — already logged this occasion this year?
        if ($occasion === 'anniversary') {
            $stmt = $db->prepare("SELECT id FROM family_greetings WHERE occasion = 'anniversary' AND family_id = ? AND occasion_year = ?");
            $stmt->execute([$familyId, $year]);
        } elseif ($occasion === 'festival') {
            $stmt = $db->prepare("SELECT id FROM family_greetings WHERE occasion = 'festival' AND festival_id = ? AND family_id = ? AND occasion_year = ?");
            $stmt->execute([$festivalId, $familyId, $year]);
        } else {
            $stmt = $db->prepare("SELECT id FROM family_greetings WHERE occasion = 'birthday' AND family_member_id = ? AND occasion_year = ?");
            $stmt->execute([$memberId, $year]);
        }
        if ($stmt->fetch()) sendJSON(['message' => 'Already logged', 'duplicate' => true]);

        $stmt = $db->prepare(
            'INSERT INTO family_greetings (family_id, family_member_id, festival_id, occasion, occasion_year, message, sent_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $familyId,
            $memberId,
            $festivalId,
            $occasion,
            $year,
            sanitize($body['message'] ?? ''),
            $auth['sub'],
        ]);
        auditLog('create', 'family_greetings', (int)$db->lastInsertId(), ['family_id' => $familyId, 'occasion' => $occasion, 'year' => $year], $auth['sub']);
        sendJSON(['message' => 'Wish logged'], 201);
        break;


    // ────────────────────────────────────────────────────────
    // FAMILIES — CRUD (default action)
    // ────────────────────────────────────────────────────────
    default:
        $auth = requireAuth();
        $db = getDB();

        if ($method === 'GET') {
            if ($id) {
                $stmt = $db->prepare('SELECT * FROM families WHERE id = ?');
                $stmt->execute([$id]);
                $f = $stmt->fetch();
                if (!$f) sendError('Family not found', 404);
                sendJSON(shapeFamily($db, $f));
            }
            $search = trim((string)($_GET['search'] ?? ''));
            if ($search !== '') {
                $stmt = $db->prepare('SELECT * FROM families WHERE display_name LIKE ? ORDER BY display_name');
                $stmt->execute(['%' . $search . '%']);
            } else {
                $stmt = $db->prepare('SELECT * FROM families ORDER BY display_name');
                $stmt->execute();
            }
            $families = [];
            foreach ($stmt->fetchAll() as $f) {
                $families[] = shapeFamily($db, $f);
            }
            sendJSON(['families' => $families, 'total' => count($families)]);
        }

        if ($method === 'POST') {
            $body = getJSONBody();
            $displayName = sanitize($body['display_name'] ?? '');
            if ($displayName === '') sendError('Family name is required', 400);

            $anniv = (isset($body['anniversary_date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $body['anniversary_date']))
                ? $body['anniversary_date'] : null;

            $db->beginTransaction();
            try {
                $stmt = $db->prepare(
                    'INSERT INTO families (display_name, anniversary_date, anniversary_year_known, notes, is_active)
                     VALUES (?, ?, ?, ?, 1)'
                );
                $stmt->execute([
                    $displayName,
                    $anniv,
                    (int)(!isset($body['anniversary_year_known']) || $body['anniversary_year_known'] ? 1 : 0),
                    sanitize($body['notes'] ?? ''),
                ]);
                $newId = (int)$db->lastInsertId();

                list($flagFields, $flagParams) = familyFlagFields($db, $body, null);
                if (!empty($flagFields)) {
                    $flagParams[] = $newId;
                    $stmt = $db->prepare('UPDATE families SET ' . implode(', ', $flagFields) . ' WHERE id = ?');
                    $stmt->execute($flagParams);
                }

                if (isset($body['members']) && is_array($body['members'])) {
                    saveMembers($db, $newId, $body['members']);
                }
                $db->commit();
            } catch (Throwable $e) {
                $db->rollBack();
                sendError('Could not create family', 500);
            }

            auditLog('create', 'families', $newId, ['name' => $displayName], $auth['sub']);
            $stmt = $db->prepare('SELECT * FROM families WHERE id = ?');
            $stmt->execute([$newId]);
            sendJSON(shapeFamily($db, $stmt->fetch()), 201);
        }

        if ($method === 'PUT') {
            if (!$id) sendError('Family ID is required', 400);
            $stmt = $db->prepare('SELECT * FROM families WHERE id = ?');
            $stmt->execute([$id]);
            $current = $stmt->fetch();
            if (!$current) sendError('Family not found', 404);

            $body = getJSONBody();
            $fields = [];
            $params = [];

            if (array_key_exists('display_name', $body)) {
                $name = sanitize($body['display_name']);
                if ($name === '') sendError('Family name cannot be empty', 400);
                $fields[] = 'display_name = ?'; $params[] = $name;
            }
            if (array_key_exists('anniversary_date', $body)) {
                $anniv = $body['anniversary_date'];
                if ($anniv !== null && $anniv !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $anniv)) {
                    sendError('anniversary_date must be YYYY-MM-DD', 400);
                }
                $fields[] = 'anniversary_date = ?'; $params[] = ($anniv === '' ? null : $anniv);
            }
            if (array_key_exists('anniversary_year_known', $body)) {
                $fields[] = 'anniversary_year_known = ?'; $params[] = (int)(bool)$body['anniversary_year_known'];
            }
            if (array_key_exists('notes', $body)) { $fields[] = 'notes = ?'; $params[] = sanitize($body['notes']); }
            if (array_key_exists('is_active', $body)) { $fields[] = 'is_active = ?'; $params[] = (int)(bool)$body['is_active']; }
            list($flagFields, $flagParams) = familyFlagFields($db, $body, $current);
            $fields = array_merge($fields, $flagFields);
            $params = array_merge($params, $flagParams);

            $db->beginTransaction();
            try {
                if (!empty($fields)) {
                    $params[] = $id;
                    $stmt = $db->prepare('UPDATE families SET ' . implode(', ', $fields) . ' WHERE id = ?');
                    $stmt->execute($params);
                }
                if (isset($body['members']) && is_array($body['members'])) {
                    saveMembers($db, $id, $body['members']);
                }
                $db->commit();
            } catch (Throwable $e) {
                $db->rollBack();
                sendError('Could not update family', 500);
            }

            auditLog('update', 'families', $id, $body, $auth['sub']);
            $stmt = $db->prepare('SELECT * FROM families WHERE id = ?');
            $stmt->execute([$id]);
            sendJSON(shapeFamily($db, $stmt->fetch()));
        }

        if ($method === 'DELETE') {
            if (!$id) sendError('Family ID is required', 400);
            $stmt = $db->prepare('SELECT id FROM families WHERE id = ?');
            $stmt->execute([$id]);
            if (!$stmt->fetch()) sendError('Family not found', 404);
            $stmt = $db->prepare('DELETE FROM families WHERE id = ?');
            $stmt->execute([$id]);
            auditLog('delete', 'families', $id, null, $auth['sub']);
            sendJSON(['message' => 'Family deleted']);
        }

        sendError('Method not allowed', 405);
}
