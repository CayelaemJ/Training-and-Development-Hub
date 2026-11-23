/**
 * AI credit plans. Every learner-facing AI request costs credits; each month
 * a person gets their plan's allowance, and purchased or granted top-ups are
 * used once the allowance runs out. Grading by staff is never blocked.
 *
 * Prices are NOT set here: they come from the payment provider's plans and
 * the CABO_* price settings, so the owner decides them. Nothing is charged
 * unless a payment provider is configured.
 */
export const PLANS = {
  free: { label: "Free", monthlyCredits: 30, description: "For trying CABO's AI study help." },
  educator: { label: "Educator", monthlyCredits: 200, description: "Included for teachers and school staff." },
  plus: { label: "Plus", monthlyCredits: 300, description: "For regular study with AI help every day." },
  pro: { label: "Pro", monthlyCredits: 1000, description: "For heavy use: long documents and many practice tests." },
} as const;
export type PlanCode = keyof typeof PLANS;

/** Top-up packs that never expire. */
export const PACKS = {
  small: { label: "50 credits", credits: 50 },
  medium: { label: "150 credits", credits: 150 },
  large: { label: "500 credits", credits: 500 },
} as const;
export type PackCode = keyof typeof PACKS;

export const OPERATION_COST: Readonly<Record<string, number>> = {
  material_qa: 1,
  learner_support: 1,
  passport_reflection: 1,
  quiz: 1, // per batch of questions
  written_exam: 2,
  development_plan: 2,
  grading: 0,
};

export function costOf(operation: string): number {
  return OPERATION_COST[operation] ?? 1;
}

/** Staff start on the Educator allowance; everyone else on Free, unless subscribed. */
export function effectivePlan(subscription: { plan: string; status: string; currentPeriodEnd: Date } | null, roles: readonly string[], now: Date): PlanCode {
  if (subscription && subscription.status === "active" && subscription.currentPeriodEnd > now && subscription.plan in PLANS) return subscription.plan as PlanCode;
  return roles.some(r => ["owner", "admin", "teacher", "assessor"].includes(r)) ? "educator" : "free";
}

export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type Balance = { plan: PlanCode; allowance: number; usedThisMonth: number; allowanceLeft: number; topUpLeft: number; total: number };

export function balance(plan: PlanCode, usedThisMonth: number, topUpLeft: number): Balance {
  const allowance = PLANS[plan].monthlyCredits;
  const allowanceLeft = Math.max(0, allowance - usedThisMonth);
  return { plan, allowance, usedThisMonth, allowanceLeft, topUpLeft: Math.max(0, topUpLeft), total: allowanceLeft + Math.max(0, topUpLeft) };
}

/** Which pot pays for a request, or null when there are not enough credits. */
export function chargeFrom(b: Balance, cost: number): "usage" | "usage_topup" | null {
  if (cost <= 0) return "usage";
  if (b.allowanceLeft >= cost) return "usage";
  if (b.topUpLeft >= cost) return "usage_topup";
  return null;
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export function paystackSignatureValid(rawBody: Buffer, signature: unknown, secret: string, hmac: (secret: string, body: Buffer) => string, equal: (a: string, b: string) => boolean): boolean {
  if (typeof signature !== "string" || !/^[a-f0-9]{128}$/i.test(signature) || !secret) return false;
  return equal(hmac(secret, rawBody).toLowerCase(), signature.toLowerCase());
}
