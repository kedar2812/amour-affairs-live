<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — JWT Authentication Middleware
 * ============================================================
 * Handles JWT creation, validation, refresh tokens,
 * rate limiting, and brute-force protection.
 * ============================================================
 */

require_once __DIR__ . '/config.php';

/**
 * Base64url encode (JWT-safe)
 */
function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Base64url decode
 */
function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
}

/**
 * Create a JWT access token
 */
function createAccessToken(int $userId, string $email, string $role): string {
    $header = base64url_encode(json_encode([
        'typ' => 'JWT',
        'alg' => 'HS256'
    ]));

    $now = time();
    $payload = base64url_encode(json_encode([
        'iss' => 'amouraffairs',
        'sub' => $userId,
        'email' => $email,
        'role' => $role,
        'iat' => $now,
        'exp' => $now + JWT_ACCESS_EXPIRY,
        'jti' => bin2hex(random_bytes(16))
    ]));

    $signature = base64url_encode(
        hash_hmac('sha256', "{$header}.{$payload}", JWT_SECRET, true)
    );

    return "{$header}.{$payload}.{$signature}";
}

/**
 * Create a secure refresh token
 */
function createRefreshToken(int $userId): string {
    $token = bin2hex(random_bytes(32));
    $hash = hash('sha256', $token);
    $expiresAt = date('Y-m-d H:i:s', time() + JWT_REFRESH_EXPIRY);

    $db = getDB();

    // Clean up expired tokens for this user
    $stmt = $db->prepare('DELETE FROM refresh_tokens WHERE user_id = ? OR expires_at < NOW()');
    $stmt->execute([$userId]);

    // Insert new token
    $stmt = $db->prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $hash, $expiresAt]);

    return $token;
}

/**
 * Validate a refresh token and return user_id
 */
function validateRefreshToken(string $token): ?int {
    $hash = hash('sha256', $token);
    $db = getDB();

    $stmt = $db->prepare('SELECT user_id FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()');
    $stmt->execute([$hash]);
    $row = $stmt->fetch();

    if (!$row) return null;

    // Delete used token (rotation — each token is single-use)
    $stmt = $db->prepare('DELETE FROM refresh_tokens WHERE token_hash = ?');
    $stmt->execute([$hash]);

    return (int)$row['user_id'];
}

/**
 * Revoke all refresh tokens for a user (logout)
 */
function revokeAllTokens(int $userId): void {
    $db = getDB();
    $stmt = $db->prepare('DELETE FROM refresh_tokens WHERE user_id = ?');
    $stmt->execute([$userId]);
}

/**
 * Validate JWT and extract payload
 * Returns the decoded payload array or null on failure
 */
function validateJWT(string $jwt): ?array {
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) return null;

    [$header64, $payload64, $signature64] = $parts;

    // Verify signature
    $expectedSig = base64url_encode(
        hash_hmac('sha256', "{$header64}.{$payload64}", JWT_SECRET, true)
    );

    if (!hash_equals($expectedSig, $signature64)) {
        return null;
    }

    // Decode payload
    $payload = json_decode(base64url_decode($payload64), true);
    if (!$payload) return null;

    // Check expiry
    if (!isset($payload['exp']) || $payload['exp'] < time()) {
        return null;
    }

    // Check issuer
    if (!isset($payload['iss']) || $payload['iss'] !== 'amouraffairs') {
        return null;
    }

    return $payload;
}

/**
 * Extract Bearer token from Authorization header
 */
function getBearerToken(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';

    if (empty($header)) {
        // Apache workaround
        if (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }
    }

    if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        return $matches[1];
    }

    return null;
}

/**
 * Authenticate request — returns user payload or sends 401
 * Use this at the top of any protected endpoint
 */
function requireAuth(): array {
    $token = getBearerToken();
    if (!$token) {
        sendError('Authentication required', 401);
    }

    $payload = validateJWT($token);
    if (!$payload) {
        sendError('Invalid or expired token', 401);
    }

    // Verify user still exists and is active
    $db = getDB();
    $stmt = $db->prepare('SELECT id, email, role, is_active FROM admin_users WHERE id = ?');
    $stmt->execute([$payload['sub']]);
    $user = $stmt->fetch();

    if (!$user || !$user['is_active']) {
        sendError('Account disabled or not found', 401);
    }

    return $payload;
}

/**
 * Optionally authenticate — returns user payload or null
 * Use this for endpoints that work differently when authenticated
 */
function optionalAuth(): ?array {
    $token = getBearerToken();
    if (!$token) return null;

    return validateJWT($token);
}

/**
 * Check rate limit — blocks if exceeded
 */
function checkRateLimit(string $endpoint, int $maxAttempts, int $windowSeconds): void {
    $ip = getClientIP();
    $overLimit = false;

    // FAIL OPEN. Rate limiting is an anti-abuse convenience; it is never worth
    // losing a real customer over. Any database trouble in here used to throw an
    // uncaught PDOException, which became an empty-bodied 500 — indistinguishable
    // to the website from "the API is unreachable". A booking enquiry must not
    // die because the bookkeeping around it stumbled.
    try {
        $db = getDB();

        // Clean old entries. Scoped by ip_address FIRST so it can use
        // idx_ip_endpoint(ip_address, endpoint, window_start); the previous
        // version filtered on endpoint alone, which skipped the index and made
        // this a full scan with row locks on every single enquiry.
        $stmt = $db->prepare(
            'DELETE FROM rate_limits WHERE ip_address = ? AND endpoint = ? AND window_start < DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([$ip, $endpoint, $windowSeconds]);

        // Count attempts
        $stmt = $db->prepare(
            'SELECT SUM(attempts) as total FROM rate_limits WHERE ip_address = ? AND endpoint = ? AND window_start > DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([$ip, $endpoint, $windowSeconds]);
        $row = $stmt->fetch();
        $total = (int)($row['total'] ?? 0);

        $overLimit = $total >= $maxAttempts;

        if (!$overLimit) {
            // Record attempt. rate_limits carries no unique key, so this is a
            // plain insert — one row per attempt, summed above.
            $stmt = $db->prepare(
                'INSERT INTO rate_limits (ip_address, endpoint, attempts, window_start) VALUES (?, ?, 1, NOW())'
            );
            $stmt->execute([$ip, $endpoint]);
        }
    } catch (Throwable $e) {
        error_log('AA-RATELIMIT degraded (allowing request): ' . $e->getMessage());
        return;
    }

    if ($overLimit) {
        header('Retry-After: ' . $windowSeconds);
        sendError('Too many requests. Please try again later.', 429);
    }
}

/**
 * Reset rate limit for an IP+endpoint (on successful login)
 */
function resetRateLimit(string $endpoint): void {
    $ip = getClientIP();
    $db = getDB();
    $stmt = $db->prepare('DELETE FROM rate_limits WHERE ip_address = ? AND endpoint = ?');
    $stmt->execute([$ip, $endpoint]);
}
