import { useEffect, useState, type FormEvent } from "react";
import { Eye, Send, ShieldCheck, XCircle } from "lucide-react";

type Recipient = { id: number; name: string; kind: "higher_education" | "organisation" };
type Share = { id: number; recipient: string; purpose: string; scope: string[]; status: string; expiresAt: string; createdAt: string; views: number; lastViewedAt: string | null };
type Mine = { scopes: { id: string; label: string }[]; shares: Share[] };
type Pending = { id: number; childName: string; recipient: string; purpose: string; scope: string[]; expiresAt: string };

async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch("/api" + path, {
    credentials: "include", cache: "no-store",
    ...(body !== undefined ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? (r.status === 404 ? "Not available." : "Request failed. Please retry."));
  return j as T;
}
const PURPOSES: [string, string][] = [["admission", "University or college admission"], ["bursary", "Bursary or scholarship"], ["employment", "A job"], ["internship", "An internship or learnership"]];
const STATUS: Record<string, string> = { active: "Shared", pending_guardian: "Waiting for your parent or guardian", declined: "Declined by your parent or guardian", revoked: "Stopped", expired: "Expired" };
const date = (s: string) => new Date(s).toLocaleDateString(undefined, { dateStyle: "medium" });

export default function PassportSharingPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [mine, setMine] = useState<Mine | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [org, setOrg] = useState(""), [purpose, setPurpose] = useState("admission"), [days, setDays] = useState(90);
  const [scope, setScope] = useState<string[]>(["results", "learning_dna"]);
  const [message, setMessage] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);

  async function load() {
    const [r, m, p] = await Promise.all([api<Recipient[]>("/passport-shares/recipients"), api<Mine>("/passport-shares/me"), api<Pending[]>("/passport-shares/guardian/pending").catch(() => [])]);
    setRecipients(r); setMine(m); setPending(p);
  }
  useEffect(() => { load().catch(e => setError((e as Error).message)); }, []);

  async function share(e: FormEvent) {
    e.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const r = await api<{ status: string; notice: string | null }>("/passport-shares", { organizationId: Number(org), purpose, scope, days });
      setMessage(r.notice ?? "Shared. You can see every time they open it, and stop sharing at any time.");
      await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function act(path: string, body: unknown, done: string) {
    setError(""); setMessage("");
    try { await api(path, body); setMessage(done); await load(); } catch (err) { setError((err as Error).message); }
  }

  return <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
    <header>
      <p className="eyebrow">MY PASSPORT</p>
      <h1 className="font-display text-3xl">Share my passport</h1>
      <p className="mt-1 text-muted-foreground">Choose a university, college or employer and exactly what they may see. Nothing is shared until you do this, you can stop at any time, and you'll see every time they open it.</p>
    </header>
    {error && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm">{error}</p>}
    {message && <p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}

    {pending.length > 0 && <section className="rounded-xl border p-5 space-y-3" aria-labelledby="approve-h">
      <h2 id="approve-h" className="font-display text-xl flex items-center gap-2"><ShieldCheck size={18} aria-hidden /> Waiting for your approval</h2>
      <p className="text-sm text-muted-foreground">Your child wants to share part of their passport. Nothing is shared until you approve.</p>
      {pending.map(p => <article key={p.id} className="rounded-lg border p-4 space-y-2">
        <p><strong>{p.childName}</strong> wants to share with <strong>{p.recipient}</strong> for {PURPOSES.find(x => x[0] === p.purpose)?.[1].toLowerCase() ?? p.purpose}, until {date(p.expiresAt)}.</p>
        <ul className="list-disc pl-5 text-sm">{p.scope.map(s => <li key={s}>{s}</li>)}</ul>
        <div className="flex gap-2">
          <button className="button button-small" onClick={() => act(`/passport-shares/${p.id}/guardian-decision`, { decision: "approve" }, "Approved. The institution can now see what your child chose.")}>Approve</button>
          <button className="button button-outline button-small" onClick={() => act(`/passport-shares/${p.id}/guardian-decision`, { decision: "decline" }, "Declined. Nothing was shared.")}>Decline</button>
        </div>
      </article>)}
    </section>}

    <form onSubmit={share} className="rounded-xl border p-5 space-y-4" aria-labelledby="share-h">
      <h2 id="share-h" className="font-display text-xl flex items-center gap-2"><Send size={18} aria-hidden /> Share with an institution</h2>
      <label className="block text-sm">Who should see it?
        <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" value={org} onChange={e => setOrg(e.target.value)} required>
          <option value="">Choose a university, college or employer</option>
          {recipients.map(r => <option key={r.id} value={r.id}>{r.name}{r.kind === "higher_education" ? " (higher education)" : ""}</option>)}
        </select>
      </label>
      <label className="block text-sm">What for?
        <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" value={purpose} onChange={e => setPurpose(e.target.value)}>
          {PURPOSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1">What may they see?</legend>
        {(mine?.scopes ?? []).map(s => <label key={s.id} className="flex items-center gap-2">
          <input type="checkbox" checked={scope.includes(s.id)} onChange={e => setScope(cur => e.target.checked ? [...cur, s.id] : cur.filter(x => x !== s.id))} /> {s.label}
        </label>)}
      </fieldset>
      <label className="block text-sm">For how long? <strong>{days} days</strong>
        <input type="range" min={7} max={365} step={1} value={days} onChange={e => setDays(Number(e.target.value))} className="mt-1 w-full" aria-valuetext={`${days} days`} />
      </label>
      <button className="button" disabled={busy || !org || scope.length === 0}>{busy ? "Sharing…" : "Share"}</button>
    </form>

    <section className="space-y-3" aria-labelledby="mine-h">
      <h2 id="mine-h" className="font-display text-xl">Who can see my passport</h2>
      {mine && mine.shares.length === 0 && <p className="text-sm text-muted-foreground">No one. You haven't shared your passport yet.</p>}
      {mine?.shares.map(s => <article key={s.id} className="rounded-lg border p-4 space-y-1 text-sm">
        <p className="flex flex-wrap items-center gap-2"><strong className="text-base">{s.recipient}</strong><span className="rounded-full border px-2 py-0.5 text-xs">{STATUS[s.status] ?? s.status}</span></p>
        <p>{s.scope.map(x => mine.scopes.find(y => y.id === x)?.label ?? x).join(" · ")}</p>
        <p className="text-muted-foreground flex items-center gap-1"><Eye size={14} aria-hidden /> Opened {s.views} {s.views === 1 ? "time" : "times"}{s.lastViewedAt ? `, last on ${date(s.lastViewedAt)}` : ""} · until {date(s.expiresAt)}</p>
        {(s.status === "active" || s.status === "pending_guardian") && <button className="button button-outline button-small mt-1 inline-flex items-center gap-1" onClick={() => act(`/passport-shares/${s.id}/revoke`, {}, "Stopped. They can no longer see your passport.")}><XCircle size={14} aria-hidden /> Stop sharing</button>}
      </article>)}
    </section>
  </div>;
}
