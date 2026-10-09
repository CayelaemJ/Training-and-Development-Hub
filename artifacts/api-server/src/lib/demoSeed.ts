import { and, eq } from "drizzle-orm";
import {
  db, usersTable, organizationsTable, organizationMembersTable, learnerGroupsTable,
  learnerGroupMembersTable, academicSettingsTable, academicCoursesTable, academicPeriodsTable,
  courseEnrollmentsTable, academicAssessmentsTable, academicGradesTable, academicGradeEventsTable,
  courseStaffAssignmentsTable, managementUnitsTable, managementRoleGrantsTable,
  schoolAttendanceTable, schoolNoticesTable, guardianRelationshipsTable,
} from "@workspace/db";

// Fictional, non-identifying test data. No passwords, secrets, real school names or real learners.
// Only the isolated Railway testing environment may invoke this function.
const people = [
  ["headmaster-south", "Nomsa", "Dube"],
  ["teacher-south", "Thabo", "Maseko"],
  ["assessor-south", "Palesa", "Mokoena"],
  ["learner-south-a", "Lerato", "Mahlobo"],
  ["learner-south-b", "Sipho", "Khumalo"],
  ["parent-south", "Mpho", "Mahlobo"],
  ["district-south", "Zanele", "Nkosi"],
  ["university-head", "Dr Nandi", "Molefe"],
  ["university-teacher", "Bongani", "Zulu"],
  ["university-learner", "Ayanda", "Mthembu"],
  ["company-head", "Karabo", "Pillay"],
  ["headmaster-north", "Musa", "Mabena"],
  ["learner-north", "Sihle", "Naidoo"],
] as const;
const uid = (key: string) => `cabo-fixture-${key}`;
const demoName = (name: string) => `[DEMO] ${name}`;

