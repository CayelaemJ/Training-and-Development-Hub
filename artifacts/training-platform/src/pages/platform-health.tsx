import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Activity, AlertTriangle, CheckCircle2, CircleHelp, Clock3, LoaderCircle, RefreshCw, Server, Smartphone } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type State = "healthy" | "unavailable" | "disabled" | "configured" | "unconfigured" | "active" | "degraded" | "recent" | "stale" | "no_signal";
type Platform = { platform: string; version: string | null; lastSeenAt: string | null; ageSeconds: number | null; lastHttpStatus: number | null; state: State };
type Bucket = { bucket: string; requests: number; failures: number; averageLatencyMs: number; p95LatencyMs: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number | null; pricedRequests: number };
type Operation = Omit<Bucket, "bucket"> & { operation: string; lastRequestAt: string | null };
type Health = {
  observedAt: string; windowHours: number; telemetryReady: boolean;
  services: Record<string, { state: State; provider?: string; model?: string; liveProbe?: string }>;
  platforms: Platform[];
  ai: { series: Bucket[]; operations: Operation[]; costPricingConfigured: boolean; costMethod: string; rawPromptsStored: false };
};

const clientLabels: Record<string, string> = { web: "Web", ios: "iOS", android: "Android", windows: "Windows app" };
const serviceLabels: Record<string, string> = { api: "API service", database: "PostgreSQL", redis: "Redis rate limiter", groq: "Groq AI" };
const stateLabels: Record<State, string> = {
  healthy: "Healthy", unavailable: "Unavailable", disabled: "Not configured", configured: "Configured · probe on demand",
  unconfigured: "Not configured", active: "Recently active", degraded: "Server errors observed", recent: "Seen in last hour",
  stale: "No recent activity", no_signal: "No signal yet",
};
const stateStyles: Record<State, string> = {
  healthy: "text-emerald-700 dark:text-emerald-300", unavailable: "text-red-700 dark:text-red-300", disabled: "text-muted-foreground",
  configured: "text-amber-700 dark:text-amber-300", unconfigured: "text-red-700 dark:text-red-300", active: "text-emerald-700 dark:text-emerald-300",
  degraded: "text-red-700 dark:text-red-300", recent: "text-amber-700 dark:text-amber-300", stale: "text-muted-foreground", no_signal: "text-muted-foreground",
};
const money = (value: number | null | undefined) => value == null ? "Not priced" : `$${value.toFixed(4)}`;
const duration = (seconds: number | null) => seconds == null ? "Never reported" : seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
const hourLabel = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit" });

