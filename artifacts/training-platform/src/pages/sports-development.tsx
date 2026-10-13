import {Link} from "wouter";
import {Activity,ArrowRight,Award,BookOpen,HeartHandshake,ShieldCheck,Target,Users} from "lucide-react";

const domains=[
 {name:"Sport participation",icon:Activity,detail:"Capture the sport, age group, season, team and position or discipline. Record attendance and enjoyment alongside participation."},
 {name:"Coach observations",icon:Target,detail:"Track age-appropriate skill development, effort, teamwork and goals with dated evidence and a coach's feedback."},
 {name:"Extra-mural activities",icon:BookOpen,detail:"Include music, art, debate, chess, coding, drama, culture, volunteering and leadership without forcing different talents onto one score."},
 {name:"Teams and achievements",icon:Award,detail:"Record memberships, matches, competitions, milestones and awards. Clearly distinguish learner-entered claims from coach-verified achievements."},
 {name:"Whole-child wellbeing",icon:HeartHandshake,detail:"Support balanced participation, rest, enjoyment and learner choice. Avoid public injury information, health profiling or predictive selection labels."},
 {name:"Family and coach access",icon:Users,detail:"Give coaches access only to their assigned teams; guardians see only their verified child's records. Learners can view and contribute to their own journey."}
];
export default function SportsDevelopmentPage(){
 return <section className="mx-auto max-w-5xl space-y-6 pb-20" aria-labelledby="sports-page-title">
  <header className="space-y-3 border-b pb-6">
   <p className="text-xs uppercase tracking-[.18em] text-muted-foreground">CABO / Whole-child development</p>
   <h1 id="sports-page-title" className="font-display text-3xl sm:text-5xl">Sport & extracurricular growth</h1>
   <p className="max-w-2xl text-muted-foreground leading-relaxed">A learner is more than their marks. Recognise dedication, creativity, teamwork and growth outside the classroom.</p>
  </header>
  <div className="rounded-xl border bg-card p-5 sm:p-7 space-y-3">
   <div className="flex items-center gap-2 text-primary"><ShieldCheck size={20}/><strong>Development area in preparation</strong></div>
   <p className="text-sm leading-relaxed text-muted-foreground">Dedicated coach assessments, team rosters, verified results, progress charts and guardian sharing are planned but not yet live. Your existing private learning journey can already record general personal milestones. Do not upload sensitive medical records or children's private information into free-text milestone fields.</p>
   <Link href="/learner-journey" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Open my development journey <ArrowRight size={16}/></Link>
  </div>
  <h2 className="font-display text-2xl">What we'll measure and celebrate</h2>
  <div className="grid gap-3 sm:grid-cols-2">
   {domains.map(({name,icon:Icon,detail})=><article key={name} className="rounded-xl border bg-card p-5 space-y-3">
    <Icon size={23} className="text-primary" aria-hidden="true"/><h3 className="font-semibold">{name}</h3><p className="text-sm leading-relaxed text-muted-foreground">{detail}</p>
   </article>)}
  </div>
  <div className="rounded-xl border p-5 space-y-2"><h2 className="font-semibold">How progress intelligence will work</h2><p className="text-sm leading-relaxed text-muted-foreground">Compare a learner with their own previous observations using the same rubric, age band and activity. Visualise participation and growth over time, highlight areas for supportive practice, and require coach review before verified results appear. The platform will not rank unrelated sports or use automated talent predictions to exclude children.</p></div>
 </section>;
}
