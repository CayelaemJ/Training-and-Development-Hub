import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight, BookOpenCheck, Building2, CheckCircle2, ClipboardCheck,
  FileShield2, GraduationCap, Landmark, LockKeyhole, ShieldCheck, UsersRound,
  Waypoints,
} from "lucide-react";

type Journey = "school" | "tertiary" | "transfer" | "institution";
type Portal = { role: string };
type Application = { id: number; status: string };

const journeys: { id: Journey; title: string; detail: string; icon: typeof GraduationCap }[] = [
  { id: "school", title: "School applications", detail: "Preschool to matric", icon: UsersRound },
  { id: "tertiary", title: "University & college", detail: "Programmes and modules", icon: GraduationCap },
  { id: "transfer", title: "Institution transfers", detail: "Move with verified records", icon: Waypoints },
  { id: "institution", title: "Admissions desk", detail: "For authorised staff", icon: Building2 },
];

const stageSteps = {
  school: [
    ["Select a school", "Check the institution and intake year with its official admissions office."],
    ["Guardian approval", "An independently verified parent or legal guardian must approve every preprimary, primary or high-school application."],
    ["Evidence & fees", "An authorised institution reviews necessary documents and reconciles fees or exemptions; no bank screenshots as proof of payment."],
    ["Placement decision", "Only the receiving institution can confirm admission or registration."],
  ],
  tertiary: [
    ["Explore programmes", "Check the official university or college listing, admission criteria and deadlines."],
    ["Verify results", "Official issuers or authorised partners confirm marks and qualifications; AI cannot authenticate certificates."],
    ["Plan modules", "Institution-approved credits, prerequisites, electives and double majors guide the study plan; an adviser approves exceptions."],
    ["Complete registration", "The institution confirms enrolment, payments, student cards and the collection or delivery of materials."],
  ],
  transfer: [
    ["Choose a receiving institution", "Check eligibility, curriculum and available places before requesting a transfer."],
    ["Approve limited sharing", "The student or verified guardian selects which authenticated records can be disclosed."],
    ["Human review", "The institution evaluates official transcripts, grade placement or university credit recognition."],
    ["Confirm the move", "Source and destination must acknowledge the transfer before records or enrolments change."],
  ],
  institution: [
    ["Verify institutional authority", "Schools and registrars need an approved tenant, accountable reviewers and country clearance."],
    ["Review guardian and document proof", "Family evidence must stay private, temporary and purpose-limited; AI can flag issues for review."],
    ["Reconcile fees and register", "Only approved institution staff and trusted payment systems can record authoritative decisions."],
    ["Manage appeals and transfers", "Track institution-confirmed outcomes while preserving lawful audit and retention records."],
  ],
} as const;

const roleIntake = new Set(["superadmin", "headmaster", "deputy_headmaster", "administrator"]);
const heading: Record<Journey, { title: string; copy: string; state: string }> = {
  school: {
    title: "School registration, with families at the centre",
    copy: "Preprimary, primary and high-school applications must involve a verified parent or legal guardian. CABO is preparing a consent-led, institution-approved application journey.",
    state: "Planned — school submissions disabled",
  },
  tertiary: {
    title: "Find your next course of study",
    copy: "University and college programme discovery and CABO application drafts already exist. Module registration and official enrolment will require direct institutional approval.",
    state: "CABO draft and official-site handoff available",
  },
  transfer: {
    title: "Make education portable, without exposing records",
    copy: "Plan a move between schools or tertiary institutions. Official academic record exchange, transfer acceptance and credit equivalence are not active yet.",
    state: "Pilot records only — transfer submissions paused",
  },
  institution: {
    title: "A responsible admissions desk",
    copy: "For verified staff, manage intake authority and prepare institutional processes. No new admissions approvals, document verification or sensitive uploads are enabled here.",
    state: "Planning workspace — no live admissions processing",
  },
};

