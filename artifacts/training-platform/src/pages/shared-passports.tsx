import { useEffect, useState } from "react";
import { FileUser, Lock } from "lucide-react";

type Org = { id: number; name: string; role: string; member?: boolean };
type ShareRow = { id: number; learnerName: string; purpose: string; scope: { id: string; label: string }[]; expiresAt: string; sharedAt: string };
type Passport = {
  learnerName: string; purpose: string; sharedAt: string; expiresAt: string; provenance: string;
  scope: { id: string; label: string }[];
  sections: {
    results?: { subject: string; level: string; institution: string; pct: number | null; results: number }[];
    learning_dna?: { concept: string; state: string; reviewedAt: string }[];
    skills?: { skill: string; category: string; masteryLevel: number; demonstration: string; description: string }[];
    verified_achievements?: { skill: string; verifiedBy: string; verifiedAt: string | null }[];
    journey?: { stages: { institution: string; stage: string; year: number; source: string }[]; milestones: { title: string; kind: string; year: number; source: string }[] };
  };
};

async function api<T>(path: string): Promise<T> {
  const r = await fetch("/api" + path, { credentials: "include", cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? (r.status === 403 ? "Only owners and administrators of this institution can open shared passports." : r.status === 404 ? "This passport is no longer shared with you." : "Request failed. Please retry."));
  return j as T;
}
const STATE: Record<string, string> = { demonstrated: "Demonstrated", needs_practice: "Practising", not_attempted: "Not yet attempted", needs_review: "Awaiting review" };
const date = (s: string | null) => s ? new Date(s).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";

export default function SharedPassportsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]), [org, setOrg] = useState("");
  const [rows, setRows] = useState<ShareRow[] | null>(null), [open, setOpen] = useState<Passport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Org[]>("/organizations").then(list => {
      const mine = list.filter(o => o.member !== false && ["owner", "admin"].includes(o.role));
      setOrgs(mine); if (mine.length) setOrg(String(mine[0].id));
    }).catch(e => setError((e as Error).message));
  }, []);
  useEffect(() => {
    if (!org) return;
    setRows(null); setOpen(null); setError("");
    api<ShareRow[]>(`/organizations/${org}/shared-passports`).then(setRows).catch(e => setError((e as Error).message));
  }, [org]);

  async function view(id: number) {
    setError("");
    try { setOpen(await api<Passport>(`/organizations/${org}/shared-passports/${id}`)); } catch (e) { setError((e as Error).message); }
  }

  return <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
    <header>
      <p className="eyebrow">ADMISSIONS AND RECRUITMENT</p>
      <h1 className="font-display text-3xl">Passports shared with us</h1>
      <p className="mt-1 text-muted-foreground">Learners choose to share parts of their CABO passport with your institution, for a purpose and a period they set. You see only what they chose, they can stop at any time, and they see each time you open it.</p>
    </header>
    {error && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm">{error}</p>}
    {orgs.length === 0 && !error && <p className="rounded-lg border p-4 text-sm"><Lock size={14} className="inline" aria-hidden /> Sign in as an owner or administrator of a university, college or employer to see passports shared with it.</p>}
    {orgs.length > 1 && <label className="block text-sm">Institution
      <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" value={org} onChange={e => setOrg(e.target.value)}>
        {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select></label>}

    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <section aria-labelledby="list-h" className="space-y-2">
        <h2 id="list-h" className="font-display text-xl">Shared with you</h2>
        {rows?.length === 0 && <p className="text-sm text-muted-foreground">No learner has shared their passport with this institution yet.</p>}
        {rows?.map(r => <button key={r.id} onClick={() => view(r.id)} className="w-full rounded-lg border p-3 text-left text-sm hover:bg-muted/50" aria-label={`Open ${r.learnerName}'s shared passport`}>
          <strong className="flex items-center gap-2"><FileUser size={15} aria-hidden /> {r.learnerName}</strong>
          <span className="block text-muted-foreground">{r.purpose} · {r.scope.map(s => s.label).join(", ")}</span>
          <span className="block text-xs text-muted-foreground">Shared {date(r.sharedAt)} · until {date(r.expiresAt)}</span>
        </button>)}
      </section>

      {open && <section aria-labelledby="pp-h" className="rounded-xl border p-5 space-y-5">
        <div><h2 id="pp-h" className="font-display text-2xl">{open.learnerName}</h2>
          <p className="text-sm text-muted-foreground">Shared for {open.purpose} on {date(open.sharedAt)}, until {date(open.expiresAt)}.</p></div>
        {open.sections.results && <div><h3 className="font-semibold">Published results</h3>
          <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Subject</th><th>Institution</th><th className="text-right">Average</th></tr></thead>
            <tbody>{open.sections.results.map(r => <tr key={r.subject + r.institution} className="border-t"><td className="py-1">{r.subject} <span className="text-muted-foreground">({r.level})</span></td><td>{r.institution}</td><td className="text-right">{r.pct == null ? "—" : `${r.pct}%`} <span className="text-muted-foreground">({r.results})</span></td></tr>)}</tbody></table>
          {open.sections.results.length === 0 && <p className="text-sm text-muted-foreground">No published results yet.</p>}</div>}
        {open.sections.learning_dna && <div><h3 className="font-semibold">Learning DNA</h3>
          <ul className="mt-1 space-y-1 text-sm">{open.sections.learning_dna.map(d => <li key={d.concept}>{d.concept}: <strong>{STATE[d.state] ?? d.state}</strong> <span className="text-muted-foreground">({date(d.reviewedAt)})</span></li>)}</ul></div>}
        {open.sections.skills && <div><h3 className="font-semibold">Skills (self-reported)</h3>
          <ul className="mt-1 space-y-1 text-sm">{open.sections.skills.map(s => <li key={s.skill}><strong>{s.skill}</strong>, level {s.masteryLevel}/5, {s.demonstration}: {s.description}</li>)}</ul></div>}
        {open.sections.verified_achievements && <div><h3 className="font-semibold">Verified achievements</h3>
          <ul className="mt-1 space-y-1 text-sm">{open.sections.verified_achievements.map(a => <li key={a.skill + a.verifiedBy}>{a.skill}: verified by {a.verifiedBy} {a.verifiedAt ? `on ${date(a.verifiedAt)}` : ""}</li>)}</ul>
          {open.sections.verified_achievements.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}</div>}
        {open.sections.journey && <div><h3 className="font-semibold">Learning journey</h3>
          <ul className="mt-1 space-y-1 text-sm">{open.sections.journey.stages.map((s, i) => <li key={i}>{s.year}: {s.stage}, {s.institution}{s.source === "self_report" ? " (self-reported)" : ""}</li>)}
            {open.sections.journey.milestones.map((m, i) => <li key={"m" + i}>{m.year}: {m.title}{m.source === "self_report" ? " (self-reported)" : ""}</li>)}</ul></div>}
        <p className="text-xs text-muted-foreground">{open.provenance}</p>
      </section>}
    </div>
  </div>;
}
