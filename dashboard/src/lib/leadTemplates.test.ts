/**
 * Unit tests for the lead WhatsApp presets — placeholder filling and
 * recipient resolution. Framework-free like families.test.ts:
 *   npx tsx src/lib/leadTemplates.test.ts
 */

import assert from "node:assert";
import {
  LEAD_PRESETS, MessageableLead,
  buildSentNote, composeLeadMessage, getPreset, leadRecipients, presetForStage,
} from "./leadTemplates";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const mkLead = (over: Partial<MessageableLead> = {}): MessageableLead => ({
  id: 1,
  lead_ref: "LD-001",
  client_name: "Priya &amp; Rahul",
  phone: "+919876500001",
  stage: "New Inquiry",
  event_type: "Wedding",
  event_date: "2027-02-14",
  venue: "Taj Lands End",
  ...over,
});

console.log("\ncomposeLeadMessage");

test("fills {name} from the couple's names when both are known", () => {
  const lead = mkLead({ bride_name: "Priya", groom_name: "Rahul" });
  const msg = composeLeadMessage({ crm_tpl_lead_followup: "Hello {name}, about your {event}." }, lead, "followup");
  assert.strictEqual(msg, "Hello Priya & Rahul, about your Wedding.");
});

test("falls back to the decoded client name when the couple isn't split out", () => {
  const msg = composeLeadMessage({ crm_tpl_lead_welcome: "Hi {name}!" }, mkLead(), "welcome");
  assert.strictEqual(msg, "Hi Priya & Rahul!");
});

test("uses the built-in copy when no override is saved", () => {
  const msg = composeLeadMessage({}, mkLead(), "welcome");
  assert.ok(msg.startsWith("*Thank you for contacting Amour Affairs!*"));
});

test("uses the built-in copy when the override is blank", () => {
  const msg = composeLeadMessage({ crm_tpl_lead_closure: "   " }, mkLead(), "closure");
  assert.ok(msg.includes("With warmest wishes,"));
});

test("preserves paragraph breaks (WhatsApp renders them as typed)", () => {
  const msg = composeLeadMessage({}, mkLead(), "followup");
  assert.ok(msg.includes("\n\n"), "expected blank lines between paragraphs");
  assert.ok(msg.split("\n").length > 8);
});

test("empty placeholders leave no double spaces or orphaned commas", () => {
  const lead = mkLead({ venue: null, event_date: null, bride_name: null, groom_name: null });
  const msg = composeLeadMessage(
    { crm_tpl_lead_welcome: "At {venue} on {date}, congratulations {bride} {groom}!" },
    lead,
    "welcome",
  );
  assert.ok(!msg.includes("  "), `double space in: ${msg}`);
  assert.ok(!msg.includes(" ,"), `orphaned comma in: ${msg}`);
});

test("formats the event date in IST long form", () => {
  const msg = composeLeadMessage({ crm_tpl_lead_followup: "{date}" }, mkLead(), "followup");
  assert.ok(/2027/.test(msg) && /Feb/i.test(msg), `unexpected date: ${msg}`);
});

test("every preset has non-empty built-in copy and a distinct settings key", () => {
  const keys = new Set(LEAD_PRESETS.map((p) => p.settingKey));
  assert.strictEqual(keys.size, 3);
  for (const p of LEAD_PRESETS) assert.ok(p.fallback.trim().length > 100, `${p.key} copy too short`);
});

console.log("\nleadRecipients");

test("returns the primary contact", () => {
  const r = leadRecipients(mkLead());
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].digits, "919876500001");
});

test("adds bride and groom numbers, WhatsApp number first", () => {
  const r = leadRecipients(mkLead({
    bride_name: "Priya", bride_phone: "+919876500002", bride_whatsapp: "+919876500003",
    groom_name: "Rahul", groom_phone: "+919876500004",
  }));
  assert.deepStrictEqual(r.map((x) => x.digits), [
    "919876500001", "919876500003", "919876500002", "919876500004",
  ]);
});

test("dedupes a number shared between fields", () => {
  const r = leadRecipients(mkLead({ bride_phone: "+919876500001", bride_whatsapp: "919876500001" }));
  assert.strictEqual(r.length, 1);
});

test("skips missing and malformed numbers", () => {
  const r = leadRecipients(mkLead({ phone: null, bride_phone: "12", groom_phone: "  " }));
  assert.strictEqual(r.length, 0);
});

test("keeps legacy bare 10-digit Indian numbers", () => {
  const r = leadRecipients(mkLead({ phone: "9876500009" }));
  assert.strictEqual(r[0].digits, "919876500009");
});

console.log("\nampersands never double-encode");

test("an encoded client name renders as a plain ampersand", () => {
  const msg = composeLeadMessage({ crm_tpl_lead_welcome: "Hi {name}!" }, mkLead(), "welcome");
  assert.strictEqual(msg, "Hi Priya & Rahul!");
  assert.ok(!msg.includes("&amp;"));
});

test("a plain ampersand in a saved template survives untouched", () => {
  const msg = composeLeadMessage({ crm_tpl_lead_welcome: "Photography & Videography" }, mkLead(), "welcome");
  assert.strictEqual(msg, "Photography & Videography");
});

test("a legacy encoded template is repaired rather than shown raw", () => {
  const msg = composeLeadMessage({ crm_tpl_lead_welcome: "Photo &amp; Film for {name}" }, mkLead(), "welcome");
  assert.strictEqual(msg, "Photo & Film for Priya & Rahul");
});

test("encoded couple names decode in recipient labels", () => {
  const r = leadRecipients(mkLead({ bride_name: "Anaya &amp; co", bride_phone: "+919876500007" }));
  assert.ok(r.some((x) => x.name === "Anaya & co"));
  assert.ok(r.every((x) => !x.name.includes("&amp;")));
});

test("the timeline note carries no entities", () => {
  const lead = mkLead();
  const msg = composeLeadMessage({}, lead, "welcome");
  const note = buildSentNote(getPreset("welcome"), leadRecipients(lead), msg, "2026-08-03 12:00:00");
  assert.ok(!note.content.includes("&amp;"));
  assert.ok(note.content.includes("Stage 1 — Initial Inquiry & Welcome"));
});

console.log("\npresetForStage");

test("suggests the stage-appropriate preset", () => {
  assert.strictEqual(presetForStage("New Inquiry"), "welcome");
  assert.strictEqual(presetForStage("Contacted"), "followup");
  assert.strictEqual(presetForStage("Proposal Sent"), "followup");
  assert.strictEqual(presetForStage("Won"), "followup");
  assert.strictEqual(presetForStage("Lost"), "closure");
});

console.log(`\n${passed} tests passed.\n`);
