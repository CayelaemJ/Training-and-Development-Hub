// Small fetch helpers shared by the accountability, class chat and privacy pages.
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init?: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown }): Promise<T> {
  const r = await fetch("/api" + path, {
    credentials: "include",
    cache: "no-store",
    method: init?.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      // Lets the server suggest a country for schools that have not recorded one.
      "X-CABO-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, (data && typeof data.error === "string" && data.error) || (r.status === 404 ? "Not available to your account." : "Something went wrong. Try again."));
  return data as T;
}

export type SchoolOption = { id: number; name: string; role: string };

/** Schools the user belongs to, plus schools where they are a verified guardian. */
export async function mySchools(): Promise<SchoolOption[]> {
  const [orgs, children] = await Promise.all([
    api<{ id: number; name: string; role: string }[]>("/organizations").catch(() => []),
    api<{ organizationId: number; organization: string }[]>("/guardian/children").catch(() => []),
  ]);
  const out = new Map<number, SchoolOption>();
  for (const o of orgs) out.set(o.id, { id: o.id, name: o.name, role: o.role });
  for (const c of children) if (!out.has(c.organizationId)) out.set(c.organizationId, { id: c.organizationId, name: c.organization, role: "guardian" });
  return [...out.values()];
}

export function when(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
