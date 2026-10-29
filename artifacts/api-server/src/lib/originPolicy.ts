/** Browser origins accepted for credentialed requests must be explicitly trusted. */
export function trustedOrigins(env:NodeJS.ProcessEnv):Set<string>{
 const origins=(env.CABO_ALLOWED_ORIGINS??"").split(",").map(x=>x.trim()).filter(Boolean);
 if(env.RENDER_EXTERNAL_URL)origins.push(env.RENDER_EXTERNAL_URL);
 if(env.RAILWAY_PUBLIC_DOMAIN)origins.push("https://"+env.RAILWAY_PUBLIC_DOMAIN);
 if(env.NODE_ENV!=="production")origins.push("http://localhost:5173","http://127.0.0.1:5173");
 const valid=new Set<string>();
 for(const item of origins){try{const u=new URL(item);if((u.protocol==="https:"||(env.NODE_ENV!=="production"&&u.protocol==="http:"))&&u.username===""&&u.password===""&&u.pathname==="/"&&u.search===""&&u.hash==="")valid.add(u.origin)}catch{}}
 return valid;
}
export function permittedBrowserOrigin(origin:string|undefined,env:NodeJS.ProcessEnv){
 if(!origin)return true; // CLI/API calls without browser Origin use authentication; mutating browser calls always send Origin.
 return trustedOrigins(env).has(origin);
}


/** A cookie-backed browser mutation must prove its site. Native clients may omit these headers only when they send no cookies. */
export function permittedMutationOrigin(headers: { origin?: string; referer?: string; cookie?: string }, env: NodeJS.ProcessEnv): boolean {
  if (headers.origin !== undefined) return headers.origin.length > 0 && permittedBrowserOrigin(headers.origin, env);
  if (headers.referer !== undefined) {
    try { return trustedOrigins(env).has(new URL(headers.referer).origin); }
    catch { return false; }
  }
  return !headers.cookie?.trim();
}

/** Build OIDC origins only from an approved deployment origin matching request Host. */
export function oidcRequestOrigin(host: string | undefined, env: NodeJS.ProcessEnv): string | null {
  if (!host || !/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(host)) return null;
  const approved = trustedOrigins(env);
  if (env.NODE_ENV !== "production") {
    const port = env.PORT || "3000";
    if (/^[0-9]{1,5}$/.test(port) && Number(port) > 0 && Number(port) <= 65535) {
      approved.add("http://localhost:" + port);
      approved.add("http://127.0.0.1:" + port);
    }
  }
  for (const origin of approved) if (new URL(origin).host.toLowerCase() === host.toLowerCase()) return origin;
  return null;
}

/** Accept safe same-origin paths only; reject parser slash tricks and header injection. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/.test(value) || /%(?:2f|5c|0d|0a)/i.test(value)) return "/";
  try {
    const base = "https://auth-boundary.invalid";
    return new URL(value, base).origin === base ? value : "/";
  } catch { return "/"; }
}
