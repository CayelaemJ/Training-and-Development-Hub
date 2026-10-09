import {useEffect,useState} from "react";
type Org={id:number;name:string;role:string};
type Unit={id:number;parentId:number|null;name:string;type:string};
type Grant={id:number;unitId:number;userId:string;role:string};
type Hierarchy={owner:boolean;role:string;units:Unit[];grants:Grant[];mine:{unitId:number;role:string}[];canManage:boolean};
const types=["national","province","district","group","school","department","grade","class"];
const roles=["national_director","provincial_director","district_director","group_executive","governing_body_chair","headmaster","deputy_headmaster","head_of_department","grade_head","teacher","assessor","administrator"];
const title=(s:string)=>s.split("_").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ");
const field="w-full rounded-md border bg-background p-3 text-sm";
async function request<T>(path:string,method="GET",body?:object):Promise<T>{
 const r=await fetch("/api"+path,{method,credentials:"include",headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
 if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||"Request failed")}
 return r.status===204?undefined as T:r.json();
}
export default function GovernancePage(){
 const [orgs,setOrgs]=useState<Org[]>([]),[org,setOrg]=useState(""),[data,setData]=useState<Hierarchy|null>(null);
 const [name,setName]=useState(""),[type,setType]=useState("school"),[parent,setParent]=useState("");
 const [email,setEmail]=useState(""),[role,setRole]=useState("teacher"),[unit,setUnit]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{request<Org[]>("/organizations").then(list=>{setOrgs(list);if(list.length)setOrg(String(list[0].id))}).catch(e=>setError(e.message))},[]);
 const refresh=()=>org?request<Hierarchy>("/organizations/"+org+"/hierarchy").then(setData):Promise.resolve();
 useEffect(()=>{if(!org){setData(null);return}setData(null);refresh().catch(e=>setError(e.message))},[org]);
 const run=async(work:()=>Promise<unknown>,message:string)=>{setBusy(true);setError("");setNotice("");try{await work();await refresh();setNotice(message)}catch(e){setError(e instanceof Error?e.message:"Action failed")}finally{setBusy(false)}};
 const ordered=(data?.units??[]).slice().sort((a,b)=>types.indexOf(a.type)-types.indexOf(b.type)||a.id-b.id);
 const strongest=(data?.mine??[]).slice().sort((a,b)=>roles.indexOf(a.role)-roles.indexOf(b.role))[0];
 return <section className="mx-auto max-w-6xl space-y-6 pb-16">
  <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">CABO Education Governance</p><h1 className="font-display text-3xl sm:text-4xl">Your organisation, your responsibilities.</h1><p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">A structured chain of accountability. National and group leadership oversee organisational units; school leadership manages its school; educators work with assigned units. Learner records and guardian relationships remain private.</p></header>
  {error&&<p role="alert" className="rounded-md border border-destructive p-3">{error}</p>}
  {notice&&<p role="status" className="rounded-md border p-3">{notice}</p>}
  <div className="rounded-xl border p-5 space-y-3">
   <label className="block text-sm font-semibold" htmlFor="governance-org">Organisation</label>
   <select id="governance-org" className={field} value={org} onChange={e=>setOrg(e.target.value)}><option value="">Choose your organisation</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name} · {o.role}</option>)}</select>
   <p className="text-sm text-muted-foreground">{!data?"Choose a workspace to view its role-specific structure.":data.owner?"You own this organisation and can establish its governance structure.":strongest?`Your assigned responsibility: ${title(strongest.role)}`:"Your membership has no governance delegation. Your own learner and family information remains accessible in its dedicated pages."}</p>
  </div>
  {data&&<div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
   <section className="rounded-xl border p-5 space-y-4 min-w-0">
    <div><h2 className="font-display text-2xl">Leadership structure</h2><p className="text-sm text-muted-foreground">Showing only organisational units within your permitted scope.</p></div>
    {ordered.length===0?<p className="rounded-md border p-4 text-sm text-muted-foreground">No organisational levels have been set up for this workspace. An organisation owner can establish the top-level unit.</p>:
     <div className="space-y-2">{ordered.map(u=><div key={u.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-4 py-3"><div className="min-w-0"><p className="text-xs uppercase tracking-wide text-muted-foreground">{title(u.type)} · Unit {u.id}</p><p className="font-medium break-words">{u.name}</p><p className="text-xs text-muted-foreground">{u.parentId?"Reports to unit "+u.parentId:"Top-level unit"}</p></div><span className="text-xs text-muted-foreground">{data.grants.filter(g=>g.unitId===u.id).length} roles</span></div>)}</div>}
   </section>
   <section className="rounded-xl border p-5 space-y-4 min-w-0">
    <div><h2 className="font-display text-2xl">My responsibilities</h2><p className="text-sm text-muted-foreground">These are delegated access assignments, not personality or performance ratings.</p></div>
    {data.owner&&<p className="rounded-md border p-3 text-sm">Organisation owner. Root configuration and emergency governance administration.</p>}
    {data.mine.length===0&&!data.owner?<p className="text-sm text-muted-foreground">No management role is assigned to your account. Continue using your normal learner, educator or family workspace.</p>:data.mine.map((m,i)=><div key={i} className="border-b pb-3"><p className="font-semibold">{title(m.role)}</p><p className="text-sm text-muted-foreground">{ordered.find(u=>u.id===m.unitId)?.name??"Assigned unit"}</p></div>)}
    <h3 className="font-semibold">People assigned within my view</h3>
    {data.grants.length===0?<p className="text-sm text-muted-foreground">No management assignments visible yet.</p>:data.grants.map(g=><p key={g.id} className="border-b py-2 text-sm break-all">{title(g.role)} · {g.userId} · {ordered.find(u=>u.id===g.unitId)?.name??"Unit "+g.unitId}</p>)}
   </section>
  </div>}
  {data?.canManage&&<div className="grid gap-5 lg:grid-cols-2">
   <section className="rounded-xl border p-5 space-y-3"><h2 className="font-display text-xl">Add a reporting level</h2>
    <label className="block text-sm">Level name<input className={field+" mt-1"} maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Cape Town District"/></label>
    <label className="block text-sm">Level type<select className={field+" mt-1"} value={type} onChange={e=>setType(e.target.value)}>{types.map(t=><option key={t} value={t}>{title(t)}</option>)}</select></label>
    <label className="block text-sm">Reports to<select className={field+" mt-1"} value={parent} onChange={e=>setParent(e.target.value)}><option value="">Top level (organisation owner only)</option>{ordered.map(u=><option key={u.id} value={u.id}>{u.name} · {title(u.type)}</option>)}</select></label>
    <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={busy||name.trim().length<2} onClick={()=>run(()=>request("/organizations/"+org+"/hierarchy/units","POST",{name,type,parentId:parent?Number(parent):null}),"Reporting unit created")}>Create level</button>
   </section>
   <section className="rounded-xl border p-5 space-y-3"><h2 className="font-display text-xl">Delegate responsibility</h2><p className="text-sm text-muted-foreground">The person must already be registered and a member of this organisation. Higher or equal authority cannot be delegated by lower roles.</p>
    <label className="block text-sm">Existing member email<input type="email" className={field+" mt-1"} value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@example.org"/></label>
    <label className="block text-sm">Responsibility<select className={field+" mt-1"} value={role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r} value={r}>{title(r)}</option>)}</select></label>
    <label className="block text-sm">Unit<select className={field+" mt-1"} value={unit} onChange={e=>setUnit(e.target.value)}><option value="">Choose reporting unit</option>{ordered.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
    <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={busy||!unit||!email} onClick={()=>run(()=>request("/organizations/"+org+"/hierarchy/grants","POST",{unitId:Number(unit),role,email}),"Role assignment created")}>Assign role</button>
   </section>
  </div>}
  <section className="rounded-xl border p-5"><h2 className="font-display text-xl">How access is separated</h2><div className="mt-3 grid gap-4 sm:grid-cols-3 text-sm"><p><strong>Leadership</strong><span className="mt-1 block text-muted-foreground">Oversees assigned organisational levels and delegates only lower authority.</span></p><p><strong>Teachers and assessors</strong><span className="mt-1 block text-muted-foreground">Access their own assigned organisational unit. Student assessment permissions remain separately controlled.</span></p><p><strong>Learners and parents</strong><span className="mt-1 block text-muted-foreground">Use private development or invitation workflows. Neither receives automatic access to institutional records.</span></p></div></section>
 </section>
}
