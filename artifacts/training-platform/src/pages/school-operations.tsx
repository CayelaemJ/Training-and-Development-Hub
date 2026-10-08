import {useEffect,useState} from "react";
type Org={id:number;name:string;role:string};
type Notice={id:number;subject:string;message:string;audience:string;createdAt:string};
type Attendance={id:number;day:string;status:string;note:string};
async function req<T>(path:string,method="GET",body?:object):Promise<T>{const r=await fetch("/api"+path,{method,credentials:"include",headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error??"Request failed")}return r.json()}
const input="rounded-md border bg-background p-3 text-sm w-full";
const btn="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50";
export default function SchoolOperationsPage(){
 const [orgs,setOrgs]=useState<Org[]>([]),[org,setOrg]=useState(""),[notices,setNotices]=useState<Notice[]>([]),[attendance,setAttendance]=useState<Attendance[]>([]);
 const [subject,setSubject]=useState(""),[message,setMessage]=useState(""),[audience,setAudience]=useState("all");
 const [learnerId,setLearnerId]=useState(""),[day,setDay]=useState(new Date().toISOString().slice(0,10)),[status,setStatus]=useState("present");
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const selected=orgs.find(x=>String(x.id)===org),manager=!!selected&&["owner","admin"].includes(selected.role);
 useEffect(()=>{req<Org[]>("/organizations").then(rows=>{setOrgs(rows);if(rows.length)setOrg(String(rows[0].id))}).catch(e=>setError(e.message));req<Attendance[]>("/school/attendance/me").then(setAttendance).catch(e=>setError(e.message))},[]);
 const reload=async()=>{if(org)setNotices(await req<Notice[]>("/organizations/"+org+"/notices"))};
 useEffect(()=>{reload().catch(e=>setError(e.message))},[org]);
 const action=async(fn:()=>Promise<unknown>,msg:string)=>{setBusy(true);setError("");setNotice("");try{await fn();await reload();setNotice(msg)}catch(e){setError(e instanceof Error?e.message:"Request failed")}finally{setBusy(false)}};
 return <section className="mx-auto max-w-5xl space-y-6 pb-16">
  <header className="border-b pb-5 space-y-2"><p className="text-xs uppercase tracking-widest text-muted-foreground">CABO Education Operations</p><h1 className="font-display text-3xl sm:text-4xl">School communications & attendance</h1><p className="max-w-2xl text-muted-foreground">A scoped workspace for daily attendance, notices and school communication. Student histories remain restricted to the relevant institution or learner.</p></header>
  {error&&<p role="alert" className="rounded-lg border border-destructive p-3">{error}</p>}{notice&&<p role="status" className="rounded-lg border p-3">{notice}</p>}
  <label className="block text-sm font-medium">Institution<select className={input+" mt-2"} value={org} onChange={e=>setOrg(e.target.value)}><option value="">Choose institution</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  <div className="grid gap-4 lg:grid-cols-2">
   <section className="rounded-xl border p-5 space-y-3"><h2 className="font-display text-xl">Institution notices</h2>{notices.length===0?<p className="text-sm text-muted-foreground">No notices yet.</p>:notices.map(n=><article key={n.id} className="border-b py-3"><p className="font-semibold">{n.subject}</p><p className="text-sm whitespace-pre-wrap">{n.message}</p><p className="text-xs text-muted-foreground mt-1">{n.audience} · {new Date(n.createdAt).toLocaleDateString()}</p></article>)}</section>
   <section className="rounded-xl border p-5 space-y-3"><h2 className="font-display text-xl">My attendance history</h2>{attendance.length===0?<p className="text-sm text-muted-foreground">No personal attendance entries yet.</p>:attendance.map(a=><div className="flex gap-2 justify-between border-b py-2 text-sm" key={a.id}><span>{a.day}</span><span className="font-semibold capitalize">{a.status}</span></div>)}</section>
  </div>
  {manager&&<div className="grid gap-4 lg:grid-cols-2">
   <section className="rounded-xl border p-5 space-y-3"><h2 className="font-display text-xl">Publish notice</h2><input aria-label="Notice title" className={input} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Notice title"/><textarea aria-label="Notice message" className={input} value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="Write an announcement"/><select aria-label="Audience" className={input} value={audience} onChange={e=>setAudience(e.target.value)}>{["all","learners","staff"].map(x=><option key={x}>{x}</option>)}</select><button className={btn} disabled={busy||subject.length<3||message.length<10} onClick={()=>action(async()=>{await req("/organizations/"+org+"/notices","POST",{subject,message,audience});setSubject("");setMessage("")},"Notice published")}>Publish</button></section>
   <section className="rounded-xl border p-5 space-y-3"><h2 className="font-display text-xl">Record attendance</h2><p className="text-xs text-muted-foreground">School owner/admin only; learner must be a member of this institution.</p><input className={input} aria-label="Learner account ID" placeholder="Learner account ID" value={learnerId} onChange={e=>setLearnerId(e.target.value)}/><input className={input} aria-label="Attendance date" type="date" value={day} onChange={e=>setDay(e.target.value)}/><select className={input} aria-label="Attendance status" value={status} onChange={e=>setStatus(e.target.value)}>{["present","absent","late","excused"].map(x=><option key={x}>{x}</option>)}</select><button className={btn} disabled={busy||!learnerId} onClick={()=>action(()=>req("/organizations/"+org+"/attendance","POST",{learnerId,day,status}),"Attendance recorded")}>Save attendance</button></section>
  </div>}
 </section>
}
