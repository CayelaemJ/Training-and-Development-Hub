import { useEffect, useState } from "react";
import PassportTrustLayers from "./passport-trust-layers";

type Preferences={learningContext:string;preferredLanguage:string;learningGoal:string};
type EvidenceLink={id:number;provider:string;url:string;description:string;evidenceType:string;verificationStatus:string};
type Competency={id:number;skill:string;category:string;masteryLevel:number;demonstration:string;description:string;evidenceLinkId:number|null;verificationStatus:string};
type Passport={preferences:Preferences;links:EvidenceLink[];competencies:Competency[];masteryExplanations:string[]};
const field="w-full rounded-md border bg-background p-2 text-sm";
const primary="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50";
const contexts=[
 ["lifelong","Lifelong personal learning"],["adult_returning","Returning to education as an adult"],
 ["career_change","Preparing for a career change"],["professional","Professional development"],
 ["school","School learning"],["personal","Independent learning"]
];
const levels=[
 "0 — Not yet demonstrated (not a judgement of ability)",
 "1 — Exploring with guidance",
 "2 — Developing with some assistance",
 "3 — Independent demonstration",
 "4 — Applies the skill in new situations"
];
async function send<T>(path:string,method="GET",body?:object):Promise<T>{
 const response=await fetch("/api"+path,{method,credentials:"include",
  headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
 if(!response.ok){
  const data=await response.json().catch(()=>({error:"Please try again"}));
  throw new Error(typeof data.error==="string"?data.error:"Please try again");
 }
 return response.status===204?undefined as T:response.json();
}
export default function LifelongPassport(){
 const [prefs,P]=useState<Preferences>({learningContext:"lifelong",preferredLanguage:"",learningGoal:""});
 const [links,L]=useState<EvidenceLink[]>([]),[skills,S]=useState<Competency[]>([]);
 const [provider,PV]=useState(""),[url,U]=useState(""),[linkType,LT]=useState("portfolio"),[linkNote,LN]=useState("");
 const [skill,SK]=useState(""),[category,C]=useState("technical"),[level,LV]=useState(0),[method,M]=useState("practical"),[detail,D]=useState(""),[support,SU]=useState("");
 const [busy,B]=useState(false),[error,E]=useState(""),[message,N]=useState("");
 const refresh=async()=>{
  const data=await send<Passport>("/learning-passport/me");
  P(data.preferences);L(data.links);S(data.competencies);
 };
 useEffect(()=>{refresh().catch(e=>E(e instanceof Error?e.message:"Could not load your passport"))},[]);
 const act=async(operation:()=>Promise<unknown>,success:string)=>{
  B(true);E("");N("");
  try{await operation();await refresh();N(success)}
  catch(e){E(e instanceof Error?e.message:"Could not save the change")}
  finally{B(false)}
 };
 return <section className="rounded-xl border p-5 space-y-6" aria-labelledby="learning-passport-title">
  <header className="space-y-2">
   <p className="text-xs uppercase tracking-widest text-muted-foreground">CABO · Human potential for every age</p>
   <h2 className="text-2xl font-semibold" id="learning-passport-title">My Learning Passport</h2>
   <p className="text-sm text-muted-foreground">Your private record of goals, practical skills and work you can demonstrate. Marks and official qualifications are recorded separately. Self-reported evidence is not a verified certificate or intelligence score.</p>
  </header>
  {error&&<p className="rounded-md border border-destructive p-3 text-sm" role="alert">{error}</p>}
  {message&&<p className="rounded-md border p-3 text-sm" role="status">{message}</p>}
  <div className="space-y-3 border-b pb-6">
   <h3 className="font-semibold">My learning preferences</h3>
   <label className="block text-sm">What brings you here?
    <select className={field+" mt-1"} value={prefs.learningContext} onChange={e=>P({...prefs,learningContext:e.target.value})}>
     {contexts.map(([value,label])=><option value={value} key={value}>{label}</option>)}
    </select>
   </label>
   <label className="block text-sm">Preferred language (optional)
    <input className={field+" mt-1"} maxLength={24} value={prefs.preferredLanguage} onChange={e=>P({...prefs,preferredLanguage:e.target.value})} placeholder="For example: English or isiZulu"/>
   </label>
   <label className="block text-sm">What would you like to learn, complete or become?
    <textarea className={field+" mt-1"} maxLength={2000} rows={3} value={prefs.learningGoal} onChange={e=>P({...prefs,learningGoal:e.target.value})}/>
   </label>
   <button className={primary} disabled={busy} onClick={()=>act(()=>send("/learning-passport/preferences","PUT",prefs),"Learning preferences saved")}>Save preferences</button>
  </div>
  <div className="space-y-3 border-b pb-6">
   <h3 className="font-semibold">External evidence and connections</h3>
   <p className="text-sm text-muted-foreground">Add a GitHub repository, LinkedIn profile, video, community work, Facebook page or any public HTTPS portfolio. The address is stored privately, not scanned or shared with employers.</p>
   {links.length===0?<p className="text-sm text-muted-foreground">No links added yet.</p>:<div className="space-y-2">
    {links.map(link=><article key={link.id} className="rounded-md border p-3">
     <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
       <p className="font-medium">{link.provider} <span className="text-xs text-muted-foreground">· {link.evidenceType.replaceAll("_"," ")} · self-reported</span></p>
       <a href={link.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm underline">{link.url}</a>
       {link.description&&<p className="text-sm">{link.description}</p>}
      </div><button disabled={busy} className="text-sm underline" onClick={()=>act(()=>send("/learning-passport/links/"+link.id,"DELETE"),"Evidence link removed")}>Remove</button>
     </div>
    </article>)}
   </div>}
   <div className="grid gap-2 sm:grid-cols-2">
    <label className="text-sm">Website or platform<input className={field+" mt-1"} placeholder="GitHub, LinkedIn, personal site…" maxLength={80} value={provider} onChange={e=>PV(e.target.value)}/></label>
    <label className="text-sm">Evidence type<select className={field+" mt-1"} value={linkType} onChange={e=>LT(e.target.value)}>{["portfolio","project","social","learning","community","other"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   </div>
   <label className="block text-sm">Public HTTPS address<input className={field+" mt-1"} type="url" placeholder="https://…" maxLength={2048} value={url} onChange={e=>U(e.target.value)}/></label>
   <label className="block text-sm">What does this demonstrate?<textarea className={field+" mt-1"} rows={2} maxLength={2000} value={linkNote} onChange={e=>LN(e.target.value)}/></label>
   <button className={primary} disabled={busy||provider.trim().length<2||!url.startsWith("https://")} onClick={()=>act(async()=>{await send("/learning-passport/links","POST",{provider,url,description:linkNote,evidenceType:linkType});PV("");U("");LN("")},"Private evidence link added")}>Add evidence link</button>
  </div>
  <div className="space-y-3">
   <p className="text-xs uppercase tracking-widest text-muted-foreground">Layer 1 · Practical evidence</p><h3 className="font-semibold">Practical skills I can demonstrate</h3>
   <p className="text-sm text-muted-foreground">Describe work you really completed. Mastery levels describe the evidence for one skill only; they do not compare anyone's intelligence or potential. This is your self-assessment until a human review is available.</p>
   {skills.length===0?<p className="text-sm text-muted-foreground">No skills recorded yet.</p>:skills.map(item=><article key={item.id} className="rounded-md border p-3">
    <div className="flex justify-between gap-2"><div>
     <p className="font-medium">{item.skill}</p>
     <p className="text-xs text-muted-foreground">{item.category} · {levels[item.masteryLevel]??"Unrated"} · self-reported</p>
     <p className="mt-2 whitespace-pre-wrap text-sm">{item.description}</p>
     <p className="text-xs text-muted-foreground">Evidence: {item.demonstration.replaceAll("_"," ")}{item.evidenceLinkId?" · Linked source #"+item.evidenceLinkId:""}</p>
    </div><button className="text-sm underline" disabled={busy} onClick={()=>act(()=>send("/learning-passport/competencies/"+item.id,"DELETE"),"Skill removed")}>Remove</button></div>
   </article>)}
   <div className="grid gap-2 sm:grid-cols-2">
    <label className="text-sm">Skill<input className={field+" mt-1"} maxLength={120} value={skill} onChange={e=>SK(e.target.value)} placeholder="For example: building electrical circuits"/></label>
    <label className="text-sm">Skill category<select className={field+" mt-1"} value={category} onChange={e=>C(e.target.value)}>{["technical","academic","creative","vocational","transferable","other"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="text-sm">Evidence-based self-assessment<select className={field+" mt-1"} value={level} onChange={e=>LV(Number(e.target.value))}>{levels.map((x,i)=><option key={i} value={i}>{x}</option>)}</select></label>
    <label className="text-sm">How did you demonstrate it?<select className={field+" mt-1"} value={method} onChange={e=>M(e.target.value)}>{["practical","project","assessment","portfolio","work_example","reflection","other"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></label>
   </div>
   <label className="block text-sm">Supporting external evidence (optional)<select className={field+" mt-1"} value={support} onChange={e=>SU(e.target.value)}><option value="">No linked evidence</option>{links.map(x=><option key={x.id} value={x.id}>{x.provider} — {x.url.slice(0,70)}</option>)}</select></label>
   <label className="block text-sm">What did you make, solve, do or explain?<textarea className={field+" mt-1"} maxLength={3000} rows={3} value={detail} onChange={e=>D(e.target.value)}/></label>
   <button className={primary} disabled={busy||skill.trim().length<2||detail.trim().length<10} onClick={()=>act(async()=>{await send("/learning-passport/competencies","POST",{skill,category,masteryLevel:level,demonstration:method,description:detail,evidenceLinkId:support?Number(support):null});SK("");D("");SU("")},"Practical competency recorded privately")}>Record skill evidence</button>
  </div>
  <PassportTrustLayers competencies={skills} />
 </section>;
}