export default function PlatformHealthPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [smokeBusy, setSmokeBusy] = useState(false);
  const [smokeMessage, setSmokeMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/platform/health", { credentials: "include", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 403 ? "Platform superadmin access is required." : body.error ?? "Could not load monitoring data.");
      setHealth(body as Health); setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load monitoring data.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const totals = useMemo(() => {
    const rows = health?.ai.series ?? [];
    return rows.reduce((sum, row) => ({
      requests: sum.requests + row.requests,
      failures: sum.failures + row.failures,
      inputTokens: sum.inputTokens + row.inputTokens,
      outputTokens: sum.outputTokens + row.outputTokens,
      cost: sum.cost + (row.estimatedCostUsd ?? 0),
      priced: sum.priced + row.pricedRequests,
    }), { requests: 0, failures: 0, inputTokens: 0, outputTokens: 0, cost: 0, priced: 0 });
  }, [health]);

  async function probeGroq() {
    setSmokeBusy(true); setSmokeMessage("");
    try {
      const response = await fetch("/api/platform/mlops/smoke-test", { method: "POST", credentials: "include" });
      const result = await response.json();
      setSmokeMessage(response.ok ? `Groq replied in ${result.latencyMs} ms (${result.model}).` : result.error ?? "Provider check failed.");
      await refresh();
    } catch { setSmokeMessage("The Groq connection check could not complete."); }
    finally { setSmokeBusy(false); }
  }

  const rag = health?.ai.operations.find(item => item.operation === "material_qa");
  const displayState = (state: State) => <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${stateStyles[state]}`}>
    {state === "healthy" || state === "active" ? <CheckCircle2 size={15} /> : state === "unavailable" || state === "degraded" ? <AlertTriangle size={15} /> : <Clock3 size={15} />}
    {stateLabels[state]}
  </span>;

  return <main className="mx-auto max-w-7xl space-y-6 pb-12">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2"><p className="text-xs uppercase tracking-widest text-muted-foreground">Superadmin · operational monitoring</p><h1 className="font-display text-3xl sm:text-4xl">Platform health</h1><p className="max-w-3xl text-sm text-muted-foreground">Live service checks, privacy-safe client activity, AI reliability and recorded cost estimates. Refreshes every 30 seconds while this page is open.</p></div>
      <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{health ? `Checked ${new Date(health.observedAt).toLocaleTimeString()}` : "Waiting for first check"}</span><button type="button" onClick={() => { setLoading(true); void refresh(); }} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><RefreshCw size={15} /> Refresh</button></div>
    </header>

    {loading && !health ? <div className="flex items-center gap-2 rounded-xl border p-6 text-sm"><LoaderCircle className="animate-spin" size={18} /> Checking platform services…</div> : error && !health ? <p role="alert" className="rounded-xl border border-red-500/40 p-5 text-sm">{error}</p> : null}

    {health && <>
      {error && <p role="status" className="rounded-lg border border-amber-500/40 p-3 text-sm">Latest refresh failed; displaying the last successful snapshot. {error}</p>}
      {!health.telemetryReady && <p role="status" className="rounded-lg border border-amber-500/40 p-3 text-sm">Monitoring tables or columns are missing, or telemetry queries are unavailable. Apply `lib/db/migrations/20261114_platform_health_telemetry.sql`, then refresh.</p>}
      <section aria-label="Service health" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(health.services).map(([key, service]) => <article key={key} className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-medium">{serviceLabels[key] ?? key}</h2><Server size={17} className="text-muted-foreground" /></div>
          {displayState(service.state)}
          {key === "groq" && <p className="mt-2 break-all text-xs text-muted-foreground">{service.model} · live check is manual to avoid unnecessary provider calls</p>}
        </article>)}
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div><h2 className="font-display text-xl">iOS, Android, Windows and web clients</h2><p className="text-sm text-muted-foreground">Activity is reported from signed-in API requests. No user, school or device identifiers are stored. “Recently active” means a client contacted the API; it is not a full device-side UI test.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {health.platforms.map(platform => <article key={platform.platform} className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between"><h3 className="font-medium">{clientLabels[platform.platform] ?? platform.platform}</h3><Smartphone size={17} className="text-muted-foreground" /></div>
            {displayState(platform.state)}
            <p className="mt-2 text-xs text-muted-foreground">Version: {platform.version ?? "—"} · Last API activity: {duration(platform.ageSeconds)}</p>
            {platform.lastHttpStatus != null && <p className="mt-1 text-xs text-muted-foreground">Last server response: HTTP {platform.lastHttpStatus}</p>}
          </article>)}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="24 hour AI overview">
        {[
          ["AI requests", totals.requests.toLocaleString()], ["Failures", `${totals.failures.toLocaleString()} (${totals.requests ? ((totals.failures / totals.requests) * 100).toFixed(1) : "0.0"}%)`],
          ["Tokens", `${(totals.inputTokens + totals.outputTokens).toLocaleString()} total`], ["Recorded estimated spend", health.ai.costPricingConfigured && totals.priced ? money(totals.cost) : "Not priced"],
        ].map(([label, value]) => <article key={label} className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></article>)}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-xl border bg-card p-5">
          <h2 className="font-display text-xl">AI requests and failures</h2><p className="mb-4 text-sm text-muted-foreground">Hourly counts for the last 24 hours.</p>
          {health.ai.series.length ? <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={health.ai.series}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="bucket" tickFormatter={hourLabel} minTickGap={24} /><YAxis allowDecimals={false} /><Tooltip labelFormatter={value => new Date(String(value)).toLocaleString()} /><Area type="monotone" dataKey="requests" name="Requests" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.16} /><Area type="monotone" dataKey="failures" name="Failures" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.12} /></AreaChart></ResponsiveContainer></div> : <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">No AI requests recorded in the last 24 hours.</p>}
        </article>
        <article className="rounded-xl border bg-card p-5">
          <h2 className="font-display text-xl">AI latency</h2><p className="mb-4 text-sm text-muted-foreground">Hourly average and p95 model response time for the last 24 hours.</p>
          {health.ai.series.length ? <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={health.ai.series}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="bucket" tickFormatter={hourLabel} minTickGap={24} /><YAxis unit=" ms" /><Tooltip labelFormatter={value => new Date(String(value)).toLocaleString()} formatter={value => [`${Number(value).toLocaleString()} ms`]} /><Area type="monotone" dataKey="averageLatencyMs" name="Average" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.12} /><Area type="monotone" dataKey="p95LatencyMs" name="p95" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.1} /></AreaChart></ResponsiveContainer></div> : <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">No AI latency samples recorded in the last 24 hours.</p>}
        </article>
        <article className="rounded-xl border bg-card p-5">
          <h2 className="font-display text-xl">Estimated AI cost</h2><p className="mb-4 text-sm text-muted-foreground">Calculated from provider usage tokens and model-specific rates you configure.</p>
          {health.ai.costPricingConfigured ? health.ai.series.some(row => row.estimatedCostUsd != null) ? <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={health.ai.series}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="bucket" tickFormatter={hourLabel} minTickGap={24} /><YAxis tickFormatter={value => `$${Number(value).toFixed(3)}`} /><Tooltip labelFormatter={value => new Date(String(value)).toLocaleString()} formatter={value => [`$${Number(value).toFixed(6)}`, "Estimated cost"]} /><Area type="monotone" dataKey="estimatedCostUsd" name="Estimated cost" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.18} /></AreaChart></ResponsiveContainer></div> : <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">Rates are configured; no priced AI usage recorded yet.</p> : <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><CircleHelp size={20} /><p>Cost rates are not configured. Add `GROQ_MODEL_COST_RATES_JSON` using current rates for each model in Render to enable estimates.</p></div>}
          <p className="mt-2 text-xs text-muted-foreground">Estimated spend is not an invoice. Unpriced requests are excluded.</p>
        </article>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl">AI tools and RAG pipeline</h2><p className="text-sm text-muted-foreground">Aggregate health only; prompts, answers and learner records are never shown.</p></div><button type="button" disabled={smokeBusy || health.services.groq.state === "unconfigured"} onClick={probeGroq} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50">{smokeBusy ? <LoaderCircle className="animate-spin" size={15} /> : <Activity size={15} />}{smokeBusy ? "Checking Groq…" : "Run synthetic Groq check"}</button></div>
        {smokeMessage && <p role="status" className="rounded-md border p-3 text-sm">{smokeMessage}</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-4">Pipeline operation</th><th className="py-2 pr-4">Requests</th><th className="py-2 pr-4">Failures</th><th className="py-2 pr-4">Avg / p95 latency</th><th className="py-2 pr-4">Tokens</th><th className="py-2">Recorded estimate</th></tr></thead><tbody>{health.ai.operations.map(item => <tr key={item.operation} className="border-b last:border-0"><td className="py-3 pr-4 font-medium">{item.operation === "material_qa" ? "Material RAG Q&A" : item.operation.replaceAll("_", " ")}</td><td className="py-3 pr-4 tabular-nums">{item.requests}</td><td className="py-3 pr-4 tabular-nums">{item.failures}</td><td className="py-3 pr-4 tabular-nums">{item.averageLatencyMs} / {item.p95LatencyMs} ms</td><td className="py-3 pr-4 tabular-nums">{(item.inputTokens + item.outputTokens).toLocaleString()}</td><td className="py-3 tabular-nums">{item.pricedRequests ? money(item.estimatedCostUsd) : "Not priced"}</td></tr>)}{health.ai.operations.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No AI pipeline requests recorded in the last 24 hours.</td></tr>}</tbody></table></div>
        <div className="rounded-lg bg-muted/50 p-4 text-sm"><p className="font-medium">Where to exercise RAG</p><p className="mt-1 text-muted-foreground">Open <Link className="underline underline-offset-2" href="/materials">Study materials</Link>, choose an uploaded source, then use “Ask this material”. Successful and failed model calls appear above as Material RAG Q&amp;A after telemetry migrations are applied.</p>{rag && <p className="mt-2 text-xs text-muted-foreground">Last RAG call: {rag.lastRequestAt ? new Date(rag.lastRequestAt).toLocaleString() : "—"} · p95 {rag.p95LatencyMs} ms.</p>}</div>
      </section>

      <p className="text-xs text-muted-foreground">Operational data refreshes while this page is open. Client activity means a recent successful or failed API response from that app build, not an automated native UI test. Native UI/build checks remain in CI.</p>
    </>}
  </main>;
}
