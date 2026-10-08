import { useEffect, useState } from "react";

type Material = { id: number; title: string; fileName: string };
type Question = { prompt: string; type: string; maxMarks: number };
type Exam = { id: number; title: string; difficulty: string; questions: Question[] };
type Mark = { questionIndex: number; awardedMarks: number; maxMarks: number; feedback: string; needsReview: boolean };
type Result = { percentage: number; awardedMarks: number; maxMarks: number; feedback: Mark[]; reviewRequired: number };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api" + url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }
  return response.json() as Promise<T>;
}
export default function WrittenExamsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [materialId, setMaterialId] = useState("");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [questionCount, setQuestionCount] = useState(5);
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([request<Material[]>("/materials"), request<Exam[]>("/written-exams")])
      .then(([m, e]) => { setMaterials(m); setExams(e); })
      .catch(e => setError(e.message));
  }, []);
  async function generate() {
    if (!materialId) return;
    setWorking(true); setError(""); setResult(null);
    try {
      const e = await request<Exam>("/materials/" + materialId + "/written-exams", {
        method: "POST", body: JSON.stringify({ questionCount, difficulty }),
      });
      setExams(prev => [e, ...prev]); selectExam(e);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to generate exam"); }
    finally { setWorking(false); }
  }
  function selectExam(e: Exam) { setExam(e); setResult(null); setAnswers(e.questions.map(() => "")); }
  async function submit() {
    if (!exam || answers.some(a => !a.trim())) { setError("Please answer every question before submitting."); return; }
    setWorking(true); setError("");
    try {
      const r = await request<Result>("/written-exams/" + exam.id + "/attempts", {
        method: "POST", body: JSON.stringify({ answers }),
      });
      setResult(r);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to mark exam"); }
    finally { setWorking(false); }
  }
  return <section className="mx-auto max-w-4xl space-y-7 pb-12">
    <header className="space-y-2"><p className="text-sm uppercase tracking-widest text-muted-foreground">Learning assessment</p>
      <h1 className="text-3xl font-semibold">Written examinations</h1>
      <p className="text-muted-foreground">Create a written assessment from your own learning material. Answer in your own words and receive rubric-based AI feedback.</p>
    </header>
    {error && <div role="alert" className="rounded-lg border border-destructive p-4 text-sm">{error}</div>}
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h2 className="text-xl font-semibold">Create an examination</h2>
      <label className="block text-sm">Source material
        <select className="mt-2 w-full rounded-md border bg-background p-3" value={materialId} onChange={e => setMaterialId(e.target.value)}>
          <option value="">Choose an uploaded document</option>
          {materials.map(m => <option key={m.id} value={m.id}>{m.title} ({m.fileName})</option>)}
        </select>
      </label>
      {materials.length === 0 && <p className="text-sm text-muted-foreground">Upload a document under Study materials first, then return here.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">Difficulty
          <select className="mt-2 w-full rounded-md border bg-background p-3" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
            <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
          </select>
        </label>
        <label className="block text-sm">Number of questions
          <input className="mt-2 w-full rounded-md border bg-background p-3" type="number" min="1" max="15" value={questionCount} onChange={e => setQuestionCount(Math.max(1, Math.min(15, Number(e.target.value) || 1)))} />
        </label>
      </div>
      <button disabled={!materialId || working} onClick={generate} className="rounded-md bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50">{working ? "Working…" : "Generate written examination"}</button>
    </div>
    {exams.length > 0 && <section className="space-y-3"><h2 className="text-xl font-semibold">Your examinations</h2>
      <div className="flex flex-wrap gap-2">{exams.map(e => <button key={e.id} onClick={() => selectExam(e)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">{e.title} · {e.questions.length} questions</button>)}</div>
    </section>}
    {exam && <section className="space-y-5"><div className="border-b pb-4"><h2 className="text-2xl font-semibold">{exam.title}</h2>
      <p className="text-sm text-muted-foreground">{exam.questions.reduce((s,q) => s+q.maxMarks,0)} marks · {exam.difficulty}</p></div>
      {exam.questions.map((q,i) => <article key={i} className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex justify-between gap-3 text-sm text-muted-foreground"><span>Question {i+1} · {q.type.replaceAll("_"," ")}</span><span>{q.maxMarks} marks</span></div>
        <h3 className="font-medium">{q.prompt}</h3>
        <textarea aria-label={`Answer to question ${i+1}`} rows={q.type === "short_answer" ? 4 : 8} maxLength={15000} disabled={!!result}
          className="w-full rounded-md border bg-background p-3 text-sm" placeholder="Write your answer in your own words…"
          value={answers[i] ?? ""} onChange={e => setAnswers(prev => prev.map((a,j) => j===i ? e.target.value : a))} />
        {result?.feedback.find(m => m.questionIndex===i) && (() => { const mark = result.feedback.find(m => m.questionIndex===i)!; return <div className="rounded-md bg-muted p-4 text-sm space-y-1">
          <p className="font-semibold">Awarded {mark.awardedMarks} / {mark.maxMarks} marks {mark.needsReview ? "· Human review advised" : ""}</p><p>{mark.feedback}</p></div>; })()}
      </article>)}
      {!result ? <button disabled={working} onClick={submit} className="rounded-md bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50">{working ? "Marking…" : "Submit for AI marking"}</button>
        : <div aria-live="polite" className="rounded-xl border p-6"><h3 className="text-xl font-semibold">Your result: {result.percentage}%</h3>
          <p>{result.awardedMarks} / {result.maxMarks} marks</p>
          <p className="mt-2 text-sm text-muted-foreground">{result.reviewRequired ? "One or more answers need human review. Treat this score as provisional." : "AI-generated assessment: scores can be reviewed by a teacher or assessor."}</p>
        </div>}
    </section>}
  </section>;
}
