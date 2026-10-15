import {Router,type IRouter} from "express";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,verifiedEnrollmentsTable,organizationMembersTable,schoolProgressionEventsTable} from "@workspace/db";
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
 res.setHeader("Cache-Control","private, no-store");res.json(rows.filter(r=>phaseForGrade(r.stage)!==null).map(r=>({...r,nextGrade:nextSchoolGrade(r.stage)})));
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
  const next=body.data.decision==="repeat"?current.stage:nextSchoolGrade(current.stage);
  if(!next)return {error:"The learner has completed the final school grade; use the school-leaving workflow"} as const;
  const [existing]=await tx.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.learnerId,current.learnerId),eq(verifiedEnrollmentsTable.stage,next),eq(verifiedEnrollmentsTable.academicYear,body.data.targetYear))).limit(1);
  if(existing)return {error:"Next-year enrollment already exists"} as const;
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