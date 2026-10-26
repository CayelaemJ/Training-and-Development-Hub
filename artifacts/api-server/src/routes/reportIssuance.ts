import {Router,type IRouter} from "express";
import {and,desc,eq} from "drizzle-orm";
import {contentDigest,configuredReportSigner,signingPayload,verifyReportSignature} from "../lib/reportCryptography";
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
 const hash=contentDigest(snapshot);
 const result=await db.transaction(async tx=>{
  const existing=await tx.select({version:issuedSchoolReportsTable.version,status:issuedSchoolReportsTable.status}).from(issuedSchoolReportsTable).where(and(eq(issuedSchoolReportsTable.organizationId,org.data),eq(issuedSchoolReportsTable.learnerId,body.data.learnerId),eq(issuedSchoolReportsTable.academicYear,body.data.academicYear))).orderBy(desc(issuedSchoolReportsTable.version));
  if(existing.some(r=>["submitted","approved","issued"].includes(r.status)))return {error:"A pending or issued report version already exists"} as const;
  const [item]=await tx.insert(issuedSchoolReportsTable).values({organizationId:org.data,learnerId:body.data.learnerId,academicYear:body.data.academicYear,version:(existing[0]?.version??0)+1,status:"submitted",snapshot,contentHash:hash,digestAlgorithm:"canonical-json-v2",submittedBy:req.user!.id}).returning();
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
  let signature:string|null=null,signingKeyId:string|null=null;
  if(action==="issue"){
   if(item.digestAlgorithm!=="canonical-json-v2"||contentDigest(item.snapshot)!==item.contentHash)return {error:"Report uses an unverifiable legacy digest or content failed integrity verification; regenerate the report",code:409} as const;
   const signer=configuredReportSigner();
   if(signer){signature=signer.signData(signingPayload(item.organizationId,item.learnerId,item.academicYear,item.version,item.contentHash));signingKeyId=signer.keyId}
  }
  const [updated]=await tx.update(issuedSchoolReportsTable).set({status,reviewedBy:action==="approve"?req.user!.id:item.reviewedBy,issuedAt:action==="issue"?new Date():item.issuedAt,signature:action==="issue"?signature:item.signature,signingKeyId:action==="issue"?signingKeyId:item.signingKeyId}).where(eq(issuedSchoolReportsTable.id,item.id)).returning();
  await tx.insert(schoolReportEventsTable).values({reportId:item.id,actorId:req.user!.id,action,reason:body.data.reason});
  return {id:updated.id,status:updated.status,hash:updated.contentHash,cryptographicallySigned:!!updated.signature} as const;
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
 const [authority]=await db.select({decision:guardianVerificationEventsTable.decision}).from(guardianVerificationEventsTable).where(and(eq(guardianVerificationEventsTable.relationshipId,relation.id),eq(guardianVerificationEventsTable.organizationId,org.data))).orderBy(desc(guardianVerificationEventsTable.createdAt),desc(guardianVerificationEventsTable.id)).limit(1);
 const [enrolled]=await db.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.learnerId,req.params.learnerId),eq(verifiedEnrollmentsTable.status,"active"))).limit(1);
 if(authority?.decision!=="verified"||!enrolled){res.sendStatus(403);return}
 const rows=await db.select({id:issuedSchoolReportsTable.id,academicYear:issuedSchoolReportsTable.academicYear,contentHash:issuedSchoolReportsTable.contentHash,snapshot:issuedSchoolReportsTable.snapshot}).from(issuedSchoolReportsTable).where(and(eq(issuedSchoolReportsTable.organizationId,org.data),eq(issuedSchoolReportsTable.learnerId,req.params.learnerId),eq(issuedSchoolReportsTable.status,"issued")));
 res.setHeader("Cache-Control","private, no-store");res.json(rows);
});

router.get("/report-issuance/:reportId/integrity",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const id=positive.safeParse(req.params.reportId);if(!id.success){res.sendStatus(400);return}
 const [item]=await db.select().from(issuedSchoolReportsTable).where(eq(issuedSchoolReportsTable.id,id.data)).limit(1);
 if(!item){res.sendStatus(404);return}
 if(req.user.id!==item.learnerId&&!await schoolManager(item.organizationId,req.user.id)){
  const [relation]=await db.select({id:guardianRelationshipsTable.id}).from(guardianRelationshipsTable).where(and(eq(guardianRelationshipsTable.learnerId,item.learnerId),eq(guardianRelationshipsTable.guardianId,req.user.id),eq(guardianRelationshipsTable.status,"verified"))).limit(1);
  const [authority]=relation?await db.select({decision:guardianVerificationEventsTable.decision}).from(guardianVerificationEventsTable).where(and(eq(guardianVerificationEventsTable.relationshipId,relation.id),eq(guardianVerificationEventsTable.organizationId,item.organizationId))).orderBy(desc(guardianVerificationEventsTable.createdAt),desc(guardianVerificationEventsTable.id)).limit(1):[];
  const [enrolled]=await db.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,item.organizationId),eq(verifiedEnrollmentsTable.learnerId,item.learnerId),eq(verifiedEnrollmentsTable.status,"active"))).limit(1);
  if(!relation||authority?.decision!=="verified"||!enrolled){res.sendStatus(403);return}
 }
 const hashValid=item.digestAlgorithm==="canonical-json-v2"?contentDigest(item.snapshot)===item.contentHash:null;
 let signatureValid=false;
 if(hashValid===true&&item.signature&&item.signingKeyId){
  const signer=configuredReportSigner();
  const registered=process.env.CABO_REPORT_PUBLIC_KEYS_JSON;
  let trusted:Record<string,string>={};
  try{const obj=registered?JSON.parse(registered):{};if(obj&&typeof obj==="object"&&!Array.isArray(obj))trusted=obj}catch{}
  const pem=trusted[item.signingKeyId]??(signer?.keyId===item.signingKeyId?signer.publicKeyPem:undefined);
  if(pem)signatureValid=verifyReportSignature(signingPayload(item.organizationId,item.learnerId,item.academicYear,item.version,item.contentHash),item.signature,pem);
 }
 res.setHeader("Cache-Control","private, no-store");
 res.json({id:item.id,status:item.status,hashValid,digestAlgorithm:item.digestAlgorithm,cryptographicallySigned:!!item.signature,signatureValid,signingKeyId:item.signingKeyId,issuerIdentityAccredited:false,warning:"Signature proves configured key possession, not DBE/IEB accreditation or school authority."});
});
export default router;
