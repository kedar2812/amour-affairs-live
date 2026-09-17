<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — Testimonials API
 * ============================================================
 * GET    /api/testimonials.php          — List (public)
 * GET    /api/testimonials.php?id=X     — Get single
 * POST   /api/testimonials.php          — Create (auth)
 * PUT    /api/testimonials.php?id=X     — Update (auth)
 * DELETE /api/testimonials.php?id=X     — Delete (auth)
 * ============================================================
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/upload.php';

handleCORS();
setJSONHeaders();

$method = getMethod();
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {

    case 'GET':
        $db = getDB();
        if ($id) {
            $stmt = $db->prepare('SELECT * FROM testimonials WHERE id = ?');
            $stmt->execute([$id]);
            $t = $stmt->fetch();
            if (!$t) sendError('Testimonial not found', 404);
            sendJSON($t);
        }

        $featured = isset($_GET['featured']) ? (int)$_GET['featured'] : null;
        $weddings = isset($_GET['weddings']) ? (int)$_GET['weddings'] : null;
        $pages = isset($_GET['pages']) ? (int)$_GET['pages'] : null;
        $activeOnly = !isset($_GET['all']);

        $where = [];
        $params = [];
        if ($activeOnly) { $where[] = 'is_active = 1'; }
        if ($featured !== null) { $where[] = 'is_featured = ?'; $params[] = $featured; }
        if ($weddings !== null) { $where[] = 'show_on_weddings = ?'; $params[] = $weddings; }
        // Shared marquee above the enquiry form on every other page
        if ($pages !== null) { $where[] = 'show_on_pages = ?'; $params[] = $pages; }

        $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $stmt = $db->prepare("SELECT * FROM testimonials {$whereSQL} ORDER BY sort_order ASC, created_at DESC");
        $stmt->execute($params);

        sendJSON(['testimonials' => $stmt->fetchAll(), 'total' => $stmt->rowCount()]);
        break;


    case 'POST':
        $auth = requireAuth();
        $action = $_GET['action'] ?? '';

        // ─ Replace / set a testimonial's photo (multipart `photo`) ─
        if ($action === 'photo') {
            if (!$id) sendError('Testimonial ID is required', 400);

            $db = getDB();
            $stmt = $db->prepare('SELECT photo_path FROM testimonials WHERE id = ?');
            $stmt->execute([$id]);
            $existing = $stmt->fetch();
            if (!$existing) sendError('Testimonial not found', 404);

            $photoData = processImageUpload('photo', 'testimonials/');
            if (empty($photoData)) {
                sendError('Photo file is required (field: photo)', 400);
            }

            if ($existing['photo_path']) {
                deleteImageFiles($existing['photo_path']);
            }

            $stmt = $db->prepare('UPDATE testimonials SET photo_path = ? WHERE id = ?');
            $stmt->execute([$photoData['file_path'], $id]);

            auditLog('update_photo', 'testimonials', $id, null, $auth['sub']);

            $stmt = $db->prepare('SELECT * FROM testimonials WHERE id = ?');
            $stmt->execute([$id]);
            sendJSON($stmt->fetch());
            break;
        }

        $photoData = processImageUpload('photo', 'testimonials/');

        $clientName = sanitize($_POST['client_name'] ?? '');
        $reviewText = sanitize($_POST['review_text'] ?? '');
        if (empty($clientName) || empty($reviewText)) {
            sendError('Client name and review text are required', 400);
        }

        $db = getDB();
        $stmt = $db->prepare(
            'INSERT INTO testimonials (client_name, event_type, event_date, review_text, rating, photo_path, city, is_featured, show_on_weddings, show_on_pages, marquee_row, is_active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $clientName,
            sanitize($_POST['event_type'] ?? 'Wedding'),
            $_POST['event_date'] ?? null,
            $reviewText,
            min(5, max(1, (int)($_POST['rating'] ?? 5))),
            $photoData['file_path'] ?? null,
            sanitize($_POST['city'] ?? ''),
            (int)($_POST['is_featured'] ?? 0),
            (int)($_POST['show_on_weddings'] ?? 0),
            (int)($_POST['show_on_pages'] ?? 0),
            min(2, max(1, (int)($_POST['marquee_row'] ?? 1))),
            1,
            (int)($_POST['sort_order'] ?? 0)
        ]);

        $newId = $db->lastInsertId();
        auditLog('create', 'testimonials', $newId, ['client' => $clientName], $auth['sub']);

        $stmt = $db->prepare('SELECT * FROM testimonials WHERE id = ?');
        $stmt->execute([$newId]);
        sendJSON($stmt->fetch(), 201);
        break;


    case 'PUT':
        $auth = requireAuth();
        if (!$id) sendError('Testimonial ID is required', 400);

        $db = getDB();
        $stmt = $db->prepare('SELECT id FROM testimonials WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) sendError('Testimonial not found', 404);

        $body = getJSONBody();
        $fields = [];
        $params = [];

        $updatable = ['client_name', 'event_type', 'event_date', 'review_text', 'rating', 'city', 'is_featured', 'show_on_weddings', 'show_on_pages', 'marquee_row', 'is_active', 'sort_order'];
        foreach ($updatable as $f) {
            if (array_key_exists($f, $body)) {
                $value = is_string($body[$f]) ? sanitize($body[$f]) : $body[$f];
                if ($f === 'marquee_row') {
                    $value = min(2, max(1, (int)$value));
                }
                $fields[] = "{$f} = ?";
                $params[] = $value;
            }
        }

        if (empty($fields)) sendError('No fields to update', 400);

        $params[] = $id;
        $stmt = $db->prepare('UPDATE testimonials SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($params);

        auditLog('update', 'testimonials', $id, $body, $auth['sub']);

        $stmt = $db->prepare('SELECT * FROM testimonials WHERE id = ?');
        $stmt->execute([$id]);
        sendJSON($stmt->fetch());
        break;


    case 'DELETE':
        $auth = requireAuth();
        if (!$id) sendError('Testimonial ID is required', 400);

        $db = getDB();
        $stmt = $db->prepare('SELECT photo_path FROM testimonials WHERE id = ?');
        $stmt->execute([$id]);
        $t = $stmt->fetch();
        if (!$t) sendError('Testimonial not found', 404);

        if ($t['photo_path']) deleteImageFiles($t['photo_path']);

        $stmt = $db->prepare('DELETE FROM testimonials WHERE id = ?');
        $stmt->execute([$id]);

        auditLog('delete', 'testimonials', $id, null, $auth['sub']);
        sendJSON(['message' => 'Testimonial deleted']);
        break;

    default:
        sendError('Method not allowed', 405);
}
