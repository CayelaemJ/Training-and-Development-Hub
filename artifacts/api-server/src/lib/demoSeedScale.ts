import { and, eq, inArray, like, sql } from "drizzle-orm";
import {
  db, usersTable, organizationsTable, organizationMembersTable, academicSettingsTable, academicCoursesTable,
  academicPeriodsTable, courseEnrollmentsTable, academicAssessmentsTable, academicGradesTable,
  courseStaffAssignmentsTable, managementUnitsTable, managementRoleGrantsTable, schoolAttendanceTable,
  guardianRelationshipsTable, guardianVerificationEventsTable, verifiedEnrollmentsTable, institutionSetupTable,
  classChatChannelsTable, classChatMessagesTable, accountabilityCasesTable,
} from "@workspace/db";
import { openCase } from "./accountabilityService";

/**
 * Demo dataset at school scale: about 450 fictional people across a South
 * African secondary school, a Botswana senior school, an independent school
 * and a university, with every subject, three terms of published results,
 * six weeks of attendance, verified guardians, class chats and accountability
 * cases. Deterministic (seeded random numbers) and idempotent: rerunning adds
 * nothing that already exists and never overwrites edited results.
 *
 * Same guard as seedCaboDemo: only on an isolated, explicitly enabled testing
 * database. All names are invented combinations; ids use the cabo-fixture-
 * prefix and addresses use the reserved example.invalid domain.
 */

const FIRST = ["Amahle", "Bontle", "Kagiso", "Lesedi", "Thandiwe", "Neo", "Ofentse", "Tumelo", "Zinhle", "Lwazi", "Naledi", "Karabo", "Onalenna", "Masego", "Kabelo", "Refilwe", "Sibusiso", "Nandi", "Tshepo", "Ayanda", "Boitumelo", "Katlego", "Mpho", "Lindiwe", "Thato", "Palesa", "Sello", "Keabetswe", "Unathi", "Wandile", "Aaliyah", "Dineo", "Gaone", "Itumeleng", "Junior", "Kgosi", "Lorato", "Mosa", "Nomvula", "Omphile", "Pule", "Rethabile", "Siyabonga", "Tebogo", "Usisipho", "Vuyo", "Xolani", "Yolanda", "Zola", "Priya"];
const LAST = ["Dlamini", "Mokoena", "Ndlovu", "Sithole", "Khumalo", "Mahlangu", "Nkosi", "Molefe", "Mabaso", "Radebe", "Modise", "Kgosana", "Tau", "Phiri", "Seretse", "Motsamai", "Gaolathe", "Ramotswe", "Mogale", "Ntuli", "Zungu", "Botha", "Naidoo", "Pillay", "Masilo", "Kekana", "Letsholo", "Mmusi", "Segokgo", "Tshabalala"];

