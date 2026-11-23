import { and, eq, inArray, like, sql } from "drizzle-orm";
import {
  db, organizationsTable, organizationMembersTable, courseEnrollmentsTable, courseStaffAssignmentsTable,
  academicCoursesTable, learnerSupportTicketsTable, learnerSupportEventsTable, studyMaterialsTable,
  quizzesTable, aiSubscriptionsTable, aiCreditLedgerTable, passportSharesTable, passportCompetenciesTable, guardianRelationshipsTable,
} from "@workspace/db";

/**
 * Showcase layer for the isolated demo pilot, run after seedCaboDemo and
 * seedCaboDemoAtScale. Adds the records a presenter needs to show every part of
 * the Learner Success Loop and the AI features end to end:
 *
 * - ~40 learner help requests across the four demo schools, spread over every
 *   workflow stage, each with a consistent event history (assignment, educator
 *   reply, practice checkpoint, follow-up outcome, learning-DNA review, learner
 *   feedback). The named demo sign-in learners and teachers get their own.
 * - Five AI-readable study materials (AI reading switched on) with practice
 *   quizzes, so "Ask this material" and quiz review work immediately.
 * - AI credit plans and usage so the credits page shows a healthy balance, a
 *   teacher allowance and one learner close to the limit (to show top-ups).
 *
 * Everything is fictional and marked [DEMO]. Same three guards as the other
 * demo seeders. Idempotent: request keys, object paths and ledger references
 * are unique, so a second run adds nothing.
 */
const uid = (key: string) => `cabo-fixture-${key}`;
const DAY = 86_400_000;

