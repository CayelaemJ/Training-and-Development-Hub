import { useCallback, useEffect, useState } from "react";

// Consent-based organization membership UI.
// - InvitationInbox: invitations addressed to the signed-in account's verified email.
// - PendingInvitations: open invitations a manager has sent (shows only what they typed).

type IncomingInvitation = { id: number; organizationId: number; organization: string; role: string; expiresAt: string };
type SentInvitation = { id: number; email: string; role: string; createdAt: string; expiresAt: string };

async function request<T>(path: string, init?: { method: "POST" | "DELETE"; body?: object }): Promise<T | null> {
  const r = await fetch("/api" + path, {
    credentials: "include",
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || "Request failed");
  }
  return r.status === 204 ? null : ((await r.json()) as T);
}

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

export function InvitationInbox({ onAccepted }: { onAccepted?: () => void }) {
  const [items, setItems] = useState<IncomingInvitation[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    // A failure here must not break the page (for example before the migration is applied).
    request<IncomingInvitation[]>("/organization-invitations").then(x => setItems(x ?? [])).catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);
  if (items.length === 0) return null;
  async function decide(id: number, decision: "accepted" | "declined") {
    setBusy(id);
    setError("");
    try {
      await request(`/organization-invitations/${id}/decision`, { method: "POST", body: { decision } });
      load();
      if (decision === "accepted") onAccepted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the invitation");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="rounded-xl border p-5 space-y-3" aria-labelledby="org-invitations-heading">
      <h2 id="org-invitations-heading" className="text-lg font-semibold">Invitations for you</h2>
      <p className="text-sm text-muted-foreground">
        Joining lets this organisation's managers see your name, email and the work you submit to it. You can decline.
      </p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-2">
        {items.map(i => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              <strong>{i.organization}</strong> invited you as <strong>{i.role}</strong>
              {formatDate(i.expiresAt) && <> · expires {formatDate(i.expiresAt)}</>}
            </span>
            <button disabled={busy === i.id} className="rounded-md bg-primary px-3 py-1 text-primary-foreground" onClick={() => decide(i.id, "accepted")} aria-label={`Accept invitation from ${i.organization}`}>Accept</button>
            <button disabled={busy === i.id} className="rounded-md border px-3 py-1" onClick={() => decide(i.id, "declined")} aria-label={`Decline invitation from ${i.organization}`}>Decline</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PendingInvitations({ organizationId, refreshKey }: { organizationId: number; refreshKey: number }) {
  const [items, setItems] = useState<SentInvitation[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    request<SentInvitation[]>(`/organizations/${organizationId}/invitations`).then(x => setItems(x ?? [])).catch(() => setItems([]));
  }, [organizationId]);
  useEffect(load, [load, refreshKey]);
  if (items.length === 0) return null;
  async function revoke(id: number) {
    setError("");
    try {
      await request(`/organizations/${organizationId}/invitations/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke the invitation");
    }
  }
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Open invitations</h3>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-1">
        {items.map(i => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span>{i.email} — {i.role} · expires {formatDate(i.expiresAt)}</span>
            <button className="rounded-md border px-2 py-0.5" onClick={() => revoke(i.id)} aria-label={`Revoke invitation for ${i.email}`}>Revoke</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
