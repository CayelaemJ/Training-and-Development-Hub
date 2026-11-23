// Integration tests for AI credit enforcement and the credits REST routes.
// Exercises: charge, refund on failure, exhaustion → 402, idempotent grants,
// demo top-up, GET balance, and webhook HMAC validation (without a real Paystack).
//
// Bundle with @workspace/db aliased to supportTestDb.ts (scripts/test-ai-credits.mjs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import express from "express";
import { engine } from "./supportTestDb";
import { db, usersTable, organizationMembersTable, organizationsTable } from "./supportTestDb";
import { createSchemaFromDrizzle } from "./schemaFromDrizzle";
import { currentBalance, withAiCredits, grantCredits, AiCreditsExhaustedError, sendCreditsExhausted } from "../../lib/aiCredits";
import aiCreditsRouter from "../../routes/aiCredits";

// ---- Schema ----------------------------------------------------------------
const statementCount = await createSchemaFromDrizzle();
console.log(`# schema: ${statementCount} statements generated from lib/db/src/schema`);

// Drop and re-create AI credit tables from the reviewed migration.
await engine.exec(`DROP TABLE IF EXISTS ai_credit_ledger, ai_subscriptions CASCADE`);
await engine.exec(readFileSync("lib/db/migrations/20261123_ai_credits.sql", "utf8"));
console.log("# applied reviewed migration 20261123_ai_credits");

// ---- Seed users ------------------------------------------------------------
await db.insert(usersTable).values([
  { id: "u-learner", email: "learner@test.cabo", firstName: "Lerato", lastName: "Dube" },
  { id: "u-teacher", email: "teacher@test.cabo", firstName: "Themba", lastName: "Nkosi" },
  { id: "u-broke",   email: "broke@test.cabo",   firstName: "Sipho",  lastName: "Molefe" },
]).onConflictDoNothing();

// ---- Seed organization (required parent for organization_members FK) --------
// Use raw SQL to force id=99 (serial column) and reference an already-seeded user as owner.
await engine.exec(`
  INSERT INTO organizations (id, name, owner_id, created_at)
  VALUES (99, 'Test Org', 'u-learner', NOW())
  ON CONFLICT (id) DO NOTHING
`);
console.log("# seeded test organization (id=99)");

await db.insert(organizationMembersTable).values([
  { organizationId: 99, userId: "u-learner", role: "learner" },
  { organizationId: 99, userId: "u-teacher", role: "teacher" },
  { organizationId: 99, userId: "u-broke",   role: "learner" },
]).onConflictDoNothing();

// ---- Helpers ---------------------------------------------------------------
function hmacSha512(secret: string, body: Buffer): string {
  return createHmac("sha512", secret).update(body).digest("hex");
}

type ReqUser = { id: string };

function buildApp(user?: ReqUser) {
  const app = express();
  app.use((req: any, _res, next) => { req.user = user; req.isAuthenticated = () => !!user; next(); });
  app.use(express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf instanceof Buffer ? buf : Buffer.from(String(buf)); },
  }));
  app.use("/api", aiCreditsRouter);
  return app;
}

async function call(app: express.Express, method: string, path: string, body?: unknown, headers: Record<string,string> = {}): Promise<{ status: number; body: any }> {
  const req = { method, url: path, headers: { "content-type": "application/json", ...headers }, body } as any;
  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string,string>,
      status(c: number) { this.statusCode = c; return this; },
      setHeader(k: string, v: string) { this.headers[k] = v; },
      get(k: string) { return req.headers[k]; },
      sendStatus(c: number) { this.statusCode = c; resolve({ status: c, body: null }); },
      json(b: unknown) { resolve({ status: this.statusCode, body: b }); },
    };
    app(req as any, res as any, () => resolve({ status: 404, body: null }));
  });
}

// ---- Tests -----------------------------------------------------------------

// 1. Fresh learner balance shows free plan.
{
  const b = await currentBalance("u-learner");
  assert.equal(b.plan, "free");
  assert.equal(b.allowance, 30);
  assert.equal(b.usedThisMonth, 0);
  assert.equal(b.total, 30);
  console.log("ok 1 - fresh learner starts on free plan with 30 credits");
}

// 2. Teacher gets educator plan allowance.
{
  const b = await currentBalance("u-teacher");
  assert.equal(b.plan, "educator");
  assert.equal(b.allowance, 200);
  console.log("ok 2 - teacher starts on educator plan");
}