type Template = { concept: string; question: string; attempted: string; reply: string; practice: string };
const TEMPLATES: Record<string, Template[]> = {
  MAT: [
    { concept: "Quadratic equations", question: "When should I factorise and when should I use the quadratic formula?", attempted: "I tried factorising x² + 3x − 7 = 0 but could not find two numbers that work.", reply: "Check the discriminant first: if b² − 4ac is not a perfect square, the equation will not factorise neatly, so go straight to the formula. Worked example on page 2 of the class notes.", practice: "Five mixed quadratics: decide the method before solving." },
    { concept: "Differential calculus", question: "How do I find the turning points of a cubic graph?", attempted: "I found f′(x) but I am not sure what to do with it.", reply: "Set f′(x) = 0 and solve: those x-values are where the gradient is zero. Substitute them back into f(x) for the y-values, then use f″(x) to tell a maximum from a minimum.", practice: "Sketch three cubics using turning points and intercepts." },
    { concept: "Algebraic fractions", question: "How do I find the lowest common denominator?", attempted: "I factorised both denominators and highlighted common factors.", reply: "Good start. Take every factor that appears, each at its highest power. Then multiply each fraction up so the denominators match.", practice: "Six fractions with factorised denominators." },
  ],
  PHY: [
    { concept: "Newton's second law", question: "Why does the trolley accelerate less when I add mass?", attempted: "I wrote F = ma but I don't see how that explains it.", reply: "With the same net force, a bigger m means a smaller a, because a = F/m. Draw a free-body diagram first, then find the net force before using the formula.", practice: "Four free-body diagram problems, net force first." },
    { concept: "Stoichiometry", question: "How do I find the limiting reagent?", attempted: "I balanced the equation and found moles of both reactants.", reply: "Divide each reactant's moles by its coefficient in the balanced equation. The smaller result is the limiting reagent.", practice: "Three limiting-reagent calculations with mole ratios." },
  ],
  LSC: [
    { concept: "Photosynthesis", question: "What is the difference between the light and dark reactions?", attempted: "I know photosynthesis makes glucose but the stages confuse me.", reply: "The light-dependent stage happens in the thylakoids and makes ATP and NADPH. The light-independent stage (Calvin cycle) in the stroma uses them to fix CO₂ into glucose.", practice: "Label a chloroplast diagram and match each stage." },
    { concept: "Meiosis", question: "Why does meiosis make cells with half the chromosomes?", attempted: "I drew mitosis and meiosis side by side but they look similar.", reply: "Meiosis has two divisions but the DNA is copied only once. Homologous pairs separate in meiosis I, which halves the chromosome number.", practice: "Order the phases of meiosis I and II." },
  ],
  ACC: [
    { concept: "The accounting equation", question: "Why does buying equipment on credit not change owner's equity?", attempted: "I added the equipment to assets but didn't know where else to record it.", reply: "Assets go up and liabilities (creditors) go up by the same amount, so A = OE + L still balances and equity is unchanged.", practice: "Ten transactions: show the effect on A, OE and L." },
  ],
  ENG: [
    { concept: "Literary analysis", question: "How do I write a paragraph that analyses rather than retells?", attempted: "My paragraphs keep summarising the story.", reply: "Use claim, evidence, explanation. Make one claim, quote a short piece of evidence, then explain how the writer's choice supports your claim.", practice: "Rewrite one summary paragraph as an analysis paragraph." },
  ],
  BIO: [
    { concept: "Enzymes", question: "Why does a high temperature stop an enzyme working?", attempted: "I know enzymes are proteins.", reply: "Heat changes the enzyme's shape, so the active site no longer fits the substrate. That is denaturation, and it is usually permanent.", practice: "Interpret a temperature–rate graph." },
  ],
  SCI: [
    { concept: "Electric circuits", question: "Why do bulbs in series get dimmer when I add another?", attempted: "I measured the current but I'm not sure what it shows.", reply: "In series the same current flows through each bulb, and adding a bulb raises total resistance, so the current drops and each bulb gets less power.", practice: "Compare series and parallel circuits with three bulbs." },
  ],
  GEN: [
    { concept: "Exam preparation", question: "How should I plan revision for this subject?", attempted: "I reread my notes but forget things quickly.", reply: "Swap rereading for retrieval: close the notes and write what you remember, then check. Space it out over the week and mix question types.", practice: "Three 20-minute retrieval sessions this week." },
  ],
};
function templatesFor(courseName: string, code: string): Template[] {
  const key = Object.keys(TEMPLATES).find(k => code.startsWith(k)) ??
    (/math/i.test(courseName) ? "MAT" : /physic|chemi/i.test(courseName) ? "PHY" : /life|biolog/i.test(courseName) ? "LSC" : /account/i.test(courseName) ? "ACC" : /english/i.test(courseName) ? "ENG" : "GEN");
  return TEMPLATES[key];
}

// Workflow stages in the order they are spread across requests.
const STAGES = ["open", "triaged", "assigned", "in_progress", "awaiting_learner", "follow_up_required", "resolved", "closed"] as const;
const PER_SCHOOL = 10;
const NAMED_LEARNERS = ["learner-south-a", "learner-south-b", "learner-south-c", "learner-north", "learner-bw", "university-learner"].map(uid);

