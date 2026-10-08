import {useEffect,useState} from "react";
import {Link} from "wouter";
type Portal={role:string;organizationIds:number[];scopes:{organizationId:number;unitId:number;role:string}[];summary:Record<string,number>;cards:{label:string;href:string}[]};
const roleCopy:Record<string,{title:string;description:string}>={
 superadmin:{title:"Platform command centre",description:"CABO test-platform oversight across institutions. Administrative scope is explicit, audited access still requires endpoint-specific permission checks."},
 executive:{title:"Education leadership",description:"Oversight for the institutions and reporting units assigned to your leadership role."},
 headmaster:{title:"School leadership",description:"Coordinate your school's governance, learning operations and authorised personnel."},
 teacher:{title:"Teaching desk",description:"Prepare materials, support learners and manage your permitted classes."},
 assessor:{title:"Assessment desk",description:"Review examination results and work through your assigned assessment responsibilities."},
 parent:{title:"Parent and guardian space",description:"Manage your family relationship invitations. Learner records remain private unless separately authorised."},
 learner:{title:"My learning space",description:"Track your progress, practise what you are studying and develop your long-term portfolio."}
};
export default function RoleHomePage(){
 const [portal,setPortal]=useState<Portal|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 const refresh=async()=>{setBusy(true);setError("");try{const r=await fetch("/api/portal/me",{credentials:"include",cache:"no-store"});if(!r.ok)throw Error("Could not load your permitted workspace");setPortal(await r.json())}catch(e){setError(e instanceof Error?e.message:"Unexpected error")}finally{setBusy(false)}};
 useEffect(()=>{refresh()},[]);
 if(busy)return <section className="rounded-xl border p-6" aria-live="polite">Preparing your authorised workspace…</section>;
 if(error)return <section className="rounded-xl border p-6 space-y-3"><p role="alert">{error}</p><button className="rounded-md border px-4 py-2" onClick={refresh}>Try again</button></section>;
 if(!portal)return null;
 const copy=roleCopy[portal.role]??roleCopy.learner;
 return <section className="space-y-6 pb-12">
  <header className="space-y-3 border-b pb-6"><p className="text-xs uppercase tracking-[.18em] text-muted-foreground">CABO / {portal.role.replaceAll("_"," ")}</p><h1 className="font-display text-3xl sm:text-5xl">{copy.title}</h1><p className="max-w-2xl text-muted-foreground leading-relaxed">{copy.description}</p></header>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Role summary">
   {Object.entries(portal.summary).map(([key,n])=><div className="rounded-xl border p-5" key={key}><p className="text-xs uppercase tracking-wide text-muted-foreground">{key.replace(/([A-Z])/g," $1")}</p><strong className="mt-2 block text-3xl tabular-nums">{n.toLocaleString()}</strong></div>)}
   {portal.role==="superadmin"&&<div className="rounded-xl border p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Platform authority</p><strong className="mt-2 block text-xl">Superadmin</strong><p className="mt-2 text-xs text-muted-foreground">Isolated test environment only</p></div>}
  </div>
  <div><h2 className="font-display text-2xl mb-3">Your workspaces</h2><div className="grid gap-3 sm:grid-cols-2">{portal.cards.map((c,i)=><Link key={c.href} href={c.href} className="group flex justify-between gap-3 rounded-xl border bg-card p-5 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><div><p className="text-xs text-muted-foreground">0{(i+1).toString()}</p><h3 className="mt-2 font-semibold">{c.label}</h3></div><span aria-hidden="true" className="text-xl group-hover:translate-x-1 transition-transform">↗</span></Link>)}</div></div>
  {portal.role==="superadmin"&&<p className="rounded-lg border p-4 text-sm text-muted-foreground">Superadmin covers the platform's administrative inventory and oversight. Sensitive learner data, guardian records and marks remain subject to privacy-specific endpoint rules and audit requirements.</p>}
 </section>
}
