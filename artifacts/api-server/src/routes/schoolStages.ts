import {Router,type IRouter} from "express";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,organizationMembersTable,verifiedEnrollmentsTable,schoolStageProgressTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {schoolPhases,phaseForGrade,validPhaseDomain,mayWriteSchoolProgress,progressStates} from "../lib/schoolStagePolicy";
const router:IRouter=Router(),positive=z.coerce.number().int().positive();
const phases=z.enum(["preprimary","primary","highschool"]);
const grade=z.enum(["RR","R","1","2","3","4","5","6","7","8","9","10","11","12"]);
function auth(req:any,res:any):string|null{if(!req.isAuthenticated()){res.sendStatus(401);return null}return req.user.id}
async function role(org:number,user:string){if(isPlatformSuperadmin(user))return "owner";const [row]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);return row?.role??null}
async function activeEnrollment(org:number,learner:string,grade:string,year:number){const [record]=await db.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org),eq(verifiedEnrollmentsTable.learnerId,learner),eq(verifiedEnrollmentsTable.stage,grade),eq(verifiedEnrollmentsTable.academicYear,year),eq(verifiedEnrollmentsTable.status,"active"))).limit(1);return !!record}
router.get("/school-stages",async(req,res)=>{if(!auth(req,res))return;res.json(schoolPhases)});
router.get("/school-stages/me",async(req,res)=>{
 const user=auth(req,res);if(!user)return;
 const enrolled=await db.select({organizationId:verifiedEnrollmentsTable.organizationId,grade:verifiedEnrollmentsTable.stage,academicYear:verifiedEnrollmentsTable.academicYear,status:verifiedEnrollmentsTable.status}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.learnerId,user),eq(verifiedEnrollmentsTable.status,"active")));
 const records=await db.select().from(schoolStageProgressTable).where(eq(schoolStageProgressTable.learnerId,user)).orderBy(desc(schoolStageProgressTable.createdAt)).limit(100);
 res.setHeader("Cache-Control","private, no-store");
 res.json({enrollments:enrolled.filter(x=>phaseForGrade(x.grade)!==null).map(x=>({...x,phase:phaseForGrade(x.grade)})),records:records.filter(r=>enrolled.some(e=>e.organizationId===r.organizationId&&e.grade===r.grade&&e.academicYear===r.academicYear))});
});
router.get("/organizations/:orgId/school-stages/:phase",async(req,res)=>{
 const user=auth(req,res);if(!user)return;
 const org=positive.safeParse(req.params.orgId),phase=phases.safeParse(req.params.phase);
 if(!org.success||!phase.success){res.sendStatus(400);return}
 const r=await role(org.data,user);if(!r){res.sendStatus(403);return}
 if(!mayWriteSchoolProgress(r)){res.status(403).json({error:"School-wide records require institution administrator access"});return}
 const records=await db.select().from(schoolStageProgressTable).where(and(eq(schoolStageProgressTable.organizationId,org.data),eq(schoolStageProgressTable.stage,phase.data))).orderBy(desc(schoolStageProgressTable.createdAt)).limit(200);
 res.setHeader("Cache-Control","private, no-store");res.json(records);
});
router.post("/organizations/:orgId/school-stages/progress",async(req,res)=>{
 const user=auth(req,res);if(!user)return;
 const org=positive.safeParse(req.params.orgId),body=z.object({
  learnerId:z.string().min(1),grade,academicYear:z.number().int().min(2000).max(2200),
  phase:phases,domain:z.string().min(2).max(40),title:z.string().trim().min(3).max(180),
  observation:z.string().trim().max(3000).default(""),nextStep:z.string().trim().max(2000).default(""),
  progress:z.enum(progressStates).default("observing")
 }).safeParse(req.body);
 if(!org.success||!body.success){res.status(400).json({error:"Invalid progress record"});return}
 if(!mayWriteSchoolProgress(await role(org.data,user))){res.sendStatus(403);return}
 if(phaseForGrade(body.data.grade)!==body.data.phase||!validPhaseDomain(body.data.phase,body.data.domain)){res.status(400).json({error:"Grade or developmental domain does not match the school phase"});return}
 if(!await activeEnrollment(org.data,body.data.learnerId,body.data.grade,body.data.academicYear)){res.status(409).json({error:"An active, grade-matched institution enrolment is required"});return}
 const [record]=await db.insert(schoolStageProgressTable).values({learnerId:body.data.learnerId,grade:body.data.grade,academicYear:body.data.academicYear,stage:body.data.phase,domain:body.data.domain,title:body.data.title,observation:body.data.observation,nextStep:body.data.nextStep,progress:body.data.progress,organizationId:org.data,recordedBy:user}).returning();
 res.status(201).json({id:record.id,phase:record.stage,grade:record.grade,progress:record.progress});
});
router.patch("/organizations/:orgId/school-stages/progress/:recordId",async(req,res)=>{
 const user=auth(req,res);if(!user)return;
 const org=positive.safeParse(req.params.orgId),id=positive.safeParse(req.params.recordId);
 const body=z.object({progress:z.enum(progressStates),nextStep:z.string().trim().max(2000),observation:z.string().trim().max(3000)}).safeParse(req.body);
 if(!org.success||!id.success||!body.success){res.sendStatus(400);return}
 if(!mayWriteSchoolProgress(await role(org.data,user))){res.sendStatus(403);return}
 const [original]=await db.select().from(schoolStageProgressTable).where(and(eq(schoolStageProgressTable.organizationId,org.data),eq(schoolStageProgressTable.id,id.data))).limit(1);
 if(!original){res.sendStatus(404);return}
 if(!await activeEnrollment(org.data,original.learnerId,original.grade,original.academicYear)){res.status(409).json({error:"The learner's matching enrolment is no longer active"});return}
 const [updated]=await db.update(schoolStageProgressTable).set({...body.data,updatedAt:new Date(),recordedBy:user}).where(and(eq(schoolStageProgressTable.organizationId,org.data),eq(schoolStageProgressTable.id,id.data))).returning();
 res.json({id:updated.id,progress:updated.progress,updatedAt:updated.updatedAt});
});
export default router;
