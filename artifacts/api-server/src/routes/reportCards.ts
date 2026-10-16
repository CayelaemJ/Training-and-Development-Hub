import {Router,type IRouter} from "express";
import {and,eq,gte,lt} from "drizzle-orm";
import {z} from "zod/v4";
import {db,academicCoursesTable,academicAssessmentsTable,academicGradesTable,academicPeriodsTable,organizationMembersTable,verifiedEnrollmentsTable,usersTable,schoolAttendanceTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
async function schoolManager(org:number,user:string){
 if(isPlatformSuperadmin(user))return true;
 const [m]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);
 return !!m&&["owner","admin"].includes(m.role);
}
async function gather(org:number,learner:string,year:number){
 const enrolment=await db.select({stage:verifiedEnrollmentsTable.stage,academicYear:verifiedEnrollmentsTable.academicYear,status:verifiedEnrollmentsTable.status}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org),eq(verifiedEnrollmentsTable.learnerId,learner),eq(verifiedEnrollmentsTable.academicYear,year))).limit(1);
 if(!enrolment.length)return null;
 const marks=await db.select({subject:academicCoursesTable.name,courseId:academicCoursesTable.id,grade:academicCoursesTable.level,assessment:academicAssessmentsTable.title,weight:academicAssessmentsTable.weight,maxMarks:academicAssessmentsTable.maxMarks,marks:academicGradesTable.marks,period:academicPeriodsTable.name}).from(academicGradesTable)
 .innerJoin(academicAssessmentsTable,eq(academicGradesTable.assessmentId,academicAssessmentsTable.id))
 .innerJoin(academicCoursesTable,eq(academicAssessmentsTable.courseId,academicCoursesTable.id))
 .innerJoin(academicPeriodsTable,eq(academicAssessmentsTable.periodId,academicPeriodsTable.id))
 .where(and(eq(academicCoursesTable.organizationId,org),eq(academicGradesTable.learnerId,learner),eq(academicGradesTable.status,"published"),eq(academicPeriodsTable.year,year),eq(academicCoursesTable.level,enrolment[0].stage)));
 const aggregates=new Map<string,{subject:string;total:number;weights:number;assessments:number}>();
 for(const row of marks){if(!(row.maxMarks>0))continue;const key=row.subject;const prev=aggregates.get(key)??{subject:key,total:0,weights:0,assessments:0};const w=row.weight>0?row.weight:1;prev.total+=Math.max(0,Math.min(100,row.marks/row.maxMarks*100))*w;prev.weights+=w;prev.assessments++;aggregates.set(key,prev)}
 const subjects=[...aggregates.values()].map(x=>({name:x.subject,percentage:Math.round(x.total/x.weights*10)/10,assessmentCount:x.assessments})).sort((a,b)=>a.name.localeCompare(b.name));
 const days=await db.select({status:schoolAttendanceTable.status}).from(schoolAttendanceTable).where(and(eq(schoolAttendanceTable.organizationId,org),eq(schoolAttendanceTable.learnerId,learner),gte(schoolAttendanceTable.day,year+"-01-01"),lt(schoolAttendanceTable.day,(year+1)+"-01-01")));
 const present=days.filter(x=>x.status==="present"||x.status==="late").length;
 return {year,grade:enrolment[0].stage,enrolmentStatus:enrolment[0].status,subjects,average:subjects.length?Math.round(subjects.reduce((n,x)=>n+x.percentage,0)/subjects.length*10)/10:null,attendance:{recordedDays:days.length,presentDays:present,rate:days.length?Math.round(present/days.length*100):null},official:false};
}
router.get("/reports/me",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.query.organizationId),year=z.coerce.number().int().min(2000).max(2200).safeParse(req.query.year);
 if(!org.success||!year.success){res.sendStatus(400);return}
 const report=await gather(org.data,req.user.id,year.data);
 if(!report){res.sendStatus(404);return}
 res.setHeader("Cache-Control","private, no-store");res.json({...report,learnerId:req.user.id,visibility:"learner_only",status:"draft_preview"});
});
router.get("/organizations/:orgId/reports/:learnerId",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),year=z.coerce.number().int().min(2000).max(2200).safeParse(req.query.year);
 if(!org.success||!year.success){res.sendStatus(400);return}
 if(req.user.id!==req.params.learnerId&&!await schoolManager(org.data,req.user.id)){res.sendStatus(403);return}
 const report=await gather(org.data,req.params.learnerId,year.data);
 if(!report){res.sendStatus(404);return}
 const [person]=await db.select({firstName:usersTable.firstName,lastName:usersTable.lastName}).from(usersTable).where(eq(usersTable.id,req.params.learnerId)).limit(1);
 res.setHeader("Cache-Control","private, no-store");res.json({...report,learnerId:req.params.learnerId,learnerName:[person?.firstName,person?.lastName].filter(Boolean).join(" "),status:"draft_preview",official:false});
});
router.get("/organizations/:orgId/analytics",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),year=z.coerce.number().int().min(2000).max(2200).safeParse(req.query.year);
 if(!org.success||!year.success){res.sendStatus(400);return}
 if(!await schoolManager(org.data,req.user.id)){res.sendStatus(403);return}
 const enrolled=await db.select({learnerId:verifiedEnrollmentsTable.learnerId,grade:verifiedEnrollmentsTable.stage}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.academicYear,year.data),eq(verifiedEnrollmentsTable.status,"active")));
 const attendance=await db.select({status:schoolAttendanceTable.status}).from(schoolAttendanceTable).where(and(eq(schoolAttendanceTable.organizationId,org.data),gte(schoolAttendanceTable.day,year.data+"-01-01"),lt(schoolAttendanceTable.day,(year.data+1)+"-01-01")));
 const byGrade:Record<string,number>={};for(const x of enrolled)byGrade[x.grade]=(byGrade[x.grade]??0)+1;
 const present=attendance.filter(x=>x.status==="present"||x.status==="late").length;
 res.setHeader("Cache-Control","private, no-store");
 res.json({year:year.data,learnerCount:enrolled.length,attendance:{events:attendance.length,rate:attendance.length?Math.round(present/attendance.length*100):null},byGrade,verifiedNationalStatistics:false,syntheticOnly:process.env.RAILWAY_ENVIRONMENT_NAME==="testing"});
});
export default router;