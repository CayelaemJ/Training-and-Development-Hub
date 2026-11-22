import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert, UserRound } from "lucide-react";
import { api, mySchools, when, type SchoolOption } from "@/lib/schoolApi";

// Concerns and accountability. Anyone in a school (and school-verified
// guardians) can raise a concern. Each case has an owner and deadlines; missed
// deadlines move it up the school automatically and stay on the record.

type Kind = "safeguarding" | "conduct" | "data_incident" | "service" | "chat_report";
type CaseRow = {
  id: number; kind: Kind; severity: string; status: string; view: "full" | "reporter";
  escalationLevel: number; levelTitle: string; createdAt: string; resolvedAt: string | null;
  acknowledged?: boolean; summary?: string; assignedName?: string | null; reporterName?: string | null; subjectName?: string | null;
  acknowledgeDueAt?: string; resolveDueAt?: string; regulatorDueAt?: string | null; regulatorNotifiedAt?: string | null;
  overdue?: boolean; regulatorOverdue?: boolean; jurisdiction?: string;
};
type CaseDetail = CaseRow & { canHandle: boolean; events: { id: number; action: string; note: string; actorName: string; createdAt: string; fromLevel: number | null; toLevel: number | null }[] };
type Dashboard = {
  totals: { open: number; overdue: number; withoutOwner: number; regulatorOverdue: number };
  people: { userId: string; name: string; assigned: number; acknowledgedOnTime: number; resolvedOnTime: number; overdueNow: number; escalations: number; medianHoursToAcknowledge: number | null }[];
  regime: { country: string; law: string; rules: { breachRegulatorHours: { value: number; kind: string } } };
};

const kindLabels: Record<Kind, string> = {
  safeguarding: "Safeguarding concern (a child may be at risk)",
  conduct: "Conduct complaint (how someone behaved)",
  data_incident: "Data incident (personal information exposed or lost)",
  service: "Service problem (something at school is not working)",
  chat_report: "Class chat report",
};
const actionLabels: Record<string, string> = {
  created: "Raised", assigned: "Owner set", no_owner: "No one available at this level", acknowledge: "Acknowledged",
  start: "Work started", resolve: "Resolved", close: "Closed", reopen: "Reopened", note: "Note",
  escalated: "Escalated automatically", overdue_at_top: "Still overdue at the top level", regulator_notified: "Regulator notified",
};

