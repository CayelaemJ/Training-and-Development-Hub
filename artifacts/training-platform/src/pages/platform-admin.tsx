import {useEffect,useState} from "react";
import {Link} from "wouter";
type Org={id:number;name:string};
type Event={id:number;action:string;organizationId:number|null;createdAt:string};
export default function PlatformAdminPage(){
 const [orgs,setOrgs]=useState<Org[]>([]),[events,setEvents]=useState<Event[]>([]);
 const [error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;Promise.all(["/platform/overview","/platform/audit"].map(async path=>{
  const r=await fetch("/api"+path,{credentials:"include",cache:"no-store"});
  if(!r.ok)throw Error(r.status===403?"You do not have platform superadmin permission":"Unable to load platform information");
  return r.json();
 })).then(([o,a])=>{if(live){setOrgs(o.organizations);setEvents(a)}}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
 return <section className="mx-auto max-w-6xl space-y-6 pb-12">
  <header className="space-y-2"><p className="text-xs uppercase tracking-widest text-muted-foreground">CABO platform administration</p><h1 className="font-display text-3xl sm:text-4xl">Superadmin command centre</h1><p className="max-w-3xl text-sm text-muted-foreground">Cross-institution administrative visibility in the isolated testing environment. Sensitive learner records remain governed by their dedicated authorisation rules.</p></header>
  {loading?<p aria-live="polite">Loading permitted platform data…</p>:error?<p role="alert" className="rounded-lg border p-4">{error}</p>:<div className="grid gap-5 lg:grid-cols-2">
   <section className="rounded-xl border bg-card p-5 space-y-3"><div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl">Organisations</h2><span className="text-sm tabular-nums">{orgs.length}</span></div><p className="text-sm text-muted-foreground">All organisational workspaces in the current isolated test database.</p>{orgs.length===0?<p className="rounded-md border p-4 text-sm">No organisations exist yet. Create a school or a governing organisation in Organisations.</p>:orgs.map(org=><div key={org.id} className="border-b py-3"><p className="font-medium">{org.name}</p><p className="text-xs text-muted-foreground">Organisation #{org.id}</p></div>)}<Link className="inline-block underline underline-offset-4 text-sm" href="/organizations">Manage organisations</Link></section>
   <section className="rounded-xl border bg-card p-5 space-y-3"><h2 className="font-display text-xl">Recent administrator activity</h2><p className="text-sm text-muted-foreground">Server-recorded elevated access events. These records support accountability, but are not yet a tamper-evident compliance archive.</p>{events.length===0?<p className="text-sm">No events yet.</p>:events.map(event=><div key={event.id} className="border-b py-3 text-sm"><p className="font-medium">{event.action.replaceAll("_"," ")}</p><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()} {event.organizationId!==null?"· Organisation "+event.organizationId:""}</p></div>)}</section>
  </div>}
 </section>
}