// 3. withAiCredits charges on success.
{
  process.env.CABO_AI_CREDITS_ENFORCED = "true";
  await withAiCredits("u-learner", "material_qa", async () => {});
  const b = await currentBalance("u-learner");
  assert.equal(b.usedThisMonth, 1);
  assert.equal(b.allowanceLeft, 29);
  console.log("ok 3 - withAiCredits charges 1 credit on success");
}

// 4. withAiCredits refunds on failure.
{
  const before = await currentBalance("u-learner");
  try {
    await withAiCredits("u-learner", "material_qa", async () => { throw new Error("AI downstream failure"); });
    assert.fail("Should have rethrown");
  } catch (e) {
    if (e instanceof assert.AssertionError) throw e;
  }
  const after = await currentBalance("u-learner");
  assert.equal(after.usedThisMonth, before.usedThisMonth, "charge was refunded on failure");
  console.log("ok 4 - withAiCredits refunds credits when the run throws");
}

// 5. withAiCredits throws AiCreditsExhaustedError when balance is zero.
{
  // Exhaust all 30 credits by running 29 more (1 already used, 29 left)
  for (let i = 0; i < 29; i++) {
    await withAiCredits("u-learner", "material_qa", async () => {});
  }
  const b = await currentBalance("u-learner");
  assert.equal(b.total, 0);
  let threw = false;
  try {
    await withAiCredits("u-learner", "material_qa", async () => { return "never"; });
  } catch (e) {
    if (!(e instanceof AiCreditsExhaustedError)) throw e;
    threw = true;
    assert.equal(e.balance.total, 0);
  }
  assert.ok(threw, "Should throw AiCreditsExhaustedError");
  console.log("ok 5 - withAiCredits throws AiCreditsExhaustedError when exhausted");
}

// 6. sendCreditsExhausted returns 402 with the right shape.
{
  const fakeBalance = { plan: "free" as const, allowance: 30, usedThisMonth: 30, allowanceLeft: 0, topUpLeft: 0, total: 0 };
  const err = new AiCreditsExhaustedError(fakeBalance);
  let statusSet = 0, bodySet: any;
  const fakeRes = {
    status(c: number) { statusSet = c; return { json(b: unknown) { bodySet = b; } }; },
  };
  sendCreditsExhausted(fakeRes as any, err);
  assert.equal(statusSet, 402);
  assert.equal(bodySet.code, "ai_credits_exhausted");
  assert.deepEqual(bodySet.balance, fakeBalance);
  assert.equal(bodySet.upgradeUrl, "/ai-credits");
  console.log("ok 6 - sendCreditsExhausted sends 402 with correct shape");
}

// 7. grantCredits is idempotent on the same reference.
{
  const ref = `test-grant:${randomUUID()}`;
  const r1 = await grantCredits("u-learner", 50, "grant", ref);
  const r2 = await grantCredits("u-learner", 50, "grant", ref);
  assert.equal(r1, "granted");
  assert.equal(r2, "duplicate");
  const b = await currentBalance("u-learner");
  assert.equal(b.topUpLeft, 50);
  console.log("ok 7 - grantCredits is idempotent; second call returns duplicate");
}

// 8. Top-up credits are used when allowance exhausted.
{
  // u-learner has 0 allowance + 50 top-up. material_qa costs 1.
  await withAiCredits("u-learner", "material_qa", async () => {});
  const b = await currentBalance("u-learner");
  assert.equal(b.topUpLeft, 49);
  console.log("ok 8 - top-up credits used when allowance exhausted");
}

// 9. GET /api/ai-credits/me returns 401 when not signed in.
{
  const app = buildApp(); // no user
  const r = await call(app, "GET", "/api/ai-credits/me");
  assert.equal(r.status, 401);
  console.log("ok 9 - GET /ai-credits/me returns 401 when not signed in");
}

// 10. GET /api/ai-credits/me returns balance when signed in.
{
  const app = buildApp({ id: "u-teacher" });
  const r = await call(app, "GET", "/api/ai-credits/me");
  assert.equal(r.status, 200);
  assert.ok(r.body.balance, "has balance");
  assert.ok(Array.isArray(r.body.plans), "has plans");
  assert.ok(Array.isArray(r.body.packs), "has packs");
  assert.ok(typeof r.body.enforced === "boolean", "has enforced flag");
  console.log("ok 10 - GET /ai-credits/me returns balance and plan info");
}

