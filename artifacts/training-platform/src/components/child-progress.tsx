import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Child progress for verified guardians. Data: GET /api/guardian/children and
// GET /api/guardian/progress/:learnerId. Every number here is computed on the
// server from PUBLISHED marks; class comparisons are aggregate-only.

type Child = { learnerId: string; learnerName: string; organizationId: number; organization: string; grade: string; academicYear: number };
type Trend = "improving" | "steady" | "declining" | "not_enough_data";
type Outlook = "on_track" | "watch" | "needs_support" | "not_enough_data";
type Standing =
  | { available: true; cohortSize: number; classAverage: number; band: "top_quarter" | "upper_middle" | "lower_middle" | "bottom_quarter"; differenceFromAverage: number }
  | { available: false; reason: string };
type Subject = {
  subject: string; terms: { period: string; percentage: number | null }[]; current: number | null; previous: number | null;
  change: number | null; trend: Trend; latestTerm: string | null; assessments: number; standing: Standing;
  outlook: { status: Outlook; reason: string };
};
type Progress = {
  learnerName: string; organization: string; grade: string; year: number;
  overall: { current: number | null; previous: number | null; change: number | null; trend: Trend; terms: { period: string; percentage: number | null }[] };
  outlook: { status: Outlook; reasons: string[] };
  subjects: Subject[];
  highlights: { strongest: string[]; mostImproved: { subject: string; change: number | null }[]; focusAreas: { subject: string; status: Outlook; reason: string }[] };
  attendance: { recordedDays: number; rate: number | null; recentRate: number | null; earlierRate: number | null; trend: Trend };
  recentResults: { subject: string; assessment: string; percentage: number; publishedAt: string }[];
  method: { minCohortForComparison: number; thresholds: { subjectSupportBelow: number; attendanceSupportBelow: number; trendStep: number }; notAPrediction: string };
};

