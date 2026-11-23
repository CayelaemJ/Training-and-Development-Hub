// AI credits: balance, plans, top-ups and the payment provider webhook.
// Payments use Paystack's hosted checkout, so card details never reach CABO.
// Nothing can be bought until PAYSTACK_SECRET_KEY and the CABO price settings
// are configured; on an isolated demo service a clearly labelled demo top-up
// grants credits without money.
import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable, aiCreditLedgerTable, aiSubscriptionsTable } from "@workspace/db";
import { PACKS, PLANS, OPERATION_COST, paystackSignatureValid, type PackCode, type PlanCode } from "../lib/aiCreditPolicy";
import { currentBalance, grantCredits, creditsEnforced } from "../lib/aiCredits";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const PAYSTACK = "https://api.paystack.co";

function signedIn(req: Request, res: Response): string | null {
  res.setHeader("Cache-Control", "private, no-store");
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Sign in required" }); return null; }
  return req.user!.id;
}

function isolatedDemo(env = process.env) {
  return (env.CABO_ENVIRONMENT ?? env.RAILWAY_ENVIRONMENT_NAME) === "testing" && env.CABO_TEST_DATABASE_ISOLATED === "true";
}

/** Owner-set prices in the smallest currency unit (cents / thebe), per product and currency. */
function price(product: string, currency: "ZAR" | "BWP", env = process.env): number | null {
  const raw = env[`CABO_PRICE_${product.replace(":", "_").toUpperCase()}_${currency}`];
  const n = raw ? Number(raw) : NaN;
  return Number.isSafeInteger(n) && n >= 100 && n <= 10_000_000 ? n : null;
}
function paymentsReady(env = process.env) { return !!env.PAYSTACK_SECRET_KEY?.startsWith("sk_"); }

const product = z.enum(["plan:plus", "plan:pro", "pack:small", "pack:medium", "pack:large"]);

router.get("/ai-credits/me", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const [b, recent, [subscription]] = await Promise.all([
    currentBalance(userId),
    db.select({ kind: aiCreditLedgerTable.kind, delta: aiCreditLedgerTable.delta, operation: aiCreditLedgerTable.operation, createdAt: aiCreditLedgerTable.createdAt })
      .from(aiCreditLedgerTable).where(eq(aiCreditLedgerTable.userId, userId)).orderBy(desc(aiCreditLedgerTable.id)).limit(25),
    db.select({ plan: aiSubscriptionsTable.plan, status: aiSubscriptionsTable.status, currentPeriodEnd: aiSubscriptionsTable.currentPeriodEnd }).from(aiSubscriptionsTable).where(eq(aiSubscriptionsTable.userId, userId)).limit(1),
  ]);
  res.json({
    balance: b, subscription: subscription ?? null, enforced: creditsEnforced(),
    plans: Object.entries(PLANS).map(([code, p]) => ({ code, ...p, price: { ZAR: price(`plan:${code}`, "ZAR"), BWP: price(`plan:${code}`, "BWP") } })),
    packs: Object.entries(PACKS).map(([code, p]) => ({ code, ...p, price: { ZAR: price(`pack:${code}`, "ZAR"), BWP: price(`pack:${code}`, "BWP") } })),
    costs: OPERATION_COST,
    paymentsAvailable: paymentsReady(), demoTopUpAvailable: isolatedDemo(),
    recent,
  });
});

router.post("/ai-credits/demo-topup", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  if (!isolatedDemo()) { res.sendStatus(404); return; }
  const item = product.safeParse(req.body?.product);
  if (!item.success) { res.sendStatus(400); return; }
  const [kind, code] = item.data.split(":") as ["plan" | "pack", string];
  if (kind === "pack") {
    await grantCredits(userId, PACKS[code as PackCode].credits, "grant", `demo:${randomUUID()}`);
  } else {
    const end = new Date(Date.now() + 30 * 86_400_000);
    await db.insert(aiSubscriptionsTable).values({ userId, plan: code, status: "active", currentPeriodEnd: end, provider: "demo" })
      .onConflictDoUpdate({ target: aiSubscriptionsTable.userId, set: { plan: code, status: "active", currentPeriodEnd: end, provider: "demo", updatedAt: new Date() } });
  }
  res.json({ ok: true, demo: true, balance: await currentBalance(userId) });
});

