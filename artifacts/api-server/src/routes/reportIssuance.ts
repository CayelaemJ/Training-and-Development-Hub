import {Router,type IRouter} from "express";
import {and,desc,eq} from "drizzle-orm";
import {createHash} from "node:crypto";
import {z} from "zod/v4";
import {db,issuedSchoolReportsTable,schoolReportEventsTable,guardianRelationshipsTable,guardianVerificationEventsTable,verifiedEnrollmentsTable} from "@workspace/db";
import {gather,schoolManager} from "./reportCards";
import {mayChangeReport,type ReportStatus} from "../lib/reportIssuancePolicy";
const router:IRouter=Router(),positive=z.coerce.number().int().positive();
router.post("/organizations/:orgId/report-issuance",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=positive.safeParse(req.params.orgId);
 const body=z.object({learnerId:z.string().min(1),academicYear:z.number().int().min(2000).max(2200)}).safeParse(req.body);
 if(!org.success||!body.success){res.sendStatus(400);return}
 if(!await schoolManager(org.data,req.user.id)){res.sendStatus(403);return}
 const snapshot=await gather(org.data,body.data.learnerId,body.data.academicYear);
 if(!snapshot||snapshot.subjects.length===0){res.status(409).json({error:"Published assessments and valid enrolment are needed"});return}
 const hash=createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
 const result=await db.transaction(async tx=>{
  const existing=await tx.select({version:issuedSchoolReportsTable.version,status:issuedSchoolReportsTable.status}).from(issuedSchoolReportsTable).where(and(eq(issuedSchoolReportsTable.organizationId,org.data),eq(issuedSchoolReportsTable.learnerId,body.data.learnerId),eq(issuedSchoolReportsTable.academicYear,body.data.academicYear))).orderBy(desc(issuedSchoolReportsTable.version));
  if(existing.some(r=>["submitted","approved","issued"].includes(r.status)))return {error:"A pending or issued report version already exists"} as const;
  const [item]=await tx.insert(issuedSchoolReportsTable).values({organizationId:org.data,learnerId:body.data.learnerId,academicYear:body.data.academicYear,version:(existing[0]?.version??0)+1,status:"submitted",snapshot,contentHash:hash,submittedBy:req.user!.id}).returning();
  await tx.insert(schoolReportEventsTable).values({reportId:item.id,actorId:req.user!.id,action:"submitted"});
  return {id:item.id,status:item.status,version:item.version,hash:item.contentHash} as const;
 });
 if("error" in result){res.status(409).json({error:result.error});return}
 res.status(201).json(result);
});
router.get("/organizations/:orgId/report-issuance",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=positive.safeParse(req.params.orgId);if(!org.success){res.sendStatus(400);return}
 if(!await schoolManager(org.data,req.user.id)){res.sendStatus(403);return}
 const items=await db.select({id:issuedSchoolReportsTable.id,learnerId:issuedSchoolReportsTable.learnerId,academicYear:issuedSchoolReportsTable.academicYear,version:issuedSchoolReportsTable.version,status:issuedSchoolReportsTable.status,submittedBy:issuedSchoolReportsTable.submittedBy,reviewedBy:issuedSchoolReportsTable.reviewedBy,contentHash:issuedSchoolReportsTable.contentHash,issuedAt:issuedSchoolReportsTable.issuedAt}).from(issuedSchoolReportsTable).where(eq(issuedSchoolReportsTable.organizationId,org.data)).orderBy(desc(issuedSchoolReportsTable.createdAt)).limit(100);
 res.setHeader("Cache-Control","private, no-store");res.json(items);
});
router.post("/organizations/:orgId/report-issuance/:reportId/decision",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=positive.safeParse(req.params.orgId),report=positive.safeParse(req.params.reportId);
 const body=z.object({action:z.enum(["approve","reject","issue","revoke"]),reason:z.string().trim().max(1000).default("")}).safeParse(req.body);
 if(!org.success||!report.success||!body.success){res.sendStatus(400);return}
 if(!await schoolManager(org.data,req.user.id)){res.sendStatus(403);return}
 const result=await db.transaction(async tx=>{
  const [item]=await tx.select().from(issuedSchoolReportsTable).where(and(eq(issuedSchoolReportsTable.organizationId,org.data),eq(issuedSchoolReportsTable.id,report.data))).for("update").limit(1);
  if(!item)return {error:"Report not found",code:404} as const;
  const action=body.data.action,valid=mayChangeReport(item.status as ReportStatus,action,item.submittedBy,req.user!.id,body.data.reason);
  if(!valid)return {error:"Invalid report transition",code:409} as const;
  if(action==="approve"&&item.submittedBy===req.user!.id)return {error:"A second authorised reviewer must approve",code:403} as const;
  if((action==="reject"||action==="revoke")&&!body.data.reason)return {error:"A reason is required",code:400} as const;
  const status={approve:"approved",reject:"rejected",issue:"issued",revoke:"revoked"}[action];
  const [updated]=await tx.update(issuedSchoolReportsTable).set({status,reviewedBy:action==="approve"?req.user!.id:item.reviewedBy,issuedAt:action==="issue"?new Date():item.issuedAt}).where(eq(issuedSchoolReportsTable.id,item.id)).returning();
  await tx.insert(schoolReportEventsTable).values({reportId:item.id,actorId:req.user!.id,action,reason:body.data.reason});
  return {id:updated.id,status:updated.status,hash:updated.contentHash} as const;
 });
 if("error" in result){res.status(result.code??400).json({error:result.error});return}
 res.json(result);
});
router.get("/report-issuance/me",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const rows=await db.select({id:issuedSchoolReportsTable.id,organizationId:issuedSchoolReportsTable.organizationId,academicYear:issuedSchoolReportsTable.academicYear,status:issuedSchoolReportsTable.status,contentHash:issuedSchoolReportsTable.contentHash,snapshot:issuedSchoolReportsTable.snapshot}).from(issuedSchoolReportsTable).where(and(eq(issuedSchoolReportsTable.learnerId,req.user.id),eq(issuedSchoolReportsTable.status,"issued"))).orderBy(desc(issuedSchoolReportsTable.createdAt));
 res.setHeader("Cache-Control","private, no-store");res.json(rows);
});
router.get("/guardian/issued-reports/:learnerId",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=positive.safeParse(req.query.organizationId);if(!org.success){res.sendStatus(400);return}
 const [relation]=await db.select({id:guardianRelationshipsTable.id}).from(guardianRelationshipsTable).where(and(eq(guardianRelationshipsTable.learnerId,req.params.learnerId),eq(guardianRelationshipsTable.guardianId,req.user.id),eq(guardianRelationshipsTable.status,"verified"))).limit(1);
 if(!relation){res.sendStatus(403);return}
 const [authority]=await db.select({id:guardianVerificationEventsTable.id}).from(guardianVerificationEventsTable).where(and(eq(guardianVerificationEventsTable.relationshipId,relation.id),eq(guardianVerificationEventsTable.organizationId,org.data),eq(guardianVerificationEventsTable.decision,"verified"))).limit(1);
 const [enrolled]=await db.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.learnerId,req.params.learnerId),eq(verifiedEnrollmentsTable.status,"active"))).limit(1);
 if(!authority||!enrolled){res.sendStatus(403);return}
 const rows=await db.select({id:issuedSchoolReportsTable.id,academicYear:issuedSchoolReportsTable.academicYear,contentHash:issuedSchoolReportsTable.contentHash,snapshot:issuedSchoolReportsTable.snapshot}).from(issuedSchoolReportsTable).where(and(eq(issuedSchoolReportsTable.organizationId,org.data),eq(issuedSchoolReportsTable.learnerId,req.params.learnerId),eq(issuedSchoolReportsTable.status,"issued")));
 res.setHeader("Cache-Control","private, no-store");res.json(rows);
});
export default router;