async function get<T>(path: string): Promise<T> {
  const r = await fetch("/api" + path, { credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error(r.status === 403 ? "This child's progress is not available to your account at this school." : "Progress is unavailable right now.");
  return r.json();
}

const outlookCopy: Record<Outlook, { label: string; tone: string }> = {
  on_track: { label: "On track", tone: "border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" },
  watch: { label: "Worth watching", tone: "border-amber-600/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" },
  needs_support: { label: "Needs support", tone: "border-rose-600/40 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100" },
  not_enough_data: { label: "Not enough results yet", tone: "border-border bg-muted text-foreground" },
};
const bandCopy = { top_quarter: "Top quarter of the class", upper_middle: "Above the class middle", lower_middle: "Below the class middle", bottom_quarter: "Bottom quarter of the class" };

function TrendText({ trend, change }: { trend: Trend; change: number | null }) {
  if (trend === "not_enough_data" || change === null) return <span className="text-muted-foreground">First term</span>;
  const arrow = trend === "improving" ? "▲" : trend === "declining" ? "▼" : "▶";
  const words = trend === "improving" ? "up" : trend === "declining" ? "down" : "steady,";
  return <span><span aria-hidden="true">{arrow} </span>{words} {Math.abs(change)} pts</span>;
}
const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

export function ChildProgress({ onSelect }: { onSelect?: (child: Child) => void }) {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [selected, setSelected] = useState<Child | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    get<Child[]>("/guardian/children").then(list => {
      setChildren(list);
      if (list.length) { setSelected(list[0]); setYear(list[0].academicYear); }
    }).catch(() => setChildren([]));
  }, []);

  useEffect(() => {
    if (!selected) return;
    onSelect?.(selected);
    setBusy(true); setError(""); setData(null);
    get<Progress>(`/guardian/progress/${encodeURIComponent(selected.learnerId)}?organizationId=${selected.organizationId}&year=${year}`)
      .then(setData).catch(e => setError(e instanceof Error ? e.message : "Progress unavailable")).finally(() => setBusy(false));
  }, [selected, year]);

  if (children === null) return <section className="rounded-xl border p-5" aria-live="polite">Loading your children's progress…</section>;
  if (children.length === 0) return (
    <section className="rounded-xl border p-5 space-y-2" aria-labelledby="child-progress-heading">
      <h2 id="child-progress-heading" className="font-display text-xl">Your child's progress</h2>
      <p className="text-sm text-muted-foreground">Progress appears here after you accept your child's invitation and their school confirms you as their guardian.</p>
    </section>
  );

  const chartData = data?.overall.terms.filter(t => t.percentage !== null) ?? [];
  return (
    <section className="rounded-xl border p-5 space-y-5" aria-labelledby="child-progress-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="child-progress-heading" className="font-display text-xl">Your child's progress</h2>
          <p className="text-sm text-muted-foreground">Based on marks the school has published. Draft marks are never shown.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {children.length > 1 && (
            <label className="text-sm">Child
              <select className="mt-1 block rounded-md border bg-background p-2" value={`${selected?.learnerId}:${selected?.organizationId}`}
                onChange={e => { const c = children.find(x => `${x.learnerId}:${x.organizationId}` === e.target.value); if (c) setSelected(c); }}>
                {children.map(c => <option key={`${c.learnerId}:${c.organizationId}`} value={`${c.learnerId}:${c.organizationId}`}>{c.learnerName} — {c.organization}</option>)}
              </select>
            </label>
          )}
          <label className="text-sm">Year
            <input className="mt-1 block w-24 rounded-md border bg-background p-2" type="number" min={2020} max={2200} value={year} onChange={e => setYear(Number(e.target.value))} />
          </label>
        </div>
      </div>

      {busy && <p aria-live="polite" className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm">{error}</p>}

      {data && (
        <>
          <div className={`rounded-lg border p-4 ${outlookCopy[data.outlook.status].tone}`} role="status">
            <p className="text-xs uppercase tracking-wide">Outlook for {data.learnerName} · {data.organization} · Grade {data.grade}</p>
            <p className="text-lg font-semibold">{outlookCopy[data.outlook.status].label}</p>
            {data.outlook.reasons.length > 0 && <p className="text-sm">Because {data.outlook.reasons.join(" and ")}.</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Summary">
            <div className="rounded-lg border p-4"><p className="text-xs uppercase text-muted-foreground">Overall average</p><p className="text-3xl tabular-nums">{pct(data.overall.current)}</p><p className="text-sm"><TrendText trend={data.overall.trend} change={data.overall.change} /></p></div>
            <div className="rounded-lg border p-4"><p className="text-xs uppercase text-muted-foreground">Attendance</p><p className="text-3xl tabular-nums">{pct(data.attendance.rate)}</p><p className="text-sm">{data.attendance.recordedDays ? <>Last 20 days {pct(data.attendance.recentRate)}</> : "No days recorded yet"}</p></div>
            <div className="rounded-lg border p-4"><p className="text-xs uppercase text-muted-foreground">Strongest</p><p className="text-sm font-semibold">{data.highlights.strongest.join(", ") || "—"}</p></div>
            <div className="rounded-lg border p-4"><p className="text-xs uppercase text-muted-foreground">Most improved</p><p className="text-sm font-semibold">{data.highlights.mostImproved.map(m => `${m.subject} (+${m.change})`).join(", ") || "—"}</p></div>
          </div>

          {chartData.length >= 2 && (
            <figure className="space-y-2">
              <figcaption className="text-sm font-semibold">Overall average by term</figcaption>
              <div className="h-56 w-full" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tickLine={false} />
                    <YAxis domain={[0, 100]} tickLine={false} unit="%" />
                    <Tooltip formatter={v => `${v}%`} />
                    <Line type="monotone" dataKey="percentage" name="Overall" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="sr-only">{chartData.map(t => `${t.period}: ${t.percentage}%`).join("; ")}</p>
            </figure>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="mb-2 text-left font-semibold">Subjects</caption>
              <thead><tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-3">Subject</th>
                {data.overall.terms.map(t => <th scope="col" key={t.period} className="py-2 pr-3">{t.period}</th>)}
                <th scope="col" className="py-2 pr-3">Change</th>
                <th scope="col" className="py-2 pr-3">Compared with the class</th>
                <th scope="col" className="py-2">Outlook</th>
              </tr></thead>
              <tbody>
                {data.subjects.map(s => (
                  <tr key={s.subject} className="border-b align-top">
                    <th scope="row" className="py-2 pr-3 text-left font-medium">{s.subject}</th>
                    {s.terms.map(t => <td key={t.period} className="py-2 pr-3 tabular-nums">{pct(t.percentage)}</td>)}
                    <td className="py-2 pr-3"><TrendText trend={s.trend} change={s.change} /></td>
                    <td className="py-2 pr-3">{s.standing.available
                      ? <>{bandCopy[s.standing.band]} · class average {s.standing.classAverage}% ({s.standing.differenceFromAverage >= 0 ? "+" : ""}{s.standing.differenceFromAverage} pts)</>
                      : <span className="text-muted-foreground">{s.standing.reason}</span>}</td>
                    <td className="py-2"><span className="font-medium">{outlookCopy[s.outlook.status].label}</span><br /><span className="text-muted-foreground">{s.outlook.reason}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.subjects.length === 0 && <p className="text-sm text-muted-foreground">No published results for {data.year} yet.</p>}
          </div>

          {data.highlights.focusAreas.length > 0 && (
            <div className="space-y-1">
              <h3 className="font-semibold">Where to focus</h3>
              <ul className="list-disc pl-5 text-sm">{data.highlights.focusAreas.map(f => <li key={f.subject}><strong>{f.subject}</strong>: {f.reason}</li>)}</ul>
              <p className="text-sm text-muted-foreground">Talk to your child's teacher about support. These notes are a conversation starter, not a judgement.</p>
            </div>
          )}

          {data.recentResults.length > 0 && (
            <div className="space-y-1">
              <h3 className="font-semibold">Latest published results</h3>
              <ul className="text-sm">{data.recentResults.map((r, i) => <li key={i} className="flex justify-between border-b py-1"><span>{r.subject} — {r.assessment}</span><span className="tabular-nums">{Math.round(r.percentage)}% · {new Date(r.publishedAt).toLocaleDateString()}</span></li>)}</ul>
            </div>
          )}

          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">How this is calculated</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Only marks your child's school has published are used. Each term's result weights assessments the same way as the report card.</li>
              <li>A change of {data.method.thresholds.trendStep} points or more between terms counts as improving or declining.</li>
              <li>Subjects below {data.method.thresholds.subjectSupportBelow}% and attendance below {data.method.thresholds.attendanceSupportBelow}% are flagged, the same thresholds teachers see.</li>
              <li>Class comparisons use only the class average and which quarter of the class your child is in. They appear only when at least {data.method.minCohortForComparison} learners have results, and never show another child's marks or position.</li>
              <li>{data.method.notAPrediction}</li>
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
