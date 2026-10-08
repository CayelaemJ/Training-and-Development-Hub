import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db, academicSettingsTable,academicCoursesTable, academicPeriodsTable,courseEnrollmentsTable,academicAssessmentsTable,academicGradesTable,academicGradeEventsTable,organizationMembersTable,usersTable } from "@workspace/db";
const router:IRouter=Router();
const id=z.coerce.number().int().positive();
type MemberRole="owner"|"admin"|"teacher"|"assessor"|"learner";
function auth(req:Request,res:Response){if(!req.isAuthenticated()){res.status(401).json({error:"Sign in required"});return null;}return req.user!.id;}
async function allowed(req:Request,res:Response,orgId:number,roles?:MemberRole[]){
 const user=auth(req,res);if(!user)return false;
 const [member]=await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,orgId),eq(organizationMembersTable.userId,user))).limit(1);
 if(!member||roles&&!roles.includes(member.role as MemberRole)){res.status(403).json({error:"Access denied"});return false;}return true;
}
const staff:MemberRole[]=["owner","admin","teacher","assessor"];
async function course(orgId:number,courseId:number){
 const [row]=await db.select().from(academicCoursesTable).where(and(eq(academicCoursesTable.organizationId,orgId),eq(academicCoursesTable.id,courseId))).limit(1);return row;
}
router.get("/organizations/:orgId/academic",async(req,res)=>{
 const org=id.safeParse(req.params.orgId);if(!org.success){res.sendStatus(400);return;}if(!await allowed(req,res,org.data))return;
 const [settings]=await db.select().from(academicSettingsTable).where(eq(academicSettingsTable.organizationId,org.data)).limit(1);
 const periods=await db.select().from(academicPeriodsTable).where(eq(academicPeriodsTable.organizationId,org.data));
 const courses=await db.select().from(academicCoursesTable).where(eq(academicCoursesTable.organizationId,org.data));
 res.json({settings:settings??null,periods,courses});
});
router.put("/organizations/:orgId/academic",async(req,res)=>{
 const org=id.safeParse(req.params.orgId),input=z.object({institutionType:z.enum(["school","university"]),framework:z.enum(["NSC","IEB","UNIVERSITY","CUSTOM"]),academicYear:z.number().int().min(2000).max(2200)}).safeParse(req.body);
 if(!org.success||!input.success){res.sendStatus(400);return;}if(!await allowed(req,res,org.data,["owner","admin"]))return;
 if(input.data.institutionType==="university"&&!["UNIVERSITY","CUSTOM"].includes(input.data.framework)||input.data.institutionType==="school"&&!["NSC","IEB","CUSTOM"].includes(input.data.framework)){res.status(400).json({error:"Invalid institution framework combination"});return;}
 const [settings]=await db.insert(academicSettingsTable).values({organizationId:org.data,...input.data}).onConflictDoUpdate({target:academicSettingsTable.organizationId,set:input.data}).returning();
 res.json(settings);
});
router.post("/organizations/:orgId/academic/periods",async(req,res)=>{
 const org=id.safeParse(req.params.orgId),input=z.object({name:z.string().trim().min(2).max(100),year:z.number().int().min(2000).max(2200)}).safeParse(req.body);
 if(!org.success||!input.success){res.sendStatus(400);return;}if(!await allowed(req,res,org.data,staff))return;
 const [row]=await db.insert(academicPeriodsTable).values({organizationId:org.data,...input.data}).returning();res.status(201).json(row);
});
router.post("/organizations/:orgId/academic/courses",async(req,res)=>{
 const org=id.safeParse(req.params.orgId),input=z.object({name:z.string().trim().min(2).max(200),code:z.string().trim().min(1).max(50),level:z.string().trim().min(1).max(50),credits:z.number().int().min(0).max(1000).optional()}).safeParse(req.body);
 if(!org.success||!input.success){res.sendStatus(400);return;}if(!await allowed(req,res,org.data,staff))return;
 const [row]=await db.insert(academicCoursesTable).values({organizationId:org.data,...input.data}).returning();res.status(201).json(row);
});
router.post("/organizations/:orgId/academic/courses/:courseId/enroll",async(req,res)=>{
 const org=id.safeParse(req.params.orgId),cid=id.safeParse(req.params.courseId),input=z.object({userId:z.string().min(1)}).safeParse(req.body);
 if(!org.success||!cid.success||!input.success){res.sendStatus(400);return;}if(!await allowed(req,res,org.data,staff))return;
 const c=await course(org.data,cid.data);
 const [m]=await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org.data),eq(organizationMembersTable.userId,input.data.userId),eq(organizationMembersTable.role,"learner"))).limit(1);
 if(!c||!m){res.status(400).json({error:"Course or learner not in institution"});return;}
 await db.insert(courseEnrollmentsTable).values({courseId:c.id,userId:input.data.userId}).onConflictDoNothing();res.status(201).json({ok:true});
});
router.post("/organizations/:orgId/academic/assessments",async(req,res)=>{
 const org=id.safeParse(req.params.orgId),input=z.object({courseId:z.number().int().positive(),periodId:z.number().int().positive(),title:z.string().trim().min(2).max(200),category:z.enum(["assignment","test","exam","practical","oral","project"]),maxMarks:z.number().positive().max(10000),weight:z.number().positive().max(100),instructions:z.string().max(10000).optional(),dueAt:z.iso.datetime().optional()}).safeParse(req.body);
 if(!org.success||!input.success){res.sendStatus(400);return;}if(!await allowed(req,res,org.data,staff))return;
 const [period]=await db.select().from(academicPeriodsTable).where(and(eq(academicPeriodsTable.id,input.data.periodId),eq(academicPeriodsTable.organizationId,org.data))).limit(1);
 if(!await course(org.data,input.data.courseId)||!period){res.status(400).json({error:"Invalid course or term"});return;}
 const [row]=await db.insert(academicAssessmentsTable).values({...input.data,dueAt:input.data.dueAt?new Date(input.data.dueAt):null,organizationId:org.data,createdBy:req.user!.id}).returning();res.status(201).json(row);
});
router.get("/organizations/:orgId/academic/assessments",async(req,res)=>{
 const org=id.safeParse(req.params.orgId),cid=id.safeParse(req.query.courseId);
 if(!org.success){res.sendStatus(400);return;}if(!await allowed(req,res,org.data))return;
 let rows=await db.select().from(academicAssessmentsTable).where(eq(academicAssessmentsTable.organizationId,org.data));
 if(cid.success)rows=rows.filter(r=>r.courseId===cid.data);
 if(!(await allowedRole(org.data,req.user!.id,staff))){
   const enrolled=await db.select({courseId:courseEnrollmentsTable.courseId}).from(courseEnrollmentsTable).where(eq(courseEnrollmentsTable.userId,req.user!.id));
   const own=new Set(enrolled.map(e=>e.courseId));rows=rows.filter(r=>own.has(r.courseId));
 }
 res.json(rows);
});
async function allowedRole(orgId:number,userId:string,roles:MemberRole[]){
 const [row]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,orgId),eq(organizationMembersTable.userId,userId))).limit(1);
 return !!row&&roles.includes(row.role as MemberRole);
}
router.put("/organizations/:orgId/academic/assessments/:assessmentId/grades/:learnerId",async(req,res)=>{
 const org=id.safeParse(req.params.orgId),aid=id.safeParse(req.params.assessmentId),
 input=z.object({marks:z.number().min(0),status:z.enum(["draft","published"]),reason:z.string().trim().min(5).max(2000),feedback:z.string().max(5000).optional()}).safeParse(req.body);
 if(!org.success||!aid.success||!input.success){res.sendStatus(400);return;}if(!await allowed(req,res,org.data,staff))return;
 const [assessment]=await db.select().from(academicAssessmentsTable).where(and(eq(academicAssessmentsTable.id,aid.data),eq(academicAssessmentsTable.organizationId,org.data))).limit(1);
 if(!assessment||input.data.marks>assessment.maxMarks){res.status(400).json({error:"Assessment unavailable or marks exceed maximum"});return;}
 const [enrolled]=await db.select().from(courseEnrollmentsTable).where(and(eq(courseEnrollmentsTable.courseId,assessment.courseId),eq(courseEnrollmentsTable.userId,req.params.learnerId))).limit(1);
 if(!enrolled){res.status(403).json({error:"Learner is not enrolled in this subject/module"});return;}
 const row=await db.transaction(async tx=>{
  const [old]=await tx.select().from(academicGradesTable).where(and(eq(academicGradesTable.assessmentId,aid.data),eq(academicGradesTable.learnerId,req.params.learnerId))).limit(1);
  const [grade]=await tx.insert(academicGradesTable).values({assessmentId:aid.data,learnerId:req.params.learnerId,marks:input.data.marks,status:input.data.status,feedback:input.data.feedback,reviewedBy:req.user!.id})
    .onConflictDoUpdate({target:[academicGradesTable.assessmentId,academicGradesTable.learnerId],set:{marks:input.data.marks,status:input.data.status,feedback:input.data.feedback,reviewedBy:req.user!.id,updatedAt:new Date()}}).returning();
  await tx.insert(academicGradeEventsTable).values({gradeId:grade.id,changedBy:req.user!.id,oldMarks:old?.marks??null,newMarks:grade.marks,oldStatus:old?.status??null,newStatus:grade.status,reason:input.data.reason});return grade;
 });res.json(row);
});
async function reportRows(orgId:number){
 return db.select({courseId:academicCoursesTable.id,courseName:academicCoursesTable.name,level:academicCoursesTable.level,learnerId:academicGradesTable.learnerId,assessmentId:academicAssessmentsTable.id,assessmentTitle:academicAssessmentsTable.title,periodId:academicPeriodsTable.id,periodName:academicPeriodsTable.name,year:academicPeriodsTable.year,weight:academicAssessmentsTable.weight,marks:academicGradesTable.marks,maxMarks:academicAssessmentsTable.maxMarks})
 .from(academicGradesTable).innerJoin(academicAssessmentsTable,eq(academicAssessmentsTable.id,academicGradesTable.assessmentId))
 .innerJoin(academicCoursesTable,eq(academicCoursesTable.id,academicAssessmentsTable.courseId))
 .innerJoin(academicPeriodsTable,eq(academicPeriodsTable.id,academicAssessmentsTable.periodId))
 .where(and(eq(academicAssessmentsTable.organizationId,orgId),eq(academicGradesTable.status,"published")));
}
function summarize(rows:Awaited<ReturnType<typeof reportRows>>){
 const groups=new Map<string,{learnerId:string;courseId:number;courseName:string;periodId:number;periodName:string;year:number;weighted:number;totalWeight:number;completed:number}>();
 for(const row of rows){const key=[row.learnerId,row.courseId,row.periodId].join(":");
  const g=groups.get(key)||{learnerId:row.learnerId,courseId:row.courseId,courseName:row.courseName,periodId:row.periodId,periodName:row.periodName,year:row.year,weighted:0,totalWeight:0,completed:0};
  g.weighted+=row.marks/row.maxMarks*100*row.weight;g.totalWeight+=row.weight;g.completed++;groups.set(key,g);
 }
 return [...groups.values()].map(g=>({learnerId:g.learnerId,courseId:g.courseId,courseName:g.courseName,periodId:g.periodId,periodName:g.periodName,year:g.year,percentage:Math.round(g.weighted/g.totalWeight*100)/100,assessments:g.completed,weightIncluded:g.totalWeight,provisional:g.totalWeight<99.99}));
}
router.get("/organizations/:orgId/academic/my-report",async(req,res)=>{
 const org=id.safeParse(req.params.orgId);if(!org.success){res.sendStatus(400);return;}if(!await allowed(req,res,org.data))return;
 const rows=(await reportRows(org.data)).filter(row=>row.learnerId===req.user!.id);
 res.json({results:summarize(rows),assessments:rows.map(r=>({courseName:r.courseName,title:r.assessmentTitle,periodName:r.periodName,marks:r.marks,maxMarks:r.maxMarks,percentage:Math.round(10000*r.marks/r.maxMarks)/100}))});
});
router.get("/organizations/:orgId/academic/leaderboard",async(req,res)=>{
 const org=id.safeParse(req.params.orgId),period=id.safeParse(req.query.periodId),cid=id.safeParse(req.query.courseId);
 if(!org.success||!period.success||!cid.success){res.status(400).json({error:"courseId and periodId required"});return;}
 if(!await allowed(req,res,org.data,staff))return;
 if(!await course(org.data,cid.data)){res.sendStatus(404);return;}
 const entries=summarize((await reportRows(org.data)).filter(r=>r.courseId===cid.data&&r.periodId===period.data)).sort((a,b)=>b.percentage-a.percentage||a.learnerId.localeCompare(b.learnerId)).slice(0,10);
 const learners=entries.length?await db.select({id:usersTable.id,firstName:usersTable.firstName,lastName:usersTable.lastName}).from(usersTable).where(inArray(usersTable.id,entries.map(e=>e.learnerId))):[];
 const users=new Map(learners.map(u=>[u.id,u]));
 res.json(entries.map((e,i)=>({rank:i+1,learnerId:e.learnerId,name:[users.get(e.learnerId)?.firstName,users.get(e.learnerId)?.lastName].filter(Boolean).join(" ")||"Learner",percentage:e.percentage,assessments:e.assessments,provisional:e.provisional})));
});
router.get("/organizations/:orgId/academic/reports",async(req,res)=>{
 const org=id.safeParse(req.params.orgId);if(!org.success){res.sendStatus(400);return;}
 if(!await allowed(req,res,org.data,staff))return;
 const results=summarize(await reportRows(org.data));
 const avg=results.length?Math.round(results.reduce((s,r)=>s+r.percentage,0)/results.length*100)/100:null;
 res.json({averageScore:avg,resultCount:results.length,results});
});
export default router;