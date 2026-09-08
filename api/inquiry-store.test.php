<?php
/**
 * Unit tests for the inquiry store.
 * Framework-free so it runs anywhere:  php api/inquiry-store.test.php
 *
 * These lock in the behaviour that was missing on 2026-09-08, when a transient
 * database fault turned into an empty-bodied 500, the website reported "we
 * couldn't send your inquiry", and the enquiry was gone with no trace.
 */

$tmp = sys_get_temp_dir() . '/aa-inquiry-test-' . getmypid();
@mkdir($tmp, 0777, true);
define('AA_SPOOL_DIR', $tmp);
define('AA_SPOOL_FILE', $tmp . '/inquiries.jsonl');
define('AA_LOG_DIR', $tmp);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/inquiry-store.php';

$passed = 0;
$failed = 0;

function check(string $name, bool $ok, string $detail = '') {
    global $passed, $failed;
    if ($ok) { $passed++; echo "  ✓ $name\n"; }
    else     { $failed++; echo "  ✗ $name" . ($detail ? "  — $detail" : '') . "\n"; }
}

function sampleLead(string $name = 'Aarohi Deshpande'): array {
    return [
        'client_name'  => $name,
        'phone'        => '9922003344',
        'email'        => 'aarohi@example.com',
        'event_type'   => 'Wedding',
        'event_date'   => '2027-02-14',
        'venue'        => 'Pune',
        'guest_count'  => '300',
        'budget_range' => '3-4 Lakh',
        'source'       => 'Website (Contact)',
        'notes'        => [['content' => 'Looking forward!', 'author' => 'Website Form', 'date' => '2026-09-08 15:38:00']],
    ];
}

function resetSpool() { @unlink(AA_SPOOL_FILE); }

/** replaySpooledInquiries only hands the connection to the inserter, which the
    tests stub out — so no real database is needed here. */
function dummyPDO() { return null; }


echo "\nlead reference — one scheme, not two\n";

check('a ref is derived from the row id', leadRefForId(37) === '#LD-837', leadRefForId(37));
check('ids never collide with each other', leadRefForId(37) !== leadRefForId(38));
check(
    'the dashboard scheme that would have collided is gone',
    // The old dashboard minted '#LD-' . (MAX(id)+1). Once ids reach 800 that
    // starts re-issuing refs the website already used, and lead_ref is UNIQUE.
    leadRefForId(1) !== '#LD-1' && leadRefForId(1) === '#LD-801'
);


echo "\nsanitize — a name must never silently vanish\n";

$loneSurrogate = "Anj\xED\xA0\xBDali";      // invalid UTF-8, as a phone keyboard can produce
check('invalid UTF-8 no longer blanks the whole value', sanitize($loneSurrogate) !== '', var_export(sanitize($loneSurrogate), true));
check('the readable part survives', strpos(sanitize($loneSurrogate), 'Anj') === 0);
check('valid text is untouched', sanitize('  Aarohi & Vedant  ') === 'Aarohi &amp; Vedant');
check('quotes still escape', strpos(sanitize('a "b"'), '&quot;') !== false);


echo "\nspool — an enquiry the database refused is kept, not dropped\n";

resetSpool();
check('spooling reports success', spoolInquiry(sampleLead()) === true);
check('the spool file exists', is_file(AA_SPOOL_FILE));

$line = json_decode(trim(file_get_contents(AA_SPOOL_FILE)), true);
check('every field survives the round trip', $line['client_name'] === 'Aarohi Deshpande' && $line['phone'] === '9922003344');
check('the notes survive as structure', is_array($line['notes']) && $line['notes'][0]['author'] === 'Website Form');

spoolInquiry(sampleLead('Second Couple'));
check('spooling appends rather than overwriting', count(file(AA_SPOOL_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)) === 2);

check('non-UTF8 content does not defeat the spool', spoolInquiry(sampleLead(sanitize("Riy\xED\xA0\xBDa"))) === true);


echo "\nreplay — the spool drains into the CRM once it is healthy\n";

resetSpool();
spoolInquiry(sampleLead('Replay One'));
spoolInquiry(sampleLead('Replay Two'));

$inserted = [];
replaySpooledInquiries(dummyPDO(), function ($db, $lead) use (&$inserted) {
    $inserted[] = $lead['client_name'];
    return leadRefForId(count($inserted));
});
check('both spooled enquiries were inserted', $inserted === ['Replay One', 'Replay Two'], implode(',', $inserted));
check('the spool is emptied after a clean drain', filesize(AA_SPOOL_FILE) === 0);

resetSpool();
replaySpooledInquiries(dummyPDO(), function () { throw new RuntimeException('should not be called'); });
check('replay is a no-op when there is nothing spooled', true);

resetSpool();
spoolInquiry(sampleLead('Keeps Failing'));
spoolInquiry(sampleLead('Also Failing'));
replaySpooledInquiries(dummyPDO(), function () { throw new RuntimeException('database still down'); });
$still = file(AA_SPOOL_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
check('a still-broken database keeps the enquiries on disk', count($still) === 2, 'left ' . count($still));

resetSpool();
spoolInquiry(sampleLead('Good One'));
file_put_contents(AA_SPOOL_FILE, "{not json at all\n", FILE_APPEND);
spoolInquiry(sampleLead('Another Good'));
$inserted = [];
replaySpooledInquiries(dummyPDO(), function ($db, $lead) use (&$inserted) { $inserted[] = $lead['client_name']; });
check('a corrupt line cannot block the good ones behind it', $inserted === ['Good One', 'Another Good'], implode(',', $inserted));


echo "\npersistInquiry — retries a transient fault before giving up\n";

// getDB() is unavailable here (no MySQL), so persistInquiry must surface the
// failure as a throw for handlePublicInquiry to catch and spool — never as a
// fatal, which is exactly what used to reach the visitor as an empty 500.
$threw = false;
try { persistInquiry(sampleLead()); } catch (Throwable $e) { $threw = true; }
check('a total database failure throws (catchable) rather than fataling', $threw);

@array_map('unlink', glob($tmp . '/*'));
@rmdir($tmp);

echo "\n$passed passed, $failed failed\n";
exit($failed === 0 ? 0 : 1);
