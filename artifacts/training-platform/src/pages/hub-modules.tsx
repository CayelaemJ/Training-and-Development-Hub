import {useEffect,useState} from "react";
import {Link} from "wouter";
type Org={id:number;name:string;role:string};
type RecordRow={id:number;title:string;description:string;startAt:string|null;endAt:string|null;subjectId:string|null;createdAt:string};
const modules=[
 {id:"academic_intervention",title:"Academic intelligence",description:"Create reviewable intervention and progress support records",read:"Scoped learning intervention records"},
 {id:"timetable",title:"Attendance & timetables",description:"Publish school and university schedule entries",read:"Timetable entries and scheduled activities"},
 {id:"family_meeting",title:"Parent Connect",description:"Arrange confidential guardian engagement meetings",read:"Individual meeting records"},
 {id:"credential",title:"Qualifications wallet",description:"Verified credentials need issuer signing and identity verification",read:"Credential records (issuance locked)"},
 {id:"bursary",title:"Career navigator & bursaries",description:"Capture bursary, learning and opportunity information",read:"Bursary and opportunity announcements"},
 {id:"sports",title:"Sports & extracurriculars",description:"Record institution teams, training activities and events",read:"Activities, teams and events"},
 {id:"assessment_blueprint",title:"Assessment studio",description:"Validated tests and approved exam templates require professional review",read:"Assessment blueprint records (issuance locked)"},
 {id:"university_module",title:"University registrar",description:"Plan faculties, modules and semester milestones",read:"Module registry entries"},
 {id:"talent_skill",title:"Talent passport",description:"Record candidate-specific development evidence with privacy safeguards",read:"Individual skill-development records"},
 {id:"governance_action",title:"Education command centre",description:"Track institution oversight and action items",read:"Institution administrative actions"},
 {id:"learning_resource",title:"Offline & multilingual content",description:"Catalogue approved educational resources and translations",read:"Published learning resource notices"},
 {id:"education_integration",title:"Institution integrations",description:"Inventory proposed APIs and controlled system connections",read:"Integration registration inventory"}
] as const;
type ModuleId=(typeof modules)[number]["id"];
async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const r=await fetch("/api"+path,{credentials:"include",cache:"no-store",...init,headers:{"Content-Type":"application/json",...init?.headers}});
 if(!r.ok){const body=await r.json().catch(()=>({}));throw Error(body.error??"Unable to load the requested information")}
 return r.json();
}
export default function HubModulesPage(){
 const [orgs,setOrgs]=useState<Org[]>([]),[org,setOrg]=useState(""),[kind,setKind]=useState<ModuleId>("academic_intervention");
 const [rows,setRows]=useState<RecordRow[]>([]),[name,setName]=useState(""),[description,setDescription]=useState(""),[subjectId,setSubjectId]=useState(""),[date,setDate]=useState("");
 const [loading,setLoading]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const selected=orgs.find(o=>String(o.id)===org),manager=selected&&["owner","admin"].includes(selected.role);
 const m=modules.find(x=>x.id===kind)!;
 useEffect(()=>{api<Org[]>("/organizations").then(list=>{setOrgs(list);if(list.length)setOrg(String(list[0].id))}).catch(e=>setError(e.message))},[]);
 async function reload(){if(!org){setRows([]);return}setLoading(true);setError("");try{setRows(await api<RecordRow[]>("/organizations/"+org+"/hub-records?kind="+kind))}catch(e){setError(e instanceof Error?e.message:"Request failed")}finally{setLoading(false)}}
 useEffect(()=>{reload()},[org,kind]);
 async function add(){setWorking(true);setError("");setNotice("");try{
  await api("/organizations/"+org+"/hub-records",{method:"POST",body:JSON.stringify({kind,title:name,description,subjectId:subjectId||undefined,startAt:date?new Date(date+"T12:00:00Z").toISOString():undefined})});
  setName("");setDescription("");setSubjectId("");setDate("");await reload();setNotice("Institution record created");
 }catch(e){setError(e instanceof Error?e.message:"Could not create record")}finally{setWorking(false)}}
 const locked=kind==="credential"||kind==="assessment_blueprint";
 const sensitive=["academic_intervention","family_meeting","talent_skill"].includes(kind);
 return <section className="mx-auto max-w-6xl space-y-6 pb-16">
  <header className="space-y-2 border-b pb-5"><p className="text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">CABO · Connected Education</p><h1 className="font-display text-3xl sm:text-4xl">Institution hub</h1><p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">One connected workspace across academic intelligence, school operations, tertiary learning and careers. Each section respects institutional membership and individual record privacy.</p></header>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="group" aria-label="CABO development modules">{modules.map(module=><button key={module.id} onClick={()=>setKind(module.id)} aria-pressed={kind===module.id} className={"min-h-20 rounded-lg border p-3 text-left text-sm font-medium transition-colors "+(kind===module.id?"border-primary bg-primary/10":"bg-card hover:bg-muted")}>{module.title}</button>)}</div>
  {error&&<p role="alert" className="rounded-lg border border-destructive p-3 text-sm">{error}</p>}{notice&&<p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
  <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
   <section className="rounded-xl border p-5 space-y-4"><div className="space-y-1"><p className="text-xs uppercase tracking-wider text-muted-foreground">Institution module</p><h2 className="font-display text-2xl">{m.title}</h2><p className="text-sm text-muted-foreground">{m.description}</p></div>
    <label className="block text-sm font-medium">Institution<select className="mt-2 w-full rounded-md border bg-background p-3" value={org} onChange={e=>setOrg(e.target.value)}><option value="">Choose institution</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
    {kind==="timetable"&&<Link className="underline underline-offset-4 text-sm" href="/school-operations">View existing attendance tools</Link>}
    {kind==="sports"&&<Link className="underline underline-offset-4 text-sm" href="/sports-development">Open the sports development tracker</Link>}
    {kind==="talent_skill"&&<Link className="underline underline-offset-4 text-sm" href="/career-passport">Open private learner passport</Link>}
    {kind==="academic_intervention"&&<Link className="underline underline-offset-4 text-sm" href="/development-plan">Open learner development plans</Link>}
    {kind==="bursary"&&<Link className="underline underline-offset-4 text-sm" href="/career-passport">Open career opportunities</Link>}
    {kind==="governance_action"&&<Link className="underline underline-offset-4 text-sm" href="/governance">Open organisation governance</Link>}
    <div className="border-t pt-4 space-y-3"><h3 className="font-semibold">{m.read}</h3>{loading?<p aria-live="polite" className="text-sm">Loading authorised records…</p>:!rows.length?<p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">No records to display for this institution and module yet.</p>:rows.map(r=><article key={r.id} className="rounded-md border p-3"><div className="font-medium">{r.title}</div>{r.description&&<p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.description}</p>}{r.startAt&&<p className="text-xs text-muted-foreground mt-2">Scheduled {new Date(r.startAt).toLocaleDateString()}</p>}</article>)}</div>
   </section>
   <aside className="rounded-xl border p-5 space-y-4"><h2 className="font-display text-xl">Manage this module</h2>{locked?<p className="rounded-md border p-3 text-sm text-muted-foreground">Issuance is locked until accredited assessors, verified credentials, moderation and signed records are integrated. A prototype must not be mistaken for an official qualification or psychological report.</p>:manager?<div className="space-y-3">
    <label className="block text-sm">Record title<input className="mt-1 w-full rounded-md border bg-background p-3" maxLength={180} value={name} onChange={e=>setName(e.target.value)} placeholder="Enter a descriptive title"/></label>
    <label className="block text-sm">Details<textarea className="mt-1 w-full rounded-md border bg-background p-3" rows={4} maxLength={5000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    {sensitive&&<label className="block text-sm">Enrolled learner ID (required for individual records)<input className="mt-1 w-full rounded-md border bg-background p-3" value={subjectId} onChange={e=>setSubjectId(e.target.value)} placeholder="Enrolled learner account ID"/></label>}
    <label className="block text-sm">Optional date<input className="mt-1 w-full rounded-md border bg-background p-3" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <button disabled={working||name.trim().length<3||(sensitive&&!subjectId)} onClick={add} className="w-full rounded-md bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50">{working?"Saving…":"Create record"}</button>
   </div>:<p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">Only institution owners and administrators can create records. Your existing enrolment and role determine what you can view.</p>}
   <p className="text-xs leading-relaxed text-muted-foreground">Pilot functionality only. A record here does not automatically become an accredited award, a certified assessment result, a university transcript or a government report.</p></aside>
  </div>
 </section>;
}
