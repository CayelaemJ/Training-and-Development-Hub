import {Router,type IRouter} from "express";
import {and,eq,inArray} from "drizzle-orm";
import {db,organizationsTable,verifiedEnrollmentsTable,academicGradesTable,academicAssessmentsTable,academicCoursesTable,schoolAttendanceTable,admissionInstitutionsTable,admissionProgrammesTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
const router:IRouter=Router();
const DEMO_NAMES=["CABO DEMO | Early Learning Centre","CABO DEMO | Tshwane Primary","CABO DEMO | Pretoria Secondary"];
router.get("/platform/demo/status",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!isPlatformSuperadmin(req.user.id)||(process.env.CABO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME)!=="testing"){res.sendStatus(403);return}
 const schools=await db.select({id:organizationsTable.id,name:organizationsTable.name}).from(organizationsTable).where(inArray(organizationsTable.name,DEMO_NAMES));
 const rows=[] as {id:number;name:string;learners:number;publishedGrades:number;attendanceEntries:number}[];
 for(const school of schools){
  const enrollments=await db.select({learnerId:verifiedEnrollmentsTable.learnerId}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,school.id),eq(verifiedEnrollmentsTable.academicYear,2026)));
  const grades=await db.select({id:academicGradesTable.id}).from(academicGradesTable).innerJoin(academicAssessmentsTable,eq(academicGradesTable.assessmentId,academicAssessmentsTable.id)).where(and(eq(academicAssessmentsTable.organizationId,school.id),eq(academicGradesTable.status,"published")));
  const attendance=await db.select({id:schoolAttendanceTable.id}).from(schoolAttendanceTable).where(eq(schoolAttendanceTable.organizationId,school.id));
  rows.push({id:school.id,name:school.name,learners:enrollments.length,publishedGrades:grades.length,attendanceEntries:attendance.length});
 }
 const [university]=await db.select({id:admissionInstitutionsTable.id}).from(admissionInstitutionsTable).where(eq(admissionInstitutionsTable.name,"CABO DEMO | University of Future Skills")).limit(1);
 const programmeCount=university?(await db.select({id:admissionProgrammesTable.id}).from(admissionProgrammesTable).where(eq(admissionProgrammesTable.institutionId,university.id))).length:0;
 res.setHeader("Cache-Control","private, no-store");
 res.json({ready:schools.length===3&&rows.every(x=>x.learners>0&&x.publishedGrades>0),schools:rows,universityProgrammes:programmeCount,synthetic:true,year:2026});
});
export default router;