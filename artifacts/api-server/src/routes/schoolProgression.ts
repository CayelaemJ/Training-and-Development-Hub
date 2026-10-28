import {configuredNextLevel} from "../lib/frameworkPolicy";
import {Router,type IRouter} from "express";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,educationFrameworkVersionsTable,verifiedEnrollmentsTable,organizationMembersTable,schoolProgressionEventsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {phaseForGrade} from "../lib/schoolStagePolicy";
import {nextSchoolGrade,canProgressToYear} from "../lib/schoolProgressionPolicy";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
async function manager(org:number,user:string){if(isPlatformSuperadmin(user))return true;const [m]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);return m?.role==="owner"||m?.role==="admin"}
router.get("/organizations/:orgId/progression/candidates",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),year=z.coerce.number().int().min(2020).max(2200).safeParse(req.query.year);
 if(!org.success||!year.success){res.sendStatus(400);return}
 if(!await manager(org.data,req.user.id)){res.sendStatus(403);return}
 const rows=await db.select({id:verifiedEnrollmentsTable.id,learnerId:verifiedEnrollmentsTable.learnerId,stage:verifiedEnrollmentsTable.stage,academicYear:verifiedEnrollmentsTable.academicYear}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.academicYear,year.data),eq(verifiedEnrollmentsTable.status,"active"))).orderBy(desc(verifiedEnrollmentsTable.id));
 const [framework]=process.env.ENABLE_LEARNER_SUCCESS_LOOP==="true"?await db.select().from(educationFrameworkVersionsTable).where(eq(educationFrameworkVersionsTable.organizationId,org.data)).orderBy(desc(educationFrameworkVersionsTable.id)).limit(1):[];
 res.setHeader("Cache-Control","private, no-store");res.json(rows.filter(r=>framework?framework.settings.levels.includes(r.stage):phaseForGrade(r.stage)!==null).map(r=>({...r,frameworkVersionId:framework?.id??null,nextGrade:framework?configuredNextLevel(framework.settings.levels,r.stage):nextSchoolGrade(r.stage)})));
});
router.post("/organizations/:orgId/progression/:enrollmentId",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),enrollment=id.safeParse(req.params.enrollmentId),body=z.object({targetYear:z.number().int().min(2020).max(2200),decision:z.enum(["promote","repeat"])}).safeParse(req.body);
 if(!org.success||!enrollment.success||!body.success){res.sendStatus(400);return}
 if(!await manager(org.data,req.user.id)){res.sendStatus(403);return}
 const result=await db.transaction(async tx=>{
  const [current]=await tx.select().from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.id,enrollment.data),eq(verifiedEnrollmentsTable.organizationId,org.data))).for("update").limit(1);
  if(!current||current.status!=="active")return {error:"Enrollment is no longer active"} as const;
  if(!canProgressToYear(current.academicYear,body.data.targetYear))return {error:"Target year must follow the current academic year"} as const;
  const [framework]=process.env.ENABLE_LEARNER_SUCCESS_LOOP==="true"?await tx.select().from(educationFrameworkVersionsTable).where(eq(educationFrameworkVersionsTable.organizationId,org.data)).orderBy(desc(educationFrameworkVersionsTable.id)).limit(1):[];
  if(framework&&!framework.settings.levels.includes(current.stage))return {error:"Current stage is absent from the configured framework; school review required"} as const;
  const next=body.data.decision==="repeat"?current.stage:framework?configuredNextLevel(framework.settings.levels,current.stage):nextSchoolGrade(current.stage);
  if(!next)return {error:"The learner has completed the final school grade; use the school-leaving workflow"} as const;
  const [existing]=await tx.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.learnerId,current.learnerId),eq(verifiedEnrollmentsTable.stage,next),eq(verifiedEnrollmentsTable.academicYear,body.data.targetYear))).limit(1);
  if(existing)return {error:"Next-year enrollment already exists"} as const;
  const [activeSameYear]=await tx.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.learnerId,current.learnerId),eq(verifiedEnrollmentsTable.academicYear,body.data.targetYear),eq(verifiedEnrollmentsTable.status,"active"))).limit(1);
  if(activeSameYear)return {error:"Learner already has an active enrolment at this school for the target year"} as const;
  const [created]=await tx.insert(verifiedEnrollmentsTable).values({organizationId:org.data,learnerId:current.learnerId,stage:next,academicYear:body.data.targetYear,recordedBy:req.user!.id,status:"active"}).returning();
  await tx.update(verifiedEnrollmentsTable).set({status:"completed",updatedAt:new Date()}).where(eq(verifiedEnrollmentsTable.id,current.id));
  await tx.insert(schoolProgressionEventsTable).values({organizationId:org.data,priorEnrollmentId:current.id,newEnrollmentId:created.id,learnerId:current.learnerId,fromGrade:current.stage,toGrade:next,decision:body.data.decision,approvedBy:req.user!.id});
  return {id:created.id,learnerId:created.learnerId,fromGrade:current.stage,toGrade:next,academicYear:created.academicYear} as const;
 });
 if("error" in result){res.status(409).json({error:result.error});return}
 res.status(201).json(result);
});
router.get("/organizations/:orgId/progression/history",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId);if(!org.success){res.sendStatus(400);return}
 if(!await manager(org.data,req.user.id)){res.sendStatus(403);return}
 const entries=await db.select().from(schoolProgressionEventsTable).where(eq(schoolProgressionEventsTable.organizationId,org.data)).orderBy(desc(schoolProgressionEventsTable.approvedAt)).limit(100);
 res.setHeader("Cache-Control","private, no-store");res.json(entries);
});
export default router;