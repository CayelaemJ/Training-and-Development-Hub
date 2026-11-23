import { useEffect, useState, useCallback } from "react";
import {
  ArrowRight, BrainCircuit, CheckCircle2, Coins, ExternalLink,
  LoaderCircle, PartyPopper, Sparkles, TrendingUp, Zap,
} from "lucide-react";
import { api } from "@/lib/schoolApi";

// /ai-credits — shows the learner/educator their current AI credit balance,
// monthly allowance, available top-up packs, and recent ledger entries.
// Checkout wires to POST /api/ai-credits/checkout (Paystack hosted page).
// Demo top-up wires to POST /api/ai-credits/demo-topup when demoTopUpAvailable.

// ---- Types matching the API response from GET /api/ai-credits/me ----

type ApiBalance = {
  plan: string;
  allowance: number;
  usedThisMonth: number;
  allowanceLeft: number;
  topUpLeft: number;
  total: number;
};

type ApiPlan = {
  code: string;
  label: string;
  monthlyCredits: number;
  description: string;
  price: { ZAR: number | null; BWP: number | null };
};

type ApiPack = {
  code: string;
  label: string;
  credits: number;
  price: { ZAR: number | null; BWP: number | null };
};

type ApiSubscription = {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
} | null;

type LedgerEntry = {
  kind: string;
  delta: number;
  operation: string | null;
  createdAt: string;
};

type MeData = {
  balance: ApiBalance;
  subscription: ApiSubscription;
  enforced: boolean;
  plans: ApiPlan[];
  packs: ApiPack[];
  costs: Record<string, number>;
  paymentsAvailable: boolean;
  demoTopUpAvailable: boolean;
  recent: LedgerEntry[];
};

// ---- Helpers ----

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatPrice(price: { ZAR: number | null; BWP: number | null }): string {
  if (price.ZAR !== null) return `R ${(price.ZAR / 100).toFixed(2)} / mo`;
  if (price.BWP !== null) return `P ${(price.BWP / 100).toFixed(2)} / mo`;
  return "Contact CABO";
}

function formatPackPrice(price: { ZAR: number | null; BWP: number | null }): string {
  if (price.ZAR !== null) return `R ${(price.ZAR / 100).toFixed(2)}`;
  if (price.BWP !== null) return `P ${(price.BWP / 100).toFixed(2)}`;
  return "Contact CABO";
}

// ---- Sub-components ----

function BalanceRing({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(1, used / total) : 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);
  const colour = pct > 0.85 ? "text-red-500" : pct > 0.6 ? "text-amber-500" : "text-emerald-500";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={128} height={128} viewBox="0 0 128 128" aria-hidden="true">
        <circle cx={64} cy={64} r={r} fill="none" strokeWidth={10} className="stroke-muted" />
        <circle
          cx={64} cy={64} r={r} fill="none" strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={dash}
          strokeLinecap="round" transform="rotate(-90 64 64)"
          className={`${colour} stroke-current transition-all duration-700`}
        />
      </svg>
      <div className="absolute text-center">
        <p className={`text-2xl font-bold leading-none ${colour}`}>{total}</p>
        <p className="text-xs text-muted-foreground mt-0.5">credits left</p>
      </div>
    </div>
  );
}

