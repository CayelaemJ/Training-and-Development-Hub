/**
 * Local-only synthetic PostgreSQL schema checks (PGlite).
 * No Neon/Render/production connection strings, secrets or real learner data.
 * This verifies DDL constraints, not full app-level row authorization.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../package.json",import.meta.url));
const {PGlite}=require("@electric-sql/pglite");

const migrations=[
  "20261029_notification_outbox.sql",
  "20261029_notification_consent.sql",
  "20261029_notification_preference_audit.sql",
];
const EVENT_A="02e1701d-d45b-43a7-85b7-c952c85fb66a";
const EVENT_B="6c6f12e5-c67b-4664-895b-4b632477b2aa";
const EVENT_C="9c8f55d6-8c54-4d70-a281-d2906f609c2f";
const EVENT_ROLLBACK="d7c6cb83-acac-42bd-a618-9e6489c7dc46";
const users=["guardian-alpha","guardian-beta","educator-alpha"];
const email="synthetic.guardian@example.org";

test("three review-only migrations preserve tenant, consent and audit database invariants",async(t)=>{
  const pg=new PGlite();
  t.after(async()=>pg.close());
  // Minimal synthetic upstream FK targets; never attach real school tables.
  await pg.exec("CREATE TABLE users(id VARCHAR(128) PRIMARY KEY); CREATE TABLE organizations(id INTEGER PRIMARY KEY);");
  for(const file of migrations){
    const sql=await readFile(new URL("../../../../lib/db/migrations/"+file,import.meta.url),"utf8");
    await pg.exec(sql);
  }
  for(const user of users) await pg.query("INSERT INTO users(id) VALUES ($1)",[user]);
  for(const id of [11,22])await pg.query("INSERT INTO organizations(id) VALUES ($1)",[id]);

  await t.test("no inferred consent and no opted-in state without confirmation",async()=>{
    const result=await pg.query("SELECT COUNT(*)::int AS n FROM notification_preferences");
    assert.equal(result.rows[0].n,0);
    await assert.rejects(pg.query(
      "INSERT INTO notification_preferences(user_id,organization_id,kind,opted_in) VALUES ($1,$2,$3,true)",
      ["guardian-alpha",11,"guardian_review_requested"]),/check constraint/i);
    await assert.rejects(pg.query(
      "INSERT INTO notification_preferences(user_id,organization_id,kind,opted_in,confirmed_at) VALUES ($1,$2,$3,true,NOW())",
      ["guardian-alpha",999,"guardian_review_requested"]),/foreign key/i);
    await assert.rejects(pg.query(
      "INSERT INTO notification_preferences(user_id,organization_id,kind) VALUES ($1,$2,$3)",
      ["guardian-alpha",11,"unapproved_kind"]),/check constraint/i);
  });
  await t.test("distinct guardians and schools cannot share a consent key",async()=>{
    await pg.query(
      "INSERT INTO notification_preferences(user_id,organization_id,kind,opted_in,confirmed_at) VALUES ($1,$2,$3,true,NOW())",
      ["guardian-alpha",11,"guardian_review_requested"]);
    await pg.query(
      "INSERT INTO notification_preferences(user_id,organization_id,kind,opted_in,confirmed_at) VALUES ($1,$2,$3,true,NOW())",
      ["guardian-beta",22,"guardian_review_requested"]);
    const scoped=await pg.query("SELECT user_id,organization_id FROM notification_preferences WHERE user_id=$1 AND organization_id=$2",
      ["guardian-alpha",22]);
    assert.equal(scoped.rows.length,0,"tenant-filtered query must not return another guardian's school");
    const own=await pg.query("SELECT opted_in FROM notification_preferences WHERE user_id=$1 AND organization_id=$2",
      ["guardian-alpha",11]);
    assert.equal(own.rows.length,1);
    assert.equal(own.rows[0].opted_in,true);
    await assert.rejects(pg.query(
      "INSERT INTO notification_preferences(user_id,organization_id,kind) VALUES ($1,$2,$3)",
      ["guardian-alpha",11,"guardian_review_requested"]),/duplicate key/i);
  });
  await t.test("opt-out and append-only decision history commit together",async()=>{
    await pg.exec("BEGIN");
    try{
      await pg.query("UPDATE notification_preferences SET opted_in=false,confirmed_at=NULL,revoked_at=NOW() WHERE user_id=$1 AND organization_id=$2 AND kind=$3",
        ["guardian-alpha",11,"guardian_review_requested"]);
      await pg.query("INSERT INTO notification_preference_events(user_id,organization_id,kind,action) VALUES($1,$2,$3,$4)",
        ["guardian-alpha",11,"guardian_review_requested","opt_out"]);
      await pg.exec("COMMIT");
    }catch(e){await pg.exec("ROLLBACK");throw e}
    const r=await pg.query("SELECT opted_in,revoked_at FROM notification_preferences WHERE user_id=$1 AND organization_id=$2",
      ["guardian-alpha",11]);
    assert.equal(r.rows[0].opted_in,false);
    assert.ok(r.rows[0].revoked_at);
    const a=await pg.query("SELECT action FROM notification_preference_events WHERE user_id=$1 AND organization_id=$2",
      ["guardian-alpha",11]);
    assert.deepEqual(a.rows.map(x=>x.action),["opt_out"]);
    await assert.rejects(pg.query("INSERT INTO notification_preference_events(user_id,organization_id,kind,action) VALUES($1,$2,$3,$4)",
      ["guardian-alpha",11,"guardian_review_requested","invalid"]),/check constraint/i);
  });
  await t.test("outbox requires unique event, valid source and bounded states",async()=>{
    await pg.query("INSERT INTO notification_outbox(event_id,organization_id,recipient_user_id,recipient_ciphertext,kind) VALUES($1,$2,$3,$4,$5)",
      [EVENT_A,11,"guardian-alpha","v1.synthetic.encrypted.content","guardian_review_requested"]);
    await pg.query("INSERT INTO notification_event_sources(event_id,source_kind,source_id) VALUES($1,$2,$3)",
      [EVENT_A,"guardian_relationship",37]);
    const ok=await pg.query("SELECT source_kind,source_id FROM notification_event_sources WHERE event_id=$1",[EVENT_A]);
    assert.equal(ok.rows.length,1);
    await assert.rejects(pg.query("INSERT INTO notification_outbox(event_id,organization_id,recipient_user_id,recipient_ciphertext,kind) VALUES($1,$2,$3,$4,$5)",
      [EVENT_A,22,"guardian-beta","v1.another.encrypted.value","guardian_review_requested"]),/duplicate key/i);
    await assert.rejects(pg.query("INSERT INTO notification_event_sources(event_id,source_kind,source_id) VALUES($1,$2,$3)",
      [EVENT_B,"guardian_relationship",37]),/foreign key/i);
    await assert.rejects(pg.query("INSERT INTO notification_event_sources(event_id,source_kind,source_id) VALUES($1,$2,$3)",
      [EVENT_A,"malicious_source",5]),/check constraint/i);
    await assert.rejects(pg.query("UPDATE notification_outbox SET attempts=4 WHERE event_id=$1",[EVENT_A]),/check constraint/i);
    await assert.rejects(pg.query("UPDATE notification_outbox SET status='unverified_sent' WHERE event_id=$1",[EVENT_A]),/check constraint/i);
  });
  await t.test("atomic rollback never leaves an unbound notification event",async()=>{
    await pg.exec("BEGIN");
    await pg.query("INSERT INTO notification_outbox(event_id,organization_id,recipient_user_id,recipient_ciphertext,kind) VALUES($1,$2,$3,$4,$5)",
      [EVENT_ROLLBACK,22,"guardian-beta","v1.synthetic.encrypted.content","guardian_review_requested"]);
    await pg.query("INSERT INTO notification_event_sources(event_id,source_kind,source_id) VALUES($1,$2,$3)",
      [EVENT_ROLLBACK,"guardian_relationship",40]);
    await pg.exec("ROLLBACK");
    const [o,s]=await Promise.all([
      pg.query("SELECT COUNT(*)::int AS n FROM notification_outbox WHERE event_id=$1",[EVENT_ROLLBACK]),
      pg.query("SELECT COUNT(*)::int AS n FROM notification_event_sources WHERE event_id=$1",[EVENT_ROLLBACK]),
    ]);
    assert.equal(o.rows[0].n,0);
    assert.equal(s.rows[0].n,0);
    // Deleting the pending event also removes its source (no orphan records).
    await pg.query("DELETE FROM notification_outbox WHERE event_id=$1",[EVENT_A]);
    const gone=await pg.query("SELECT COUNT(*)::int AS n FROM notification_event_sources WHERE event_id=$1",[EVENT_A]);
    assert.equal(gone.rows[0].n,0);
  });
  await t.test("no emails, external connections, or application side effects",async()=>{
    const r=await pg.query("SELECT COUNT(*)::int AS n FROM notification_outbox");
    assert.equal(r.rows[0].n,0);
    assert.ok(email.endsWith("@example.org"));
    assert.notEqual(EVENT_C,EVENT_A);
  });
});
