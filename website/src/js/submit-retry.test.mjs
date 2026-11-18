/**
 * Unit tests for the inquiry submit retry policy.
 * Framework-free so it runs anywhere:  node src/js/submit-retry.test.mjs
 *
 * These guard the rule learned the hard way on 2026-09-08: a single transient
 * fault on the enquiry POST used to lose the lead outright and show the visitor
 * "we couldn't send your inquiry". A transport fault or a 5xx must be retried;
 * a validation answer from the server must NOT be (it would spam duplicates and
 * hide the real message).
 */

import assert from 'node:assert';
import { shouldRetry, postWithRetry, RETRY_DELAYS_MS } from './submit-retry.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const atest = async (name, fn) => { await fn(); passed++; console.log(`  ✓ ${name}`); };

console.log('\nshouldRetry — what deserves another attempt');

test('a thrown fetch (offline, DNS, abort) is retried', () => {
  assert.strictEqual(shouldRetry({ kind: 'transport-error' }), true);
});

test('a 500 with an unreadable body is retried', () => {
  assert.strictEqual(shouldRetry({ kind: 'server-error', status: 500 }), true);
});

test('a 502/503/504 from the host is retried', () => {
  for (const status of [502, 503, 504]) {
    assert.strictEqual(shouldRetry({ kind: 'server-error', status }), true);
  }
});

test('a success is never retried', () => {
  assert.strictEqual(shouldRetry({ kind: 'ok' }), false);
});

test('a validation answer (400) is never retried — the visitor must see it', () => {
  assert.strictEqual(shouldRetry({ kind: 'rejected', status: 400 }), false);
});

test('a rate-limit answer (429) is never retried — retrying guarantees another 429', () => {
  assert.strictEqual(shouldRetry({ kind: 'rejected', status: 429 }), false);
});

console.log('\npostWithRetry — the loop');

await atest('a first-attempt success posts exactly once', async () => {
  let calls = 0;
  const result = await postWithRetry(async () => { calls++; return { kind: 'ok', leadRef: '#LD-900' }; }, { sleep: async () => {} });
  assert.strictEqual(calls, 1);
  assert.deepStrictEqual(result, { kind: 'ok', leadRef: '#LD-900' });
});

await atest('a transient blip is retried and the lead still gets through', async () => {
  let calls = 0;
  const result = await postWithRetry(async () => {
    calls++;
    if (calls === 1) return { kind: 'transport-error' };
    return { kind: 'ok', leadRef: '#LD-901' };
  }, { sleep: async () => {} });
  assert.strictEqual(calls, 2, 'should have made a second attempt');
  assert.strictEqual(result.kind, 'ok');
});

await atest('an empty-bodied 500 (the 2026-09-08 failure) is retried', async () => {
  let calls = 0;
  const result = await postWithRetry(async () => {
    calls++;
    if (calls < 3) return { kind: 'server-error', status: 500 };
    return { kind: 'ok', leadRef: '#LD-902' };
  }, { sleep: async () => {} });
  assert.strictEqual(calls, 3);
  assert.strictEqual(result.kind, 'ok');
});

await atest('retries are bounded — it gives up after the configured delays', async () => {
  let calls = 0;
  const result = await postWithRetry(async () => { calls++; return { kind: 'transport-error' }; }, { sleep: async () => {} });
  assert.strictEqual(calls, RETRY_DELAYS_MS.length + 1, 'one initial attempt plus one per delay');
  assert.strictEqual(result.kind, 'transport-error');
});

await atest('a validation rejection short-circuits the loop', async () => {
  let calls = 0;
  const result = await postWithRetry(async () => {
    calls++;
    return { kind: 'rejected', status: 400, error: 'Please enter a valid phone number' };
  }, { sleep: async () => {} });
  assert.strictEqual(calls, 1, 'must not retry a validation answer');
  assert.strictEqual(result.error, 'Please enter a valid phone number');
});

await atest('it waits between attempts, using the configured backoff', async () => {
  const waited = [];
  let calls = 0;
  await postWithRetry(async () => { calls++; return { kind: 'transport-error' }; }, {
    sleep: async (ms) => { waited.push(ms); },
  });
  assert.deepStrictEqual(waited, RETRY_DELAYS_MS, 'backoff should widen, not hammer the server');
});

console.log(`\n${passed} passed\n`);
