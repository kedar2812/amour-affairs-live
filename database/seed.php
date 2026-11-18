<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — Database Seed Script
 * ============================================================
 * Run this ONCE after importing database/schema.sql to create the
 * initial admin user with a securely hashed password.
 *
 * Usage (CLI only, never upload this file): php database/seed.php
 * ============================================================
 */

require_once __DIR__ . '/../api/config.php';

// Security: one-time seed key (change this, then delete after use)
$SEED_KEY = 'amour_affairs_initial_setup_2026';

// REQUIRED: set a strong admin password before running. The script
// refuses to run while the placeholder is in place so a real password
// never gets committed to version control.
$ADMIN_PASSWORD = 'CHANGE_ME_BEFORE_RUNNING';

// Local development only — set true to also create test@test.in/test123.
// NEVER enable on the production server.
$SEED_TEST_USER = false;

if ($ADMIN_PASSWORD === 'CHANGE_ME_BEFORE_RUNNING') {
    http_response_code(500);
    echo json_encode(['error' => 'Set $ADMIN_PASSWORD in seed.php before running.']);
    exit;
}

// If accessed via web, require seed key
if (php_sapi_name() !== 'cli') {
    $key = $_GET['key'] ?? '';
    if ($key !== $SEED_KEY) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid seed key']);
        exit;
    }
}

try {
    $db = getDB();

    // Check if admin already exists
    $stmt = $db->prepare('SELECT COUNT(*) as c FROM admin_users WHERE email = ?');
    $stmt->execute(['info@amouraffairs.in']);
    $count = $stmt->fetch()['c'];

    if ($count > 0) {
        echo json_encode(['message' => 'Admin user already exists. Seed skipped.']);
        exit;
    }

    // Seed list
    $usersToSeed = [
        [
            'email' => 'info@amouraffairs.in',
            'password' => $ADMIN_PASSWORD,
            'name' => 'Amour Affairs',
            'role' => 'super_admin'
        ]
    ];

    if ($SEED_TEST_USER) {
        $usersToSeed[] = [
            'email' => 'test@test.in',
            'password' => 'test123',
            'name' => 'Test User',
            'role' => 'admin'
        ];
    }

    $seeded = [];
    $stmt = $db->prepare(
        'INSERT INTO admin_users (email, password_hash, name, role, is_active)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name)'
    );

    foreach ($usersToSeed as $u) {
        $hash = password_hash($u['password'], PASSWORD_BCRYPT, ['cost' => BCRYPT_COST]);
        $stmt->execute([
            $u['email'],
            $hash,
            $u['name'],
            $u['role']
        ]);
        $seeded[] = $u['email'];
    }

    echo json_encode([
        'message' => 'Seeding completed successfully',
        'seeded_users' => $seeded,
        'note' => 'DELETE THIS FILE after seeding for security!'
    ]);

} catch (PDOException $e) {
    echo json_encode(['error' => 'Seed failed: ' . $e->getMessage()]);
}