router.post("/ai-credits/checkout", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const item = product.safeParse(req.body?.product), currency = z.enum(["ZAR", "BWP"]).safeParse(req.body?.currency ?? "ZAR");
  if (!item.success || !currency.success) { res.sendStatus(400); return; }
  const amount = price(item.data, currency.data);
  if (!paymentsReady() || amount === null) { res.status(503).json({ error: "Payments are not switched on yet. Ask your school or CABO about upgrading." }); return; }
  const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user?.email) { res.status(400).json({ error: "Add an email address to your account before paying." }); return; }
  const planCode = item.data.startsWith("plan:") ? process.env[`CABO_PAYSTACK_PLAN_${item.data.slice(5).toUpperCase()}`] : undefined;
  const reference = `cabo-${randomUUID()}`;
  const origin = process.env.CABO_PUBLIC_ORIGIN ?? "";
  const response = await fetch(`${PAYSTACK}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, amount, currency: currency.data, reference, ...(planCode ? { plan: planCode } : {}),
      callback_url: origin ? `${origin}/ai-credits?paid=1` : undefined, metadata: { cabo_user: userId, cabo_product: item.data } }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  const data = response ? await response.json().catch(() => null) : null;
  const url = data?.data?.authorization_url;
  if (!response?.ok || typeof url !== "string" || !url.startsWith("https://checkout.paystack.com/")) {
    logger.warn({ status: response?.status ?? null }, "Paystack checkout not created");
    res.status(502).json({ error: "We could not start the payment. Nothing was charged; please try again." }); return;
  }
  res.json({ checkoutUrl: url, reference });
});

/**
 * Paystack webhook. Verified with the HMAC-SHA512 signature over the raw
 * body, then confirmed by re-fetching the transaction from Paystack before
 * any credit is granted. Idempotent by reference.
 */
router.post("/ai-credits/webhooks/paystack", async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY ?? "";
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  const valid = !!raw && paystackSignatureValid(raw, req.get("x-paystack-signature"), secret,
    (s, body) => createHmac("sha512", s).update(body).digest("hex"),
    (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)));
  if (!valid) { res.sendStatus(401); return; }
  res.sendStatus(200); // acknowledge quickly; processing below is idempotent
  try {
    const event = req.body as { event?: string; data?: { reference?: string } };
    if (event.event !== "charge.success" || typeof event.data?.reference !== "string" || !/^[A-Za-z0-9._-]{6,100}$/.test(event.data.reference)) return;
    const verify = await fetch(`${PAYSTACK}/transaction/verify/${encodeURIComponent(event.data.reference)}`, {
      headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(8000),
    });
    const tx = (await verify.json().catch(() => null))?.data;
    if (!verify.ok || tx?.status !== "success") return;
    const userId = tx?.metadata?.cabo_user, item = product.safeParse(tx?.metadata?.cabo_product);
    if (typeof userId !== "string" || !item.success) return;
    const expected = price(item.data, tx.currency === "BWP" ? "BWP" : "ZAR");
    if (expected === null || tx.amount < expected) { logger.warn({ reference: tx.reference }, "Paystack amount below price; not granted"); return; }
    const [kind, code] = item.data.split(":") as ["plan" | "pack", string];
    if (kind === "pack") {
      await grantCredits(userId, PACKS[code as PackCode].credits, "purchase", `paystack:${tx.reference}`);
    } else {
      const end = new Date(Date.now() + 31 * 86_400_000);
      await db.insert(aiSubscriptionsTable).values({ userId, plan: code as PlanCode, status: "active", currentPeriodEnd: end, provider: "paystack", providerReference: tx.reference })
        .onConflictDoUpdate({ target: aiSubscriptionsTable.userId, set: { plan: code as PlanCode, status: "active", currentPeriodEnd: end, provider: "paystack", providerReference: tx.reference, updatedAt: new Date() } });
    }
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.name : "unknown" }, "Paystack webhook processing failed");
  }
});

export default router;
