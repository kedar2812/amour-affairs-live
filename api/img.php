<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — Responsive image sizes for CMS uploads
 * ============================================================
 * Dashboard uploads are stored at up to 3500 px (1 MB+), which is far more
 * than a card or a phone needs. The website asks for a smaller copy at
 *
 *     /uploads/_w/<width>/<path inside uploads>.webp
 *
 * The root .htaccess serves that path as a plain static file when it exists;
 * only the very first request for a size reaches this script, which makes the
 * copy, saves it there and returns it. Every later request is static.
 *
 * Widths are a fixed allow-list (no arbitrary resizing on demand), only .webp
 * files inside uploads/ are accepted, and the cache folder is excluded from
 * backups (it can always be regenerated).
 *
 * PHP 7.3-compatible: the live host runs 7.3.33.
 * ============================================================
 */

require_once __DIR__ . '/config.php';

const AA_IMG_WIDTHS = array(480, 800, 1200, 1600);
const AA_IMG_CACHE  = '_w';

function aa_img_fail(int $status): void {
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo $status === 404 ? 'Not found' : 'Bad request';
    exit;
}

$width = isset($_GET['w']) ? (int)$_GET['w'] : 0;
$rel   = isset($_GET['p']) ? (string)$_GET['p'] : '';

if (!in_array($width, AA_IMG_WIDTHS, true)) aa_img_fail(400);
if ($rel === '' || strpos($rel, "\0") !== false || strpos($rel, '..') !== false) aa_img_fail(400);
if (!preg_match('#^[A-Za-z0-9][A-Za-z0-9._/-]*\.webp$#', $rel)) aa_img_fail(400);
if (strpos($rel, AA_IMG_CACHE . '/') === 0) aa_img_fail(400);

$uploads = realpath(UPLOAD_DIR);
$source  = realpath(UPLOAD_DIR . $rel);
if ($uploads === false || $source === false || strpos($source, $uploads . DIRECTORY_SEPARATOR) !== 0 || !is_file($source)) {
    aa_img_fail(404);
}

$target = UPLOAD_DIR . AA_IMG_CACHE . '/' . $width . '/' . $rel;

/** Stream a finished file with long-lived caching (filenames never change). */
function aa_img_send(string $file): void {
    header('Content-Type: image/webp');
    header('Content-Length: ' . filesize($file));
    header('Cache-Control: public, max-age=31536000, immutable');
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    exit;
}

if (is_file($target)) aa_img_send($target);   // raced with another request

$dir = dirname($target);
if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
    aa_img_send($source);                       // can't cache: serve the original
}

$info = @getimagesize($source);
if ($info === false || !function_exists('imagecreatefromwebp')) aa_img_send($source);
list($srcW, $srcH) = $info;

$tmp = $target . '.' . bin2hex(random_bytes(4)) . '.tmp';

if ($srcW <= $width) {
    // Already small enough — keep the original bytes under the sized path.
    if (!@copy($source, $tmp) || !@rename($tmp, $target)) { @unlink($tmp); aa_img_send($source); }
    aa_img_send($target);
}

$src = @imagecreatefromwebp($source);
if (!$src) aa_img_send($source);

$newH = (int)max(1, round($srcH * ($width / $srcW)));
$dst  = imagecreatetruecolor($width, $newH);
imagealphablending($dst, false);
imagesavealpha($dst, true);
imagecopyresampled($dst, $src, 0, 0, 0, 0, $width, $newH, $srcW, $srcH);
imagedestroy($src);

$ok = imagewebp($dst, $tmp, 80) && @rename($tmp, $target);
imagedestroy($dst);
if (!$ok) { @unlink($tmp); aa_img_send($source); }

aa_img_send($target);
