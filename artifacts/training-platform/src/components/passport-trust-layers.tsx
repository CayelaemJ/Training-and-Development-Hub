import {useEffect,useState} from "react";

type Skill={id:number;skill:string;description:string};
type Reflection={id:number;competencyId:number;summary:string;practiceSuggestion:string;limitations:string;
 modelId:string;promptVersion:string;reviewState:string;createdAt:string;disclosure:string};
type Review={id:number;organizationId:number;competencyId:number;status:string;reviewerId:string|null;
 reviewNote:string|null;reviewedAt:string|null;requestedAt:string;revokeReason:string|null};
type Org={id:number;name:string;role:string};
type Layers={aiInterpretations:Reflection[];achievementReviews:Review[]};
type Capabilities={aiConfigured:boolean;humanReviewPilotEnabled:boolean};
const btn="rounded-md border px-3 py-2 text-sm disabled:opacity-50";
const primary="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50";
const input="w-full rounded-md border bg-background p-2 text-sm";
async function api<T>(path:string,method="GET",body?:object):Promise<T>{
 const response=await fetch("/api"+path,{method,credentials:"include",
  headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,cache:"no-store"});
 if(!response.ok){const error=await response.json().catch(()=>({error:"Please try again"}));
  throw Error(typeof error.error==="string"?error.error:"Please try again")}
 return response.status===204?undefined as T:response.json();
}
export default function PassportTrustLayers({competencies}: {competencies:Skill[]}){
 const [interpretations,I]=useState<Reflection[]>([]),[reviews,R]=useState<Review[]>([]),[orgs,O]=useState<Org[]>([]);
 const [organizationId,OI]=useState(""),[competencyId,CI]=useState("");
 const [busy,B]=useState(false),[notice,N]=useState(""),[error,E]=useState("");
 const [pilot,SET_PILOT]=useState(false);
 const skillName=(id:number)=>competencies.find(x=>x.id===id)?.skill??"Evidence #"+id;
 const orgName=(id:number)=>orgs.find(x=>x.id===id)?.name??"Institution #"+id;
 const learnerOrgs=orgs.filter(o=>o.role==="learner");
 async function load(){
  const [layers,organizations,capabilities]=await Promise.all([
   api<Layers>("/learning-passport/trust-layers/me"),
   api<Org[]>("/organizations"),
   api<Capabilities>("/learning-passport/trust-layers/capabilities")
  ]);
  I(layers.aiInterpretations);R(layers.achievementReviews);O(organizations);SET_PILOT(capabilities.humanReviewPilotEnabled);
 }
 useEffect(()=>{load().catch(e=>E(e instanceof Error?e.message:"Could not load passport reviews"))},[]);
 async function act(task:()=>Promise<unknown>,message:string){
  B(true);E("");N("");
  try{await task();await load();N(message)}
  catch(e){E(e instanceof Error?e.message:"Something went wrong")}
  finally{B(false)}
 }
 return <div className="space-y-6" aria-label="Learning Passport trust layers">
  {error&&<p role="alert" className="rounded-md border border-destructive p-3 text-sm">{error}</p>}
  {notice&&<p role="status" className="rounded-md border p-3 text-sm">{notice}</p>}
  <section className="space-y-3 border-t pt-6" aria-labelledby="passport-ai-layer">
   <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Layer 2 · AI interpretation</p>
    <h3 className="text-lg font-semibold" id="passport-ai-layer">Optional AI learning reflections</h3></div>
   <p className="text-sm text-muted-foreground">You choose if CABO analyses a practical example. An AI reflection is a suggestion, not proof of skill, an official grade, an accredited qualification, a hiring judgement or a human review. You can dispute its interpretation.</p>
   <label className="block text-sm">Choose practical evidence for an optional reflection
    <select className={input+" mt-1"} value={competencyId} onChange={e=>CI(e.target.value)}>
     <option value="">Select evidence</option>
     {competencies.map(s=><option key={s.id} value={s.id}>{s.skill}</option>)}
    </select>
   </label>
   <button className={primary} disabled={busy||!competencies.some(s=>String(s.id)===competencyId)}
    onClick={()=>act(()=>api("/learning-passport/competencies/"+competencyId+"/interpret","POST"),"AI reflection saved separately from your practical evidence")}>
    Request optional AI reflection</button>
   {interpretations.length===0?<p className="text-sm text-muted-foreground">No AI interpretations saved. Your practical skills remain available without AI.</p>:
    interpretations.map(item=><article className="space-y-2 rounded-lg border p-4" key={item.id}>
     <p className="font-semibold">{skillName(item.competencyId)} <span className="text-xs font-normal text-muted-foreground">· AI-generated · {item.reviewState}</span></p>
     <p className="text-sm"><strong>AI observation:</strong> {item.summary}</p>
     <p className="text-sm"><strong>Suggested practice:</strong> {item.practiceSuggestion}</p>
     <p className="text-sm"><strong>Uncertainty:</strong> {item.limitations}</p>
     <p className="text-xs text-muted-foreground">{item.disclosure}</p>
     <p className="text-xs text-muted-foreground">Model: {item.modelId} · Prompt: {item.promptVersion}</p>
     <div className="flex flex-wrap gap-2">
      <button className={btn} disabled={busy||item.reviewState==="noted"}
       onClick={()=>act(()=>api("/learning-passport/interpretations/"+item.id+"/review","PATCH",{reviewState:"noted"}),"Interpretation marked as read — not verified")}>Mark as read</button>
      <button className={btn} disabled={busy||item.reviewState==="disputed"}
       onClick={()=>act(()=>api("/learning-passport/interpretations/"+item.id+"/review","PATCH",{reviewState:"disputed"}),"Interpretation disputed — your evidence was not changed")}>Dispute interpretation</button>
     </div>
    </article>)}
  </section>
  <section className="space-y-3 border-t pt-6" aria-labelledby="passport-human-layer">
   <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Layer 3 · Human-institution review</p>
    <h3 className="text-lg font-semibold" id="passport-human-layer">Achievements reviewed by people</h3></div>
   <p className="text-sm text-muted-foreground">You explicitly choose which practical evidence to submit to an institution you belong to. An authorized assessor or administrator must review it and record their decision. Even an approved review is an institution-specific attestation, not automatically a nationally accredited qualification.</p>
   {reviews.length===0?<p className="text-sm text-muted-foreground">No review requests yet. Your practical work and AI reflections remain separate.</p>:
   reviews.map(item=><article key={item.id} className="rounded-lg border p-4 space-y-2">
    <p className="font-semibold">{skillName(item.competencyId)}</p>
    <p className="text-sm">{orgName(item.organizationId)} · <strong>{item.status==="verified"?"Human-reviewed achievement":item.status==="pending"?"Awaiting human review":item.status==="revoked"?"Review withdrawn or revoked":"Not verified by reviewer"}</strong></p>
    {item.status==="verified"&&<p className="text-sm">Reviewed by institution account {item.reviewerId} on {item.reviewedAt?new Date(item.reviewedAt).toLocaleDateString():"recorded date"}. This is not an accreditation claim.</p>}
    {item.reviewNote&&<p className="text-sm">Reviewer note: {item.reviewNote}</p>}
    {item.revokeReason&&<p className="text-sm">Revocation reason: {item.revokeReason}</p>}
    {["pending","verified"].includes(item.status)&&<button className={btn} disabled={busy}
     onClick={()=>act(()=>api("/learning-passport/achievements/"+item.id+"/withdraw","POST"),"Institution review withdrawn and audit event recorded")}>Withdraw this review</button>}
   </article>)}
   {!pilot&&<p className="rounded-md border p-3 text-sm text-muted-foreground">Institution verification is in controlled preview. A participating institution must complete its verification and consent safeguards before learners can submit new requests.</p>}
   {learnerOrgs.length===0?<p className="rounded-md border p-3 text-sm text-muted-foreground">Institution verification becomes available after an institution enrols your account as a learner. You can still record practical skills without it.</p>:
   <div className="space-y-2 rounded-md border p-3">
    <h4 className="font-medium">Request a human review</h4>
    <label className="block text-sm">Institution
     <select className={input+" mt-1"} value={organizationId} onChange={e=>OI(e.target.value)}>
      <option value="">Choose your institution</option>
      {learnerOrgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
     </select>
    </label>
    <label className="block text-sm">Evidence to be reviewed
     <select className={input+" mt-1"} value={competencyId} onChange={e=>CI(e.target.value)}>
      <option value="">Choose a practical example</option>
      {competencies.map(s=><option key={s.id} value={s.id}>{s.skill}</option>)}
     </select>
    </label>
    <p className="text-xs text-muted-foreground">Submitting grants that institution's authorized reviewer access to this one evidence item only, not your entire learning history.</p>
    <button className={primary} disabled={busy||!pilot||!organizationId||!competencies.some(s=>String(s.id)===competencyId)}
     onClick={()=>act(()=>api("/learning-passport/achievements/requests","POST",{organizationId:Number(organizationId),competencyId:Number(competencyId)}),"Human review requested; nothing has been verified yet")}>Request human review</button>
   </div>}
  </section>
 </div>;
}
