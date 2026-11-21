import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { PGlite } = require("@electric-sql/pglite");
const migration = await readFile(
  new URL("../../../../lib/db/migrations/20261109_r2_staging_budget.sql", import.meta.url), "utf8",
);

test("R2 staging schema enforces immutable opaque keys, byte caps and tenant ownership fields", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE users(id varchar PRIMARY KEY)");
    await db.query("INSERT INTO users(id) VALUES($1)", ["synthetic-user"]);
    await db.exec(migration);
    const initial = await db.query("SELECT reserved_bytes, stored_bytes FROM cabo_r2_usage");
    assert.equal(initial.rows.length, 1);
    assert.equal(Number(initial.rows[0].reserved_bytes), 0);
    const key = "quarantine/550e8400-e29b-41d4-a716-446655440001";
    const values = [key, "synthetic-user", "synthetic-school", "notes.pdf", "application/pdf", "a".repeat(64), 8_388_608];
    const insert = `INSERT INTO cabo_r2_objects
      (object_key,owner_user_id,tenant_id,file_name,media_type,expected_sha256,size_bytes)
      VALUES($1,$2,$3,$4,$5,$6,$7)`;
    await db.query(insert, values);
    const row = await db.query("SELECT state,ai_read_consent,billing_stage FROM cabo_r2_objects");
    assert.deepEqual(row.rows[0], {
      state: "reserved", ai_read_consent: false, billing_stage: "reserved",
    });
    await assert.rejects(db.query(insert, [
      "quarantine/not-a-uuid", ...values.slice(1),
    ]), /check constraint/i);
    await assert.rejects(db.query(insert, [
      "quarantine/550e8400-e29b-41d4-a716-446655440002",
      ...values.slice(1, 6), 8_388_609,
    ]), /check constraint/i);
    await assert.rejects(db.query(insert, [
      "quarantine/550e8400-e29b-41d4-a716-446655440003",
      ...values.slice(1, 2), "", ...values.slice(3),
    ]), /check constraint/i);
    await assert.rejects(db.query(
      "UPDATE cabo_r2_usage SET reserved_bytes=$1 WHERE singleton=true",
      [2_147_483_649],
    ), /check constraint/i);
    // Re-applying the additive migration must not erase stored quota.
    await db.exec(migration);
    const after = await db.query("SELECT COUNT(*)::int AS count FROM cabo_r2_objects");
    assert.equal(after.rows[0].count, 1);
  } finally {
    await db.close();
  }
});
