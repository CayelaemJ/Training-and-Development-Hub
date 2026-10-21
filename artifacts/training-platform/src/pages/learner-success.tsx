import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
type Org = { id: number; name: string; role: string };
type Outcome = { baseline: number; followup: number; improvementPp: number };
type Ticket = {
  id: number;
  organizationId: number;
  courseId: number;
  concept: string;
  question: string;
  attempted: string;
  status: string;
  assignedTo: string | null;
  version: number;
  reviewAt: string | null;
  feedback: string | null;
  outcome: Outcome | null;
  createdAt: string;
  updatedAt: string;
};
type Detail = {
  publishedResults: {
    id: number;
    title: string;
    marks: number;
    maxMarks: number;
    updatedAt: string;
  }[];
  educators: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  }[];
  ticket: Ticket;
  staff: boolean;
  owner: boolean;
  history: {
    id: number;
    kind: string;
    body: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }[];
};
type Passport = {
  items: Ticket[];
  learningDNA: {
    ticketId: number;
    concept: string;
    courseId: number;
    state: string;
    reviewedAt: string;
  }[];
  nextCursor: number | null;
  asOf: string;
  interpretation: string;
};
const field = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const button =
  "rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50";
const label = (s: string) => s.replaceAll("_", " ");
async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch("/api" + path, {
    credentials: "include",
    cache: "no-store",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw Error(
      j.error ??
        (r.status === 404
          ? "The Learner Success Loop has not been enabled for this deployment."
          : "Request failed. Please retry."),
    );
  }
  return r.json();
}
export default function LearnerSuccessPage() {
  const client = useQueryClient();
  const [org, setOrg] = useState(""),
    [selected, setSelected] = useState<number | null>(null),
    [tab, setTab] = useState("support"),
    [after, setAfter] = useState(0);
  const [concept, setConcept] = useState(""),
    [course, setCourse] = useState(""),
    [question, setQuestion] = useState(""),
    [attempted, setAttempted] = useState(""),
    [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [text, setText] = useState(""),
    [review, setReview] = useState(""),
    [assignee, setAssignee] = useState(""),
    [baseline, setBaseline] = useState(""),
    [followup, setFollowup] = useState(""),
    [dnaState, setDnaState] = useState("needs_practice");
  const orgs = useQuery({
    queryKey: ["support-orgs"],
    queryFn: () => api<Org[]>("/organizations"),
  });
  useEffect(() => {
    if (!org && orgs.data?.length) setOrg(String(orgs.data[0].id));
  }, [orgs.data, org]);
  const prefix = "/organizations/" + org + "/support";
  const options = useQuery({
    queryKey: ["support-options", org],
    queryFn: () =>
      api<{
        role: string;
        courses: { id: number; name: string; level: string }[];
      }>(prefix + "/options"),
    enabled: !!org,
  });
  const queue = useQuery({
    queryKey: ["support-queue", org, after],
    queryFn: () =>
      api<{ items: Ticket[]; nextCursor: number | null; asOf: string }>(
        prefix + "?after=" + after,
      ),
    enabled: !!org,
    refetchInterval: 30000,
  });
  const detail = useQuery({
    queryKey: ["support-detail", org, selected],
    queryFn: () => api<Detail>(prefix + "/" + selected),
    enabled: !!org && selected !== null,
    refetchInterval: 30000,
  });
  const accountability = useQuery({
    queryKey: ["support-accountability", org],
    queryFn: () =>
      api<{ summary: Record<string, number>; asOf: string }>(
        prefix + "/accountability",
      ),
    enabled: !!org && tab === "accountability",
    refetchInterval: 30000,
  });
  const passport = useQuery({
    queryKey: ["learner-passport"],
    queryFn: () => api<Passport>("/learner-passport/me"),
    enabled: tab === "dna" || tab === "passport",
    refetchInterval: 30000,
  });
  const refresh = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["support-queue"] }),
      client.invalidateQueries({ queryKey: ["support-detail"] }),
      client.invalidateQueries({ queryKey: ["support-accountability"] }),
      client.invalidateQueries({ queryKey: ["learner-passport"] }),
    ]);
  }, [client]);
  const create = useMutation({
    mutationFn: () =>
      api<Ticket>(prefix, {
        courseId: Number(course),
        concept,
        question,
        attempted,
        requestKey,
      }),
    onSuccess: async (t) => {
      setSelected(t.id);
      setQuestion("");
      setAttempted("");
      setConcept("");
      setRequestKey(crypto.randomUUID());
      await refresh();
    },
  });
  const act = useMutation({
    mutationFn: (action: Record<string, unknown>) =>
      api<Ticket>(prefix + "/" + selected + "/actions", {
        version: detail.data!.ticket.version,
        action,
      }),
    onSuccess: async () => {
      setText("");
      await refresh();
    },
    onError: async () => {
      await refresh();
    },
  });
  const guidance = useMutation({
    mutationFn: () =>
      api<{
        source: string;
        explanation: string;
        questions: string[];
        practice: string[];
      }>(prefix + "/" + selected + "/guidance-draft", {}),
    onSuccess: (r) =>
      setText(
        (r.source === "ai_draft"
          ? "AI draft — review before use"
          : "Non-AI learning template") +
          "\n" +
          r.explanation +
          "\n\nQuestions\n" +
          r.questions.join("\n") +
          "\n\nPractice\n" +
          r.practice.join("\n"),
      ),
  });
  const error =
    accountability.error ??
    guidance.error ??
    orgs.error ??
    options.error ??
    queue.error ??
    detail.error ??
    passport.error ??
    create.error ??
    act.error;
  const t = detail.data?.ticket;
  const staff = detail.data?.staff;
  const respond = (action: Record<string, unknown>) => act.mutate(action);
  const download = async () => {
    let p = await api<Passport>("/learner-passport/me?download=true");
    const items = [...p.items],
      learningDNA = [...p.learningDNA];
    let pages = 1;
    while (p.nextCursor !== null) {
      if (pages++ > 100)
        throw Error(
          "Export exceeds this pilot limit. Contact your school for a complete data export.",
        );
      p = await api<Passport>("/learner-passport/me?after=" + p.nextCursor);
      items.push(...p.items);
      learningDNA.push(...p.learningDNA);
    }
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { ...p, items, learningDNA, exportedAt: new Date().toISOString() },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "cabo-learner-passport.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const [downloadError, setDownloadError] = useState("");
  return (
    <main className="mx-auto max-w-6xl space-y-6 pb-16">
      <header className="rounded-2xl border bg-card p-6 sm:p-8">
        <p className="eyebrow">CABO · Learning, support, progress</p>
        <h1 className="font-display text-3xl sm:text-4xl">
          Your next breakthrough.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Ask for help, practise with your educator and see what changes. Every
          result has a source. Every support request has a next step.
        </p>
      </header>
      <nav
        aria-label="Learner success workspaces"
        className="flex flex-wrap gap-2"
      >
        {[
          ["support", "Success Loop"],
          ["dna", "Learning DNA"],
          ["accountability", "Intervention Accountability"],
          ["passport", "Learner Passport"],
          ["framework", "School Framework"],
        ].map(([id, title]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={
              tab === id ? button : "rounded-lg border px-4 py-2 text-sm"
            }
            onClick={() => setTab(id)}
          >
            {title}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-4">
          {error.message}{" "}
          <button
            className="underline"
            onClick={() => {
              void refresh();
              void passport.refetch();
            }}
          >
            Retry
          </button>
        </p>
      )}
      {tab === "support" && (
        <>
          <label className="block text-sm">
            School
            <select
              className={field}
              value={org}
              onChange={(e) => {
                setOrg(e.target.value);
                setSelected(null);
                setAfter(0);
                setCourse("");
              }}
            >
              <option value="">Choose school</option>
              {orgs.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          {options.data?.role === "learner" && (
            <form
              className="grid gap-3 rounded-2xl border p-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <h2 className="font-display text-xl sm:col-span-2">
                Where do you need help?
              </h2>
              <label className="text-sm">
                Subject
                <select
                  required
                  className={field}
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                >
                  <option value="">Choose an enrolled subject</option>
                  {options.data.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Concept
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  className={field}
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="e.g. Adding fractions"
                />
              </label>
              <label className="text-sm">
                What is difficult?
                <textarea
                  required
                  minLength={10}
                  maxLength={4000}
                  className={field}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </label>
              <label className="text-sm">
                What have you tried?
                <textarea
                  required
                  minLength={3}
                  maxLength={2000}
                  className={field}
                  value={attempted}
                  onChange={(e) => setAttempted(e.target.value)}
                />
              </label>
              <button className={button} disabled={create.isPending || !course}>
                {create.isPending ? "Sending…" : "Ask an educator"}
              </button>
              <p className="text-xs text-muted-foreground">
                Only educational questions. Keep personal contact details out of
                messages.
              </p>
            </form>
          )}
          <div className="grid gap-5 lg:grid-cols-[minmax(240px,1fr)_2fr]">
            <section className="space-y-3">
              <h2 className="font-display text-xl">Support queue</h2>
              {queue.isLoading ? (
                <p role="status">Loading support requests…</p>
              ) : !queue.data?.items.length ? (
                <p className="rounded-xl border p-5 text-muted-foreground">
                  No support requests in this view.
                </p>
              ) : (
                queue.data.items.map((x) => (
                  <button
                    aria-pressed={selected === x.id}
                    className={
                      "w-full rounded-xl border p-4 text-left " +
                      (selected === x.id ? "border-primary bg-primary/5" : "")
                    }
                    key={x.id}
                    onClick={() => setSelected(x.id)}
                  >
                    <strong>{x.concept}</strong>
                    <span className="mt-1 block text-xs uppercase text-muted-foreground">
                      #{x.id} · {label(x.status)}
                    </span>
                    {x.reviewAt && (
                      <span className="text-xs">
                        Review {new Date(x.reviewAt).toLocaleDateString()}
                      </span>
                    )}
                  </button>
                ))
              )}
              <div className="flex gap-2">
                {after > 0 && (
                  <button className={button} onClick={() => setAfter(0)}>
                    First page
                  </button>
                )}
                {queue.data?.nextCursor && (
                  <button
                    className={button}
                    onClick={() => setAfter(queue.data!.nextCursor!)}
                  >
                    Next page
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Refreshes every 30 seconds and after updates.
              </p>
            </section>
            <section className="space-y-4 rounded-2xl border p-5">
              {!t ? (
                <p className="text-muted-foreground">
                  Choose a request to view its history and next steps.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap justify-between gap-3">
                    <h2 className="font-display text-2xl">{t.concept}</h2>
                    <span>{label(t.status)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{t.question}</p>
                  <p className="text-sm text-muted-foreground">
                    Already attempted: {t.attempted}
                  </p>
                  <div className="grid grid-cols-3 gap-3 rounded-xl bg-primary/5 p-4">
                    {[
                      ["Initial", t.outcome?.baseline],
                      ["Follow-up", t.outcome?.followup],
                      ["Change", t.outcome?.improvementPp],
                    ].map(([name, value]) => (
                      <div key={String(name)}>
                        <p className="text-xs text-muted-foreground">{name}</p>
                        <strong className="text-2xl">
                          {typeof value === "number"
                            ? Math.round(value * 10) / 10
                            : "—"}
                          <small className="text-xs">
                            {name === "Change" ? " pp" : "%"}
                          </small>
                        </strong>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Published assessment evidence reviewed for comparability by
                    an educator. Change does not prove the intervention caused
                    it.
                  </p>
                  <ol className="space-y-3 border-l pl-4">
                    {detail.data?.history.map((e) => (
                      <li key={e.id}>
                        <p className="text-xs uppercase text-muted-foreground">
                          {label(e.kind)} ·{" "}
                          {new Date(e.createdAt).toLocaleString()}
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{e.body}</p>
                        {e.kind === "learning_dna" && (
                          <p className="text-xs">
                            Concept: {String(e.metadata.state)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                  <button
                    className={button}
                    disabled={guidance.isPending}
                    onClick={() => guidance.mutate()}
                  >
                    {guidance.isPending
                      ? "Preparing guidance…"
                      : "Get guided learning help"}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Uses the topic label only when school AI is enabled.
                    Otherwise returns a labelled non-AI template. Review the
                    draft before sending.
                  </p>
                  <label className="block text-sm">
                    Guidance, practice or review notes
                    <textarea
                      className={field}
                      rows={3}
                      value={text}
                      maxLength={4000}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </label>
                  <button
                    className={button}
                    disabled={act.isPending || text.trim().length < 2}
                    onClick={() => respond({ kind: "reply", body: text })}
                  >
                    Send reply
                  </button>
                  {staff && (
                    <div className="space-y-3 border-t pt-4">
                      <label className="block text-sm">
                        Educator
                        <select
                          className={field}
                          value={assignee}
                          onChange={(e) => setAssignee(e.target.value)}
                        >
                          <option value="">
                            Choose an authorised educator
                          </option>
                          {detail.data?.educators.map((x) => (
                            <option key={x.id} value={x.id}>
                              {[x.firstName, x.lastName]
                                .filter(Boolean)
                                .join(" ") || "School educator"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className={button}
                        disabled={act.isPending || !assignee}
                        onClick={() =>
                          respond({ kind: "assign", staffId: assignee })
                        }
                      >
                        Assign authorised educator
                      </button>
                      <label className="block text-sm">
                        Practice review date
                        <input
                          className={field}
                          type="datetime-local"
                          value={review}
                          onChange={(e) => setReview(e.target.value)}
                        />
                      </label>
                      <button
                        className={button}
                        disabled={
                          act.isPending || !review || text.trim().length < 5
                        }
                        onClick={() =>
                          respond({
                            kind: "practice",
                            body: text,
                            reviewAt: new Date(review).toISOString(),
                          })
                        }
                      >
                        Assign practice & checkpoint
                      </button>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm">
                          Initial published result
                          <select
                            className={field}
                            value={baseline}
                            onChange={(e) => setBaseline(e.target.value)}
                          >
                            <option value="">Choose baseline evidence</option>
                            {detail.data?.publishedResults.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.title} · {g.marks}/{g.maxMarks} ·{" "}
                                {new Date(g.updatedAt).toLocaleDateString()}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm">
                          Follow-up published result
                          <select
                            className={field}
                            value={followup}
                            onChange={(e) => setFollowup(e.target.value)}
                          >
                            <option value="">Choose follow-up evidence</option>
                            {detail.data?.publishedResults.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.title} · {g.marks}/{g.maxMarks} ·{" "}
                                {new Date(g.updatedAt).toLocaleDateString()}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <button
                        className={button}
                        disabled={
                          act.isPending ||
                          !baseline ||
                          !followup ||
                          text.trim().length < 20
                        }
                        onClick={() =>
                          respond({
                            kind: "outcome",
                            baselineGradeId: Number(baseline),
                            followupGradeId: Number(followup),
                            comparisonReason: text,
                          })
                        }
                      >
                        Record comparable evidence
                      </button>
                      <label className="block text-sm">
                        Learning DNA review
                        <select
                          className={field}
                          value={dnaState}
                          onChange={(e) => setDnaState(e.target.value)}
                        >
                          {[
                            "needs_practice",
                            "demonstrated",
                            "not_attempted",
                          ].map((s) => (
                            <option key={s} value={s}>
                              {label(s)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className={button}
                        disabled={act.isPending || text.trim().length < 20}
                        onClick={() =>
                          respond({
                            kind: "learning_dna",
                            state: dnaState,
                            body: text,
                          })
                        }
                      >
                        Save educator concept review
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    {(staff
                      ? [
                          "triaged",
                          "assigned",
                          "in_progress",
                          "awaiting_learner",
                          "follow_up_required",
                          "resolved",
                          "closed",
                        ]
                      : ["in_progress", "closed"]
                    ).map((s) => (
                      <button
                        className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40"
                        key={s}
                        disabled={
                          act.isPending ||
                          s === t.status ||
                          text.trim().length < 3
                        }
                        onClick={() =>
                          respond({
                            kind: "transition",
                            status: s,
                            reason: text,
                          })
                        }
                      >
                        Move to {label(s)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The server enforces each stage. Resolving requires follow-up
                    evidence; closing requires learner acknowledgement.
                  </p>
                  {detail.data?.owner && (
                    <div className="flex gap-2">
                      <button
                        className={button}
                        disabled={act.isPending}
                        onClick={() =>
                          respond({ kind: "feedback", feedback: "helpful" })
                        }
                      >
                        I understood the help
                      </button>
                      <button
                        className="rounded-lg border px-3 py-2 text-sm"
                        disabled={act.isPending}
                        onClick={() =>
                          respond({
                            kind: "feedback",
                            feedback: "needs_more_help",
                          })
                        }
                      >
                        I still need help
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
      {tab === "dna" && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Learning DNA</h2>
          <p className="text-sm text-muted-foreground">
            A changing concept map, never an intelligence or personality score.
            Unreviewed concepts remain unknown. These are support concept
            labels; a versioned curriculum catalogue is still required.
          </p>
          {passport.isLoading ? (
            <p>Loading your concept evidence…</p>
          ) : !passport.data?.learningDNA.length ? (
            <p className="rounded-xl border p-5">
              No educator-reviewed concept evidence yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.values(
                Object.fromEntries(
                  passport.data.learningDNA.map((d) => [
                    d.courseId + ":" + d.concept,
                    d,
                  ]),
                ),
              ).map((d) => (
                <article
                  key={d.courseId + ":" + d.concept}
                  className="rounded-xl border border-l-4 border-l-primary p-5"
                >
                  <h3 className="font-semibold">{d.concept}</h3>
                  <p className="mt-2 capitalize">{label(d.state)}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Educator review ·{" "}
                    {new Date(d.reviewedAt).toLocaleDateString()} · Request #
                    {d.ticketId}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === "accountability" && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">
            Intervention Accountability Engine
          </h2>
          <p className="text-sm text-muted-foreground">
            Open the Success Loop to review your authorised school queue.
            Accountability follows the support process and evidence, without
            ranking teachers.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [
                "Authorised support requests",
                accountability.data?.summary.total,
              ],
              [
                "Awaiting learner",
                accountability.data?.summary.awaitingLearner,
              ],
              [
                "Overdue checkpoints",
                accountability.data?.summary.overdueCheckpoints,
              ],
              [
                "Measured outcomes",
                accountability.data?.summary.measuredOutcomes,
              ],
              [
                "Learners requesting more help",
                accountability.data?.summary.needsMoreHelp,
              ],
              ["Awaiting assignment", accountability.data?.summary.unassigned],
            ].map(([name, value]) => (
              <article key={String(name)} className="rounded-xl border p-5">
                <p className="text-sm text-muted-foreground">{name}</p>
                <strong className="text-3xl">{value ?? "—"}</strong>
              </article>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Counts cover all requests you are authorised to see in this school.
            Refreshed every 30 seconds.
          </p>
        </section>
      )}
      {tab === "framework" && <FrameworkEditor org={org} />}
      {tab === "passport" && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Your Learner Passport</h2>
          <p className="text-muted-foreground">
            Private, portable support and progress evidence across your schools.
            This export contains your support progress; it does not certify a
            qualification or expose staff conversations.
          </p>
          <button
            className={button}
            onClick={() =>
              void download().catch((e) => setDownloadError(e.message))
            }
          >
            Download private passport (JSON)
          </button>
          {downloadError && <p role="alert">{downloadError}</p>}
          {passport.data?.items.map((x) => (
            <article key={x.id} className="rounded-xl border p-5">
              <h3 className="font-semibold">{x.concept}</h3>
              <p className="text-sm">
                {label(x.status)} · School #{x.organizationId}
              </p>
              {x.outcome && (
                <p className="mt-2">
                  {x.outcome.baseline}% → {x.outcome.followup}% ·{" "}
                  {x.outcome.improvementPp > 0 ? "+" : ""}
                  {x.outcome.improvementPp} pp
                </p>
              )}
            </article>
          ))}
          {passport.data?.nextCursor && (
            <p className="text-sm">
              Showing the first 100 records. Full historical export is not yet
              available in this pilot.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {passport.data?.interpretation}
          </p>
        </section>
      )}
    </main>
  );
}

type FrameworkConfig = {
  countryCode: string;
  frameworkCode: string;
  name: string;
  timeZone: string;
  languages: string[];
  settings: {
    levels: string[];
    curriculumVersion: string;
    notes: string;
    gradingScale: { label: string; minimumPercent: number }[];
  };
};
function FrameworkEditor({ org }: { org: string }) {
  const client = useQueryClient();
  const [country, setCountry] = useState("BW"),
    [code, setCode] = useState("CUSTOM"),
    [name, setName] = useState(""),
    [zone, setZone] = useState("Africa/Gaborone"),
    [languages, setLanguages] = useState("en, tn"),
    [levels, setLevels] = useState(
      "Standard 1, Standard 2, Standard 3, Standard 4, Standard 5, Standard 6, Standard 7",
    ),
    [version, setVersion] = useState(""),
    [notes, setNotes] = useState(""),
    [scale, setScale] = useState(
      '[{"label":"Pass","minimumPercent":50},{"label":"Needs support","minimumPercent":0}]',
    );
  const current = useQuery({
    queryKey: ["school-framework", org],
    queryFn: () =>
      api<{
        current: (FrameworkConfig & { id: number }) | null;
        canConfigure: boolean;
      }>("/organizations/" + org + "/education-framework"),
    enabled: !!org,
  });
  const save = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(scale);
      } catch {
        throw Error("Enter a valid JSON grading scale.");
      }
      return api("/organizations/" + org + "/education-framework", {
        countryCode: country.toUpperCase(),
        frameworkCode: code,
        name,
        timeZone: zone,
        languages: languages
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        settings: {
          levels: levels
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          curriculumVersion: version,
          notes,
          gradingScale: parsed,
        },
      });
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["school-framework", org] }),
  });
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl">School framework</h2>
      <p className="text-sm text-muted-foreground">
        Country-neutral, versioned school settings. Botswana PSLE, JCE and BGCSE
        or any custom curriculum can be configured. Configuration does not
        establish examination-body approval or implement official promotion
        rules.
      </p>
      {current.error && <p role="alert">{current.error.message}</p>}
      {current.data?.current && (
        <div className="rounded-xl border p-5">
          <strong>{current.data.current.name}</strong>
          <p className="text-sm">
            {current.data.current.countryCode} ·{" "}
            {current.data.current.frameworkCode} · Version #
            {current.data.current.id} · {current.data.current.timeZone}
          </p>
          <p className="text-xs text-muted-foreground">
            Existing support records retain their original framework version.
          </p>
        </div>
      )}
      {!org ? (
        <p>Select your school in the Success Loop first.</p>
      ) : current.data?.canConfigure ? (
        <form
          className="grid gap-3 rounded-xl border p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {[
            ["Country ISO code", country, setCountry],
            ["Framework code (PSLE / JCE / BGCSE / CUSTOM)", code, setCode],
            ["School curriculum name", name, setName],
            ["IANA timezone", zone, setZone],
            ["Language tags, comma separated", languages, setLanguages],
            ["Curriculum version", version, setVersion],
            ["Year / grade labels, comma separated", levels, setLevels],
          ].map(([title, value, set]) => (
            <label className="text-sm" key={String(title)}>
              {String(title)}
              <input
                required
                className={field}
                value={value as string}
                onChange={(e) => (set as (s: string) => void)(e.target.value)}
              />
            </label>
          ))}
          <label className="text-sm">
            School notes
            <textarea
              className={field}
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Grading bands (JSON; percentages, including a zero floor)
            <textarea
              className={field + " font-mono"}
              rows={3}
              value={scale}
              onChange={(e) => setScale(e.target.value)}
            />
          </label>
          <button disabled={save.isPending} className={button}>
            Save new framework version
          </button>
          {save.error && <p role="alert">{save.error.message}</p>}
          {save.isSuccess && <p role="status">New framework version saved.</p>}
        </form>
      ) : (
        <p className="text-sm">
          Only school owners and administrators can publish new framework
          settings.
        </p>
      )}
    </section>
  );
}