async function seedHelpRequests(now: Date): Promise<number> {
  const orgs = await db.select({ id: organizationsTable.id }).from(organizationsTable).where(like(organizationsTable.name, "[DEMO]%"));
  let created = 0;
  for (const { id: organizationId } of orgs) {
    const courses = await db.select({ id: academicCoursesTable.id, name: academicCoursesTable.name, code: academicCoursesTable.code, staffId: courseStaffAssignmentsTable.staffId })
      .from(academicCoursesTable)
      .innerJoin(courseStaffAssignmentsTable, and(eq(courseStaffAssignmentsTable.courseId, academicCoursesTable.id), eq(courseStaffAssignmentsTable.organizationId, organizationId)))
      .where(eq(academicCoursesTable.organizationId, organizationId))
      .orderBy(academicCoursesTable.id).limit(40);
    if (!courses.length) continue;
    const learnerIds = new Set((await db.select({ id: organizationMembersTable.userId }).from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.organizationId, organizationId), eq(organizationMembersTable.role, "learner")))).map(r => r.id));
    const enrolments = await db.select({ courseId: courseEnrollmentsTable.courseId, learnerId: courseEnrollmentsTable.userId }).from(courseEnrollmentsTable)
      .where(inArray(courseEnrollmentsTable.courseId, courses.map(c => c.id)));
    // Named demo learners first, so every demo sign-in has requests of their own.
    const pairs = enrolments.filter(e => learnerIds.has(e.learnerId))
      .sort((a, b) => Number(NAMED_LEARNERS.includes(b.learnerId)) - Number(NAMED_LEARNERS.includes(a.learnerId)) || a.courseId - b.courseId);
    const used = new Set<string>();
    let n = 0;
    for (const pair of pairs) {
      if (n >= PER_SCHOOL) break;
      const course = courses.find(c => c.id === pair.courseId)!;
      if (used.has(pair.learnerId + ":" + course.id)) continue;
      used.add(pair.learnerId + ":" + course.id);
      const stage = STAGES[n % STAGES.length];
      const t = templatesFor(course.name, course.code)[n % templatesFor(course.name, course.code).length];
      const openedAt = new Date(now.getTime() - (42 - n * 3) * DAY);
      const done = stage === "resolved" || stage === "closed";
      const baseline = 38 + ((organizationId * 7 + n * 11) % 22);
      const improvement = 8 + ((n * 5) % 14);
      const [ticket] = await db.insert(learnerSupportTicketsTable).values({
        organizationId, courseId: course.id, learnerId: pair.learnerId,
        concept: t.concept, question: t.question, attempted: t.attempted,
        status: stage, requestKey: `showcase-${organizationId}-${n}`,
        assignedTo: stage === "open" || stage === "triaged" ? null : course.staffId,
        reviewAt: stage === "follow_up_required" ? new Date(now.getTime() + 5 * DAY) : done ? new Date(openedAt.getTime() + 14 * DAY) : null,
        outcome: done ? { baseline, followup: baseline + improvement, improvementPp: improvement, comparisonReason: "Same topic, comparable published assessment before and after support", reviewedBy: course.staffId } : null,
        feedback: done ? "helpful" : null,
        createdAt: openedAt, updatedAt: new Date(openedAt.getTime() + 3 * DAY),
      }).onConflictDoNothing().returning({ id: learnerSupportTicketsTable.id });
      n++;
      if (!ticket) continue; // already seeded
      created++;
      const at = (days: number) => new Date(openedAt.getTime() + days * DAY);
      const ev: (typeof learnerSupportEventsTable.$inferInsert)[] = [
        { ticketId: ticket.id, actorId: pair.learnerId, kind: "created", body: t.question, metadata: { synthetic: true }, createdAt: openedAt },
      ];
      const reached = STAGES.indexOf(stage);
      if (reached >= STAGES.indexOf("assigned")) ev.push({ ticketId: ticket.id, actorId: course.staffId, kind: "assign", body: "Educator assignment updated", metadata: { previous: null, assignedTo: course.staffId, synthetic: true }, createdAt: at(1) });
      if (reached >= STAGES.indexOf("in_progress")) {
        ev.push({ ticketId: ticket.id, actorId: course.staffId, kind: "reply", body: t.reply, metadata: { synthetic: true }, createdAt: at(2) });
        ev.push({ ticketId: ticket.id, actorId: course.staffId, kind: "learning_dna", body: "Working on it with guided practice.", metadata: { concept: t.concept, courseId: course.id, state: "needs_practice", outcome: null, evidenceType: "educator_review", synthetic: true }, createdAt: at(2) });
      }
      if (reached >= STAGES.indexOf("follow_up_required")) ev.push({ ticketId: ticket.id, actorId: course.staffId, kind: "practice", body: t.practice, metadata: { reviewAt: (stage === "follow_up_required" ? new Date(now.getTime() + 5 * DAY) : at(14)).toISOString(), synthetic: true }, createdAt: at(4) });
      if (done) {
        ev.push({ ticketId: ticket.id, actorId: course.staffId, kind: "outcome", body: `Follow-up result ${baseline + improvement}% against ${baseline}% before support.`, metadata: { baseline, followup: baseline + improvement, improvementPp: improvement, synthetic: true }, createdAt: at(14) });
        ev.push({ ticketId: ticket.id, actorId: course.staffId, kind: "learning_dna", body: "Demonstrated in the follow-up assessment.", metadata: { concept: t.concept, courseId: course.id, state: "demonstrated", outcome: { baseline, followup: baseline + improvement, improvementPp: improvement }, evidenceType: "educator_review", synthetic: true }, createdAt: at(15) });
        ev.push({ ticketId: ticket.id, actorId: pair.learnerId, kind: "feedback", body: "Learner understood the assistance", metadata: { synthetic: true }, createdAt: at(15) });
      }
      await db.insert(learnerSupportEventsTable).values(ev);
    }
  }
  return created;
}

