import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BookOpen, BrainCircuit, GraduationCap, HeartHandshake, Landmark, ShieldCheck, Smartphone, Sparkles, Users } from "lucide-react";

// A guided tour of everything the CABO Learning Hub can do, written so a
// presenter can walk through it top to bottom. "Try it as" names a fictional
// demo account by username only; sign-in secrets are never shown here.
type Stop = { title: string; what: string; href: string; as?: string };
type Section = { id: string; icon: typeof BookOpen; title: string; intro: string; stops: Stop[] };

const LEARNER = "cabo_learner_south_a (Lerato, Grade 12)";
const TEACHER = "cabo_teacher_south (Thabo, teacher)";
const HEAD = "cabo_headmaster_south (Nomsa, headmaster)";
const PARENT = "cabo_parent_south (Mpho, Lerato's parent)";
const BW = "cabo_learner_bw (Masego, Botswana)";
const UNI = "cabo_university_head (Dr Nandi, Mzanzi Digital University)";
const EMPLOYER = "cabo_company_head (Karabo, Kwezi Skills & Training)";

const SECTIONS: Section[] = [
  { id: "learn", icon: BookOpen, title: "Learn", intro: "A learner's day: study, practise, ask for help and see progress.", stops: [
    { title: "Ask your study material", what: "Open a set of notes and ask a question. CABO answers only from that material and quotes the passages it used.", href: "/materials", as: LEARNER },
    { title: "Practice tests", what: "Instant quizzes from your own notes, with an explanation for every answer and a little celebration for a strong score.", href: "/quizzes", as: LEARNER },
    { title: "Written exams with AI marking", what: "Teacher-assigned written work, marked against a rubric. A teacher can override any mark, and learners see both.", href: "/written-exams", as: LEARNER },
    { title: "Learner Success Loop", what: "Ask for help on a concept, get a teacher's guidance, practise, and see before-and-after results in your learning DNA.", href: "/learner-success", as: LEARNER },
    { title: "My CABO AI profile", what: "Choose how CABO explains things (examples first, step by step), your language and interests. You decide what it knows.", href: "/my-ai", as: LEARNER },
    { title: "Career passport and development plan", what: "A private record of skills and evidence, plus an AI-drafted development plan a coach or teacher reviews.", href: "/career-passport", as: LEARNER },
    { title: "Class chat", what: "One teacher-moderated channel per class. Phone numbers, links and off-platform invitations are held for a teacher.", href: "/class-chat", as: LEARNER },
  ]},
  { id: "teach", icon: Users, title: "Teach", intro: "Everything a teacher needs to support a class, with nothing hidden from review.", stops: [
    { title: "Help-request queue", what: "Every request from your classes, from new to resolved, with follow-up dates and measured improvement.", href: "/learner-success", as: TEACHER },
    { title: "Assign and review written work", what: "Generate an exam from source material, assign it, review AI marks and override them with a reason.", href: "/written-exams", as: TEACHER },
    { title: "Question bank", what: "Reusable questions by subject and level, shared within the school.", href: "/question-bank", as: TEACHER },
    { title: "Moderate class chat", what: "Release or remove held messages, mute, and turn reports into accountability cases.", href: "/class-chat", as: TEACHER },
  ]},
  { id: "lead", icon: Landmark, title: "Lead", intro: "School leaders see the whole picture, and nothing slips through the cracks.", stops: [
    { title: "Accountability and escalation", what: "Every concern has a named owner and a deadline. Missed deadlines move up the school automatically, and the record can't be edited.", href: "/accountability", as: HEAD },
    { title: "School intelligence", what: "Results, attendance and trends by grade and subject, with privacy thresholds on small groups.", href: "/school-intelligence", as: HEAD },
    { title: "Education command", what: "Cross-school oversight for districts and groups, aggregate-only.", href: "/education-command", as: HEAD },
    { title: "Report issuance", what: "Issue official report cards with an integrity check parents can verify.", href: "/report-issuance", as: HEAD },
  ]},
  { id: "family", icon: HeartHandshake, title: "Family", intro: "Parents see how their child is doing, once the school has verified them.", stops: [
    { title: "How your child is doing", what: "Term trends, strongest and focus subjects, attendance and a plain-language outlook. Class comparison only when at least 5 learners have results.", href: "/guardian-connect", as: PARENT },
    { title: "Result emails and photo approval", what: "Opt-in emails when results are published (no marks in the email), and approval of your child's profile picture.", href: "/notification-preferences", as: PARENT },
  ]},
  { id: "pathways", icon: GraduationCap, title: "Universities and employers", intro: "One lifelong record that follows the learner from school to university and work, shared only when they choose.", stops: [
    { title: "Share my passport", what: "Pick a university, college or employer, what they may see and for how long. Stop at any time, and see every time they open it.", href: "/passport-sharing", as: LEARNER },
    { title: "A parent approves", what: "A school learner's share waits for their verified parent's approval. Lerato has one waiting for Kwezi Skills & Training.", href: "/passport-sharing", as: PARENT },
    { title: "Passports shared with a university", what: "Admissions sees results, learning DNA and journey for learners who chose to share, nothing more.", href: "/shared-passports", as: UNI },
    { title: "Passports shared with an employer", what: "Recruiters see skills, verified achievements and results for an internship, with every view logged.", href: "/shared-passports", as: EMPLOYER },
    { title: "University performance", what: "Universities run the same results, academics and Learner Success Loop for their own students.", href: "/academics", as: UNI },
  ]},
  { id: "ai", icon: BrainCircuit, title: "CABO AI", intro: "One AI voice across the platform: warm, local, honest, and always checkable.", stops: [
    { title: "Grounded answers with citations", what: "Answers come only from approved material, and each quote is checked against the source before it is shown.", href: "/materials", as: LEARNER },
    { title: "Personal, never invasive", what: "Interests and goals shape examples and pace. The learner's own words are sent as data, never as instructions.", href: "/my-ai", as: LEARNER },
    { title: "Human in charge", what: "AI marks and plans are drafts: teachers review, override and sign off. Grading is always free of credits.", href: "/written-exams", as: TEACHER },
    { title: "AI credits", what: "Monthly allowances per plan, top-up packs, and a clear cost for every AI action. Masego's account is nearly empty to show a top-up.", href: "/ai-credits", as: BW },
  ]},
  { id: "trust", icon: ShieldCheck, title: "Privacy and safety", intro: "Built for children's data in South Africa and Botswana.", stops: [
    { title: "POPIA or Botswana DPA, automatically", what: "Each school's country picks the rules: consent, retention and breach-notification clocks. Unknown country gets the strictest of both.", href: "/privacy", as: BW },
    { title: "Raise a concern", what: "Anyone can raise a safeguarding, conduct or data concern. It reaches a named person with a deadline.", href: "/accountability", as: LEARNER },
  ]},
  { id: "you", icon: Sparkles, title: "Make it yours", intro: "Comfortable for everyone, including people using assistive technology.", stops: [
    { title: "My profile and look", what: "Name, pronouns, avatar or photo, eight colours, text size, spacing, easy-read font, high contrast, and light, dark or match-device.", href: "/me" },
    { title: "Accessibility", what: "Screen readers, keyboard, voice control, read aloud and speak to type, and Siri / Google Assistant shortcuts.", href: "/accessibility" },
    { title: "Quick jump", what: "Press Ctrl K (or /) anywhere to jump straight to any page you can open.", href: "/tour" },
  ]},
  { id: "apps", icon: Smartphone, title: "Everywhere", intro: "The same account on the web, phones and computers.", stops: [
    { title: "Install the app", what: "Add CABO to your home screen, or use the Android, iPhone and Windows apps.", href: "/install" },
  ]},
];