/** mulberry32: small seeded generator so every run produces the same people and marks. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function normal(r: () => number, mean: number, sd: number) {
  const u = Math.max(r(), 1e-9), v = r();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const uid = (key: string) => `cabo-fixture-${key}`;

async function chunked<T>(rows: T[], size: number, run: (part: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await run(rows.slice(i, i + size));
}

type Person = { key: string; firstName: string; lastName: string };

function makePeople(prefix: string, count: number, seed: number): Person[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => ({
    key: `${prefix}-${String(i + 1).padStart(3, "0")}`,
    firstName: FIRST[Math.floor(r() * FIRST.length)],
    lastName: LAST[Math.floor(r() * LAST.length)],
  }));
}

async function ensureUsers(people: readonly Person[]) {
  await chunked([...people], 500, part => db.insert(usersTable)
    .values(part.map(p => ({ id: uid(p.key), email: `${p.key}@example.invalid`, firstName: p.firstName, lastName: p.lastName })))
    .onConflictDoNothing());
}

async function ensureOrg(name: string, ownerKey: string): Promise<number> {
  const title = `[DEMO] ${name}`;
  const [existing] = await db.select({ id: organizationsTable.id }).from(organizationsTable).where(eq(organizationsTable.name, title)).limit(1);
  return existing?.id ?? (await db.insert(organizationsTable).values({ name: title, ownerId: uid(ownerKey) }).returning({ id: organizationsTable.id }))[0].id;
}

async function members(organizationId: number, people: readonly string[], role: string) {
  await chunked([...people], 500, part => db.insert(organizationMembersTable)
    .values(part.map(k => ({ organizationId, userId: uid(k), role }))).onConflictDoNothing());
}

async function ensurePeriods(organizationId: number, names: readonly [string, string][]): Promise<number[]> {
  const ids: number[] = [];
  for (const [name, begins] of names) {
    const [existing] = await db.select({ id: academicPeriodsTable.id }).from(academicPeriodsTable)
      .where(and(eq(academicPeriodsTable.organizationId, organizationId), eq(academicPeriodsTable.name, name), eq(academicPeriodsTable.year, 2026))).limit(1);
    if (existing) {
      await db.update(academicPeriodsTable).set({ beginsAt: new Date(begins) }).where(and(eq(academicPeriodsTable.id, existing.id), sql`${academicPeriodsTable.beginsAt} IS NULL`));
      ids.push(existing.id);
    } else {
      ids.push((await db.insert(academicPeriodsTable).values({ organizationId, name, year: 2026, beginsAt: new Date(begins) }).returning({ id: academicPeriodsTable.id }))[0].id);
    }
  }
  return ids;
}

async function ensureCourse(organizationId: number, code: string, name: string, level: string, teacherKey: string, assignedBy: string): Promise<number> {
  const [row] = await db.insert(academicCoursesTable).values({ organizationId, code, name, level })
    .onConflictDoUpdate({ target: [academicCoursesTable.organizationId, academicCoursesTable.code, academicCoursesTable.level], set: { name: sql`${academicCoursesTable.name}` } })
    .returning({ id: academicCoursesTable.id });
  await db.insert(courseStaffAssignmentsTable).values({ organizationId, courseId: row.id, staffId: uid(teacherKey), assignedBy: uid(assignedBy) }).onConflictDoNothing();
  return row.id;
}

async function ensureAssessment(organizationId: number, courseId: number, periodId: number, title: string, category: string, createdBy: string): Promise<number> {
  const [existing] = await db.select({ id: academicAssessmentsTable.id }).from(academicAssessmentsTable).where(and(
    eq(academicAssessmentsTable.organizationId, organizationId), eq(academicAssessmentsTable.courseId, courseId),
    eq(academicAssessmentsTable.periodId, periodId), eq(academicAssessmentsTable.title, title))).limit(1);
  return existing?.id ?? (await db.insert(academicAssessmentsTable).values({
    organizationId, courseId, periodId, title, category, maxMarks: 100, weight: category === "test" ? 60 : 40,
    instructions: "Synthetic demo assessment, not an official grade", createdBy: uid(createdBy),
  }).returning({ id: academicAssessmentsTable.id }))[0].id;
}

type SchoolPlan = {
  name: string; country: "ZA" | "BW"; framework: string; curriculum: string; institutionType: string;
  head: Person; staff: Person[]; seed: number;
  /** level -> learners */
  cohorts: { level: string; learners: Person[] }[];
  core: [string, string][]; streams: [string, string][][];
  periods: [string, string][];
  guardians: number;
  existingOrgName?: string; existingLearners?: string[]; existingParent?: [string, string];
};

const ZA_CORE: [string, string][] = [["ENG", "English Home Language"], ["ZUL", "isiZulu First Additional Language"], ["MAT", "Mathematics"], ["LIF", "Life Orientation"]];
const ZA_STREAMS: [string, string][][] = [
  [["PHY", "Physical Sciences"], ["LSC", "Life Sciences"], ["GEO", "Geography"]],
  [["ACC", "Accounting"], ["BUS", "Business Studies"], ["CAT", "Computer Applications Technology"]],
  [["HIS", "History"], ["GEO", "Geography"], ["LSC", "Life Sciences"]],
];
const BW_CORE: [string, string][] = [["ENG", "English Language"], ["SET", "Setswana"], ["MAT", "Mathematics"], ["SCI", "Combined Science"]];
const BW_STREAMS: [string, string][][] = [
  [["PHY", "Physics"], ["CHE", "Chemistry"], ["BIO", "Biology"]],
  [["ACC", "Accounting"], ["BUS", "Business Studies"], ["COM", "Computer Studies"]],
  [["HIS", "History"], ["GEO", "Geography"], ["DEV", "Development Studies"]],
];
const TERMS: [string, string][] = [["Term 1 — Demo", "2026-01-14"], ["Term 2 — Demo", "2026-04-08"], ["Term 3 — Demo", "2026-07-21"]];

