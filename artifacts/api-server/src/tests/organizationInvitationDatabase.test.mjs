/**
 * Local-only synthetic PostgreSQL schema checks (PGlite) for
 * 20261122_organization_invitations.sql. No external database, secrets or real
 * learner data. Verifies DDL invariants, not route-level authorization.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../package.json", import.meta.url));
const { PGlite } = require("@electric-sql/pglite");

const MIGRATION = "20261122_organization_invitations.sql";

test("organization invitation migration enforces normalized, single-open, bounded invitations", async t => {
  const pg = new PGlite();
  t.after(async () => pg.close());
  // Minimal synthetic upstream FK targets.
  await pg.exec("CREATE TABLE users(id VARCHAR(128) PRIMARY KEY); CREATE TABLE organizations(id INTEGER PRIMARY KEY);");
  const sql = await readFile(new URL("../../../../lib/db/migrations/" + MIGRATION, import.meta.url), "utf8");
  await pg.exec(sql);
  await pg.exec(sql); // idempotent re-run
  await pg.exec("INSERT INTO users(id) VALUES ('owner-a'),('owner-b'); INSERT INTO organizations(id) VALUES (11),(22);");
  const insert = (org, email, role = "learner", by = "owner-a") =>
    pg.query("INSERT INTO organization_invitations(organization_id,email,role,invited_by) VALUES ($1,$2,$3,$4) RETURNING id,status,expires_at>created_at AS future", [org, email, role, by]);

  await t.test("defaults to pending with a future expiry", async () => {
    const r = await insert(11, "learner@example.org");
    assert.equal(r.rows[0].status, "pending");
    assert.equal(r.rows[0].future, true);
  });
  await t.test("rejects non-normalized emails, owner role and unknown status", async () => {
    await assert.rejects(insert(11, "Learner@Example.org"), /check constraint/i);
    await assert.rejects(insert(11, " spaced@example.org"), /check constraint/i);
    await assert.rejects(insert(11, "no-at-sign"), /check constraint/i);
    await assert.rejects(insert(11, "x@example.org", "owner"), /check constraint/i);
    await assert.rejects(pg.query("UPDATE organization_invitations SET status='verified', responded_at=now()"), /check constraint/i);
  });
  await t.test("one open invitation per organization and email, but separate tenants are independent", async () => {
    await assert.rejects(insert(11, "learner@example.org"), /unique/i);
    await insert(22, "learner@example.org", "learner", "owner-b");
    const r = await pg.query("SELECT count(*)::int AS n FROM organization_invitations WHERE email='learner@example.org'");
    assert.equal(r.rows[0].n, 2);
  });
  await t.test("answered invitations require responded_at and free the slot for a new invitation", async () => {
    await assert.rejects(pg.query("UPDATE organization_invitations SET status='declined' WHERE organization_id=11"), /check constraint/i);
    await pg.query("UPDATE organization_invitations SET status='declined', responded_at=now() WHERE organization_id=11");
    await insert(11, "learner@example.org");
    await assert.rejects(pg.query("UPDATE organization_invitations SET responded_at=now() WHERE organization_id=11 AND status='pending'"), /check constraint/i);
  });
  await t.test("re-inviting refreshes only an expired open invitation", async () => {
    const upsert = (email, role) => pg.query(
      "INSERT INTO organization_invitations(organization_id,email,role,invited_by) VALUES (11,$1,$2,'owner-a') " +
      "ON CONFLICT (organization_id,email) WHERE status = 'pending' DO UPDATE SET role=EXCLUDED.role, invited_by=EXCLUDED.invited_by, " +
      "created_at=now(), expires_at=now() + interval '14 days' WHERE organization_invitations.expires_at <= now()", [email, role]);
    await upsert("renew@example.org", "learner");
    await upsert("renew@example.org", "teacher");
    let r = await pg.query("SELECT role FROM organization_invitations WHERE email='renew@example.org' AND status='pending'");
    assert.deepEqual(r.rows.map(x => x.role), ["learner"], "unexpired invitation unchanged");
    await pg.query("UPDATE organization_invitations SET created_at=now()-interval '20 days', expires_at=now()-interval '6 days' WHERE email='renew@example.org'");
    await upsert("renew@example.org", "teacher");
    r = await pg.query("SELECT role, expires_at > now() AS live FROM organization_invitations WHERE email='renew@example.org' AND status='pending'");
    assert.deepEqual(r.rows, [{ role: "teacher", live: true }], "expired invitation refreshed in place");
  });
  await t.test("foreign keys reject unknown organizations and inviters; deleting an organization removes its invitations", async () => {
    await assert.rejects(insert(999, "a@example.org"), /foreign key/i);
    await assert.rejects(insert(11, "b@example.org", "learner", "nobody"), /foreign key/i);
    await pg.query("DELETE FROM organizations WHERE id=22");
    const r = await pg.query("SELECT count(*)::int AS n FROM organization_invitations WHERE organization_id=22");
    assert.equal(r.rows[0].n, 0);
  });
});