function PlanBadge({ plan, status }: { plan: string; status: string }) {
  const labels: Record<string, string> = { free: "Free", educator: "Educator", plus: "Plus", pro: "Pro" };
  const colours: Record<string, string> = {
    free: "bg-muted text-muted-foreground",
    educator: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    plus: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    pro: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colours[plan] ?? colours.free}`}>
      {plan === "pro" && <Sparkles size={10} />}
      {labels[plan] ?? plan}
      {status !== "active" && <span className="ml-1 opacity-60">({status})</span>}
    </span>
  );
}

const opLabels: Record<string, string> = {
  material_qa: "Study material Q&A",
  learner_support: "AI learner support",
  passport_reflection: "Career passport reflection",
  quiz: "Practice quiz",
  written_exam: "Written exam",
  development_plan: "Development plan",
  grading: "Essay grading",
};

const kindLabel: Record<string, string> = {
  allowance: "Monthly allowance",
  grant: "Credits granted",
  purchase: "Top-up purchased",
  charge: "AI usage",
};

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isCredit = entry.delta > 0;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{kindLabel[entry.kind] ?? entry.kind}</p>
        {entry.operation && <p className="text-xs text-muted-foreground">{opLabels[entry.operation] ?? entry.operation}</p>}
        <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
        {isCredit ? "+" : ""}{entry.delta}
      </span>
    </div>
  );
}

// ---- Checkout / demo-topup helpers ----

type BuyState = "idle" | "loading" | "success" | "error";

function useBuy(onSuccess: () => void) {
  const [state, setState] = useState<BuyState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const checkout = useCallback(async (productCode: string, currency: "ZAR" | "BWP") => {
    setState("loading");
    setErrorMsg("");
    try {
      const { checkoutUrl } = await api<{ checkoutUrl: string; reference: string }>(
        "/ai-credits/checkout",
        { method: "POST", body: { product: productCode, currency } },
      );
      // Redirect to Paystack hosted checkout in same tab
      window.location.href = checkoutUrl;
    } catch (e) {
      setState("error");
      setErrorMsg((e as Error).message ?? "Checkout failed. Please try again.");
    }
  }, []);

  const demoTopUp = useCallback(async (productCode: string) => {
    setState("loading");
    setErrorMsg("");
    try {
      await api("/ai-credits/demo-topup", { method: "POST", body: { product: productCode } });
      setState("success");
      onSuccess();
    } catch (e) {
      setState("error");
      setErrorMsg((e as Error).message ?? "Demo top-up failed.");
    }
  }, [onSuccess]);

  return { state, errorMsg, checkout, demoTopUp };
}

// ---- Main page ----

export default function AiCreditsPage() {
  const [data, setData] = useState<MeData | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paidBanner, setPaidBanner] = useState(false);
  // Auto-detect currency from the user's institution country (ZA→ZAR, BW→BWP).
  // Falls back to ZAR if the org has no country set.
  const [currency, setCurrency] = useState<"ZAR" | "BWP">("ZAR");

  const refresh = useCallback(() => {
    api<MeData>("/ai-credits/me")
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setFetchError((e as Error).message); setLoading(false); });
  }, []);

  useEffect(() => {
    // Auto-detect currency from institution country
    api<{ countryCode?: string | null }>("/me/institution-country")
      .then(r => { if (r.countryCode === "BW") setCurrency("BWP"); })
      .catch(() => { /* non-critical; keep default ZAR */ });
    // Check if returning from a Paystack payment
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      setPaidBanner(true);
      // Remove the query param without pushing a new history entry
      window.history.replaceState({}, "", window.location.pathname);
    }
    refresh();
  }, [refresh]);

  const { state: buyState, errorMsg: buyError, checkout, demoTopUp } = useBuy(refresh);

  if (loading) return (
    <main className="page-container" aria-busy="true">
      <div className="flex items-center gap-3 text-muted-foreground py-16 justify-center">
        <LoaderCircle size={20} className="animate-spin" />
        <span>Loading your AI credits&hellip;</span>
      </div>
    </main>
  );

  if (fetchError) return (
    <main className="page-container">
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
        <p className="font-semibold text-destructive">Could not load AI credits</p>
        <p className="text-sm text-muted-foreground mt-1">{fetchError}</p>
      </div>
    </main>
  );

  if (!data) return null;

  const { balance, subscription, plans, packs, costs, enforced, paymentsAvailable, demoTopUpAvailable, recent } = data;
  const currentPlan = balance.plan;
  const operationList = Object.entries(costs).filter(([, v]) => v > 0).map(([k, v]) => ({ key: k, cost: v }));
  const freeOps = Object.entries(costs).filter(([, v]) => v === 0).map(([k]) => k);
  const isBuying = buyState === "loading";

  return (
    <main className="page-container space-y-8 py-6 max-w-3xl mx-auto px-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <BrainCircuit size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">AI Credits</h1>
          <p className="text-sm text-muted-foreground">Your CABO AI usage balance and subscription</p>
        </div>
      </div>

      {/* Paid confirmation banner */}
      {paidBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 px-4 py-3 flex items-center gap-3">
          <PartyPopper size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-sm text-emerald-800 dark:text-emerald-300">
            <strong>Payment received!</strong> Your credits will appear below within a few seconds.{" "}
            <button className="underline" onClick={refresh}>Refresh</button>
          </div>
        </div>
      )}

      {/* Dev mode banner */}
      {!enforced && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Dev mode:</strong> AI credit enforcement is currently disabled. All AI features run without consuming credits.
        </div>
      )}

      {/* Demo mode banner */}
      {demoTopUpAvailable && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          <strong>Demo environment:</strong> No real payments — use the demo top-up buttons to simulate purchasing credits.
        </div>
      )}

      {/* Buy error */}
      {buyState === "error" && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {buyError}
        </div>
      )}

      {/* Balance card */}
      <section className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row items-center gap-6" aria-labelledby="balance-heading">
        <BalanceRing used={balance.usedThisMonth} total={balance.total} />
        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h2 id="balance-heading" className="text-lg font-semibold">Your balance</h2>
            <PlanBadge plan={currentPlan} status={subscription?.status ?? "active"} />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Monthly allowance</dt>
            <dd className="font-semibold">{balance.allowanceLeft} left of {balance.allowance}</dd>
            <dt className="text-muted-foreground">Top-up credits</dt>
            <dd className="font-semibold">{balance.topUpLeft}</dd>
            <dt className="text-muted-foreground">Total available</dt>
            <dd className="font-semibold">{balance.total}</dd>
            {subscription?.currentPeriodEnd && (
              <>
                <dt className="text-muted-foreground">Resets on</dt>
                <dd className="font-semibold">{new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, { dateStyle: "medium" })}</dd>
              </>
            )}
          </dl>
        </div>
      </section>

      {/* Credit costs */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-4" aria-labelledby="costs-heading">
        <h2 id="costs-heading" className="font-semibold flex items-center gap-2"><Zap size={16} className="text-primary" /> What costs credits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {operationList.map(({ key, cost }) => (
            <div key={key} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span>{opLabels[key] ?? key}</span>
              <span className="font-semibold tabular-nums">{cost} credit{cost !== 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
        {freeOps.length > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-500" />
            Always free: {freeOps.map(k => opLabels[k] ?? k).join(", ")}
          </p>
        )}
      </section>

      {/* Plans */}
      <section className="space-y-4" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="font-semibold flex items-center gap-2"><TrendingUp size={16} className="text-primary" /> Subscription plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map(plan => {
            const isCurrent = plan.code === currentPlan;
            const hasPrice = plan.price.ZAR !== null || plan.price.BWP !== null;
            const productCode = `plan:${plan.code}` as string;
            return (
              <div key={plan.code} className={`rounded-2xl border p-5 space-y-3 transition-all ${isCurrent ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card"}`}>
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <PlanBadge plan={plan.code} status="active" />
                  {isCurrent && <span className="text-xs text-primary font-medium">Current plan</span>}
                </div>
                <p className="text-2xl font-bold">
                  {plan.monthlyCredits} <span className="text-sm font-normal text-muted-foreground">credits/month</span>
                </p>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                {hasPrice && !isCurrent && (
                  <p className="text-sm font-medium">{formatPrice(plan.price)}</p>
                )}
                {!isCurrent && (plan.code === "free" || plan.code === "educator") ? (
                  <p className="text-xs text-muted-foreground">Assigned automatically by your institution.</p>
                ) : !isCurrent && (
                  demoTopUpAvailable ? (
                    <button
                      disabled={isBuying}
                      className="w-full text-sm rounded-lg bg-primary text-primary-foreground px-3 py-2 font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                      onClick={() => demoTopUp(productCode)}
                      aria-label={`Demo-activate ${plan.label} plan`}
                    >
                      {isBuying ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      Activate (demo)
                    </button>
                  ) : paymentsAvailable ? (
                    <button
                      disabled={isBuying}
                      className="w-full text-sm rounded-lg bg-primary text-primary-foreground px-3 py-2 font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                      onClick={() => checkout(productCode, currency)}
                      aria-label={`Upgrade to ${plan.label} plan`}
                    >
                      {isBuying ? <LoaderCircle size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                      Upgrade via Paystack
                    </button>
                  ) : (
                    <p className="text-xs text-muted-foreground">Contact your institution to upgrade.</p>
                  )
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Top-up packs */}
      <section className="space-y-4" aria-labelledby="packs-heading">
        <h2 id="packs-heading" className="font-semibold flex items-center gap-2"><Coins size={16} className="text-primary" /> Top-up packs</h2>
        <p className="text-sm text-muted-foreground">Need more credits before your monthly allowance resets? Add a one-time pack. Top-up credits never expire.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {packs.map(pack => {
            const productCode = `pack:${pack.code}` as string;
            const hasPrice = pack.price.ZAR !== null || pack.price.BWP !== null;
            return (
              <div key={pack.code} className="rounded-2xl border border-border bg-card p-5 space-y-3 hover:border-primary/40 transition-colors">
                <p className="font-semibold capitalize">{pack.label}</p>
                <p className="text-2xl font-bold">{pack.credits} <span className="text-sm font-normal text-muted-foreground">credits</span></p>
                {hasPrice && <p className="text-sm font-medium">{formatPackPrice(pack.price)}</p>}
                {demoTopUpAvailable ? (
                  <button
                    disabled={isBuying}
                    className="w-full text-sm rounded-lg border border-primary text-primary px-3 py-2 font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                    onClick={() => demoTopUp(productCode)}
                    aria-label={`Demo top-up: ${pack.label}`}
                  >
                    {isBuying ? <LoaderCircle size={14} className="animate-spin" /> : <Coins size={14} />}
                    Add (demo)
                  </button>
                ) : paymentsAvailable ? (
                  <button
                    disabled={isBuying}
                    className="w-full text-sm rounded-lg border border-primary text-primary px-3 py-2 font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                    onClick={() => checkout(productCode, currency)}
                    aria-label={`Buy ${pack.label} top-up pack`}
                  >
                    {isBuying ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    Buy pack
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full text-sm rounded-lg border border-border text-muted-foreground px-3 py-2 font-medium cursor-not-allowed"
                    aria-label="Payments not yet configured"
                    title="Your administrator needs to configure payments before top-ups are available."
                  >
                    Not available yet
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent ledger */}
      {recent.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 space-y-2" aria-labelledby="ledger-heading">
          <h2 id="ledger-heading" className="font-semibold">Recent activity</h2>
          <div>
            {recent.map((entry, i) => <LedgerRow key={i} entry={entry} />)}
          </div>
        </section>
      )}

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center pb-4">
        Monthly allowance resets at the start of each billing period. Top-up credits never expire.
        Contact your institution administrator for plan changes or billing support.
      </p>
    </main>
  );
}
