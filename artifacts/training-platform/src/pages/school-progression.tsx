import {useEffect,useState} from "react";
type Org={id:number;name:string;role:string};
type Candidate={id:number;learnerId:string;stage:string;academicYear:number;nextGrade:string|null};
const field="w-full rounded-md border bg-background p-3 text-sm";
async function api<T>(path:string,method="GET",body?:object):Promise<T>{
 const response=await fetch("/api"+path,{method,credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
 if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||"Request failed")}
 return response.json();
}
export default function SchoolProgressionPage(){
 const [orgs,setOrgs]=useState<Org[]>([]),[org,setOrg]=useState(""),[year,setYear]=useState(new Date().getFullYear()),[rows,setRows]=useState<Candidate[]>([]),[error,setError]=useState(""),[message,setMessage]=useState(""),[saving,setSaving]=useState<number|null>(null);
 useEffect(()=>{api<Org[]>("/organizations").then(list=>{setOrgs(list.filter(x=>["owner","admin"].includes(x.role)));if(list.length)setOrg(String(list.find(x=>["owner","admin"].includes(x.role))?.id??""))}).catch(e=>setError(e.message))},[]);
 async function reload(){if(!org){setRows([]);return}setRows(await api<Candidate[]>("/organizations/"+org+"/progression/candidates?year="+year))}
 useEffect(()=>{reload().catch(e=>setError(e.message))},[org,year]);
 async function decide(row:Candidate,decision:"promote"|"repeat"){
  if(!window.confirm("Confirm "+decision+" for this learner in "+(year+1)+"? This creates a new enrolment and completes the previous year."))return;
  setSaving(row.id);setError("");setMessage("");
  try{await api("/organizations/"+org+"/progression/"+row.id,"POST",{decision,targetYear:year+1});await reload();setMessage("Learner "+row.learnerId+" recorded for "+(year+1))}catch(e){setError(e instanceof Error?e.message:"Progression failed")}finally{setSaving(null)}
 }
 return <section className="mx-auto max-w-5xl space-y-6 pb-16">
  <header className="space-y-2 border-b pb-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">CABO Academic Lifecycle</p><h1 className="font-display text-3xl sm:text-4xl">Year-end progression</h1><p className="max-w-3xl text-sm text-muted-foreground">Promote or repeat an enrolled learner into the following year without overwriting their previous results or development history. School administrators must confirm each decision; CABO does not make the promotion decision.</p></header>
  {error&&<p role="alert" className="rounded-md border border-destructive p-3">{error}</p>}{message&&<p role="status" className="rounded-md border p-3">{message}</p>}
  <div className="grid gap-3 rounded-xl border p-5 sm:grid-cols-2"><label className="text-sm">Institution<select className={field+" mt-1"} value={org} onChange={e=>setOrg(e.target.value)}><option value="">Select school</option>{orgs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="text-sm">Current year<input className={field+" mt-1"} type="number" min={2020} max={2200} value={year} onChange={e=>setYear(Number(e.target.value))}/></label></div>
  <section className="rounded-xl border p-5 space-y-4"><h2 className="font-display text-xl">Active enrolments</h2>{rows.length===0?<p className="text-sm text-muted-foreground">No eligible active school enrolments found for this school and year.</p>:rows.map(row=><article key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3"><div><p className="font-medium break-all">{row.learnerId}</p><p className="text-xs text-muted-foreground">Grade {row.stage} · {row.academicYear} → {row.nextGrade??"School completion"}</p></div><div className="flex flex-wrap gap-2">{row.nextGrade&&<button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={saving!==null} onClick={()=>decide(row,"promote")}>Promote to {row.nextGrade}</button>}<button disabled={saving!==null} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>decide(row,"repeat")}>Repeat grade</button></div></article>)}</section>
  <p className="text-xs text-muted-foreground">High-stakes promotion policies, reporting requirements, parent notifications and school-leaving certification require institution-approved workflows beyond this administrative pilot.</p>
 </section>;
}
