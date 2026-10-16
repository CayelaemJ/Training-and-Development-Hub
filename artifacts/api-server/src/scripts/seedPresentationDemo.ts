import {and,eq} from "drizzle-orm";
import {configuredPrincipals} from "../lib/testPrincipals";
import {db,usersTable,organizationsTable,organizationMembersTable,verifiedEnrollmentsTable,academicSettingsTable,academicCoursesTable,academicPeriodsTable,academicAssessmentsTable,academicGradesTable,schoolAttendanceTable,schoolNoticesTable,schoolStageProgressTable,hubRecordsTable,institutionSetupTable,admissionInstitutionsTable,admissionProgrammesTable,guardianRelationshipsTable} from "@workspace/db";
/** Run explicitly only on the isolated Railway TEST database, never production. */
const operator="cabo-isolated-test-learner";

async function user(id:string,firstName:string,lastName:string){
 await db.insert(usersTable).values({id,firstName,lastName,email:id+"@example.invalid"}).onConflictDoNothing();
 return id;
}
async function school(name:string,type:string){
 const [existing]=await db.select({id:organizationsTable.id}).from(organizationsTable).where(eq(organizationsTable.name,name)).limit(1);
 const id=existing?.id??(await db.insert(organizationsTable).values({name,ownerId:operator}).returning())[0].id;
 await db.insert(organizationMembersTable).values({organizationId:id,userId:operator,role:"owner"}).onConflictDoNothing();
 await db.insert(institutionSetupTable).values({organizationId:id,institutionType:type,province:"Gauteng",district:"Tshwane South",circuit:"CABO demo",curriculum:"CAPS",language:"English",academicYear:2026,status:"draft",officialReference:"",updatedBy:operator}).onConflictDoNothing();
 await db.insert(academicSettingsTable).values({organizationId:id,institutionType:type,framework:"NSC",academicYear:2026}).onConflictDoNothing();
 return id;
}
async function makeCourse(org:number,code:string,name:string,grade:string){
 const [prior]=await db.select({id:academicCoursesTable.id}).from(academicCoursesTable).where(and(eq(academicCoursesTable.organizationId,org),eq(academicCoursesTable.code,code),eq(academicCoursesTable.level,grade))).limit(1);
 return prior?.id??(await db.insert(academicCoursesTable).values({organizationId:org,name,code,level:grade}).returning())[0].id;
}
export async function seedPresentationDemo(){
 if(process.env.RAILWAY_ENVIRONMENT_NAME!=="testing"||process.env.ENABLE_CABO_DEMO_SEED!=="true")throw new Error("Isolated demo seeding is not enabled");
 await user(operator,"CABO","Tester");
 const principals=configuredPrincipals(process.env.CABO_TEST_USERS_JSON);
 // Use already-configured, independently authenticated test accounts; never create passwords in demo data.
 const roleFixture=(kind:string,phase:string)=>principals.find(p=>p.username.startsWith("cabo_"+kind+"_")&&p.username.includes(phase))??principals.find(p=>p.username.startsWith("cabo_"+kind+"_"));
 for(const p of principals)await db.insert(usersTable).values({id:p.userId,firstName:p.firstName,lastName:p.lastName,email:p.email}).onConflictDoNothing();
 const schools=[
  {name:"CABO DEMO | Early Learning Centre",type:"preprimary",grade:"R",learners:[["cabo-demo-child-r","Amara","Dlamini"]],subjects:[["LIT","Early Language"],["NUM","Early Numeracy"]]},
  {name:"CABO DEMO | Tshwane Primary",type:"primary",grade:"5",learners:[["cabo-demo-child-5a","Lerato","Mokoena"],["cabo-demo-child-5b","Thabo","Ndlovu"]],subjects:[["MAT","Mathematics"],["ENG","English Home Language"],["NST","Natural Sciences"]]},
  {name:"CABO DEMO | Pretoria Secondary",type:"highschool",grade:"11",learners:[["cabo-demo-child-11","Naledi","Molefe"]],subjects:[["MAT","Mathematics"],["ENG","English"],["PHY","Physical Sciences"],["LIF","Life Orientation"]]}
 ] as const;
 for(const s of schools){
  const org=await school(s.name,s.type);
  const educatorFixture=roleFixture("teacher",s.type);
  const educator=educatorFixture?.userId??await user("cabo-demo-teacher-"+s.type,"Demo","Educator");
  const headmaster=roleFixture("headmaster",s.type);
  if(headmaster)await db.insert(organizationMembersTable).values({organizationId:org,userId:headmaster.userId,role:"owner"}).onConflictDoNothing();
  await db.insert(organizationMembersTable).values({organizationId:org,userId:educator,role:"teacher"}).onConflictDoNothing();
  const existingPeriod=await db.select({id:academicPeriodsTable.id}).from(academicPeriodsTable).where(and(eq(academicPeriodsTable.organizationId,org),eq(academicPeriodsTable.name,"CABO DEMO Term 3"),eq(academicPeriodsTable.year,2026))).limit(1);
  const period=existingPeriod[0]?.id??(await db.insert(academicPeriodsTable).values({organizationId:org,name:"CABO DEMO Term 3",year:2026}).returning())[0].id;
  const courses=[] as {id:number;name:string}[];
  for(const [code,name] of s.subjects){courses.push({id:await makeCourse(org,code,name,s.grade),name})}
  for(const [i,[uid,first,last]] of s.learners.entries()){
   await user(uid,first,last);
   const learnerFixture=roleFixture("learner",s.type);
   if(learnerFixture&&i===0){await db.insert(organizationMembersTable).values({organizationId:org,userId:learnerFixture.userId,role:"learner"}).onConflictDoNothing();await db.insert(verifiedEnrollmentsTable).values({organizationId:org,learnerId:learnerFixture.userId,stage:s.grade,academicYear:2026,status:"active",recordedBy:operator}).onConflictDoNothing();}
   const guardianFixture=roleFixture("parent",s.type);
   const guardian=guardianFixture?.userId??await user("cabo-demo-guardian-"+uid,"Demo","Guardian");
   await db.insert(guardianRelationshipsTable).values({learnerId:uid,guardianId:guardian,status:"pending"}).onConflictDoNothing();
   await db.insert(organizationMembersTable).values({organizationId:org,userId:uid,role:"learner"}).onConflictDoNothing();
   await db.insert(verifiedEnrollmentsTable).values({organizationId:org,learnerId:uid,stage:s.grade,academicYear:2026,status:"active",recordedBy:operator}).onConflictDoNothing();
   for(const [j,course] of courses.entries()){
    const title="CABO DEMO Continuous Assessment";
    const [assessment]=await db.select({id:academicAssessmentsTable.id}).from(academicAssessmentsTable).where(and(eq(academicAssessmentsTable.organizationId,org),eq(academicAssessmentsTable.courseId,course.id),eq(academicAssessmentsTable.periodId,period),eq(academicAssessmentsTable.title,title))).limit(1);
    const assessmentId=assessment?.id??(await db.insert(academicAssessmentsTable).values({organizationId:org,courseId:course.id,periodId:period,title,category:"classwork",maxMarks:100,weight:1,createdBy:operator}).returning())[0].id;
    await db.insert(academicGradesTable).values({assessmentId,learnerId:uid,marks:66+((i*13+j*7+org)%28),status:"published",reviewedBy:operator,feedback:"SYNTHETIC DEMO RESULT · Not a real academic record"}).onConflictDoNothing();
   }
   for(let day=1;day<=10;day++){
    const date="2026-09-"+String(day).padStart(2,"0");
    await db.insert(schoolAttendanceTable).values({organizationId:org,learnerId:uid,day:date,status:day===3+i?"absent":"present",note:"SYNTHETIC DEMO",recordedBy:operator}).onConflictDoNothing();
   }
   const [prior]=await db.select({id:schoolStageProgressTable.id}).from(schoolStageProgressTable).where(and(eq(schoolStageProgressTable.organizationId,org),eq(schoolStageProgressTable.learnerId,uid),eq(schoolStageProgressTable.title,"CABO DEMO Learner development"))).limit(1);
   if(!prior)await db.insert(schoolStageProgressTable).values({organizationId:org,learnerId:uid,stage:s.type,grade:s.grade,academicYear:2026,domain:s.type==="preprimary"?"early_language":s.type==="primary"?"literacy":"study_skills",title:"CABO DEMO Learner development",observation:"Demonstrating consistent improvement in classroom activities (synthetic example).",nextStep:"Review practice activities with an educator.",progress:"developing",recordedBy:operator});
  }
  const [notice]=await db.select({id:schoolNoticesTable.id}).from(schoolNoticesTable).where(and(eq(schoolNoticesTable.organizationId,org),eq(schoolNoticesTable.subject,"CABO DEMO School Newsletter"))).limit(1);
  if(!notice)await db.insert(schoolNoticesTable).values({organizationId:org,subject:"CABO DEMO School Newsletter",message:"Welcome to the synthetic CABO school environment. All names, results and attendance are for presentations only.",audience:"all",createdBy:operator});
  const activities=[
   ["timetable","CABO DEMO Weekly Timetable","Sample Monday timetable: 08:00 registration, 08:30 learning, 10:30 break, 11:00 subject period."],
   ["bursary","CABO DEMO Bursary Guidance","Demonstration of deadlines, eligibility and official hand-off links. No funding award implied."],
   ["sports","CABO DEMO Sports & Culture","Synthetic school athletics, football and choir participation for portfolio demonstration."],
   ["academic_intervention","CABO DEMO Literacy Support Plan","Educator-reviewed support plan demonstration."],
   ["family_meeting","CABO DEMO Parent Consultation","Scheduled family consultation demonstration."],
   ["university_module","CABO DEMO Tertiary Bridge","Sample university transition guidance, not an official registration."],
   ["governance_action","CABO DEMO Principal Operations","Demonstration of leadership operational review."],
   ["learning_resource","CABO DEMO Multilingual Learning","English, Setswana and Sepedi content planning demonstration."],
   ["education_integration","CABO DEMO Integration Readiness","SA-SAMS interoperability concept. No live government integration."],
   ["talent_skill","CABO DEMO Skills Portfolio","Sample learner project record and evidence provenance."]
  ] as const;
  for(const [kind,title,description] of activities){
   const [exists]=await db.select({id:hubRecordsTable.id}).from(hubRecordsTable).where(and(eq(hubRecordsTable.organizationId,org),eq(hubRecordsTable.kind,kind),eq(hubRecordsTable.title,title))).limit(1);
   if(!exists)await db.insert(hubRecordsTable).values({organizationId:org,kind,title,description,status:"active",createdBy:operator,subjectId:["academic_intervention","family_meeting","talent_skill"].includes(kind)?s.learners[0][0]:null});
  }
  console.log("Seeded synthetic demonstration school:",s.name);
 }
 const universityName="CABO DEMO | University of Future Skills";
 const [existingUni]=await db.select({id:admissionInstitutionsTable.id}).from(admissionInstitutionsTable).where(eq(admissionInstitutionsTable.name,universityName)).limit(1);
 const universityId=existingUni?.id??(await db.insert(admissionInstitutionsTable).values({name:universityName,officialUrl:"https://www.gov.za",province:"Gauteng",route:"handoff",verification:"directory_only"}).returning())[0].id;
 for(const [name,qualification] of [["CABO DEMO Computer Science","Bachelor of Science"],["CABO DEMO Education & Development","Bachelor of Education"]] as const){
  const [existingProgramme]=await db.select({id:admissionProgrammesTable.id}).from(admissionProgrammesTable).where(and(eq(admissionProgrammesTable.institutionId,universityId),eq(admissionProgrammesTable.name,name))).limit(1);
  if(!existingProgramme)await db.insert(admissionProgrammesTable).values({institutionId:universityId,name,qualification,faculty:"Synthetic demonstration",requirements:"SYNTHETIC DEMO - not an accredited course or admissions offer",status:"published"});
 }
 console.log("CABO DEMO seed completed. NO real learner records or university partnerships.");
}

