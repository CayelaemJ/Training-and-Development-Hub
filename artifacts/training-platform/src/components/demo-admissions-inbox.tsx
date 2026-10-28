import { useEffect, useState } from "react";

type Application = { id: number; candidateId: string; programme: string; status: string };
const endpoint = "/api/platform/demo/admissions-inbox";

export function DemoAdmissionsInbox() {
  const [rows, setRows] = useState<Application[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    const response = await fetch(endpoint, { credentials: "include", cache: "no-store" });
    if ([401, 403, 503].includes(response.status)) { setRows(null); return; }
    if (!response.ok) throw new Error("Unable to load the demonstration inbox.");
    setRows(await response.json());
  }
  useEffect(() => { refresh().catch(() => setMessage("The demonstration inbox is unavailable.")); }, []);
  async function decide(id: number, action: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${endpoint}/${id}/decision`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? "This application changed. Refresh before trying again." : "Unable to update this demonstration application.");
      setMessage("Fictional status updated. No real university was contacted.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update the demonstration."); }
    finally { setBusy(false); }
  }
  if (rows === null) return null;
  return <section aria-labelledby="demo-admissions-title" className="rounded-xl border p-5 space-y-3">
    <h2 id="demo-admissions-title" className="font-display text-xl">Fictional university inbox</h2>
    <p className="text-sm text-muted-foreground">Synthetic applicants for CABO DEMO | University of Future Skills only. These statuses are demonstrations, not university receipts, admission offers or enrolments.</p>
    <button type="button" disabled={busy} className="rounded-md border px-3 py-2" onClick={() => refresh().catch(() => setMessage("Unable to refresh the inbox."))}>Refresh inbox</button>
    {message && <p role="status" className="text-sm">{message}</p>}
    {!rows.length && <p className="text-sm">No synthetic applications are ready for review.</p>}
    {rows.map(row => <article key={row.id} className="rounded-md border p-3 space-y-2">
      <h3 className="font-semibold break-words">{row.programme}</h3>
      <p className="text-sm break-all">{row.candidateId} · {row.status.replaceAll("_", " ")}</p>
      <div className="flex flex-wrap gap-2">{(row.status === "external_submission_recorded" ? ["under_review"] : row.status === "under_review" ? ["offer", "unsuccessful"] : []).map(action =>
        <button type="button" key={action} disabled={busy} className="rounded-md border px-3 py-2 disabled:opacity-50" onClick={() => decide(row.id, action)}>{action === "under_review" ? "Start fictional review" : action === "offer" ? "Record fictional offer" : "Record fictional decline"}</button>
      )}</div>
    </article>)}
  </section>;
}
