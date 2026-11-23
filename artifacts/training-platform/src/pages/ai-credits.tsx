import { useEffect, useState } from "react";
import { ArrowRight, BrainCircuit, CheckCircle2, Coins, LoaderCircle, Sparkles, TrendingUp, Zap } from "lucide-react";
import { api } from "@/lib/schoolApi";

// /ai-credits — shows the learner/educator their current AI credit balance,
// monthly allowance, available top-up packs, and recent ledger entries.
// All numbers come from GET /api/ai-credits/me.

type Plan = { name: string; monthlyAllowance: number; price: string };
type Pack = { name: string; credits: number; price: string };
type OperationCost = { [operation: string]: number };
type LedgerEntry = { kind: "allowance" | "topup" | "charge"; delta: number; operation: string | null; createdAt: string };

type BalanceData = {
  balance: { allowanceRemaining: number; topupRemaining: number; total: number };
  subscription: { plan: string; status: string; currentPeriodEnd: string | null } | null;
  plans: Plan[];
  packs: Pack[];
  costs: OperationCost;
  enforced: boolean;
  recentLedger: LedgerEntry[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

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

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isCredit = entry.delta > 0;
  const kindLabel: Record<string, string> = { allowance: "Monthly allowance", topup: "Top-up credited", charge: "AI usage" };
  const opLabel: Record<string, string> = {
    quiz: "Practice quiz", written_exam: "Written exam", development_plan: "Development plan",
    grading: "Grading", learner_support: "Learner support", material_qa: "Study material QA",
  };
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{kindLabel[entry.kind] ?? entry.kind}</p>
        {entry.operation && <p className="text-xs text-muted-foreground">{opLabel[entry.operation] ?? entry.operation}</p>}
        <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
        {isCredit ? "+" : ""}{entry.delta}
      </span>
    </div>
  );
}

export default function AiCreditsPage() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<BalanceData>("/ai-credits/me")
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError((e as Error).message); setLoading(false); });
  }, []);

  if (loading) return (
    <main className="page-container" aria-busy="true">
      <div className="flex items-center gap-3 text-muted-foreground py-16 justify-center">
        <LoaderCircle size={20} className="animate-spin" />
        <span>Loading your AI credits&hellip;</span>
      </div>
    </main>
  );

  if (error) return (
    <main className="page-container">
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
        <p className="font-semibold text-destructive">Could not load AI credits</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    </main>
  );

  if (!data) return null;

  const { balance, subscription, plans, packs, costs, enforced, recentLedger } = data;
  const currentPlan = subscription?.plan ?? "free";
  const monthlyAllowance = plans.find(p => p.name === currentPlan)?.monthlyAllowance ?? 30;
  const used = monthlyAllowance - balance.allowanceRemaining;
  const operationList = Object.entries(costs).filter(([, v]) => v > 0).map(([k, v]) => ({ key: k, cost: v }));
  const freeOps = Object.entries(costs).filter(([, v]) => v === 0).map(([k]) => k);

  const opLabels: Record<string, string> = {
    quiz: "Practice quiz", written_exam: "Written exam", development_plan: "Development plan",
    grading: "Essay grading", learner_support: "AI learner support", material_qa: "Study material QA",
  };

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

      {!enforced && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Dev mode:</strong> AI credit enforcement is currently disabled. All AI features run without consuming credits.
        </div>
      )}

      {/* Balance card */}
      <section className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row items-center gap-6" aria-labelledby="balance-heading">
        <BalanceRing used={used} total={balance.total} />
        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h2 id="balance-heading" className="text-lg font-semibold">Your balance</h2>
            <PlanBadge plan={currentPlan} status={subscription?.status ?? "active"} />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Monthly allowance</dt>
            <dd className="font-semibold">{balance.allowanceRemaining} left of {monthlyAllowance}</dd>
            <dt className="text-muted-foreground">Top-up credits</dt>
            <dd className="font-semibold">{balance.topupRemaining}</dd>
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
            Free: {freeOps.map(k => opLabels[k] ?? k).join(", ")}
          </p>
        )}
      </section>

      {/* Plans */}
      <section className="space-y-4" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="font-semibold flex items-center gap-2"><TrendingUp size={16} className="text-primary" /> Subscription plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map(plan => {
            const isCurrent = plan.name === currentPlan;
            return (
              <div key={plan.name} className={`rounded-2xl border p-5 space-y-3 transition-all ${isCurrent ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card"}`}>
                <div className="flex items-center justify-between">
                  <PlanBadge plan={plan.name} status="active" />
                  {isCurrent && <span className="text-xs text-primary font-medium">Current plan</span>}
                </div>
                <p className="text-2xl font-bold">{plan.monthlyAllowance} <span className="text-sm font-normal text-muted-foreground">credits/month</span></p>
                <p className="text-sm text-muted-foreground">{plan.price}</p>
                {!isCurrent && (
                  <button
                    className="w-full text-sm rounded-lg bg-primary text-primary-foreground px-3 py-2 font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                    onClick={() => alert("Contact your institution administrator to change your plan.")}
                    aria-label={`Upgrade to ${plan.name} plan`}
                  >
                    Upgrade <ArrowRight size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Top-up packs */}
      <section className="space-y-4" aria-labelledby="packs-heading">
        <h2 id="packs-heading" className="font-semibold flex items-center gap-2"><Coins size={16} className="text-primary" /> Top-up packs</h2>
        <p className="text-sm text-muted-foreground">Need more credits before your monthly allowance resets? Add a one-time pack.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {packs.map(pack => (
            <div key={pack.name} className="rounded-2xl border border-border bg-card p-5 space-y-3 hover:border-primary/40 transition-colors">
              <p className="font-semibold capitalize">{pack.name}</p>
              <p className="text-2xl font-bold">{pack.credits} <span className="text-sm font-normal text-muted-foreground">credits</span></p>
              <p className="text-sm text-muted-foreground">{pack.price}</p>
              <button
                className="w-full text-sm rounded-lg border border-primary text-primary px-3 py-2 font-medium hover:bg-primary/5 transition-colors"
                onClick={() => alert("Paystack checkout coming soon. Your administrator can add credits via the billing portal.")}
                aria-label={`Buy ${pack.name} top-up pack`}
              >
                Buy pack
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Recent ledger */}
      {recentLedger.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 space-y-2" aria-labelledby="ledger-heading">
          <h2 id="ledger-heading" className="font-semibold">Recent activity</h2>
          <div>
            {recentLedger.map((entry, i) => <LedgerRow key={i} entry={entry} />)}
          </div>
        </section>
      )}

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center pb-4">
        AI credits are reset at the start of each billing period. Top-up credits never expire.
        Contact your institution administrator for plan changes.
      </p>
    </main>
  );
}
