<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — Dynamic XML Sitemap
 * ============================================================
 * Served at https://www.amouraffairs.in/sitemap.xml via a
 * RewriteRule (^sitemap\.xml$ -> api/sitemap.php).
 *
 * Always emits the core static pages, and AUTOMATICALLY appends
 * every published guide and case study from the database, so the
 * sitemap never goes stale as the client adds content.
 *
 * Robust by design: if the DB is unreachable, the core pages are
 * still emitted (the dynamic section is simply skipped). PHP 7.3
 * compatible — no PHP 8 only syntax.
 * ============================================================
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/xml; charset=utf-8');
header('X-Robots-Tag: noindex'); // the sitemap file itself shouldn't be indexed

$BASE = 'https://www.amouraffairs.in';
$ROOT = __DIR__ . '/..';

/** XML-escape a string for safe inclusion in element text. */
function sm_esc($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

/**
 * Real <lastmod> for a static page, read from its index.html mtime so
 * the date reflects the actual last deploy/content change. Falls back
 * to today if the file can't be stat-ed.
 */
function sm_pageLastmod($root, $path) {
    $rel  = trim($path, '/');
    $file = $root . '/' . ($rel === '' ? '' : $rel . '/') . 'index.html';
    if (is_file($file)) {
        $t = @filemtime($file);
        if ($t) { return date('Y-m-d', $t); }
    }
    return date('Y-m-d');
}

/** Normalise a DB datetime into sitemap W3C date (Y-m-d). */
function sm_dbDate($value) {
    if (!$value) { return date('Y-m-d'); }
    $t = strtotime((string)$value);
    return $t ? date('Y-m-d', $t) : date('Y-m-d');
}

/** Build one <url> block. $images = array of ['loc'=>, 'title'=>]. */
function sm_url($base, $path, $lastmod, $changefreq, $priority, $images = array()) {
    $out  = "  <url>\n";
    $out .= '    <loc>' . sm_esc($base . $path) . "</loc>\n";
    $out .= '    <lastmod>' . sm_esc($lastmod) . "</lastmod>\n";
    $out .= '    <changefreq>' . sm_esc($changefreq) . "</changefreq>\n";
    $out .= '    <priority>' . sm_esc($priority) . "</priority>\n";
    foreach ($images as $img) {
        if (empty($img['loc'])) { continue; }
        $loc = $img['loc'];
        // Make relative upload/asset paths absolute.
        if (strpos($loc, 'http') !== 0) { $loc = $base . '/' . ltrim($loc, '/'); }
        $out .= "    <image:image>\n";
        $out .= '      <image:loc>' . sm_esc($loc) . "</image:loc>\n";
        if (!empty($img['title'])) {
            $out .= '      <image:title>' . sm_esc($img['title']) . "</image:title>\n";
        }
        $out .= "    </image:image>\n";
    }
    $out .= "  </url>\n";
    return $out;
}

// ── Core static pages ──────────────────────────────────────
// [path, changefreq, priority, [images]]
$core = array(
    array('/',                       'weekly',  '1.0', array(array('loc' => '/logo-full.png', 'title' => 'Amour Affairs — Luxury Wedding Photography & Films, Pune'))),
    array('/weddings/',              'weekly',  '0.9', array(array('loc' => '/services/weddings-opt.jpg', 'title' => 'Wedding Photography — Amour Affairs'))),
    array('/couple-shoots/',         'weekly',  '0.9', array(array('loc' => '/services/couple-shoot-opt.jpg', 'title' => 'Pre-Wedding & Couple Shoots — Amour Affairs'))),
    array('/films/',                 'weekly',  '0.9', array(array('loc' => '/services/films.jpg', 'title' => 'Wedding Films & Cinematography — Amour Affairs'))),
    array('/premium-albums/',        'monthly', '0.8', array(array('loc' => '/services/albums.png', 'title' => 'Premium Wedding Albums — Amour Affairs'))),
    array('/testimonials/',          'weekly',  '0.8', array()),
    array('/about/',                 'monthly', '0.7', array(array('loc' => '/founder.jpeg', 'title' => 'About Amour Affairs'))),
    array('/taher-husain/',          'monthly', '0.6', array(array('loc' => '/founder.jpeg', 'title' => 'Taher Husain, founder of Amour Affairs in Pune'))),
    array('/guides/',                'weekly',  '0.8', array()),
    array('/wedding-photography-pune-venues/', 'monthly', '0.7', array(array('loc' => '/wedding-photography-pune-venues/couple-portrait-natural-light.webp', 'title' => 'Wedding photography at Pune venues — Amour Affairs'))),
    array('/case-studies/',          'weekly',  '0.8', array()),
    array('/faqs/',                  'monthly', '0.6', array()),
    array('/contact/',               'monthly', '0.7', array()),
    array('/shop/',                  'monthly', '0.5', array()),
    array('/careers/',               'monthly', '0.4', array()),
    array('/privacy-policy/',        'yearly',  '0.2', array()),
    array('/disclaimer/',            'yearly',  '0.2', array()),
    array('/terms-and-conditions/',  'yearly',  '0.2', array()),
);

$body = '';
foreach ($core as $p) {
    $body .= sm_url($BASE, $p[0], sm_pageLastmod($ROOT, $p[0]), $p[1], $p[2], $p[3]);
}

// ── Dynamic: published guides & case studies ───────────────
// Own short-timeout PDO connection (NOT getDB(), which hard-exits on
// failure) so a DB outage degrades gracefully to the core pages above.
try {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET);
    $db = new PDO($dsn, DB_USER, DB_PASS, array(
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT            => 3,
    ));

    $g = $db->query("SELECT slug, title, cover_path, updated_at
                     FROM guides
                     WHERE is_published = 1
                     ORDER BY sort_order ASC, id DESC");
    if ($g) {
        foreach ($g->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if (empty($row['slug'])) { continue; }
            $imgs = array();
            if (!empty($row['cover_path'])) {
                $imgs[] = array('loc' => $row['cover_path'], 'title' => $row['title']);
            }
            $body .= sm_url($BASE, '/guides/' . rawurlencode($row['slug']) . '/',
                            sm_dbDate($row['updated_at']), 'monthly', '0.7', $imgs);
        }
    }

    $c = $db->query("SELECT slug, title, couple, cover_path, updated_at
                     FROM case_studies
                     WHERE is_published = 1
                     ORDER BY sort_order ASC, id DESC");
    if ($c) {
        foreach ($c->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if (empty($row['slug'])) { continue; }
            $imgs = array();
            if (!empty($row['cover_path'])) {
                $title = !empty($row['couple']) ? $row['couple'] : $row['title'];
                $imgs[] = array('loc' => $row['cover_path'], 'title' => $title);
            }
            $body .= sm_url($BASE, '/case-studies/' . rawurlencode($row['slug']) . '/',
                            sm_dbDate($row['updated_at']), 'monthly', '0.7', $imgs);
        }
    }
} catch (Throwable $e) {
    // DB unavailable — core pages are already emitted; fail soft.
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' . "\n";
echo '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";
echo $body;
echo "</urlset>\n";