type AiHealth = { status: "healthy" | "unavailable" | "not_configured"; model: string | null; latencyMs: number | null; checkedAt: string };

function AiStatus() {
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/healthz/ai", { cache: "no-store" })
      .then(async r => { const body = await r.json().catch(() => null); if (live) body?.status ? setHealth(body) : setFailed(true); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  const text = health?.status === "healthy" ? `CABO AI is live${health.latencyMs != null ? ` · answered in ${(health.latencyMs / 1000).toFixed(1)} s` : ""}`
    : health?.status === "not_configured" ? "CABO AI is not switched on for this server"
    : health?.status === "unavailable" || failed ? "CABO AI is not answering right now" : "Checking CABO AI…";
  const tone = health?.status === "healthy" ? "ok" : health || failed ? "warn" : "pending";
  return <p className={`tour-ai-status tour-ai-${tone}`} role="status"><span aria-hidden="true" className="dot" />{text}</p>;
}

export default function TourPage() {
  return <div className="tour page-enter">
    <header className="tour-hero">
      <p className="eyebrow">TOUR CABO</p>
      <h1 className="font-display">Everything the Learning Hub can do</h1>
      <p>Each stop says what it shows and which demo account to use. All demo data is fictional.</p>
      <AiStatus />
      <nav aria-label="Tour sections" className="tour-jump">
        {SECTIONS.map(s => <a key={s.id} href={`#tour-${s.id}`}>{s.title}</a>)}
      </nav>
    </header>
    {SECTIONS.map(({ id, icon: Icon, title, intro, stops }) => <section key={id} id={`tour-${id}`} className="tour-section" aria-labelledby={`tour-${id}-h`}>
      <h2 id={`tour-${id}-h`} className="font-display"><Icon size={20} aria-hidden="true" /> {title}</h2>
      <p className="tour-intro">{intro}</p>
      <div className="tour-grid">
        {stops.map(stop => <article key={stop.title} className="tour-card">
          <h3>{stop.title}</h3>
          <p>{stop.what}</p>
          {stop.as && <p className="tour-as"><GraduationCap size={14} aria-hidden="true" /> Try it as <strong>{stop.as}</strong></p>}
          <Link href={stop.href} className="button button-outline button-small">Open</Link>
        </article>)}
      </div>
    </section>)}
  </div>;
}
