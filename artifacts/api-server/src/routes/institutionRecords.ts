import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod/v4";
import { isPlatformSuperadmin } from "../lib/portalAccess";
import { auditSuperadmin } from "../lib/platformAudit";
import { db, usersTable, organizationsTable, organizationMembersTable, verifiedEnrollmentsTable, schoolTransfersTable, guardianRelationshipsTable } from "@workspace/db";
const router:IRouter=Router();
const id=z.coerce.number().int().positive();
const stage=z.enum(["RR","R","1","2","3","4","5","6","7","8","9","10","11","12","university","college","training"]);
function current(req:Request,res:Response):string|null{
 if(!req.isAuthenticated()){res.status(401).json({error:"Sign in required"});return null}return req.user!.id;
}
async function membership(org:number,user:string){
 const [m]=await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);
 return m;
}
async function canRecord(org:number,user:string){
 if(isPlatformSuperadmin(user)){await auditSuperadmin(user,"institution_admin_access",org);return true;}
 const m=await membership(org,user);return !!m&&["owner","admin"].includes(m.role);
}
router.get("/institution-records/me",async(req,res)=>{
 const user=current(req,res);if(!user)return;
 const [enrollments,transfers,guardians]=await Promise.all([
  db.select({id:verifiedEnrollmentsTable.id,organizationId:verifiedEnrollmentsTable.organizationId,organization:organizationsTable.name,stage:verifiedEnrollmentsTable.stage,academicYear:verifiedEnrollmentsTable.academicYear,status:verifiedEnrollmentsTable.status,createdAt:verifiedEnrollmentsTable.createdAt}).from(verifiedEnrollmentsTable).innerJoin(organizationsTable,eq(organizationsTable.id,verifiedEnrollmentsTable.organizationId)).where(eq(verifiedEnrollmentsTable.learnerId,user)).orderBy(desc(verifiedEnrollmentsTable.academicYear)),
  db.select().from(schoolTransfersTable).where(eq(schoolTransfersTable.learnerId,user)).orderBy(desc(schoolTransfersTable.createdAt)),
  db.select({id:guardianRelationshipsTable.id,guardianId:guardianRelationshipsTable.guardianId,status:guardianRelationshipsTable.status}).from(guardianRelationshipsTable).where(eq(guardianRelationshipsTable.learnerId,user))
 ]);
 res.json({enrollments,transfers,guardians});
});
router.post("/organizations/:orgId/verified-enrollments",async(req,res)=>{
 const user=current(req,res);if(!user)return;
 const org=id.safeParse(req.params.orgId),body=z.object({learnerId:z.string().min(1),stage,academicYear:z.number().int().min(1900).max(2200)}).safeParse(req.body);
 if(!org.success||!body.success){res.sendStatus(400);return}
 if(!await canRecord(org.data,user)){res.sendStatus(403);return}
 const learner=await membership(org.data,body.data.learnerId);
 if(!learner||learner.role!=="learner"){res.status(409).json({error:"Learner must first be enrolled as an organisation member"});return}
 const [record]=await db.insert(verifiedEnrollmentsTable).values({organizationId:org.data,recordedBy:user,...body.data}).onConflictDoNothing().returning();
 if(!record){res.status(409).json({error:"This institution/learner/stage/year record already exists"});return}
 res.status(201).json(record);
});
router.get("/organizations/:orgId/verified-enrollments",async(req,res)=>{
 const user=current(req,res);if(!user)return;const org=id.safeParse(req.params.orgId);
 if(!org.success){res.sendStatus(400);return}
 if(!await canRecord(org.data,user)){res.sendStatus(403);return}
 const rows=await db.select().from(verifiedEnrollmentsTable).where(eq(verifiedEnrollmentsTable.organizationId,org.data));
 res.json(rows);
});
router.post("/institution-records/transfers",async(req,res)=>{
 const user=current(req,res);if(!user)return;
 const body=z.object({fromEnrollmentId:z.number().int().positive(),toOrganizationId:z.number().int().positive(),reason:z.string().max(2000).default("")}).safeParse(req.body);
 if(!body.success){res.sendStatus(400);return}
 const [from]=await db.select().from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.id,body.data.fromEnrollmentId),eq(verifiedEnrollmentsTable.learnerId,user))).limit(1);
 if(!from||from.status!=="active"){res.status(404).json({error:"Active enrolment not found"});return}
 if(from.organizationId===body.data.toOrganizationId){res.sendStatus(400);return}
 const [target]=await db.select({id:organizationsTable.id}).from(organizationsTable).where(eq(organizationsTable.id,body.data.toOrganizationId)).limit(1);
 if(!target){res.sendStatus(404);return}
 const [transfer]=await db.insert(schoolTransfersTable).values({learnerId:user,requestedBy:user,fromOrganizationId:from.organizationId,toOrganizationId:target.id,fromEnrollmentId:from.id,reason:body.data.reason}).returning();
 res.status(201).json(transfer);
});
router.get("/organizations/:orgId/transfers/incoming",async(req,res)=>{
 const user=current(req,res);if(!user)return;const org=id.safeParse(req.params.orgId);
 if(!org.success){res.sendStatus(400);return}if(!await canRecord(org.data,user)){res.sendStatus(403);return}
 res.json(await db.select().from(schoolTransfersTable).where(eq(schoolTransfersTable.toOrganizationId,org.data)).orderBy(desc(schoolTransfersTable.createdAt)));
});
router.post("/organizations/:orgId/transfers/:transferId/decision",async(req,res)=>{
 const user=current(req,res);if(!user)return;const org=id.safeParse(req.params.orgId),tid=id.safeParse(req.params.transferId);
 const body=z.object({decision:z.enum(["accepted","declined"])}).safeParse(req.body);
 if(!org.success||!tid.success||!body.success){res.sendStatus(400);return}
 if(!await canRecord(org.data,user)){res.sendStatus(403);return}
 const [transfer]=await db.select().from(schoolTransfersTable).where(and(eq(schoolTransfersTable.id,tid.data),eq(schoolTransfersTable.toOrganizationId,org.data),eq(schoolTransfersTable.status,"pending"))).limit(1);
 if(!transfer){res.status(409).json({error:"Transfer unavailable or already processed"});return}
 // Receiving institution must confirm learner membership before accepting.
 if(body.data.decision==="accepted"){const m=await membership(org.data,transfer.learnerId);if(!m||m.role!=="learner"){res.status(409).json({error:"Receiving institution must first enrol learner as a member"});return}}
 const [updated]=await db.update(schoolTransfersTable).set({status:body.data.decision,processedBy:user,decidedAt:new Date()}).where(and(eq(schoolTransfersTable.id,tid.data),eq(schoolTransfersTable.status,"pending"))).returning();
 if(!updated){res.status(409).json({error:"Already processed"});return}
 // Approval intentionally does NOT transmit grades or modify historical enrolments.
 res.json(updated);
});
router.post("/guardian-relationships",async(req,res)=>{
 const user=current(req,res);if(!user)return;const body=z.object({guardianEmail:z.email()}).safeParse(req.body);
 if(!body.success){res.sendStatus(400);return}
 const [guardian]=await db.select({id:usersTable.id}).from(usersTable).where(eq(usersTable.email,body.data.guardianEmail)).limit(1);
 if(!guardian||guardian.id===user){res.status(400).json({error:"Provide an existing different account"});return}
 const [r]=await db.insert(guardianRelationshipsTable).values({learnerId:user,guardianId:guardian.id}).onConflictDoNothing().returning();
 if(!r){res.status(409).json({error:"Already requested"});return}
 res.status(201).json({id:r.id,status:r.status});
});
router.get("/guardian-relationships/incoming",async(req,res)=>{
 const user=current(req,res);if(!user)return;
 res.json(await db.select({id:guardianRelationshipsTable.id,learnerId:guardianRelationshipsTable.learnerId,status:guardianRelationshipsTable.status}).from(guardianRelationshipsTable).where(eq(guardianRelationshipsTable.guardianId,user)));
});
router.post("/guardian-relationships/:id/decision",async(req,res)=>{
 const user=current(req,res);if(!user)return;const rid=id.safeParse(req.params.id),body=z.object({decision:z.enum(["accepted","declined"])}).safeParse(req.body);
 if(!rid.success||!body.success){res.sendStatus(400);return}
 const [r]=await db.update(guardianRelationshipsTable).set({status:body.data.decision,respondedAt:new Date()}).where(and(eq(guardianRelationshipsTable.id,rid.data),eq(guardianRelationshipsTable.guardianId,user),eq(guardianRelationshipsTable.status,"pending"))).returning();
 if(!r){res.status(404).json({error:"Pending invitation not found"});return}
 res.json({id:r.id,status:r.status});
});
export default router;