/** Schooldays (Mon-Fri) in the six weeks to 20 November 2026. */
function schoolDays(): string[] {
  const days: string[] = [];
  for (let d = new Date("2026-10-12T00:00:00Z"); d <= new Date("2026-11-20T00:00:00Z"); d = new Date(d.getTime() + 86_400_000)) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function seedSchool(plan: SchoolPlan) {
  const r = rng(plan.seed);
  await ensureUsers([plan.head, ...plan.staff, ...plan.cohorts.flatMap(c => c.learners)]);
  const organizationId = plan.existingOrgName ? await ensureOrg(plan.existingOrgName, plan.head.key) : await ensureOrg(plan.name, plan.head.key);
  await members(organizationId, [plan.head.key], "owner");
  await members(organizationId, plan.staff.map(s => s.key), "teacher");
  await members(organizationId, plan.cohorts.flatMap(c => c.learners.map(l => l.key)), "learner");
  await db.insert(academicSettingsTable).values({ organizationId, institutionType: "school", framework: plan.framework, academicYear: 2026 }).onConflictDoNothing();
  await db.insert(institutionSetupTable).values({
    organizationId, institutionType: plan.institutionType, countryCode: plan.country, province: plan.country === "ZA" ? "Gauteng" : "Kgalagadi",
    district: plan.country === "ZA" ? "Johannesburg North (demo)" : "Tsabong (demo)", curriculum: plan.curriculum, academicYear: 2026,
    status: "draft", updatedBy: uid(plan.head.key),
  }).onConflictDoNothing();

  // Management: school unit, deputy, one grade head per cohort.
  const unitId = async (name: string, type: string, parentId: number | null) => {
    const [existing] = await db.select({ id: managementUnitsTable.id }).from(managementUnitsTable)
      .where(and(eq(managementUnitsTable.organizationId, organizationId), eq(managementUnitsTable.name, name))).limit(1);
    return existing?.id ?? (await db.insert(managementUnitsTable).values({ organizationId, name, type, parentId, createdBy: uid(plan.head.key) }).returning({ id: managementUnitsTable.id }))[0].id;
  };
  const school = await unitId(`${plan.name} (school)`, "school", null);
  const grants: { unitId: number; userId: string; role: string }[] = [
    { unitId: school, userId: uid(plan.head.key), role: "headmaster" },
    { unitId: school, userId: uid(plan.staff[0].key), role: "deputy_headmaster" },
  ];
  for (const [i, cohort] of plan.cohorts.entries()) {
    const grade = await unitId(`${cohort.level} (grade)`, "grade", school);
    grants.push({ unitId: grade, userId: uid(plan.staff[(i + 1) % plan.staff.length].key), role: "grade_head" });
  }
  await db.insert(managementRoleGrantsTable).values(grants.map(g => ({ ...g, organizationId, grantedBy: uid(plan.head.key) }))).onConflictDoNothing();

  const periodIds = await ensurePeriods(organizationId, plan.periods);
  let teacherIndex = 0;
  const nextTeacher = () => plan.staff[(teacherIndex++) % plan.staff.length].key;
  const days = schoolDays();
  const enrolments: { courseId: number; userId: string }[] = [];
  const verified: { organizationId: number; learnerId: string; stage: string; academicYear: number; status: string; recordedBy: string }[] = [];
  const attendance: { organizationId: number; learnerId: string; day: string; status: string; note: string; recordedBy: string }[] = [];
  const gradeRows: { assessmentId: number; learnerId: string; marks: number; status: string; reviewedBy: string; feedback: string }[] = [];
  const courseIds: number[] = [];

  for (const cohort of plan.cohorts) {
    const suffix = cohort.level.replace(/\D+/g, "") || cohort.level.slice(0, 2).toUpperCase();
    const subjects = new Map<string, { id: number; name: string; teacher: string; assessments: number[][] }>();
    const subjectFor = async (code: string, name: string) => {
      if (subjects.has(code)) return subjects.get(code)!;
      const teacher = nextTeacher();
      const id = await ensureCourse(organizationId, `${code}${suffix}`, name, cohort.level, teacher, plan.head.key);
      courseIds.push(id);
      const assessments: number[][] = [];
      for (const [t, periodId] of periodIds.entries()) assessments.push([
        await ensureAssessment(organizationId, id, periodId, `${name} test (term ${t + 1})`, "test", teacher),
        await ensureAssessment(organizationId, id, periodId, `${name} assignment (term ${t + 1})`, "assignment", teacher),
      ]);
      const entry = { id, name, teacher, assessments };
      subjects.set(code, entry);
      return entry;
    };
    for (const [i, learner] of cohort.learners.entries()) {
      const ability = clamp(normal(r, 62, 12), 28, 96);
      const momentum = normal(r, 0, 3);
      const stream = plan.streams[i % plan.streams.length];
      verified.push({ organizationId, learnerId: uid(learner.key), stage: cohort.level, academicYear: 2026, status: "active", recordedBy: uid(plan.head.key) });
      for (const [code, name] of [...plan.core, ...stream]) {
        const s = await subjectFor(code, name);
        enrolments.push({ courseId: s.id, userId: uid(learner.key) });
        const subjectOffset = normal(r, 0, 8);
        for (const [t, pair] of s.assessments.entries()) for (const assessmentId of pair) {
          const marks = Math.round(clamp(ability + subjectOffset + momentum * t + normal(r, 0, 6), 8, 100));
          gradeRows.push({ assessmentId, learnerId: uid(learner.key), marks, status: "published", reviewedBy: uid(s.teacher), feedback: "Synthetic demo result — not an official grade" });
        }
      }
      const absentRate = clamp(normal(r, 0.05, 0.05), 0, 0.3);
      for (const day of days) {
        const x = r();
        attendance.push({ organizationId, learnerId: uid(learner.key), day, status: x < absentRate ? "absent" : x < absentRate + 0.04 ? "late" : "present", note: "", recordedBy: uid(plan.head.key) });
      }
    }
  }
  await chunked(enrolments, 1000, part => db.insert(courseEnrollmentsTable).values(part).onConflictDoNothing());
  await chunked(verified, 500, part => db.insert(verifiedEnrollmentsTable).values(part).onConflictDoNothing());
  // Never overwrite a result someone has edited since seeding.
  await chunked(gradeRows, 1000, part => db.insert(academicGradesTable).values(part).onConflictDoNothing());
  await chunked(attendance, 1000, part => db.insert(schoolAttendanceTable).values(part).onConflictDoNothing());

  // Guardians: one per learner for the first N learners, verified by the school.
  const learners = plan.cohorts.flatMap(c => c.learners);
  const guardians = makePeople(`gen-${plan.country.toLowerCase()}${plan.seed}-guardian`, plan.guardians, plan.seed + 7)
    .map((g, i) => ({ ...g, lastName: learners[i].lastName }));
  const pairs: [string, string][] = guardians.map((g, i) => [learners[i].key, g.key]);
  if (plan.existingParent) pairs.push(plan.existingParent);
  await ensureUsers(guardians);
  await db.insert(guardianRelationshipsTable).values(pairs.map(([learner, guardian]) => ({ learnerId: uid(learner), guardianId: uid(guardian), status: "verified", respondedAt: new Date("2026-02-01") })))
    .onConflictDoUpdate({ target: [guardianRelationshipsTable.learnerId, guardianRelationshipsTable.guardianId], set: { status: "verified" } });
  const relationships = await db.select({ id: guardianRelationshipsTable.id }).from(guardianRelationshipsTable)
    .where(inArray(guardianRelationshipsTable.guardianId, pairs.map(([, g]) => uid(g))));
  const reviewed = new Set((await db.select({ id: guardianVerificationEventsTable.relationshipId }).from(guardianVerificationEventsTable)
    .where(and(eq(guardianVerificationEventsTable.organizationId, organizationId), inArray(guardianVerificationEventsTable.relationshipId, relationships.map(x => x.id))))).map(x => x.id));
  const pending = relationships.filter(x => !reviewed.has(x.id));
  if (pending.length) await db.insert(guardianVerificationEventsTable).values(pending.map(x => ({ relationshipId: x.id, organizationId, reviewedBy: uid(plan.head.key), decision: "verified" })));

  // Class chat in the first cohort's subjects, with ordinary messages.
  const firstLevel = plan.cohorts[0];
  const chatCourses = await db.select({ id: academicCoursesTable.id, name: academicCoursesTable.name }).from(academicCoursesTable)
    .where(and(eq(academicCoursesTable.organizationId, organizationId), eq(academicCoursesTable.level, firstLevel.level))).limit(3);
  for (const c of chatCourses) {
    const [channel] = await db.insert(classChatChannelsTable).values({ organizationId, courseId: c.id, status: "open", createdBy: uid(plan.head.key) })
      .onConflictDoUpdate({ target: classChatChannelsTable.courseId, set: { status: sql`${classChatChannelsTable.status}` } }).returning();
    const [has] = await db.select({ n: sql<number>`count(*)::int` }).from(classChatMessagesTable).where(eq(classChatMessagesTable.channelId, channel.id));
    if (Number(has?.n ?? 0) > 0) continue;
    const [a, b, d] = firstLevel.learners;
    await db.insert(classChatMessagesTable).values([
      { channelId: channel.id, organizationId, authorId: uid(plan.staff[0].key), body: `Welcome to the ${c.name} chat. Ask questions about the work here; be kind and stay on topic.`, status: "visible" },
      { channelId: channel.id, organizationId, authorId: uid(a.key), body: "Which pages do we need for Friday's test?", status: "visible" },
      { channelId: channel.id, organizationId, authorId: uid(b.key), body: "I think chapters 4 and 5, the teacher said in class.", status: "visible" },
      { channelId: channel.id, organizationId, authorId: uid(d.key), body: "Can someone explain question 3 from the homework?", status: "visible" },
    ]);
  }

  // A few accountability cases so dashboards have something to show.
  const [anyCase] = await db.select({ id: accountabilityCasesTable.id }).from(accountabilityCasesTable)
    .where(and(eq(accountabilityCasesTable.organizationId, organizationId), like(accountabilityCasesTable.summary, "[DEMO]%"))).limit(1);
  if (!anyCase) {
    const L = learners;
    await openCase({ organizationId, kind: "safeguarding", severity: "high", reporterId: uid(L[3].key), subjectUserId: uid(L[4].key), summary: "[DEMO] A learner reports that an older learner is demanding their lunch money." });
    await openCase({ organizationId, kind: "service", severity: "medium", reporterId: uid(plan.staff[2].key), summary: "[DEMO] Projector in the science lab has not worked for two weeks." });
    const late = await openCase({ organizationId, kind: "conduct", severity: "medium", reporterId: uid(guardians[0].key), subjectUserId: uid(plan.staff[3].key), summary: "[DEMO] A parent says homework feedback was not returned for a month." });
    // Make one case overdue so the next sweep escalates it on screen.
    await db.update(accountabilityCasesTable).set({ acknowledgeDueAt: new Date(Date.now() - 3_600_000) }).where(eq(accountabilityCasesTable.id, late.id));
    await openCase({ organizationId, kind: "data_incident", severity: "high", reporterId: uid(plan.staff[1].key), summary: "[DEMO] A class list with learner names was emailed to the wrong parent group.", awareAt: new Date(Date.now() - 20 * 3_600_000) });
  }
  return { organizationId, learners: learners.length, staff: plan.staff.length + 1, guardians: guardians.length, courses: courseIds.length, grades: gradeRows.length, attendance: attendance.length };
}

export async function seedCaboDemoAtScale(): Promise<void> {
  if ((process.env.CABO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME) !== "testing" ||
      process.env.CABO_TEST_DATABASE_ISOLATED !== "true" ||
      process.env.ENABLE_CABO_DEMO_SEED !== "true") {
    throw new Error("CABO demo fixtures require an isolated and explicitly enabled test database.");
  }
  const named = (key: string, firstName: string, lastName: string): Person => ({ key, firstName, lastName });
  const za = makePeople("gen-za-learner", 183, 11);
  const zaStaff = [named("teacher-gradehead", "Refilwe", "Ntuli"), ...makePeople("gen-za-teacher", 13, 12)];
  const bw = makePeople("gen-bw-learner", 108, 21);
  const bwStaff = [named("teacher-bw", "Onalenna", "Seretse"), ...makePeople("gen-bw-teacher", 9, 22)];
  const hv = makePeople("gen-hv-learner", 34, 31);
  const hvStaff = makePeople("gen-hv-teacher", 5, 32);
  // The named demo learners join the large classes so their dashboards are full.
  const zaGrade12 = [named("learner-south-a", "Lerato", "Mahlobo"), named("learner-south-b", "Sipho", "Khumalo"), named("learner-south-c", "Anele", "Radebe"), ...za.slice(0, 61)];
  await ensureUsers([named("parent-bw", "Lorato", "Ramotswe")]);
  const results = [];
  results.push(await seedSchool({
    name: "Ubuntu Future Secondary School", existingOrgName: "Ubuntu Future Secondary School", country: "ZA", framework: "NSC", curriculum: "CAPS (NSC)", institutionType: "highschool",
    head: named("headmaster-south", "Nomsa", "Dube"), staff: [named("teacher-south", "Thabo", "Maseko"), named("assessor-south", "Palesa", "Mokoena"), ...zaStaff], seed: 101,
    cohorts: [{ level: "Grade 12", learners: zaGrade12 }, { level: "Grade 11", learners: za.slice(61, 122) }, { level: "Grade 10", learners: za.slice(122) }],
    core: ZA_CORE, streams: ZA_STREAMS, periods: TERMS, guardians: 45, existingParent: ["learner-south-a", "parent-south"],
  }));
  results.push(await seedSchool({
    name: "Kgalagadi Community Senior School", country: "BW", framework: "BGCSE", curriculum: "BGCSE", institutionType: "highschool",
    head: named("headmaster-bw", "Kgosi", "Gaolathe"), staff: bwStaff, seed: 202,
    cohorts: [{ level: "Form 5", learners: [named("learner-bw", "Masego", "Ramotswe"), ...bw.slice(0, 54)] }, { level: "Form 4", learners: bw.slice(54) }],
    core: BW_CORE, streams: BW_STREAMS, periods: TERMS, guardians: 25, existingParent: ["learner-bw", "parent-bw"],
  }));
  results.push(await seedSchool({
    name: "Highveld Independent Academy", existingOrgName: "Highveld Independent Academy", country: "ZA", framework: "IEB", curriculum: "IEB", institutionType: "independent",
    head: named("headmaster-north", "Musa", "Mabena"), staff: hvStaff, seed: 303,
    cohorts: [{ level: "Grade 12", learners: [named("learner-north", "Sihle", "Naidoo"), ...hv] }],
    core: [["ENG", "English Home Language"], ["AFR", "Afrikaans First Additional Language"], ["MAT", "Mathematics"], ["LIF", "Life Orientation"]],
    streams: [[["PHY", "Physical Sciences"], ["LSC", "Life Sciences"], ["IT", "Information Technology"]], [["ACC", "Accounting"], ["ECO", "Economics"], ["DRA", "Dramatic Arts"]]],
    periods: TERMS, guardians: 5,
  }));
  const total = results.reduce((n, x) => n + x.learners + x.staff + x.guardians, 0);
  console.info(`CABO demo at scale ready: ${results.length} schools, ${total} people, ${results.reduce((n, x) => n + x.courses, 0)} subject classes, ${results.reduce((n, x) => n + x.grades, 0)} results, ${results.reduce((n, x) => n + x.attendance, 0)} attendance rows`);
}
