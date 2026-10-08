import { useEffect, useState } from "react";

type Evidence={id:number;category:string;title:string;description:string;source:string};
type Profile={headline:string;about:string;aspirations:string};
type Access={id:number;organization:string;purpose:string;scope:string;status:string;expiresAt:string|null};
type Opportunity={id:number;title:string;kind:string;organization:string;description:string};
type Org={id:number;name:string;role:string};
async function api<T>(path:string,method="GET",body?:object):Promise<T>{
 const r=await fetch("/api"+path,{method,credentials:"include",headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
 if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"Request failed");}
 return r.status===204?undefined as T:r.json();
}
const input="rounded-md border bg-background p-2 text-sm";
const btn="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50";
export default function PotentialPage(){
 const [profile,P]=useState<Profile>({headline:"",about:"",aspirations:""});
 const [evidence,E]=useState<Evidence[]>([]),[access,A]=useState<Access[]>([]),[opportunities,O]=useState<Opportunity[]>([]),[orgs,G]=useState<Org[]>([]);
 const [kind,K]=useState("skill"),[title,T]=useState(""),[description,D]=useState("");
 const [orgId,OI]=useState(""),[personId,PI]=useState(""),[purpose,PU]=useState(""),[scope,SC]=useState("professional");
 const [jobTitle,JT]=useState(""),[jobType,JY]=useState("internship"),[jobDescription,JD]=useState("");
 const [busy,B]=useState(false),[error,F]=useState(""),[note,N]=useState("");
 const refresh=async()=>{
  const [own,requests,offers,organizations]=await Promise.all([
   api<{profile:Profile;evidence:Evidence[]}>("/potential/me"),
   api<Access[]>("/potential/access-requests"),
   api<Opportunity[]>("/opportunities"),
   api<Org[]>("/organizations")
  ]);
  P(own.profile);E(own.evidence);A(requests);O(offers);G(organizations);
 };
 useEffect(()=>{refresh().catch(e=>F(e.message))},[]);
 const run=async(action:()=>Promise<unknown>,message:string)=>{
  B(true);F("");N("");
  try{await action();await refresh();N(message)}
  catch(e){F(e instanceof Error?e.message:"Request failed")}
  finally{B(false)}
 };
 const employerOrgs=orgs.filter(o=>["owner","admin"].includes(o.role));
 return <section className="mx-auto max-w-6xl space-y-6 pb-16">
  <header><p className="text-sm uppercase tracking-widest text-muted-foreground">CABO Potential &amp; Opportunity</p><h1 className="text-3xl font-semibold">My development journey</h1><p className="text-muted-foreground">You control your profile, interests and achievements. Nothing here is a personality diagnosis or hiring score.</p></header>
  {error&&<p role="alert" className="rounded-md border border-destructive p-3">{error}</p>}
  {note&&<p role="status" className="rounded-md border p-3">{note}</p>}
  <section className="rounded-xl border p-5 space-y-3"><h2 className="text-lg font-semibold">My potential profile</h2>
   <label className="block text-sm">Profile headline<input className={input+" mt-1 w-full"} maxLength={180} value={profile.headline} onChange={e=>P({...profile,headline:e.target.value})}/></label>
   <label className="block text-sm">About me<textarea className={input+" mt-1 w-full"} rows={3} value={profile.about} onChange={e=>P({...profile,about:e.target.value})}/></label>
   <label className="block text-sm">My goals and interests<textarea className={input+" mt-1 w-full"} rows={3} value={profile.aspirations} onChange={e=>P({...profile,aspirations:e.target.value})}/></label>
   <button disabled={busy} className={btn} onClick={()=>run(()=>api("/potential/me","PUT",profile),"Profile saved")}>Save my profile</button>
  </section>
  <section className="rounded-xl border p-5 space-y-3"><h2 className="text-lg font-semibold">My strengths, skills and evidence</h2>
   <p className="text-sm text-muted-foreground">Entries are self-reported unless separately verified. Describe actual examples of your work and development.</p>
   <div className="grid gap-2 sm:grid-cols-2">{evidence.map(e=><div className="rounded-md border p-3 space-y-1" key={e.id}><p className="text-xs uppercase tracking-wide text-muted-foreground">{e.category.replaceAll("_"," ")} · {e.source.replaceAll("_"," ")}</p><p className="font-medium">{e.title}</p><p className="whitespace-pre-wrap text-sm">{e.description}</p><button className="text-sm underline" disabled={busy} onClick={()=>run(()=>api("/potential/evidence/"+e.id,"DELETE"),"Entry removed")}>Remove</button></div>)}</div>
   <select className={input} aria-label="Evidence type" value={kind} onChange={e=>K(e.target.value)}>{["skill","strength","growth_area","project","achievement","interest","reflection"].map(k=><option key={k} value={k}>{k.replaceAll("_"," ")}</option>)}</select>
   <input className={input+" w-full"} placeholder="Evidence title" aria-label="Evidence title" value={title} onChange={e=>T(e.target.value)}/>
   <textarea className={input+" w-full"} rows={3} placeholder="What did you do? What did you learn?" aria-label="Evidence description" value={description} onChange={e=>D(e.target.value)}/>
   <button className={btn} disabled={busy||title.trim().length<2||description.trim().length<10} onClick={()=>run(async()=>{await api("/potential/evidence","POST",{category:kind,title,description});T("");D("")},"Development evidence recorded")}>Add evidence</button>
  </section>
  <section className="rounded-xl border p-5 space-y-3"><h2 className="text-lg font-semibold">Who wants to view my profile?</h2>
   <p className="text-sm text-muted-foreground">Employer access starts as pending. You choose to approve or deny it. Approved access expires after seven days and can be revoked.</p>
   {access.length===0?<p className="text-sm text-muted-foreground">No access requests.</p>:access.map(a=><div key={a.id} className="rounded-md border p-3"><p className="font-medium">{a.organization} · {a.scope} · {a.status}</p><p className="text-sm">{a.purpose}</p>{a.expiresAt&&<p className="text-xs text-muted-foreground">Expires {new Date(a.expiresAt).toLocaleString()}</p>}<div className="mt-2 flex gap-2">{a.status==="pending"&&<><button disabled={busy} className={btn} onClick={()=>run(()=>api("/potential/access-requests/"+a.id+"/decision","POST",{decision:"approved"}),"Access approved for seven days")}>Approve</button><button disabled={busy} className="rounded-md border px-3 py-2" onClick={()=>run(()=>api("/potential/access-requests/"+a.id+"/decision","POST",{decision:"denied"}),"Request denied")}>Deny</button></>}{a.status==="approved"&&<button disabled={busy} className="rounded-md border px-3 py-2" onClick={()=>run(()=>api("/potential/access-requests/"+a.id+"/decision","POST",{decision:"revoked"}),"Access revoked")}>Revoke</button>}</div></div>)}
  </section>
  <section className="rounded-xl border p-5 space-y-3"><h2 className="text-lg font-semibold">Opportunities</h2><p className="text-sm text-muted-foreground">Explore without algorithmic labels or hidden compatibility scores. Contact and application workflows will be added next.</p>
   {opportunities.length===0?<p className="text-sm text-muted-foreground">No opportunities published yet.</p>:opportunities.map(o=><div key={o.id} className="border-b py-3"><p className="font-semibold">{o.title}</p><p className="text-xs text-muted-foreground">{o.organization} · {o.kind.replaceAll("_"," ")}</p><p className="text-sm whitespace-pre-wrap">{o.description}</p></div>)}
  </section>
  {employerOrgs.length>0&&<section className="rounded-xl border p-5 space-y-4"><h2 className="text-lg font-semibold">Organization opportunity tools</h2><p className="text-sm text-muted-foreground">Only owners/admins can publish or request access. A subscription and billing entitlement check is not yet integrated: this is an internal pilot, not a paid-access launch.</p>
   <select aria-label="Organization" className={input} value={orgId} onChange={e=>OI(e.target.value)}><option value="">Choose organization</option>{employerOrgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>
   <div className="space-y-2"><h3 className="font-medium">Publish opportunity</h3>
    <input aria-label="Opportunity title" placeholder="Opportunity title" className={input+" w-full"} value={jobTitle} onChange={e=>JT(e.target.value)}/>
    <select aria-label="Opportunity category" className={input} value={jobType} onChange={e=>JY(e.target.value)}>{["job","internship","learnership","bursary","mentorship","university_programme"].map(k=><option key={k} value={k}>{k.replaceAll("_"," ")}</option>)}</select>
    <textarea aria-label="Opportunity description" className={input+" w-full"} rows={3} placeholder="Role, requirements and how applicants should proceed" value={jobDescription} onChange={e=>JD(e.target.value)}/>
    <button disabled={busy||!orgId||jobDescription.length<20||jobTitle.length<3} className={btn} onClick={()=>run(()=>api("/organizations/"+orgId+"/opportunities","POST",{title:jobTitle,kind:jobType,description:jobDescription}),"Opportunity published")}>Publish</button>
   </div>
   <div className="space-y-2 border-t pt-4"><h3 className="font-medium">Request consented profile access</h3>
    <p className="text-xs text-muted-foreground">You must already know the person's account ID through an appropriate relationship. There is no public search of private learner records.</p>
    <input aria-label="Person account ID" placeholder="Person account ID" className={input+" w-full"} value={personId} onChange={e=>PI(e.target.value)}/>
    <select aria-label="Data scope" className={input} value={scope} onChange={e=>SC(e.target.value)}><option value="professional">Professional strengths, achievements and interests</option><option value="portfolio">Projects, achievements and skills only</option></select>
    <textarea aria-label="Access purpose" placeholder="Specific recruitment or mentorship purpose" className={input+" w-full"} value={purpose} onChange={e=>PU(e.target.value)}/>
    <button disabled={busy||!orgId||!personId||purpose.trim().length<15} className={btn} onClick={()=>run(()=>api("/organizations/"+orgId+"/potential-access","POST",{personId,purpose,scope}),"Access request sent. No information was disclosed.")}>Send permission request</button>
   </div>
  </section>}
 </section>;
}
