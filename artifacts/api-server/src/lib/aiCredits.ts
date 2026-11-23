import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, aiCreditLedgerTable, aiSubscriptionsTable, organizationMembersTable } from "@workspace/db";
import { balance, chargeFrom, costOf, effectivePlan, monthStart, type Balance } from "./aiCreditPolicy";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export class AiCreditsExhaustedError extends Error {
  constructor(public readonly balance: Balance) {
    super("You have used all your AI credits for this month. Top up or upgrade to keep going; your work is saved.");
    this.name = "AiCreditsExhaustedError";
  }
}

export function creditsEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CABO_AI_CREDITS_ENFORCED !== "false";
}

export async function currentBalance(userId: string, exec: Executor = db, now = new Date()): Promise<Balance> {
  const [subscription] = await exec.select().from(aiSubscriptionsTable).where(eq(aiSubscriptionsTable.userId, userId)).limit(1);
  const roles = (await exec.select({ role: organizationMembersTable.role }).from(organizationMembersTable).where(eq(organizationMembersTable.userId, userId)).limit(60)).map(r => r.role);
  const plan = effectivePlan(subscription ?? null, roles, now);
  const [month] = await exec.select({ used: sql<number>`coalesce(-sum(${aiCreditLedgerTable.delta}),0)::int` }).from(aiCreditLedgerTable).where(and(
    eq(aiCreditLedgerTable.userId, userId), inArray(aiCreditLedgerTable.kind, ["usage", "refund"]), gte(aiCreditLedgerTable.createdAt, monthStart(now))));
  const [topup] = await exec.select({ left: sql<number>`coalesce(sum(${aiCreditLedgerTable.delta}),0)::int` }).from(aiCreditLedgerTable).where(and(
    eq(aiCreditLedgerTable.userId, userId), inArray(aiCreditLedgerTable.kind, ["purchase", "grant", "usage_topup", "refund_topup"])));
  return balance(plan, Math.max(0, Number(month?.used ?? 0)), Number(topup?.left ?? 0));
}

/**
 * Reserve credits for one AI request, run it, and give the credits back if
 * it fails, so learners never pay for an error. Serialised per person with a
 * transaction-scoped advisory lock so parallel requests cannot overspend.
 */
export async function withAiCredits<T>(userId: string | undefined, operation: string, run: () => Promise<T>): Promise<T> {
  const cost = costOf(operation);
  if (!userId || cost <= 0 || !creditsEnforced()) return run();
  const charge = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"ai-credits:" + userId}))`);
    const b = await currentBalance(userId, tx);
    const pot = chargeFrom(b, cost);
    if (!pot) throw new AiCreditsExhaustedError(b);
    const [row] = await tx.insert(aiCreditLedgerTable).values({ userId, kind: pot, delta: -cost, operation }).returning({ id: aiCreditLedgerTable.id });
    return { pot, id: row.id };
  });
  try {
    return await run();
  } catch (error) {
    await db.insert(aiCreditLedgerTable).values({ userId, kind: charge.pot === "usage" ? "refund" : "refund_topup", delta: cost, operation, reference: `refund:${charge.id}` }).onConflictDoNothing();
    throw error;
  }
}

export async function grantCredits(userId: string, credits: number, kind: "purchase" | "grant", reference: string): Promise<"granted" | "duplicate"> {
  const inserted = await db.insert(aiCreditLedgerTable).values({ userId, kind, delta: credits, reference }).onConflictDoNothing().returning({ id: aiCreditLedgerTable.id });
  return inserted.length ? "granted" : "duplicate";
}

/** Standard 402 reply when a person has no AI credits left. */
export function sendCreditsExhausted(res: { status(code: number): { json(body: unknown): unknown } }, error: AiCreditsExhaustedError) {
  res.status(402).json({ error: error.message, code: "ai_credits_exhausted", balance: error.balance, upgradeUrl: "/ai-credits" });
}