function StatusPill({ c }: { c: CaseRow }) {
  const tone = c.overdue || c.regulatorOverdue ? "border-destructive text-destructive" : c.status === "resolved" || c.status === "closed" ? "border-emerald-600 text-emerald-700" : "";
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${tone}`}>{c.status.replace("_", " ")}{c.overdue ? " · overdue" : ""}</span>;
}

export default function AccountabilityPage() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [org, setOrg] = useState<number | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ kind: "safeguarding" as Kind, severity: "medium", summary: "" });
  const [note, setNote] = useState("");

  useEffect(() => { mySchools().then(s => { setSchools(s); if (s.length) setOrg(s[0].id); }).catch(() => setError("We could not load your schools.")); }, []);
  async function load(id = org) {
    if (!id) return;
    setError("");
    try {
      setCases(await api<CaseRow[]>(`/organizations/${id}/accountability/cases`));
      setDash(await api<Dashboard>(`/organizations/${id}/accountability/dashboard`).catch(() => null));
    } catch (e) { setError((e as Error).message); setCases([]); }
  }
  useEffect(() => { setDetail(null); load(); }, [org]);

  async function raise(e: FormEvent) {
    e.preventDefault(); if (!org) return;
    setBusy(true); setMessage(""); setError("");
    try {
      await api(`/organizations/${org}/accountability/cases`, { method: "POST", body: form });
      setForm({ ...form, summary: "" });
      setMessage("Thank you. Your concern has been recorded and given to a named person with a deadline to respond.");
      await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function open(id: number) {
    try { setDetail(await api<CaseDetail>(`/organizations/${org}/accountability/cases/${id}`)); } catch (e) { setError((e as Error).message); }
  }
  async function act(action: string) {
    if (!org || !detail) return;
    setBusy(true); setError("");
    try {
      await api(`/organizations/${org}/accountability/cases/${detail.id}/actions`, { method: "POST", body: { action, note } });
      setNote(""); await open(detail.id); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const school = schools.find(s => s.id === org);
  const staff = school && school.role !== "learner" && school.role !== "guardian";
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8" id="main-content">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Concerns &amp; accountability</p>
        <h1 className="font-display text-3xl">Raise a concern. See it handled.</h1>
        <p className="text-muted-foreground">Every concern gets a named owner and a deadline. If the deadline is missed, CABO moves it to the next level of the school automatically and keeps a permanent record.</p>
      </header>
      {schools.length > 1 && (
        <label className="block text-sm">School
          <select className="mt-1 block w-full rounded-md border p-2" value={org ?? ""} onChange={e => setOrg(Number(e.target.value))}>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm">{error}</p>}
      {message && <p role="status" className="rounded-md border border-emerald-600 p-3 text-sm">{message}</p>}

      {dash && (
        <section className="rounded-xl border p-5 space-y-4" aria-labelledby="acc-dash">
          <h2 id="acc-dash" className="font-display text-xl">How this school is responding</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Open", dash.totals.open], ["Overdue", dash.totals.overdue], ["Without an owner", dash.totals.withoutOwner], ["Regulator notice overdue", dash.totals.regulatorOverdue]].map(([l, v]) =>
              <div key={l as string} className="rounded-lg border p-4"><p className="text-xs uppercase text-muted-foreground">{l}</p><p className="text-3xl tabular-nums">{v}</p></div>)}
          </div>
          <p className="text-sm text-muted-foreground">Data incidents in {dash.regime.country}: notify the regulator within {dash.regime.rules.breachRegulatorHours.value} hours of becoming aware ({dash.regime.rules.breachRegulatorHours.kind === "statutory" ? "set by law" : "CABO's internal limit"}). {dash.regime.law}.</p>
          {dash.people.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left"><th className="py-2 pr-3 font-medium">Owner</th><th className="py-2 pr-3 font-medium">Cases</th><th className="py-2 pr-3 font-medium">Acknowledged on time</th><th className="py-2 pr-3 font-medium">Resolved on time</th><th className="py-2 pr-3 font-medium">Overdue now</th><th className="py-2 pr-3 font-medium">Missed deadlines</th><th className="py-2 pr-3 font-medium">Median hours to acknowledge</th></tr></thead>
            <tbody>{dash.people.map(p => <tr key={p.userId} className="border-t"><td className="py-2 pr-3">{p.name}</td><td className="py-2 pr-3 tabular-nums">{p.assigned}</td><td className="py-2 pr-3 tabular-nums">{p.acknowledgedOnTime}</td><td className="py-2 pr-3 tabular-nums">{p.resolvedOnTime}</td><td className="py-2 pr-3 tabular-nums">{p.overdueNow}</td><td className="py-2 pr-3 tabular-nums">{p.escalations}</td><td className="py-2 pr-3 tabular-nums">{p.medianHoursToAcknowledge ?? "—"}</td></tr>)}</tbody>
          </table></div>}
        </section>
      )}

      <section className="rounded-xl border p-5 space-y-3" aria-labelledby="acc-raise">
        <h2 id="acc-raise" className="font-display text-xl">Raise a concern</h2>
        <p className="text-sm text-muted-foreground">If a child is in immediate danger, call the police now (South Africa 10111, Botswana 999). Children and adults can call Childline free on 116 in both countries.</p>
        <form onSubmit={raise} className="space-y-3">
          <label className="block text-sm">What is it about?
            <select className="mt-1 block w-full rounded-md border p-2" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as Kind })}>
              {(["safeguarding", "conduct", ...(staff ? ["data_incident", "service"] : [])] as Kind[]).map(k => <option key={k} value={k}>{kindLabels[k]}</option>)}
            </select>
          </label>
          <label className="block text-sm">How serious?
            <select className="mt-1 block w-full rounded-md border p-2" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
              <option value="low">Low — can wait a few days</option><option value="medium">Medium — needs attention this week</option>
              <option value="high">High — needs attention today</option><option value="critical">Critical — needs attention within the hour</option>
            </select>
          </label>
          <label className="block text-sm">What happened? Only what is needed to act; do not include ID numbers or medical details.
            <textarea className="mt-1 block w-full rounded-md border p-2" rows={4} maxLength={2000} minLength={10} required value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
          </label>
          <button disabled={busy || !org} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Send to the school</button>
        </form>
      </section>

      <section className="space-y-3" aria-labelledby="acc-list">
        <h2 id="acc-list" className="font-display text-xl">Cases you can see</h2>
        {cases.length === 0 && <p className="text-sm text-muted-foreground">No cases yet.</p>}
        <ul className="space-y-2">
          {cases.map(c => (
            <li key={c.id} className="rounded-lg border p-4">
              <button className="w-full text-left" onClick={() => c.view === "full" && open(c.id)} aria-label={`Case ${c.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  {c.kind === "safeguarding" ? <ShieldAlert size={16} aria-hidden /> : c.overdue ? <AlertTriangle size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
                  <span className="font-semibold">{kindLabels[c.kind]}</span><StatusPill c={c} />
                  <span className="text-xs text-muted-foreground">{c.severity} · {c.levelTitle}</span>
                </div>
                {c.view === "full"
                  ? <p className="mt-1 text-sm">{c.summary}</p>
                  : <p className="mt-1 text-sm text-muted-foreground">You raised this. {c.acknowledged ? "Someone has picked it up." : "Waiting to be picked up."}</p>}
                {c.view === "full" && <p className="mt-1 text-xs text-muted-foreground"><UserRound size={12} className="inline" aria-hidden /> {c.assignedName ?? "No owner yet"} · <Clock3 size={12} className="inline" aria-hidden /> acknowledge by {when(c.acknowledgeDueAt)} · resolve by {when(c.resolveDueAt)}{c.regulatorDueAt ? ` · regulator by ${when(c.regulatorDueAt)}${c.regulatorNotifiedAt ? " (done)" : ""}` : ""}</p>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {detail && (
        <section className="rounded-xl border p-5 space-y-4" aria-labelledby="acc-detail">
          <h2 id="acc-detail" className="font-display text-xl">Case {detail.id}</h2>
          <p className="text-sm">{detail.summary}</p>
          <p className="text-xs text-muted-foreground">Raised by {detail.reporterName ?? "CABO (automatic)"}{detail.subjectName ? ` · about ${detail.subjectName}` : ""} · rules: {detail.jurisdiction === "UNSET" ? "strictest of South Africa and Botswana" : detail.jurisdiction}</p>
          {detail.canHandle && detail.status !== "closed" && (
            <div className="space-y-2">
              <textarea className="block w-full rounded-md border p-2 text-sm" rows={2} placeholder="What was done (needed to resolve, close, reopen or add a note)" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} />
              <div className="flex flex-wrap gap-2">
                {detail.status === "open" && <button disabled={busy} className="rounded-md bg-primary px-3 py-1 text-primary-foreground" onClick={() => act("acknowledge")}>Acknowledge</button>}
                {["open", "acknowledged"].includes(detail.status) && <button disabled={busy} className="rounded-md border px-3 py-1" onClick={() => act("start")}>Start work</button>}
                {["open", "acknowledged", "in_progress"].includes(detail.status) && <button disabled={busy} className="rounded-md border px-3 py-1" onClick={() => act("resolve")}>Resolve</button>}
                {detail.status === "resolved" && <button disabled={busy} className="rounded-md border px-3 py-1" onClick={() => act("close")}>Close</button>}
                {detail.status === "resolved" && <button disabled={busy} className="rounded-md border px-3 py-1" onClick={() => act("reopen")}>Reopen</button>}
                {detail.kind === "data_incident" && !detail.regulatorNotifiedAt && <button disabled={busy} className="rounded-md border px-3 py-1" onClick={() => act("regulator_notified")}>Record regulator notification</button>}
                <button disabled={busy} className="rounded-md border px-3 py-1" onClick={() => act("note")}>Add note</button>
              </div>
            </div>
          )}
          <ol className="space-y-2 border-l pl-4">
            {detail.events.map(e => (
              <li key={e.id} className="text-sm">
                <span className="font-semibold">{actionLabels[e.action] ?? e.action}</span> · {e.actorName} · <span className="text-muted-foreground">{when(e.createdAt)}</span>
                {e.toLevel !== null && e.fromLevel !== null && e.toLevel !== e.fromLevel ? <span className="text-muted-foreground"> · level {e.fromLevel} → {e.toLevel}</span> : null}
                {e.note && <p className="text-muted-foreground">{e.note}</p>}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">This history cannot be edited.</p>
        </section>
      )}
    </main>
  );
}
