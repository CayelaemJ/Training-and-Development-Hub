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


/**
 * Resolve OIDC callback origins only from an explicit public-origin allowlist.
 * An inbound Host or X-Forwarded-Host is NEVER an authorization grant.
 * TRUST_PROXY_HOPS=1 is required before accepting forwarded proxy headers.
 * This allows Cloudflare preview hosts to be configured individually without
 * making arbitrary header injection an OAuth redirect.
 */
export function trustedOidcRequestOrigin(
 headers:Record<string,string|string[]|undefined>,
 env:NodeJS.ProcessEnv
):string|null{
 const trusted=trustedOrigins(env);
 if(trusted.size===0)return null;
 const one=(value:string|string[]|undefined):string|null=>
   typeof value==="string"&&value.length>0&&!/[\s,\\/@?#]/.test(value)?value:null;
 const host=one(headers.host);
 const candidates:Array<{host:string|null;proto:string|null}>=[];
 if(env.TRUST_PROXY_HOPS==="1"){
   const forwardedHost=one(headers["x-forwarded-host"]);
   const forwardedProto=one(headers["x-forwarded-proto"]);
   if(forwardedHost && forwardedProto && (forwardedProto==="https"||forwardedProto==="http"))
     candidates.push({host:forwardedHost,proto:forwardedProto});
 }
 if(host){
   const directProto=env.NODE_ENV!=="production"&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)?"http":"https";
   candidates.push({host,proto:directProto});
 }
 for(const candidate of candidates){
   try{
     const url=new URL(candidate.proto+"://"+candidate.host);
     if(url.pathname!=="/"||url.search||url.hash||url.username||url.password)continue;
     if(trusted.has(url.origin))return url.origin;
   }catch{/* malformed Host headers are rejected */}
 }
 return null;
}

/** OAuth return destinations must remain a local path, never an external URL. */
export function safeOidcReturnPath(value:unknown):string {
 if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//")
   ||value.includes("\\")||/[\u0000-\u001f\u007f]/.test(value))return "/";
 try{
   const base="https://cabo-redirect.invalid";
   const parsed=new URL(value,base);
   if(parsed.origin!==base)return "/";
   return parsed.pathname+parsed.search+parsed.hash;
 }catch{return "/";}
}
