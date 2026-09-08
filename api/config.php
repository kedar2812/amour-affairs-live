<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — API Configuration
 * ============================================================
 * Central configuration for the PHP REST API.
 * All sensitive values should be updated for production.
 * ============================================================
 */

// ── Error Handling (disable display in production) ──
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// ── Where errors actually go ──
// This host runs PHP as cgi-fcgi, so the php_flag/php_value lines in
// api/.htaccess (which only apply under mod_php) are inert, and the ini
// error_log is unset — meaning every fatal was being written to nowhere at all.
// That is why the 2026-09-08 enquiry failure left no trace anywhere. Pin the
// destination in code so it is true on every host, and deny it over HTTP.
if (!defined('AA_LOG_DIR')) define('AA_LOG_DIR', __DIR__ . '/logs');
if (!is_dir(AA_LOG_DIR)) { @mkdir(AA_LOG_DIR, 0750, true); }
if (is_dir(AA_LOG_DIR)) {
    ini_set('error_log', AA_LOG_DIR . '/php-error.log');
    if (!is_file(AA_LOG_DIR . '/.htaccess')) {
        @file_put_contents(
            AA_LOG_DIR . '/.htaccess',
            "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n  Order Allow,Deny\n  Deny from all\n</IfModule>\n"
        );
    }
}

/**
 * A short reference the visitor can quote and we can grep for. One per request.
 */
function aa_errorRef(): string {
    static $ref = null;
    if ($ref === null) {
        $ref = strtoupper(bin2hex(random_bytes(3)));
    }
    return $ref;
}

/**
 * Turn a crash into a logged, readable JSON answer.
 *
 * Before this existed an uncaught exception produced a 500 with an EMPTY body
 * (display_errors is off), the website read that as "the API is unreachable",
 * and the visitor was told to go away and use WhatsApp while their enquiry was
 * discarded silently. A caller must always get something it can parse.
 */
function aa_emitFailure(string $summary): void {
    $ref = aa_errorRef();
    error_log(
        'AA-FATAL [' . $ref . '] ' . $summary
        . ' | ' . ($_SERVER['REQUEST_METHOD'] ?? '-') . ' ' . ($_SERVER['REQUEST_URI'] ?? '-')
        . ' | ip=' . (function_exists('getClientIP') ? getClientIP() : '-')
    );

    if (headers_sent()) return;   // a response already went out; nothing to add

    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'Something went wrong on our side. Please try again in a moment — '
                 . 'if it keeps happening, quote reference ' . $ref . '.',
        'ref'   => $ref,
    ]);
}