const MATERIALS = [
  { learner: "learner-south-a", key: "showcase-maths-functions", title: "[DEMO] Grade 12 Mathematics – Functions and Calculus Notes", text: [
    "CABO DEMO MATERIAL. Fictional study notes written for the demo pilot.",
    "A function gives exactly one output for each input. We write f(x) for the output when the input is x.",
    "The gradient of a straight line is the change in y divided by the change in x. For a curve, the derivative f′(x) gives the gradient of the tangent at each point.",
    "Rules of differentiation: the derivative of x to the power n is n times x to the power n − 1. The derivative of a constant is zero.",
    "Turning points occur where f′(x) = 0. If f″(x) is positive there, the point is a minimum; if negative, a maximum.",
    "Example: a taxi owner models daily profit as P(x) = −2x² + 120x − 1000 rand, where x is the number of trips. P′(x) = −4x + 120, so profit is greatest at x = 30 trips.",
    "A cubic graph can have up to two turning points. Find the x-intercepts by factorising, the y-intercept by substituting x = 0, and the turning points from f′(x) = 0.",
  ] , questions: [
    { prompt: "What is the derivative of 3x²?", options: ["6x", "3x", "x³", "6"], correctOption: 0, explanation: "Multiply by the power and reduce it by one: 3 × 2 × x¹ = 6x." },
    { prompt: "At a turning point, what is f′(x)?", options: ["Zero", "One", "Undefined", "Equal to f(x)"], correctOption: 0, explanation: "The tangent is horizontal at a turning point, so the gradient is zero." },
    { prompt: "In the taxi example, how many trips give the most profit?", options: ["30", "60", "120", "10"], correctOption: 0, explanation: "Set −4x + 120 = 0, so x = 30." },
  ]},
  { learner: "learner-south-b", key: "showcase-life-sciences-photosynthesis", title: "[DEMO] Life Sciences – Photosynthesis and Respiration Notes", text: [
    "CABO DEMO MATERIAL. Fictional study notes written for the demo pilot.",
    "Photosynthesis takes place in chloroplasts. Light energy is converted into chemical energy stored in glucose.",
    "The light-dependent reactions happen in the thylakoid membranes. Water is split, oxygen is released, and ATP and NADPH are produced.",
    "The light-independent reactions (the Calvin cycle) happen in the stroma. ATP and NADPH are used to fix carbon dioxide into glucose.",
    "Cellular respiration releases energy from glucose. Aerobic respiration uses oxygen and produces carbon dioxide, water and many ATP molecules.",
    "Photosynthesis and respiration are linked: the products of one are the reactants of the other.",
    "Factors that limit photosynthesis include light intensity, carbon dioxide concentration and temperature.",
  ], questions: [
    { prompt: "Where does the Calvin cycle take place?", options: ["Stroma", "Thylakoid membrane", "Mitochondrion", "Nucleus"], correctOption: 0, explanation: "The light-independent reactions happen in the stroma of the chloroplast." },
    { prompt: "Which gas is released when water is split?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], correctOption: 0, explanation: "Splitting water in the light reactions releases oxygen." },
  ]},
  { learner: "learner-bw", key: "showcase-accounting-equation", title: "[DEMO] Accounting – The Accounting Equation Notes", text: [
    "CABO DEMO MATERIAL. Fictional study notes written for the demo pilot.",
    "The accounting equation is Assets = Owner's Equity + Liabilities. Every transaction keeps it in balance.",
    "Assets are what the business owns, such as equipment, stock and cash in the bank.",
    "Liabilities are what the business owes, such as loans and amounts owed to creditors.",
    "Owner's equity is the owner's interest in the business. Capital increases it; drawings and expenses decrease it; income increases it.",
    "Example: a spaza shop buys a fridge for P4 000 on credit. Assets increase by P4 000 and liabilities increase by P4 000. Equity does not change.",
    "Example: the owner takes P500 cash for personal use. Assets decrease by P500 and owner's equity decreases by P500 (drawings).",
  ], questions: [
    { prompt: "Buying equipment on credit affects which elements?", options: ["Assets and liabilities", "Assets and equity", "Liabilities and equity", "Only assets"], correctOption: 0, explanation: "Assets go up and the amount owed to the creditor goes up by the same amount." },
    { prompt: "Drawings decrease which element?", options: ["Owner's equity", "Liabilities", "Income", "Creditors"], correctOption: 0, explanation: "Drawings are the owner taking value out of the business, which reduces equity." },
  ]},
  { learner: "learner-north", key: "showcase-physical-sciences-newton", title: "[DEMO] Physical Sciences – Newton's Laws Notes", text: [
    "CABO DEMO MATERIAL. Fictional study notes written for the demo pilot.",
    "Newton's first law: an object stays at rest or moves at constant velocity unless a net force acts on it.",
    "Newton's second law: the net force on an object equals its mass times its acceleration, F = ma.",
    "Newton's third law: when object A exerts a force on object B, B exerts an equal and opposite force on A.",
    "Always draw a free-body diagram first and find the net force before using F = ma.",
    "Example: a 1 200 kg minibus taxi accelerates at 2 m/s². The net force is 1 200 × 2 = 2 400 N.",
    "Friction acts opposite to the direction of motion and reduces the net force.",
  ], questions: [
    { prompt: "What is the net force on a 1 200 kg taxi accelerating at 2 m/s²?", options: ["2 400 N", "600 N", "1 202 N", "24 000 N"], correctOption: 0, explanation: "F = ma = 1 200 × 2 = 2 400 N." },
    { prompt: "Which law describes action–reaction pairs?", options: ["Third law", "First law", "Second law", "Law of gravitation"], correctOption: 0, explanation: "Newton's third law describes equal and opposite forces between two objects." },
  ]},
  { learner: "university-learner", key: "showcase-research-methods", title: "[DEMO] Research Methods – Sampling and Bias Notes", text: [
    "CABO DEMO MATERIAL. Fictional study notes written for the demo pilot.",
    "A population is the whole group you want to learn about. A sample is the part you actually measure.",
    "Random sampling gives every member of the population an equal chance of selection, which reduces selection bias.",
    "Stratified sampling divides the population into groups, such as provinces or grades, and samples from each group.",
    "Bias is a systematic error that pushes results in one direction. Common sources are non-response, leading questions and convenience samples.",
    "A larger sample reduces random error but does not remove bias.",
    "Always report how the sample was chosen so readers can judge whether the results apply to the population.",
  ], questions: [
    { prompt: "What does random sampling mainly reduce?", options: ["Selection bias", "Sample size", "Cost", "Response time"], correctOption: 0, explanation: "Giving everyone an equal chance of selection reduces selection bias." },
    { prompt: "Does a larger sample remove bias?", options: ["No, it only reduces random error", "Yes, always", "Only for surveys", "Only for experiments"], correctOption: 0, explanation: "Bias is systematic; more data with the same bias stays biased." },
  ]},
] as const;

async function seedMaterials(): Promise<number> {
  let created = 0;
  for (const m of MATERIALS) {
    const owner = uid(m.learner);
    const text = m.text.join("\n\n");
    const objectPath = "/demo-showcase-material/" + m.key;
    const [existing] = await db.select({ id: studyMaterialsTable.id }).from(studyMaterialsTable)
      .where(and(eq(studyMaterialsTable.userId, owner), eq(studyMaterialsTable.objectPath, objectPath))).limit(1);
    const material = existing ?? (await db.insert(studyMaterialsTable).values({
      userId: owner, title: m.title, fileName: m.key + ".txt", contentType: "text/plain",
      sizeBytes: Buffer.byteLength(text), objectPath, characterCount: text.length,
    }).returning({ id: studyMaterialsTable.id }))[0];
    if (!existing) created++;
    // Synthetic notes owned by a fictional learner: AI reading is switched on
    // so the tutor, quiz generation and citations can be shown live.
    await db.execute(sql`UPDATE study_materials SET extracted_text=${text}, allow_ai_reading=true WHERE id=${material.id} AND user_id=${owner}`);
    const quizTitle = m.title.replace("Notes", "Practice Quiz");
    const [quiz] = await db.select({ id: quizzesTable.id }).from(quizzesTable)
      .where(and(eq(quizzesTable.materialId, material.id), eq(quizzesTable.userId, owner), eq(quizzesTable.title, quizTitle))).limit(1);
    if (!quiz) await db.insert(quizzesTable).values({
      userId: owner, materialId: material.id, title: quizTitle, difficulty: "practice",
      questionCount: m.questions.length, optionCount: 4, modelId: "synthetic-demo-no-ai", promptVersion: "pilot-demo-v1",
      questions: m.questions.map(q => ({ prompt: q.prompt, options: [...q.options], correctOption: q.correctOption, explanation: q.explanation })),
    });
  }
  return created;
}

async function seedCredits(now: Date): Promise<void> {
  const periodEnd = new Date(now.getTime() + 30 * DAY);
  const plans: [string, string][] = [["learner-south-a", "plus"], ["teacher-south", "educator"], ["headmaster-south", "pro"], ["learner-north", "plus"]];
  for (const [key, plan] of plans) {
    await db.insert(aiSubscriptionsTable).values({ userId: uid(key), plan, status: "active", currentPeriodEnd: periodEnd, provider: "demo", providerReference: `demo-showcase-${key}` })
      .onConflictDoNothing();
  }
  // This month's usage, so balances look lived-in. learner-bw (free plan, 30
  // credits) is left with 4 credits to demonstrate the top-up flow.
  const usage: [string, number, string][] = [
    ["learner-south-a", 18, "material_qa"], ["learner-south-a", 12, "quiz"], ["learner-south-a", 9, "learner_support"],
    ["teacher-south", 40, "written_exam"], ["teacher-south", 25, "quiz"],
    ["learner-bw", 14, "material_qa"], ["learner-bw", 8, "quiz"], ["learner-bw", 4, "development_plan"],
  ];
  const rows = usage.map(([key, credits, operation], i) => ({
    userId: uid(key), kind: "usage", delta: -credits, operation, reference: `demo-showcase-usage-${key}-${i}`,
    createdAt: new Date(Math.max(new Date(now.getFullYear(), now.getMonth(), 1).getTime() + DAY, now.getTime() - (i + 1) * DAY)),
  }));
  await db.insert(aiCreditLedgerTable).values(rows).onConflictDoNothing();
  await db.insert(aiCreditLedgerTable).values({ userId: uid("learner-south-a"), kind: "grant", delta: 50, operation: null, reference: "demo-showcase-grant-learner-south-a" }).onConflictDoNothing();
}

/**
 * Passport shares so the demo university and employer have learners to open,
 * plus one waiting for a parent's approval. Learners with a verified guardian
 * are only shared as approved by that guardian, exactly as the app requires.
 */
async function seedPassportShares(now: Date): Promise<number> {
  const orgId = async (name: string) => (await db.select({ id: organizationsTable.id }).from(organizationsTable).where(eq(organizationsTable.name, `[DEMO] ${name}`)).limit(1))[0]?.id;
  const uni = await orgId("Mzanzi Digital University"), employer = await orgId("Kwezi Skills & Training");
  if (!uni || !employer) return 0;
  for (const [skill, category, level, demonstration, description] of [
    ["Python programming", "technical", 3, "project", "Built a timetable clash checker for a student society (fictional demo)."],
    ["Public speaking", "transferable", 4, "practical", "Presented a research poster at a faculty showcase (fictional demo)."],
  ] as const) {
    const [has] = await db.select({ id: passportCompetenciesTable.id }).from(passportCompetenciesTable)
      .where(and(eq(passportCompetenciesTable.userId, uid("university-learner")), eq(passportCompetenciesTable.skill, skill))).limit(1);
    if (!has) await db.insert(passportCompetenciesTable).values({ userId: uid("university-learner"), skill, category, masteryLevel: level, demonstration, description });
  }
  const plans: { learner: string; org: number; purpose: string; scope: string[]; guardian?: string; pending?: boolean }[] = [
    { learner: "learner-south-a", org: uni, purpose: "admission", scope: ["results", "learning_dna", "journey"], guardian: "parent-south" },
    { learner: "learner-bw", org: uni, purpose: "bursary", scope: ["results", "learning_dna"], guardian: "parent-bw" },
    { learner: "university-learner", org: employer, purpose: "internship", scope: ["skills", "verified_achievements", "journey", "results"] },
    { learner: "learner-south-a", org: employer, purpose: "internship", scope: ["skills", "journey"], pending: true },
  ];
  let created = 0;
  for (const p of plans) {
    const [exists] = await db.select({ id: passportSharesTable.id }).from(passportSharesTable)
      .where(and(eq(passportSharesTable.learnerId, uid(p.learner)), eq(passportSharesTable.organizationId, p.org), eq(passportSharesTable.purpose, p.purpose))).limit(1);
    if (exists) continue;
    let guardianId: string | null = null;
    if (p.guardian) {
      const [g] = await db.select({ id: guardianRelationshipsTable.guardianId }).from(guardianRelationshipsTable)
        .where(and(eq(guardianRelationshipsTable.learnerId, uid(p.learner)), eq(guardianRelationshipsTable.guardianId, uid(p.guardian)), eq(guardianRelationshipsTable.status, "verified"))).limit(1);
      if (!g) continue; // never fake an approval the guardian could not have given
      guardianId = g.id;
    }
    await db.insert(passportSharesTable).values({
      learnerId: uid(p.learner), organizationId: p.org, purpose: p.purpose, scope: p.scope,
      status: p.pending ? "pending_guardian" : "active", guardianId: p.pending ? null : guardianId,
      guardianDecidedAt: guardianId && !p.pending ? new Date(now.getTime() - 2 * DAY) : null,
      expiresAt: new Date(now.getTime() + 90 * DAY), createdAt: new Date(now.getTime() - 3 * DAY),
    });
    created++;
  }
  return created;
}

export async function seedCaboShowcase(now = new Date()): Promise<void> {
  if ((process.env.CABO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME) !== "testing" ||
      process.env.CABO_TEST_DATABASE_ISOLATED !== "true" ||
      process.env.ENABLE_CABO_DEMO_SEED !== "true") {
    throw new Error("CABO showcase fixtures require an isolated and explicitly enabled test database.");
  }
  const requests = await seedHelpRequests(now);
  const materials = await seedMaterials();
  await seedCredits(now);
  const shares = await seedPassportShares(now);
  console.info(`CABO showcase ready: ${requests} new help requests, ${materials} new AI-readable materials, ${shares} new passport shares, demo AI credit balances`);
}