// 11. POST /api/ai-credits/demo-topup returns 404 outside testing env.
{
  const app = buildApp({ id: "u-teacher" });
  delete process.env.CABO_ENVIRONMENT;
  delete process.env.CABO_TEST_DATABASE_ISOLATED;
  const r = await call(app, "POST", "/api/ai-credits/demo-topup", { product: "pack:small" });
  assert.equal(r.status, 404);
  console.log("ok 11 - demo-topup returns 404 outside testing environment");
}

// 12. POST /api/ai-credits/demo-topup grants credits in isolated testing env.
{
  process.env.CABO_ENVIRONMENT = "testing";
  process.env.CABO_TEST_DATABASE_ISOLATED = "true";
  const app = buildApp({ id: "u-teacher" });
  const before = await currentBalance("u-teacher");
  const r = await call(app, "POST", "/api/ai-credits/demo-topup", { product: "pack:small" });
  assert.equal(r.status, 200);
  assert.ok(r.body.ok);
  assert.ok(r.body.demo);
  const after = await currentBalance("u-teacher");
  assert.equal(after.topUpLeft, before.topUpLeft + 50);
  console.log("ok 12 - demo-topup grants pack:small (50 credits) in isolated env");
}

// 13. POST /api/ai-credits/demo-topup with plan upgrades subscription.
{
  process.env.CABO_ENVIRONMENT = "testing";
  process.env.CABO_TEST_DATABASE_ISOLATED = "true";
  const app = buildApp({ id: "u-teacher" });
  const r = await call(app, "POST", "/api/ai-credits/demo-topup", { product: "plan:plus" });
  assert.equal(r.status, 200);
  const b = await currentBalance("u-teacher");
  assert.equal(b.plan, "plus");
  console.log("ok 13 - demo-topup with plan:plus upgrades subscription");
}

// 14. POST /api/ai-credits/demo-topup with invalid product returns 400.
{
  process.env.CABO_ENVIRONMENT = "testing";
  process.env.CABO_TEST_DATABASE_ISOLATED = "true";
  const app = buildApp({ id: "u-teacher" });
  const r = await call(app, "POST", "/api/ai-credits/demo-topup", { product: "pack:giant" });
  assert.equal(r.status, 400);
  console.log("ok 14 - demo-topup with invalid product returns 400");
}

// 15. POST /api/ai-credits/checkout returns 503 without Paystack key.
{
  delete process.env.PAYSTACK_SECRET_KEY;
  const app = buildApp({ id: "u-teacher" });
  const r = await call(app, "POST", "/api/ai-credits/checkout", { product: "pack:small", currency: "ZAR" });
  assert.equal(r.status, 503);
  console.log("ok 15 - checkout returns 503 when Paystack is not configured");
}

// 16. POST /api/ai-credits/webhooks/paystack rejects bad signatures.
{
  const app = buildApp({ id: "u-teacher" });
  const body = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "ref-123" } }));
  // No signature header → 401
  const r1 = await call(app, "POST", "/api/ai-credits/webhooks/paystack", JSON.parse(body.toString()), {});
  assert.equal(r1.status, 401);

  // Wrong signature → 401
  const r2 = await call(app, "POST", "/api/ai-credits/webhooks/paystack", JSON.parse(body.toString()), { "x-paystack-signature": "a".repeat(128) });
  assert.equal(r2.status, 401);
  console.log("ok 16 - webhook rejects missing or wrong signature with 401");
}

// 17. withAiCredits skips enforcement when CABO_AI_CREDITS_ENFORCED=false.
{
  process.env.CABO_AI_CREDITS_ENFORCED = "false";
  // u-broke has 0 credits + no top-ups; should still succeed without enforcement
  let ran = false;
  await withAiCredits("u-broke", "material_qa", async () => { ran = true; });
  assert.ok(ran);
  console.log("ok 17 - withAiCredits skips enforcement when CABO_AI_CREDITS_ENFORCED=false");
  process.env.CABO_AI_CREDITS_ENFORCED = "true";
}

// 18. withAiCredits is a no-op for grading (cost 0).
{
  const before = await currentBalance("u-teacher");
  await withAiCredits("u-teacher", "grading", async () => {});
  const after = await currentBalance("u-teacher");
  assert.equal(after.usedThisMonth, before.usedThisMonth, "grading does not consume credits");
  console.log("ok 18 - withAiCredits does not charge for grading (cost=0)");
}

console.log("# 18 AI credit integration tests passed");
