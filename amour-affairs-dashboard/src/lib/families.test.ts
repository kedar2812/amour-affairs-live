/**
 * Unit tests for resolveRecipients — the WhatsApp routing rules.
 * Framework-free so it runs under any TS runner (tsx/ts-node) or the
 * bundled scratchpad harness:  npx tsx src/lib/families.test.ts
 *
 * Routing table under test:
 *   Wife's birthday      → Wife AND Husband
 *   Husband's birthday   → Husband AND Wife
 *   Child's birthday     → Both parents (husband + wife)
 *   Anniversary          → Both husband and wife
 *   Festival             → Both husband and wife (all adults)
 * Plus: dedupe shared numbers; skip missing/invalid numbers.
 */

import assert from "node:assert";
import { resolveRecipients, Family, WishTarget } from "./families";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const mkFamily = (over: Partial<Family> = {}): Family => ({
  id: 1,
  display_name: "Vikram & Priyanka",
  anniversary_date: "2018-12-05",
  anniversary_year_known: 1,
  notes: null,
  album_given: 0,
  album_given_at: null,
  testimonial_given: 0,
  testimonial_given_at: null,
  is_active: 1,
  members: [
    { id: 10, family_id: 1, role: "husband", name: "Vikram", dob: "1988-04-12", dob_year_known: 1, phone: null, whatsapp: "+919876500001" },
    { id: 11, family_id: 1, role: "wife", name: "Priyanka", dob: "1990-07-20", dob_year_known: 1, phone: null, whatsapp: "+919876500002" },
    { id: 12, family_id: 1, role: "child", name: "Aarav", dob: "2020-02-29", dob_year_known: 1, phone: null, whatsapp: null },
  ],
  ...over,
});

const roles = (f: Family, t: WishTarget) => resolveRecipients(f, t).recipients.map((r) => r.role).sort();
const ids = (f: Family, t: WishTarget) => resolveRecipients(f, t).recipients.map((r) => r.member_id).sort();

console.log("resolveRecipients");

test("wife's birthday → wife AND husband", () => {
  assert.deepStrictEqual(roles(mkFamily(), { type: "birthday", memberId: 11 }), ["husband", "wife"]);
});

test("husband's birthday → husband AND wife", () => {
  assert.deepStrictEqual(roles(mkFamily(), { type: "birthday", memberId: 10 }), ["husband", "wife"]);
});

test("child's birthday → both parents (not the child)", () => {
  const r = resolveRecipients(mkFamily(), { type: "birthday", memberId: 12 });
  assert.deepStrictEqual(r.recipients.map((x) => x.member_id).sort(), [10, 11]);
  assert.ok(!r.recipients.some((x) => x.member_id === 12), "child must not be a recipient");
});

test("anniversary → both husband and wife", () => {
  assert.deepStrictEqual(ids(mkFamily(), { type: "anniversary" }), [10, 11]);
});

test("festival → all adults (husband + wife)", () => {
  assert.deepStrictEqual(ids(mkFamily(), { type: "festival" }), [10, 11]);
});

test("shared number is de-duplicated to one recipient", () => {
  const fam = mkFamily();
  fam.members[1].whatsapp = fam.members[0].whatsapp; // couple share a handset
  const r = resolveRecipients(fam, { type: "anniversary" });
  assert.strictEqual(r.recipients.length, 1, "duplicate number collapses to one");
});

test("missing number → surfaced in skipped, not silently dropped", () => {
  const fam = mkFamily();
  fam.members[1].whatsapp = null;
  fam.members[1].phone = null;
  const r = resolveRecipients(fam, { type: "anniversary" });
  assert.strictEqual(r.recipients.length, 1);
  assert.strictEqual(r.skipped.length, 1);
  assert.strictEqual(r.skipped[0].member_id, 11);
  assert.strictEqual(r.skipped[0].reason, "no_number");
});

test("invalid number → surfaced as invalid_number", () => {
  const fam = mkFamily();
  fam.members[0].whatsapp = "+12"; // too short to be valid
  const r = resolveRecipients(fam, { type: "festival" });
  assert.ok(r.skipped.some((s) => s.member_id === 10 && s.reason === "invalid_number"));
});

test("phone is used when whatsapp is absent", () => {
  const fam = mkFamily();
  fam.members[0].whatsapp = null;
  fam.members[0].phone = "+919876500009";
  const r = resolveRecipients(fam, { type: "birthday", memberId: 10 });
  const husband = r.recipients.find((x) => x.member_id === 10);
  assert.ok(husband, "husband still resolved via phone");
  assert.strictEqual(husband!.digits, "919876500009");
});

test("international (non-Indian) numbers resolve", () => {
  const fam = mkFamily();
  fam.members[0].whatsapp = "+971501234567"; // UAE
  const r = resolveRecipients(fam, { type: "birthday", memberId: 10 });
  const husband = r.recipients.find((x) => x.member_id === 10);
  assert.strictEqual(husband!.digits, "971501234567");
});

test("single-parent family: only the present adult receives", () => {
  const fam = mkFamily({
    members: [
      { id: 20, family_id: 1, role: "wife", name: "Meera", dob: "1991-03-03", dob_year_known: 1, phone: null, whatsapp: "+919000000001" },
      { id: 21, family_id: 1, role: "child", name: "Kiara", dob: "2019-06-01", dob_year_known: 1, phone: null, whatsapp: null },
    ],
  });
  const r = resolveRecipients(fam, { type: "birthday", memberId: 21 });
  assert.deepStrictEqual(r.recipients.map((x) => x.member_id), [20]);
});

console.log(`\n${passed} passed`);
