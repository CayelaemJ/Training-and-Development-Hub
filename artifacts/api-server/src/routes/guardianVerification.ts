import {Router,type IRouter} from "express";
import {and,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,guardianRelationshipsTable,guardianVerificationEventsTable,verifiedEnrollmentsTable,organizationMembersTable,usersTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
async function canManage(org:number,user:string){
 if(isPlatformSuperadmin(user))return true;
 const [row]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);
 return row?.role==="owner"||row?.role==="admin";
}
router.get("/organizations/:orgId/guardian-reviews",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId);if(!org.success){res.sendStatus(400);return}
 if(!await canManage(org.data,req.user.id)){res.sendStatus(403);return}
 const enrollments=await db.select({learnerId:verifiedEnrollmentsTable.learnerId}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.status,"active")));
 if(!enrollments.length){res.json([]);return}
 const learners=[...new Set(enrollments.map(e=>e.learnerId))];
 const results=[] as {id:number;learnerId:string;guardianId:string;status:string}[];
 for(const learner of learners){
  const links=await db.select({id:guardianRelationshipsTable.id,learnerId:guardianRelationshipsTable.learnerId,guardianId:guardianRelationshipsTable.guardianId,status:guardianRelationshipsTable.status}).from(guardianRelationshipsTable).where(eq(guardianRelationshipsTable.learnerId,learner));
  results.push(...links);
 }
 res.setHeader("Cache-Control","private, no-store");res.json(results);
});
router.post("/organizations/:orgId/guardian-reviews/:relationshipId",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),relation=id.safeParse(req.params.relationshipId);
 const data=z.object({decision:z.enum(["verified","revoked"]),evidenceReviewed:z.literal(true)}).safeParse(req.body);
 if(!org.success||!relation.success||!data.success){res.status(400).json({error:"Identity and guardianship evidence must be reviewed by an authorised institution administrator"});return}
 if(!await canManage(org.data,req.user.id)){res.sendStatus(403);return}
 const outcome=await db.transaction(async tx=>{
  const [link]=await tx.select().from(guardianRelationshipsTable).where(eq(guardianRelationshipsTable.id,relation.data)).for("update").limit(1);
  if(!link)return {error:"not_found"} as const;
  const [enrolled]=await tx.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.learnerId,link.learnerId),eq(verifiedEnrollmentsTable.status,"active"))).limit(1);
  if(!enrolled)return {error:"not_enrolled"} as const;
  if(data.data.decision==="verified"&&link.status!=="accepted")return {error:"guardian_must_accept_first"} as const;
  if(data.data.decision==="revoked"&&link.status!=="verified")return {error:"not_verified"} as const;
  await tx.update(guardianRelationshipsTable).set({status:data.data.decision,respondedAt:new Date()}).where(eq(guardianRelationshipsTable.id,link.id));
  await tx.insert(guardianVerificationEventsTable).values({relationshipId:link.id,organizationId:org.data,reviewedBy:req.user!.id,decision:data.data.decision});
  return {id:link.id,status:data.data.decision} as const;
 });
 if("error" in outcome){res.status(outcome.error==="not_found"?404:409).json({error:outcome.error});return}
 res.json(outcome);
});
export default router;