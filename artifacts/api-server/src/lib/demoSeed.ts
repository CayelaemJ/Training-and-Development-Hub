import { and, eq, sql } from "drizzle-orm";
import {
  db, usersTable, organizationsTable, organizationMembersTable, learnerGroupsTable,
  learnerGroupMembersTable, academicSettingsTable, academicCoursesTable, academicPeriodsTable,
  courseEnrollmentsTable, academicAssessmentsTable, academicGradesTable, academicGradeEventsTable,
  courseStaffAssignmentsTable, managementUnitsTable, managementRoleGrantsTable,
  schoolAttendanceTable, schoolNoticesTable, guardianRelationshipsTable,
  studyMaterialsTable, quizzesTable, verifiedEnrollmentsTable,
  learnerSupportTicketsTable, learnerSupportEventsTable, hubRecordsTable,
  learnerIdentitiesTable, learnerJourneysTable, learnerMilestonesTable, schoolStageProgressTable,
} from "@workspace/db";

// Fictional, non-identifying test data. No passwords, secrets, real school names or real learners.
// Never seed a live school or a test service without a confirmed disposable database.
const people = [
  ["headmaster-south", "Nomsa", "Dube"],
  ["teacher-south", "Thabo", "Maseko"],
  ["assessor-south", "Palesa", "Mokoena"],
  ["learner-south-a", "Lerato", "Mahlobo"],
  ["learner-south-b", "Sipho", "Khumalo"],
  ["learner-south-c", "Anele", "Radebe"],
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
  if ((process.env.CABO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME) !== "testing" ||
      process.env.CABO_TEST_DATABASE_ISOLATED !== "true" ||
      process.env.ENABLE_CABO_DEMO_SEED !== "true") {
    throw new Error("CABO demo fixtures require an isolated and explicitly enabled test database.");
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
  async function supportCase(organizationId:number,courseId:number,learner:string,teacher:string) {
    const requestKey = `demo-${learner}-fractions-2026`;
    const [existing] = await db.select().from(learnerSupportTicketsTable).where(and(eq(learnerSupportTicketsTable.learnerId,uid(learner)),eq(learnerSupportTicketsTable.requestKey,requestKey))).limit(1);
    if (existing) return;
    const [ticket] = await db.insert(learnerSupportTicketsTable).values({organizationId,courseId,learnerId:uid(learner),concept:"Algebraic fractions",question:"How do I identify the lowest common denominator?",attempted:"I factorised both denominators and highlighted the common factors.",status:"in_progress",assignedTo:uid(teacher),requestKey,reviewAt:new Date("2026-10-23T12:00:00Z")}).returning();
    await db.insert(learnerSupportEventsTable).values({ticketId:ticket.id,actorId:uid(teacher),kind:"educator_note",body:"Synthetic intervention: use worked examples, then review one week later.",metadata:{synthetic:true,nextStep:"guided-practice"}});
  }
  async function hubRecord(organizationId:number,kind:string,title:string,description:string,createdBy:string,subject?:string) {
    const [existing] = await db.select().from(hubRecordsTable).where(and(eq(hubRecordsTable.organizationId,organizationId),eq(hubRecordsTable.kind,kind),eq(hubRecordsTable.title,title))).limit(1);
    if (!existing) await db.insert(hubRecordsTable).values({organizationId,kind,title,description,status:"active",createdBy:uid(createdBy),reviewedBy:uid(createdBy),subjectId:subject?uid(subject):null});
  }
  async function grant(organizationId:number,unitId:number,person:string,role:string,by:string) {
    await db.insert(managementRoleGrantsTable).values({
      organizationId,unitId,userId:uid(person),role,grantedBy:uid(by),
    }).onConflictDoNothing();
  }


  // Each case-study record is traceable to a fictional learner account.
  // These account-owned entries are self-reports, not official verified transcripts.
  async function journey(person:string,organizationId:number,institutionName:string,stage:string,academicYear:number,note:string) {
    const userId=uid(person);
    const [existing]=await db.select({id:learnerJourneysTable.id}).from(learnerJourneysTable).where(and(
      eq(learnerJourneysTable.userId,userId),eq(learnerJourneysTable.institutionName,institutionName),
      eq(learnerJourneysTable.stage,stage),eq(learnerJourneysTable.academicYear,academicYear),
    )).limit(1);
    if(!existing)await db.insert(learnerJourneysTable).values({
      userId,institutionId:organizationId,institutionName,stage,academicYear,
      note:"[DEMO] "+note,source:"self_report",
    });
  }
  async function milestone(person:string,title:string,kind:string,year:number,description:string) {
    const userId=uid(person);
    const [existing]=await db.select({id:learnerMilestonesTable.id}).from(learnerMilestonesTable).where(and(
      eq(learnerMilestonesTable.userId,userId),eq(learnerMilestonesTable.title,title),
      eq(learnerMilestonesTable.year,year),
    )).limit(1);
    if(!existing)await db.insert(learnerMilestonesTable).values({
      userId,title,kind,year,description:"[DEMO] "+description,source:"self_report",
    });
  }
  async function stageProgress(organizationId:number,person:string,domain:string,title:string,observation:string,nextStep:string,progress:string,recordedBy:string) {
    const learnerId=uid(person);
    const [existing]=await db.select({id:schoolStageProgressTable.id}).from(schoolStageProgressTable).where(and(
      eq(schoolStageProgressTable.organizationId,organizationId),
      eq(schoolStageProgressTable.learnerId,learnerId),
      eq(schoolStageProgressTable.academicYear,2026),
      eq(schoolStageProgressTable.title,title),
    )).limit(1);
    if(!existing)await db.insert(schoolStageProgressTable).values({
      organizationId,learnerId,stage:"highschool",grade:"12",academicYear:2026,domain,title,
      observation:"[DEMO] "+observation,nextStep:"[DEMO] "+nextStep,progress,
      recordedBy:uid(recordedBy),
    });
  }

  const south = await org("Ubuntu Future Secondary School", "headmaster-south");
  const north = await org("Highveld Independent Academy", "headmaster-north");
  const uni = await org("Mzanzi Digital University", "university-head");
  const company = await org("Kwezi Skills & Training", "company-head");
  for (const [organizationId, assignments] of [
    [south, [["headmaster-south","owner"],["teacher-south","teacher"],["assessor-south","assessor"],["learner-south-a","learner"],["learner-south-b","learner"],["learner-south-c","learner"],["district-south","admin"]]],
    [north, [["headmaster-north","owner"],["learner-north","learner"]]],
    [uni, [["university-head","owner"],["university-teacher","teacher"],["university-learner","learner"]]],
    [company, [["company-head","owner"]]],
  ] as [number,string[][]][]) {
    for (const [person,role] of assignments) await member(organizationId,person,role);
  }
  await db.insert(academicSettingsTable).values({organizationId:south,institutionType:"school",framework:"NSC",academicYear:2026}).onConflictDoNothing();
  await db.insert(academicSettingsTable).values({organizationId:north,institutionType:"school",framework:"IEB",academicYear:2026}).onConflictDoNothing();
  await db.insert(academicSettingsTable).values({organizationId:uni,institutionType:"university",framework:"UNIVERSITY",academicYear:2026}).onConflictDoNothing();
  await group(south,"Grade 12A — Demo",["learner-south-a","learner-south-b","learner-south-c"]);
  await group(north,"Grade 12 — Demo",["learner-north"]);
  await group(uni,"First-year Software Development — Demo",["university-learner"]);
  const southTerm1 = await period(south,"Term 1 — Demo");
  const southTerm2 = await period(south,"Term 2 — Demo");
  const southTerm = await period(south,"Term 3 — Demo");
  const northTerm = await period(north,"Term 3 — Demo");
  const uniTerm = await period(uni,"Semester 2 — Demo");
  const maths = await course(south,"MAT12","Mathematics","Grade 12","teacher-south",["learner-south-a","learner-south-b","learner-south-c"]);
  const science = await course(south,"PHY12","Physical Sciences","Grade 12","assessor-south",["learner-south-a","learner-south-b","learner-south-c"]);
  const lifeOrientation = await course(south,"LIF12","Life Orientation","Grade 12","teacher-south",["learner-south-a","learner-south-b","learner-south-c"]);
  const english = await course(north,"ENG12","English Home Language","Grade 12","headmaster-north",["learner-north"]);
  const programming = await course(uni,"CS101","Programming Fundamentals","Year 1","university-teacher",["university-learner"]);
  // The three periods illustrate observed change. It is never presented as proof
  // that a CABO intervention caused a result, and no official progression is implied.
  await assessment(south,maths,southTerm1,"Foundations diagnostic — Synthetic","teacher-south",[["learner-south-a",70],["learner-south-b",48],["learner-south-c",61]]);
  await assessment(south,maths,southTerm2,"Midyear practice — Synthetic","teacher-south",[["learner-south-a",76],["learner-south-b",56],["learner-south-c",65]]);
  await assessment(south,science,southTerm1,"Motion fundamentals — Synthetic","assessor-south",[["learner-south-a",65],["learner-south-b",76],["learner-south-c",60]]);
  await assessment(south,science,southTerm2,"Forces and motion — Synthetic","assessor-south",[["learner-south-a",70],["learner-south-b",82],["learner-south-c",64]]);
  await assessment(south,lifeOrientation,southTerm1,"Growth reflection — Synthetic","teacher-south",[["learner-south-a",74],["learner-south-b",66],["learner-south-c",74]]);
  await assessment(south,lifeOrientation,southTerm2,"Learning plan — Synthetic","teacher-south",[["learner-south-a",80],["learner-south-b",71],["learner-south-c",78]]);
  await assessment(south,maths,southTerm,"Algebra Test — Synthetic","teacher-south",[["learner-south-a",82],["learner-south-b",64],["learner-south-c",71]]);
  await assessment(south,science,southTerm,"Mechanics Test — Synthetic","assessor-south",[["learner-south-a",74],["learner-south-b",88],["learner-south-c",69]]);
  await assessment(south,lifeOrientation,southTerm,"Study and career plan — Synthetic","teacher-south",[["learner-south-a",86],["learner-south-b",76],["learner-south-c",81]]);
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
  for (const learner of ["learner-south-a","learner-south-b","learner-south-c"] as const) await db.insert(verifiedEnrollmentsTable).values({organizationId:south,learnerId:uid(learner),stage:"12",academicYear:2026,status:"active",recordedBy:uid("headmaster-south")}).onConflictDoNothing();
  await db.insert(verifiedEnrollmentsTable).values({organizationId:north,learnerId:uid("learner-north"),stage:"12",academicYear:2026,status:"active",recordedBy:uid("headmaster-north")}).onConflictDoNothing();
  await db.insert(verifiedEnrollmentsTable).values({organizationId:uni,learnerId:uid("university-learner"),stage:"Year 1",academicYear:2026,status:"active",recordedBy:uid("university-head")}).onConflictDoNothing();
  const attendanceLearners = ["learner-south-a","learner-south-b","learner-south-c"] as const;
  for (let day=5;day<=16;day++) for (const [index,learnerId] of attendanceLearners.entries()) {
    const status = (learnerId==="learner-south-b"&&day===9)||(learnerId==="learner-south-c"&&day===14)?"absent":day===12&&index===0?"late":"present";
    await db.insert(schoolAttendanceTable).values({organizationId:south,learnerId:uid(learnerId),day:`2026-10-${String(day).padStart(2,"0")}`,status,note:"[DEMO] Synthetic attendance example",recordedBy:uid("headmaster-south")}).onConflictDoNothing();
  }

  // Give learner dashboards populated learning stages and personal milestones.
  // Do not derive a minor's identity, age, educational status or credentials from
  // these fixtures; they are fictional self-reports in a disposable demo database.
  for (const [person, organizationId, name, stage, year, note] of [
    ["learner-south-a",south,"[DEMO] Ubuntu Future Secondary School","10",2024,"Practice reflection: adapted to secondary maths."],
    ["learner-south-a",south,"[DEMO] Ubuntu Future Secondary School","11",2025,"Practice reflection: completed a science project."],
    ["learner-south-a",south,"[DEMO] Ubuntu Future Secondary School","12",2026,"Current fictional school year, not a certified enrolment."],
    ["learner-south-b",south,"[DEMO] Ubuntu Future Secondary School","10",2024,"Exploring preferred ways to learn."],
    ["learner-south-b",south,"[DEMO] Ubuntu Future Secondary School","11",2025,"Requested extra practice for algebra."],
    ["learner-south-b",south,"[DEMO] Ubuntu Future Secondary School","12",2026,"Learning evidence discussed with a teacher."],
    ["learner-south-c",south,"[DEMO] Ubuntu Future Secondary School","11",2025,"Started documenting a robotics hobby."],
    ["learner-south-c",south,"[DEMO] Ubuntu Future Secondary School","12",2026,"Developing a project portfolio."],
    ["learner-north",north,"[DEMO] Highveld Independent Academy","12",2026,"Fictional IEB school study record."],
    ["university-learner",uni,"[DEMO] Mzanzi Digital University","university",2026,"Fictional first-year programming pathway."],
  ] as [string,number,string,string,number,string][]) {
    await journey(person,organizationId,name,stage,year,note);
  }
  for (const [person,title,kind,year,description] of [
    ["learner-south-a","[DEMO] Algebra revision plan","academic",2026,"Self-reported plan to practise equations with supporting notes; no official mark awarded."],
    ["learner-south-a","[DEMO] Athletics participation","personal_growth",2026,"Fictional sport involvement for a portfolio example, not a verified achievement."],
    ["learner-south-b","[DEMO] Algebra learning checkpoint","academic",2026,"Teacher-guided worked examples are planned; progress is for demonstration only."],
    ["learner-south-b","[DEMO] Independent study habit","personal_growth",2025,"Fictional reflection on a weekly study schedule."],
    ["learner-south-c","[DEMO] Robotics design notebook","project",2026,"Fictional project notes that require human evidence verification."],
    ["learner-south-c","[DEMO] Science fair reflection","academic",2025,"Self-reported learning reflection, not a prize or accredited award."],
    ["learner-north","[DEMO] Literary analysis portfolio","creative",2026,"Sample English writing reflection; no school certification."],
    ["university-learner","[DEMO] TypeScript practice project","technical",2026,"Fictional course-related code learning reflection, not a qualification."],
  ] as [string,string,string,number,string][]) await milestone(person,title,kind,year,description);
  await db.insert(learnerIdentitiesTable).values({userId:uid("learner-south-a"),displayName:"Lerato [DEMO]"}).onConflictDoNothing();
  await db.insert(learnerIdentitiesTable).values({userId:uid("learner-south-b"),displayName:"Sipho [DEMO]"}).onConflictDoNothing();
  await db.insert(learnerIdentitiesTable).values({userId:uid("learner-south-c"),displayName:"Anele [DEMO]"}).onConflictDoNothing();
  await stageProgress(south,"learner-south-a","assessment_readiness","[DEMO] Mathematics revision","Worked examples reviewed; observed Term 1–3 practice grades are synthetic.","Teacher to review the next problem set.","developing","headmaster-south");
  await stageProgress(south,"learner-south-b","subject_mastery","[DEMO] Algebra support plan","Foundational topics need additional practice according to fictional assessment results.","Teacher to review worked fractions examples; do not infer causality.","needs_support","headmaster-south");
  await stageProgress(south,"learner-south-b","study_skills","[DEMO] Weekly practice routine","Learner has a fictional individual learning plan.","Check practice notes with teacher.","developing","headmaster-south");
  await stageProgress(south,"learner-south-c","practical_projects","[DEMO] Robotics reflection","Project evidence is self-reported and not institution verified.","Request an educator review of the portfolio.","observing","headmaster-south");
  await stageProgress(north,"learner-north","assessment_readiness","[DEMO] English writing","Fictional practice outcomes recorded for IEB illustration.","Ask educator to review a draft analysis paragraph.","meeting_expectations","headmaster-north");

  // More realistic attendance history without weekends or future dates.
  for (let day=1;day<=18;day++) {
    const date=new Date(Date.UTC(2026,8,day));
    if (date.getUTCDay()===0||date.getUTCDay()===6) continue;
    const dateText=`2026-09-${String(day).padStart(2,"0")}`;
    for(const learner of ["learner-south-a","learner-south-b","learner-south-c"] as const) {
      const status=(learner==="learner-south-b"&&day===8)?"absent":(learner==="learner-south-a"&&day===17)?"late":"present";
      await db.insert(schoolAttendanceTable).values({
        organizationId:south,learnerId:uid(learner),day:dateText,status,
        note:"[DEMO] Synthetic September attendance for case-study walkthrough",
        recordedBy:uid("headmaster-south"),
      }).onConflictDoNothing();
    }
  }

  await supportCase(south,maths,"learner-south-b","teacher-south");
  for (const [kind,title,description,subject] of [
    ["academic_intervention","[DEMO] Algebra support cycle","Teacher-led practice and follow-up review; fictional and non-diagnostic.","learner-south-b"],
    ["timetable","[DEMO] Grade 12 weekly timetable","A synthetic timetable item for the institution workspace",undefined],
    ["sports","[DEMO] Athletics participation","Fictional extracurricular participation; no verified achievement implied.","learner-south-a"],
    ["family_meeting","[DEMO] Progress consultation","Pending synthetic family consultation; guardian authority remains unverified.","learner-south-a"],
    ["talent_skill","[DEMO] Robotics project reflection","Learner-owned synthetic portfolio example; not a credential.","learner-south-c"],
  ] as const) await hubRecord(south,kind,title,description,"headmaster-south",subject);
  const [notice] = await db.select().from(schoolNoticesTable).where(and(
    eq(schoolNoticesTable.organizationId,south),eq(schoolNoticesTable.subject,"[DEMO] October assessment week"),
  )).limit(1);
  if (!notice) await db.insert(schoolNoticesTable).values({
    organizationId:south,subject:"[DEMO] October assessment week",
    message:"This is a fictional school notice for testing the learner and educator dashboards.",
    audience:"learners",createdBy:uid("headmaster-south"),
  });
  // Fixed synthetic text means no external PDF, AI provider, paid OCR or file
  // storage is needed. The native reader uses the audited, user-owned API.
  // These examples are educational demos, never formal examination papers.
  const studySamples = [
    {
      learner: "learner-south-a",
      key: "grade12-algebra",
      title: "[DEMO] Grade 12 Algebra - Practice Notes",
      text: [
        "CABO DEMO MATERIAL. Fictional practice content, not an official school resource.",
        "A linear equation has the form ax + b = c. We isolate x using inverse operations.",
        "Example: 3x + 5 = 20. Subtract 5 from both sides: 3x = 15. Divide both sides by 3: x = 5.",
        "When factorising x² - 5x + 6, find two numbers whose product is 6 and whose sum is -5.",
        "Those numbers are -2 and -3, so the expression is (x - 2)(x - 3).",
        "Always substitute your proposed solution into the original expression to verify it.",
      ].join("\n\n"),
      questions: [
        {prompt: "Solve 3x + 5 = 20.",options: ["x = 3","x = 5","x = 15","x = 25"],
         correctOption: 1,explanation: "3x = 15 after subtracting 5; divide by 3 to get x = 5."},
        {prompt: "Which factors equal x² - 5x + 6?",
         options: ["(x + 2)(x + 3)","(x - 1)(x - 6)","(x - 2)(x - 3)","(x + 1)(x - 6)"],
         correctOption: 2,explanation: "-2 and -3 add to -5 and multiply to +6."},
        {prompt: "What is the best final check after solving a linear equation?",
         options: ["Round x to a whole number","Substitute x into the original equation","Change its sign","Ignore the constant"],
         correctOption: 1,explanation: "Substituting verifies that both sides are equal."},
      ],
    },
    {
      learner: "learner-north",
      key: "english-analysis",
      title: "[DEMO] English Text Analysis - Practice Notes",
      text: [
        "CABO DEMO MATERIAL. Fictional study sample for learner device testing.",
        "A claim states an argument. Evidence may consist of details from a text.",
        "Good analysis explains how the evidence supports the claim rather than merely repeating it.",
        "Tone is the attitude suggested by a writer's language and sentence choices.",
        "A metaphor compares things without using like or as. A simile normally uses like or as.",
        "A strong paragraph follows claim, evidence, explanation and a concluding connection.",
      ].join("\n\n"),
      questions: [
        {prompt: "Which sequence best supports a text-analysis paragraph?",
         options: ["Claim, evidence, explanation","Summary, title, punctuation","Opinion without evidence","Quotation only"],
         correctOption: 0,explanation: "Evidence and explanation should follow a clear claim."},
        {prompt: "What usually signals a simile?",
         options: ["A rhetorical question","Like or as","A semicolon","Only past-tense verbs"],
         correctOption: 1,explanation: "Similes commonly compare ideas using like or as."},
      ],
    },
  ] as const;
  for (const sample of studySamples) {
    const owner = uid(sample.learner);
    const objectPath = "/native-demo-material/" + sample.key;
    const existing = await db.select({ id: studyMaterialsTable.id })
      .from(studyMaterialsTable)
      .where(and(eq(studyMaterialsTable.userId, owner),
                 eq(studyMaterialsTable.objectPath, objectPath))).limit(1);
    const material = existing[0] ??
      (await db.insert(studyMaterialsTable).values({
        userId: owner, title: sample.title, fileName: sample.key + ".txt",
        contentType: "text/plain", sizeBytes: Buffer.byteLength(sample.text),
        objectPath, characterCount: sample.text.length,
      }).returning({ id: studyMaterialsTable.id }))[0];
    // The additive material-reading migration is mandatory on the disposable
    // pilot, and ENABLE_MATERIAL_READING must be true for cached reader pages.
    await db.execute(sql`UPDATE study_materials SET extracted_text=${sample.text},
      allow_ai_reading=false WHERE id=${material.id} AND user_id=${owner}`);
    const quizTitle = sample.title.replace("Notes", "Quiz");
    const quiz = await db.select({ id: quizzesTable.id }).from(quizzesTable)
      .where(and(eq(quizzesTable.materialId, material.id),
                 eq(quizzesTable.userId, owner),
                 eq(quizzesTable.title, quizTitle))).limit(1);
    if (quiz.length === 0) {
      await db.insert(quizzesTable).values({
        userId: owner, materialId: material.id, title: quizTitle,
        difficulty: "practice", questionCount: sample.questions.length,
        optionCount: 4, modelId: "synthetic-demo-no-ai",
        promptVersion: "pilot-demo-v1",
        questions: sample.questions.map(q => ({
          prompt: q.prompt, options: [...q.options], correctOption: q.correctOption,
          explanation: q.explanation,
        })),
      });
    }
  }

  console.info("CABO synthetic fixtures ready: 4 organisations, 14 identities, 5 courses, 11 assessments, 78 attendance rows, 10 learner-journey entries, 8 milestones, 5 school-stage observations, 1 intervention, 5 hub records, 2 native learner quizzes");
}
