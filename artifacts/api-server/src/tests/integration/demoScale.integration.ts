// Runs the demo seeders against a PGlite database built from the real Drizzle
// schema (plus the reviewed accountability/chat migration), twice, to prove the
// large demo dataset loads without constraint errors and is idempotent.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { engine } from "./supportTestDb";
import { createSchemaFromDrizzle } from "./schemaFromDrizzle";
import { seedCaboDemo } from "../../lib/demoSeed";
import { seedCaboDemoAtScale } from "../../lib/demoSeedScale";

await createSchemaFromDrizzle();
await engine.exec(`DROP TABLE class_chat_mutes, class_chat_reports, class_chat_messages, class_chat_channels, accountability_case_events, accountability_cases CASCADE`);
await engine.exec(readFileSync("lib/db/migrations/20261123_accountability_and_class_chat.sql", "utf8"));
// Columns the base demo seed writes that exist only through reviewed migrations.
await engine.exec(readFileSync("lib/db/migrations/20261021_material_reading.sql", "utf8"));
Object.assign(process.env, { CABO_ENVIRONMENT: "testing", CABO_TEST_DATABASE_ISOLATED: "true", ENABLE_CABO_DEMO_SEED: "true" });

async function counts() {
  const q = async (sql: string) => Number(((await engine.query(sql)).rows[0] as any).n);
  return {
    users: await q("SELECT count(*) n FROM users"),
    learners: await q("SELECT count(DISTINCT user_id) n FROM organization_members WHERE role='learner'"),
    courses: await q("SELECT count(*) n FROM academic_courses"),
    grades: await q("SELECT count(*) n FROM academic_grades"),
    attendance: await q("SELECT count(*) n FROM school_attendance"),
    verifiedGuardians: await q("SELECT count(*) n FROM guardian_relationships WHERE status='verified'"),
    cases: await q("SELECT count(*) n FROM accountability_cases"),
    messages: await q("SELECT count(*) n FROM class_chat_messages"),
    countries: await q("SELECT count(*) n FROM institution_setup WHERE country_code IN ('ZA','BW')"),
  };
}
let failures = 0;
try {
  const started = Date.now();
  await seedCaboDemo();
  await seedCaboDemoAtScale();
  const first = await counts();
  console.log(`# first run (${Math.round((Date.now() - started) / 1000)} s):`, JSON.stringify(first));
  // ~450 learners across four institutions, plus their staff and guardians.
  assert.ok(first.users >= 560 && first.users <= 680, `about 600 people in total, got ${first.users}`);
  assert.ok(first.learners >= 430, `about 450 learners, got ${first.learners}`);
  assert.ok(first.grades > 10000);
  assert.ok(first.attendance > 9000);
  assert.ok(first.verifiedGuardians >= 70);
  assert.equal(first.countries, 3);
  assert.ok(first.cases >= 12);
  assert.ok(first.messages >= 30);
  const parent = (await engine.query(`SELECT r.status, e.decision FROM guardian_relationships r JOIN guardian_verification_events e ON e.relationship_id=r.id WHERE r.guardian_id='cabo-fixture-parent-south' AND r.learner_id='cabo-fixture-learner-south-a'`)).rows as any[];
  assert.deepEqual(parent.map(p => [p.status, p.decision]), [["verified", "verified"]], "the demo parent can see progress");
  const classSize = Number(((await engine.query(`SELECT count(*) n FROM academic_enrollments e JOIN academic_courses c ON c.id=e.course_id WHERE c.code='MAT12' AND c.level='Grade 12'`)).rows[0] as any).n);
  assert.ok(classSize >= 60, "the demo learners sit in a full Grade 12 maths class");
  await seedCaboDemo();
  await seedCaboDemoAtScale();
  assert.deepEqual(await counts(), first, "a second run adds nothing");
  console.log("ok - demo dataset loads at scale and is idempotent");
} catch (error) {
  failures++;
  console.log("not ok - demo dataset loads at scale and is idempotent");
  console.log(error);
} finally {
  await engine.close();
}
if (failures) process.exitCode = 1;
