/** Browser origins accepted for credentialed requests must be explicitly trusted. */
export function trustedOrigins(env:NodeJS.ProcessEnv):Set<string>{
 const origins=(env.CABO_ALLOWED_ORIGINS??"").split(",").map(x=>x.trim()).filter(Boolean);
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
