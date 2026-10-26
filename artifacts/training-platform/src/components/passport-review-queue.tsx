import {useEffect,useState} from "react";
type Review={id:number;userId:string;competencyId:number;skill:string;description:string;demonstration:string;requestedAt:string};
const input="w-full rounded-md border bg-background p-2 text-sm";
async function request<T>(path:string,method="GET",body?:object):Promise<T>{
 const response=await fetch("/api"+path,{method,credentials:"include",cache:"no-store",
 headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
 if(!response.ok){const data=await response.json().catch(()=>({error:"Request failed"}));
  throw Error(typeof data.error==="string"?data.error:"Request failed")}
 return response.json();
}
export default function PassportReviewQueue({organizationId}:{organizationId:number}){
 const [reviews,R]=useState<Review[]>([]),[notes,N]=useState<Record<number,string>>({}),[busy,B]=useState(false),[error,E]=useState(""),[message,M]=useState("");
 const refresh=async()=>R(await request<Review[]>("/organizations/"+organizationId+"/passport/reviews"));
 useEffect(()=>{R([]);E("");refresh().catch(e=>E(e instanceof Error?e.message:"Could not load reviews"))},[organizationId]);
 async function decide(id:number,decision:"verified"|"rejected"){
  const reviewNote=notes[id]?.trim()??"";
  B(true);E("");M("");
  try{
   await request("/organizations/"+organizationId+"/passport/reviews/"+id+"/decision","POST",{decision,reviewNote});
   await refresh();
   M(decision==="verified"?"Human review recorded; no official qualification issued":"Review rejected with a recorded explanation");
  }catch(e){E(e instanceof Error?e.message:"Could not save review")}
  finally{B(false)}
 }
 return <section className="rounded-xl border p-5 space-y-3" aria-label="Institution Passport verification queue">
  <h2 className="text-lg font-semibold">Consent-based Passport reviews</h2>
  <p className="text-sm text-muted-foreground">Only submitted practical evidence appears here. An AI interpretation cannot verify an achievement. Confirm only what you independently assessed; do not represent this review as national accreditation.</p>
  {error&&<p role="alert" className="rounded-md border border-destructive p-3 text-sm">{error}</p>}
  {message&&<p role="status" className="rounded-md border p-3 text-sm">{message}</p>}
  {reviews.length===0?<p className="text-sm text-muted-foreground">No pending evidence requests.</p>:
   reviews.map(item=><article key={item.id} className="space-y-2 border-t pt-3">
    <p className="font-semibold">{item.skill}</p>
    <p className="text-xs text-muted-foreground">Learner account: {item.userId} · Demonstration: {item.demonstration.replaceAll("_"," ")}</p>
    <p className="whitespace-pre-wrap text-sm">{item.description}</p>
    <label className="block text-sm">Your independent review evidence and reason
     <textarea className={input+" mt-1"} rows={3} maxLength={2500} value={notes[item.id]??""}
      onChange={e=>N(old=>({...old,[item.id]:e.target.value}))}
      placeholder="What did you directly observe, assess or check?"/></label>
    <div className="flex flex-wrap gap-2">
     <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
      disabled={busy||(notes[item.id]?.trim().length??0)<20} onClick={()=>decide(item.id,"verified")}>Record human verification</button>
     <button className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
      disabled={busy||(notes[item.id]?.trim().length??0)<20} onClick={()=>decide(item.id,"rejected")}>Reject with reason</button>
    </div>
   </article>)}
 </section>;
}