set_exception_handler(function ($e) {
    aa_emitFailure(get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
});

register_shutdown_function(function () {
    $err = error_get_last();
    if ($err === null) return;
    if (!in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) return;
    aa_emitFailure('FATAL ' . $err['message'] . ' @ ' . $err['file'] . ':' . $err['line']);
});

// ── Timezone ──
date_default_timezone_set('Asia/Kolkata');

// ── Server secrets (gitignored, created once on the host) ──
// On shared hosting where setting real environment variables is awkward,
// create api/config.secrets.php (copy config.secrets.example.php) and have it
// putenv() AA_JWT_SECRET and AA_DB_*. It loads here so the getenv() lookups
// below resolve to the real values. The file is never committed.
if (is_file(__DIR__ . '/config.secrets.php')) {
    require __DIR__ . '/config.secrets.php';
}

// ── Database Configuration ──
// Prefer environment variables (set these in StackCP / hosting panel or a
// .env loaded by the host). The literals are local-dev fallbacks only.
define('DB_HOST', getenv('AA_DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('AA_DB_NAME') ?: 'amour_affairs_db');
define('DB_USER', getenv('AA_DB_USER') ?: 'root');           // Change for production
define('DB_PASS', getenv('AA_DB_PASS') !== false ? getenv('AA_DB_PASS') : ''); // Change for production
define('DB_CHARSET', 'utf8mb4');

// ── JWT Configuration ──
// IMPORTANT: set AA_JWT_SECRET (64+ random chars) in the hosting environment.
// The placeholder below is a local-dev fallback and is REFUSED on live hosts
// by the guard further down — a known secret lets anyone forge admin tokens.
define('JWT_DEFAULT_SECRET', 'CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_IN_PRODUCTION_64_CHARS_MINIMUM');
define('JWT_SECRET', getenv('AA_JWT_SECRET') ?: JWT_DEFAULT_SECRET);
// Long-lived session by request — the studio doesn't want to be logged out
// while working. The access token effectively never expires during normal use,
// so we don't depend on the refresh-token flow mid-session.
define('JWT_ACCESS_EXPIRY', 2592000);    // 30 days
define('JWT_REFRESH_EXPIRY', 7776000);   // 90 days

// Fail closed: never serve real requests with the default secret on a live host.
// CLI (seeding) and localhost dev are exempt so local work keeps running.
if (
    JWT_SECRET === JWT_DEFAULT_SECRET
    && PHP_SAPI !== 'cli'
    && !preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/', $_SERVER['HTTP_HOST'] ?? '')
) {
    error_log('SECURITY: AA_JWT_SECRET is not set; refusing to run with the default secret.');
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server authentication is not configured.']);
    exit;
}

// ── Enquiry spool ──
// Where a website enquiry waits if the database is unreachable at the moment it
// arrives. Replayed into the CRM by the next healthy request. Deny-listed over
// HTTP by an .htaccess written alongside it.
// (Definable ahead of time so the unit tests can point them at a temp dir.)
if (!defined('AA_SPOOL_DIR'))  define('AA_SPOOL_DIR', __DIR__ . '/spool');
if (!defined('AA_SPOOL_FILE')) define('AA_SPOOL_FILE', AA_SPOOL_DIR . '/inquiries.jsonl');

/**
 * The one definition of a lead reference, shared by the website form and the
 * dashboard's own "add lead".
 *
 * These two used to disagree: the website minted '#LD-' . (800 + id) while the
 * dashboard minted '#LD-' . (MAX(id) + 1), which is why the table carries both
 * #LD-834 and #LD-21. Worse, lead_ref is UNIQUE — so once ids reached 800 the
 * dashboard would have started re-minting refs the website had already used,
 * and every collision would have been another uncaught 500.
 */
function leadRefForId(int $id): string {
    return '#LD-' . (800 + $id);
}


// ── Upload Configuration ──
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('UPLOAD_URL_PREFIX', '/uploads/');
define('MAX_UPLOAD_SIZE', 64 * 1024 * 1024); // 64MB — accommodates large full-res wedding photos
define('WEBP_QUALITY', 82);
define('THUMBNAIL_MAX_WIDTH', 400);
define('THUMBNAIL_MAX_HEIGHT', 400);
// Reject absurdly large pixel grids before decoding (decompression-bomb / OOM guard).
// 80 MP comfortably covers any real camera while blocking malicious tiny-but-huge files.
define('MAX_IMAGE_PIXELS', 80 * 1000 * 1000);
// Downscale the stored image to this longest edge. The web never needs more, and it
// slashes per-upload CPU, memory and disk on shared hosting. Originals aren't kept.
define('MAX_IMAGE_DIMENSION', 3500);
define('ALLOWED_MIME_TYPES', [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);

// ── Rate Limiting ──
define('RATE_LIMIT_AUTH_MAX', 5);        // Max login attempts
define('RATE_LIMIT_AUTH_WINDOW', 900);   // 15-minute window
define('RATE_LIMIT_API_MAX', 100);       // Max API calls per window
define('RATE_LIMIT_API_WINDOW', 60);     // 1-minute window

// ── CORS Configuration ──
// Add your actual domains here in production
define('ALLOWED_ORIGINS', [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080', // local: static site served by PHP
    'http://localhost:8081', // local: static dashboard export served by PHP
    'https://www.amouraffairs.in',
    'https://amouraffairs.in',
    'https://admin.amouraffairs.in',
    'https://www.admin.amouraffairs.in',
]);

// ── Security ──
define('BCRYPT_COST', 12);
define('CSRF_TOKEN_LENGTH', 32);


/**
 * Get PDO database connection (singleton pattern)
 */
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            DB_HOST, DB_NAME, DB_CHARSET
        );
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_FOUND_ROWS   => true,
            // Pin MySQL to IST so NOW() / CURRENT_TIMESTAMP match PHP's
            // Asia/Kolkata (the host's own clock is UK time — without this,
            // DB-written timestamps land 4.5–5.5h behind India).
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+05:30'",
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            // Throw, don't exit. Exiting here killed the request mid-flight and
            // gave callers no chance to react — which meant a website enquiry
            // arriving during a database outage could not be parked on disk for
            // later, it was simply turned away. Endpoints with nothing better to
            // do are still covered: the global exception handler in this file
            // turns this into a logged, readable JSON 500.
            error_log('Database connection failed: ' . $e->getMessage());
            throw $e;
        }
    }
    return $pdo;
}


/**
 * Handle CORS headers
 */
function handleCORS(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array($origin, ALLOWED_ORIGINS, true)) {
        header("Access-Control-Allow-Origin: {$origin}");
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');

    // Handle preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}


/**
 * Set JSON content type header
 */
function setJSONHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}


/**
 * Get the request method
 */
function getMethod(): string {
    return strtoupper($_SERVER['REQUEST_METHOD']);
}


/**
 * Get parsed JSON body from request
 */
function getJSONBody(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendError('Invalid JSON body', 400);
    }
    return $data ?? [];
}


/**
 * Send a JSON success response
 */
function sendJSON($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}


/**
 * Send a JSON error response
 */
function sendError(string $message, int $status = 400): void {
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}


/**
 * Sanitize a string input (trim + strip tags)
 */
function sanitize($value): string {
    if ($value === null) return '';
    // ENT_SUBSTITUTE matters: without it htmlspecialchars returns an EMPTY
    // STRING for any input that isn't perfectly valid UTF-8 (a lone surrogate
    // from a phone keyboard is enough). A visitor's name would silently vanish
    // and they'd be told "Please enter your name" no matter what they typed.
    // Substituting U+FFFD keeps the rest of the value intact.
    return htmlspecialchars(trim((string)$value), ENT_QUOTES | ENT_HTML5 | ENT_SUBSTITUTE, 'UTF-8');
}


/**
 * Validate email format
 */
function isValidEmail(string $email): bool {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}


/**
 * Get client IP address (handles proxies)
 */
function getClientIP(): string {
    $headers = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];
    foreach ($headers as $header) {
        if (!empty($_SERVER[$header])) {
            $ip = explode(',', $_SERVER[$header])[0];
            $ip = trim($ip);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return '0.0.0.0';
}


/**
 * Log an action to the audit log
 */
function auditLog(string $action, string $entityType, ?int $entityId = null, ?array $details = null, ?int $userId = null): void {
    try {
        $db = getDB();
        $stmt = $db->prepare('INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $userId,
            $action,
            $entityType,
            $entityId,
            $details ? json_encode($details) : null,
            getClientIP()
        ]);
    } catch (PDOException $e) {
        error_log('Audit log error: ' . $e->getMessage());
    }
}


/**
 * Create upload directory if it doesn't exist
 */
function ensureUploadDir(string $subdir = ''): string {
    $dir = UPLOAD_DIR . $subdir;
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return $dir;
}