export async function seedCaboDemo(): Promise<void> {
  if (process.env.RAILWAY_ENVIRONMENT_NAME !== "testing" || process.env.ENABLE_CABO_DEMO_SEED !== "true") {
    throw new Error("CABO demo seeding is restricted to explicitly enabled Railway testing");
  }
  for (const [key, firstName, lastName] of people) {
    await db.insert(usersTable).values({
      id: uid(key), email: `${key}@example.invalid`, firstName, lastName,
    }).onConflictDoNothing();
  }
  async function org(name: string, owner: string) {
    const title = demoName(name);
    const [existing] = await db.select().from(organizationsTable)
      .where(and(eq(organizationsTable.name, title), eq(organizationsTable.ownerId, uid(owner)))).limit(1);
    const row = existing ?? (await db.insert(organizationsTable)
      .values({ name: title, ownerId: uid(owner) }).returning())[0];
    return row.id;
  }
  async function member(organizationId: number, key: string, role: string) {
    await db.insert(organizationMembersTable)
      .values({ organizationId, userId: uid(key), role }).onConflictDoNothing();
  }
  async function group(organizationId: number, name: string, learners: string[]) {
    const [existing] = await db.select().from(learnerGroupsTable)
      .where(and(eq(learnerGroupsTable.organizationId, organizationId), eq(learnerGroupsTable.name, name))).limit(1);
    const row = existing ?? (await db.insert(learnerGroupsTable).values({organizationId,name}).returning())[0];
    for (const learner of learners) {
      await db.insert(learnerGroupMembersTable).values({groupId:row.id,userId:uid(learner)}).onConflictDoNothing();
    }
  }
  async function course(organizationId: number, code: string, name: string, level: string, teacher: string, learners: string[]) {
    const [existing] = await db.select().from(academicCoursesTable)
      .where(and(eq(academicCoursesTable.organizationId,organizationId),eq(academicCoursesTable.code,code),eq(academicCoursesTable.level,level))).limit(1);
    const row = existing ?? (await db.insert(academicCoursesTable)
      .values({organizationId,code,name,level}).returning())[0];
    await db.insert(courseStaffAssignmentsTable).values({
      organizationId,courseId:row.id,staffId:uid(teacher),assignedBy:uid(teacher),
    }).onConflictDoNothing();
    for (const learner of learners) await db.insert(courseEnrollmentsTable)
      .values({courseId:row.id,userId:uid(learner)}).onConflictDoNothing();
    return row.id;
  }
  async function period(organizationId:number, name:string) {
    const [existing] = await db.select().from(academicPeriodsTable)
      .where(and(eq(academicPeriodsTable.organizationId,organizationId),eq(academicPeriodsTable.name,name),eq(academicPeriodsTable.year,2026))).limit(1);
    return (existing ?? (await db.insert(academicPeriodsTable)
      .values({organizationId,name,year:2026}).returning())[0]).id;
  }
  async function assessment(organizationId:number,courseId:number,periodId:number,title:string,createdBy:string,grades:[string,number][]) {
    const [existing] = await db.select().from(academicAssessmentsTable).where(and(
      eq(academicAssessmentsTable.organizationId,organizationId),eq(academicAssessmentsTable.courseId,courseId),
      eq(academicAssessmentsTable.periodId,periodId),eq(academicAssessmentsTable.title,title),
    )).limit(1);
    const row = existing ?? (await db.insert(academicAssessmentsTable).values({
      organizationId,courseId,periodId,title,category:"test",maxMarks:100,weight:25,
      instructions:"Synthetic marks for UI and permissions testing only",createdBy:uid(createdBy),
    }).returning())[0];
    for (const [learner,marks] of grades) {
      const [previous] = await db.select().from(academicGradesTable)
        .where(and(eq(academicGradesTable.assessmentId,row.id),eq(academicGradesTable.learnerId,uid(learner)))).limit(1);
      if (previous) continue; // Never overwrite manual test results.
      const [grade] = await db.insert(academicGradesTable).values({
        assessmentId:row.id,learnerId:uid(learner),marks,status:"published",
        reviewedBy:uid(createdBy),feedback:"Synthetic baseline assessment — not an official grade",
      }).returning();
      await db.insert(academicGradeEventsTable).values({
        gradeId:grade.id,changedBy:uid(createdBy),oldMarks:null,newMarks:marks,
        oldStatus:null,newStatus:"published",reason:"Initial synthetic demo fixture",
      });
    }
  }
  async function unit(organizationId:number,name:string,type:string,createdBy:string) {
    const [existing] = await db.select().from(managementUnitsTable).where(and(
      eq(managementUnitsTable.organizationId,organizationId),eq(managementUnitsTable.name,name),
    )).limit(1);
    return (existing ?? (await db.insert(managementUnitsTable).values({
      organizationId,name,type,createdBy:uid(createdBy),
    }).returning())[0]).id;
  }
  async function grant(organizationId:number,unitId:number,person:string,role:string,by:string) {
    await db.insert(managementRoleGrantsTable).values({
      organizationId,unitId,userId:uid(person),role,grantedBy:uid(by),
    }).onConflictDoNothing();
  }

  const south = await org("Ubuntu Future Secondary School", "headmaster-south");
  const north = await org("Highveld Independent Academy", "headmaster-north");
  const uni = await org("Mzanzi Digital University", "university-head");
  const company = await org("Kwezi Skills & Training", "company-head");
  for (const [organizationId, assignments] of [
    [south, [["headmaster-south","owner"],["teacher-south","teacher"],["assessor-south","assessor"],["learner-south-a","learner"],["learner-south-b","learner"],["district-south","admin"]]],
    [north, [["headmaster-north","owner"],["learner-north","learner"]]],
    [uni, [["university-head","owner"],["university-teacher","teacher"],["university-learner","learner"]]],
    [company, [["company-head","owner"]]],
  ] as [number,string[][]][]) {
    for (const [person,role] of assignments) await member(organizationId,person,role);
  }
  await db.insert(academicSettingsTable).values({organizationId:south,institutionType:"school",framework:"NSC",academicYear:2026}).onConflictDoNothing();
  await db.insert(academicSettingsTable).values({organizationId:north,institutionType:"school",framework:"IEB",academicYear:2026}).onConflictDoNothing();
  await db.insert(academicSettingsTable).values({organizationId:uni,institutionType:"university",framework:"UNIVERSITY",academicYear:2026}).onConflictDoNothing();
  await group(south,"Grade 12A — Demo",["learner-south-a","learner-south-b"]);
  await group(north,"Grade 12 — Demo",["learner-north"]);
  await group(uni,"First-year Software Development — Demo",["university-learner"]);
  const southTerm = await period(south,"Term 3 — Demo");
  const northTerm = await period(north,"Term 3 — Demo");
  const uniTerm = await period(uni,"Semester 2 — Demo");
  const maths = await course(south,"MAT12","Mathematics","Grade 12","teacher-south",["learner-south-a","learner-south-b"]);
  const science = await course(south,"PHY12","Physical Sciences","Grade 12","assessor-south",["learner-south-a","learner-south-b"]);
  const english = await course(north,"ENG12","English Home Language","Grade 12","headmaster-north",["learner-north"]);
  const programming = await course(uni,"CS101","Programming Fundamentals","Year 1","university-teacher",["university-learner"]);
  await assessment(south,maths,southTerm,"Algebra Test — Synthetic","teacher-south",[["learner-south-a",82],["learner-south-b",64]]);
  await assessment(south,science,southTerm,"Mechanics Test — Synthetic","assessor-south",[["learner-south-a",74],["learner-south-b",88]]);
  await assessment(north,english,northTerm,"Literature Test — Synthetic","headmaster-north",[["learner-north",91]]);
  await assessment(uni,programming,uniTerm,"TypeScript Test — Synthetic","university-teacher",[["university-learner",79]]);
  const schoolUnit = await unit(south,"Ubuntu Future Secondary School — Demo","school","headmaster-south");
  await grant(south,schoolUnit,"headmaster-south","headmaster","headmaster-south");
  await grant(south,schoolUnit,"district-south","district_director","headmaster-south");
  const universityUnit = await unit(uni,"Mzanzi Digital University — Demo","school","university-head");
  await grant(uni,universityUnit,"university-head","headmaster","university-head");
  await db.insert(guardianRelationshipsTable).values({
    learnerId:uid("learner-south-a"),guardianId:uid("parent-south"),status:"accepted",
  }).onConflictDoNothing();
  for (const [learnerId,status] of [["learner-south-a","present"],["learner-south-b","absent"]] as const) {
    await db.insert(schoolAttendanceTable).values({
      organizationId:south,learnerId:uid(learnerId),day:"2026-10-09",status,
      note:"Synthetic attendance example",recordedBy:uid("headmaster-south"),
    }).onConflictDoNothing();
  }
  const [notice] = await db.select().from(schoolNoticesTable).where(and(
    eq(schoolNoticesTable.organizationId,south),eq(schoolNoticesTable.subject,"[DEMO] October assessment week"),
  )).limit(1);
  if (!notice) await db.insert(schoolNoticesTable).values({
    organizationId:south,subject:"[DEMO] October assessment week",
    message:"This is a fictional school notice for testing the learner and educator dashboards.",
    audience:"learners",createdBy:uid("headmaster-south"),
  });
  console.info("CABO synthetic fixtures ready: 4 organisations, 13 identities, 4 courses, 4 assessments");
}
