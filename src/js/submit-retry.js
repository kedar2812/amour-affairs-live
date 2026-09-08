/* ============================================================
   SUBMIT-RETRY.JS — Retry policy for the inquiry POST
   Amour Affairs · Premium Wedding Photography

   A wedding enquiry is the single most valuable request the
   site makes, and it is made from a phone on a mobile network.
   One dropped packet used to mean a lost booking: the visitor
   saw "we couldn't send your inquiry" and the lead was gone
   with nothing recorded anywhere (2026-09-08).

   So transport faults and server faults get another attempt.
   Answers the server actually gave us — validation, rate limit
   — never do: retrying those only spams duplicates and hides
   the message the visitor needs to read.

   Kept pure and injectable so it is unit-tested without a
   browser: see submit-retry.test.mjs.
   ============================================================ */

/** Backoff between attempts. Widening, and short enough that a visitor
    waiting on the button doesn't think the page has frozen. */
export const RETRY_DELAYS_MS = [600, 1800];

/** Statuses worth a second attempt — the request never really landed. */
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504, 408, 425]);

/**
 * Should this outcome be attempted again?
 * `outcome.kind` is one of:
 *   'ok'              — the lead is in
 *   'rejected'        — the server answered with a reason (4xx). Final.
 *   'server-error'    — the server broke (5xx / unreadable body)
 *   'transport-error' — fetch threw: offline, DNS, TLS, abort, blocked
 */
export function shouldRetry(outcome) {
  if (!outcome) return true;
  if (outcome.kind === 'transport-error') return true;
  if (outcome.kind === 'server-error') {
    // An unknown status means we never got a usable answer — try again.
    return outcome.status == null || RETRYABLE_STATUSES.has(outcome.status);
  }
  return false;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `doPost` until it succeeds, is finally rejected, or the backoff
 * is exhausted. Returns the last outcome either way — the caller decides
 * what the visitor sees.
 */
export async function postWithRetry(doPost, { delays = RETRY_DELAYS_MS, sleep = defaultSleep } = {}) {
  let outcome = await doPost();

  for (let i = 0; i < delays.length; i++) {
    if (!shouldRetry(outcome)) return outcome;
    await sleep(delays[i]);
    outcome = await doPost();
  }

  return outcome;
}