function JourneyPanel({ kind, role, applicationCount }: { kind: Journey; role: string; applicationCount: number | null }) {
  const item = heading[kind];
  const canManage = roleIntake.has(role);
  return <section aria-labelledby="admissions-journey-title" className="space-y-5">
    <div className="rounded-2xl border bg-card p-5 sm:p-7 space-y-3">
      <p className="text-xs uppercase tracking-[.16em] text-muted-foreground">{item.state}</p>
      <h2 className="font-display text-2xl sm:text-3xl" id="admissions-journey-title">{item.title}</h2>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{item.copy}</p>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {kind === "school" && <Link href="/guardian-connect" className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2">Guardian Connect <ArrowRight size={16}/></Link>}
        {kind === "tertiary" && <>
          <Link href="/cabo-apply" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2">Explore university programmes <ArrowRight size={16}/></Link>
          {applicationCount !== null && <span role="status" className="text-sm text-muted-foreground">{applicationCount} CABO application {applicationCount === 1 ? "draft/record" : "drafts/records"} on your account</span>}
        </>}
        {kind === "transfer" && <Link href="/institution-records" className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2">View my institution records <ArrowRight size={16}/></Link>}
        {kind === "institution" && canManage && <Link href="/organizations" className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2">Institution workspace <ArrowRight size={16}/></Link>}
        {kind === "institution" && !canManage && <p className="text-sm text-muted-foreground">Administrative access requires an authorised institution role.</p>}
      </div>
    </div>
    <div className="rounded-2xl border bg-card p-5 sm:p-6">
      <h3 className="text-lg font-semibold">How this journey works</h3>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {stageSteps[kind].map(([title, description], index) => <li key={title} className="flex gap-3 rounded-xl bg-muted/40 p-4">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">{index + 1}</span>
          <div className="space-y-1"><h4 className="font-semibold text-sm">{title}</h4><p className="text-sm leading-relaxed text-muted-foreground">{description}</p></div>
        </li>)}
      </ol>
    </div>
  </section>;
}

export default function AdmissionsHubPage() {
  const [role, setRole] = useState<string | null>(null);
  const [selected, setSelected] = useState<Journey>("school");
  const [applicationCount, setApplicationCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/portal/me", { credentials: "include", cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error("Could not load role"); return r.json() as Promise<Portal>; })
      .then(data => {
        if (!active) return;
        setRole(data.role);
        setSelected(data.role === "parent" ? "school" : roleIntake.has(data.role) ? "institution" : "tertiary");
        if (data.role !== "learner") return;
        fetch("/api/admissions/applications/me", { credentials: "include", cache: "no-store" })
          .then(async r => r.ok ? r.json() as Promise<Application[]> : null)
          .then(items => { if (active && Array.isArray(items)) setApplicationCount(items.length); })
          .catch(() => {});
      }).catch(() => { if (active) setRole("unavailable"); });
    return () => { active = false; };
  }, []);
  return <section className="mx-auto max-w-6xl space-y-6 pb-16">
    <header className="space-y-3 border-b pb-6">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">CABO / Education access & mobility</p>
      <h1 className="font-display text-3xl sm:text-5xl">Admissions & Transfers</h1>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">A place to plan the next step in education—from first school admission to university studies and a future institutional transfer. Applications and sensitive evidence only move when authorised.</p>
    </header>
    <div className="grid gap-3 sm:grid-cols-3" aria-label="Admissions principles">
      <div className="flex gap-3 rounded-xl border p-4"><ShieldCheck size={20} className="shrink-0 text-primary" aria-hidden="true"/><div><h2 className="text-sm font-semibold">Guardian-first schooling</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">No child school submission without verified lawful approval</p></div></div>
      <div className="flex gap-3 rounded-xl border p-4"><LockKeyhole size={20} className="shrink-0 text-primary" aria-hidden="true"/><div><h2 className="text-sm font-semibold">Private by design</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Minimum data, no unnecessary parent document retention</p></div></div>
      <div className="flex gap-3 rounded-xl border p-4"><ClipboardCheck size={20} className="shrink-0 text-primary" aria-hidden="true"/><div><h2 className="text-sm font-semibold">Institution-confirmed</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">AI offers guidance, not official admissions decisions</p></div></div>
    </div>
    <div className="space-y-3">
      <h2 className="font-display text-xl">Choose your journey</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Admissions journeys">
        {journeys.filter(item => item.id !== "institution" || roleIntake.has(role ?? "")).map(item => {
          const Icon = item.icon;
          const active = selected === item.id;
          return <button type="button" key={item.id} aria-pressed={active} onClick={() => setSelected(item.id)} className={"rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 " + (active ? "border-primary bg-primary/5" : "bg-card hover:border-primary/50")}>
            <Icon size={21} aria-hidden="true" className="mb-3 text-primary"/><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
          </button>;
        })}
      </div>
    </div>
    {role === null ? <p role="status">Loading your authorised workspace…</p> :
      role === "unavailable" ? <p role="alert" className="rounded-xl border p-4 text-sm">Your role could not be confirmed. Sign in again to access the appropriate admission tools.</p> :
      <JourneyPanel kind={selected} role={role} applicationCount={applicationCount}/>}
    <aside className="grid gap-3 rounded-xl border p-5 sm:grid-cols-[auto_1fr]">
      <FileShield2 size={23} aria-hidden="true" className="text-primary"/>
      <div><h2 className="text-sm font-semibold">Document verification and official applications</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">The secure upload vault, government or issuing-body result checks, payment processing, student cards, module registrations and official transcript exchange are not available yet. Do not upload birth certificates, bank documents, IDs or other sensitive evidence to a general CABO study-material tool.</p></div>
    </aside>
    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
      <Link href="/learner-journey" className="inline-flex items-center gap-1 underline underline-offset-4">My learner journey <BookOpenCheck size={15}/></Link>
      <Link href="/institution-records" className="inline-flex items-center gap-1 underline underline-offset-4">My institution records <Landmark size={15}/></Link>
      <Link href="/guardian-connect" className="inline-flex items-center gap-1 underline underline-offset-4">Family & guardian support <CheckCircle2 size={15}/></Link>
    </div>
  </section>;
}
