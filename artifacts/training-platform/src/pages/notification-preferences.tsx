import {useEffect,useState} from "react";
import {Bell,CheckCircle2,LockKeyhole,ShieldCheck,LoaderCircle} from "lucide-react";

type Choice={kind:"guardian_review_requested"|"learner_support_updated";enabled:boolean;canEnable:boolean};
type School={id:number;name:string;choices:Choice[]};
type Preferences={enabled:boolean;optInAvailable:boolean;schools:School[]};
const labels:Record<Choice["kind"],{title:string;description:string}>={
  guardian_review_requested:{
    title:"Guardian account updates",
    description:"When school-verified guardian responsibilities need your attention. No child records appear in the email.",
  },
  learner_support_updated:{
    title:"Learning support updates",
    description:"A sign-in reminder when an eligible learner-support request changes. Details stay inside CABO.",
  },
};

export default function NotificationPreferencesPage(){
 const [data,setData]=useState<Preferences|null>(null);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [saving,setSaving]=useState("");
 const [consent,setConsent]=useState(false);

 async function refresh() {
   const response=await fetch("/api/notifications/preferences",{
     credentials:"include",cache:"no-store",headers:{Accept:"application/json"}
   });
   if(!response.ok)throw new Error("Notification preferences are unavailable.");
   setData(await response.json() as Preferences);
 }
 useEffect(()=>{
   let active=true;
   fetch("/api/notifications/preferences",{credentials:"include",cache:"no-store"})
     .then(async r=>{if(!r.ok)throw Error("Notification preferences are unavailable.");return r.json() as Promise<Preferences>})
     .then(v=>{if(active)setData(v)})
     .catch(()=>{if(active)setError("We could not load your settings. Try again later.")});
   return()=>{active=false};
 },[]);
 async function change(school:School,choice:Choice){
   const id=school.id+":"+choice.kind;
   if(saving)return;
   setSaving(id);setError("");setMessage("");
   try{
     const response=await fetch(
       "/api/notifications/preferences/"+encodeURIComponent(String(school.id))+"/"+encodeURIComponent(choice.kind),
       {method:"PATCH",credentials:"include",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({enabled:!choice.enabled,acknowledged:!choice.enabled&&consent})}
     );
     if(!response.ok){
       if(response.status===403||response.status===423)throw Error("To enable email, sign in again using a verified account with recent multi-factor authentication. School and guardian approval must also be current.");
       throw Error("Your preference could not be saved. No email was sent.");
     }
     await refresh();
     setConsent(false);
     setMessage(choice.enabled?"Email preference withdrawn. Your school account remains accessible.":"Your explicit email preference was recorded. Email delivery remains controlled by CABO's separate security checks.");
   }catch(e){setError(e instanceof Error?e.message:"Could not save your preference.")}
   finally{setSaving("")}
 }
 return <main className="mx-auto max-w-5xl space-y-6 pb-16" aria-labelledby="notification-preferences-title">
  <header className="space-y-3 border-b pb-5">
   <p className="text-xs uppercase tracking-widest text-muted-foreground">CABO · Account safety</p>
   <div className="flex items-center gap-3"><Bell size={27} aria-hidden="true"/><h1 id="notification-preferences-title" className="font-display text-3xl sm:text-4xl">Notification preferences</h1></div>
   <p className="max-w-3xl text-sm text-muted-foreground">Choose which school updates you wish to receive by email. Your learning records, grades, guardian documents and private messages never appear in these emails.</p>
  </header>
  {message&&<p role="status" className="rounded-xl border p-3 text-sm flex items-start gap-2"><CheckCircle2 size={18} aria-hidden="true"/>{message}</p>}
  {error&&<p role="alert" className="rounded-xl border border-destructive p-3 text-sm">{error}</p>}
  {!data&&!error&&<p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={17} className="animate-spin"/>Loading your notification preferences…</p>}
  {data&&!data.enabled&&<section className="rounded-xl border p-6 space-y-3">
    <div className="flex items-center gap-2"><LockKeyhole size={20}/><h2 className="font-display text-xl">Email preferences are not active yet</h2></div>
    <p className="text-sm text-muted-foreground">CABO is completing guardian-consent, email verification and privacy checks. No email messages are being sent by this feature. Your normal learning and family workflows remain available.</p>
  </section>}
  {data?.enabled&&data.schools.length===0&&<section className="rounded-xl border p-6 space-y-2">
   <h2 className="font-display text-xl">No verified school notification access</h2>
   <p className="text-sm text-muted-foreground">Your institution must verify your current guardian relationship or educator assignment before school email preferences appear. A pending invitation is not enough.</p>
  </section>}
  {data?.enabled&&data.schools.map(school=><section key={school.id} className="rounded-xl border p-5 sm:p-6 space-y-4">
   <div className="border-b pb-3"><p className="text-xs uppercase tracking-widest text-muted-foreground">Verified institution</p><h2 className="font-display text-xl">{school.name}</h2></div>
   {school.choices.map(choice=>{
     const copy=labels[choice.kind];
     const key=school.id+":"+choice.kind;
     const locked=!choice.enabled&&(!data.optInAvailable||!choice.canEnable);
     return <div key={choice.kind} className="flex flex-col gap-3 border-b pb-5 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 sm:pr-6"><h3 className="font-semibold">{copy.title}</h3><p className="text-sm text-muted-foreground">{copy.description}</p>
      <p className="text-xs text-muted-foreground">{choice.enabled?"Email permitted by your recorded choice; delivery still requires live checks.":!choice.canEnable?"This institution is no longer verified for your account. You can withdraw any earlier consent.":locked?"New opt-ins are awaiting identity-provider approval.":"Off by default. You can withdraw consent at any time."}</p></div>
      <button type="button" className="shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`${copy.title} at ${school.name}: ${choice.enabled ? "Turn off email" : "Turn on email"}`}
        aria-pressed={choice.enabled} disabled={!!saving||locked||(!choice.enabled&&!consent)}
        onClick={()=>change(school,choice)}>{saving===key?"Saving…":choice.enabled?"Turn off":"Turn on"}</button>
     </div>;
   })}
  </section>)}
  {data?.enabled&&data.optInAvailable&&data.schools.some(s=>s.choices.some(c=>!c.enabled))&&<label className="flex items-start gap-3 rounded-xl border p-4 text-sm">
    <input type="checkbox" className="mt-1" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
    <span>I explicitly agree to receive the selected kind of school email. I understand I can withdraw my choice, and I will not receive learner documents or sensitive information by email.</span>
  </label>}
  <aside className="rounded-xl border p-5 space-y-2">
   <div className="flex items-center gap-2"><ShieldCheck size={19}/><h2 className="font-display text-lg">Your privacy comes first</h2></div>
   <p className="text-sm text-muted-foreground">Every send also checks the school's latest guardian or educator authorization and your current permission. Changing your school or withdrawing consent stops future eligible sends. Account security notices are handled separately by the identity provider.</p>
  </aside>
 </main>;
}
