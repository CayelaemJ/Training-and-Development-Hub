import {Router,type IRouter} from "express";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,admissionInstitutionsTable,admissionProgrammesTable,admissionApplicationsTable,admissionEventsTable} from "@workspace/db";
import {admissionTransitionAllowed,learnerMayTransition,type AdmissionStatus} from "../lib/admissionsPolicy";
import {isPlatformSuperadmin} from "../lib/portalAccess";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
function identity(req:any,res:any){if(!req.isAuthenticated()){res.sendStatus(401);return null}return req.user.id as string}
router.get("/admissions/institutions",async(_req,res)=>{
 const rows=await db.select().from(admissionInstitutionsTable).orderBy(admissionInstitutionsTable.name);
 res.json(rows.map(x=>({id:x.id,name:x.name,officialUrl:x.officialUrl,province:x.province,route:x.route,verification:x.verification})));
});
router.get("/admissions/programmes",async(req,res)=>{
 const institution=id.safeParse(req.query.institutionId);
 if(!institution.success){res.status(400).json({error:"institutionId required"});return}
 const rows=await db.select({id:admissionProgrammesTable.id,name:admissionProgrammesTable.name,faculty:admissionProgrammesTable.faculty,qualification:admissionProgrammesTable.qualification,requirements:admissionProgrammesTable.requirements}).from(admissionProgrammesTable).where(and(eq(admissionProgrammesTable.institutionId,institution.data),eq(admissionProgrammesTable.status,"published")));
 res.json(rows);
});
router.post("/platform/admissions/institutions",async(req,res)=>{
 const user=identity(req,res);if(!user)return;
 if(!isPlatformSuperadmin(user)){res.sendStatus(403);return}
 const body=z.object({name:z.string().trim().min(3).max(180),officialUrl:z.url().refine(x=>x.startsWith("https://")),province:z.string().min(2).max(60)}).safeParse(req.body);
 if(!body.success){res.sendStatus(400);return}
 const [created]=await db.insert(admissionInstitutionsTable).values({...body.data,route:"handoff",verification:"directory_only"}).onConflictDoNothing().returning();
 if(!created){res.status(409).json({error:"Institution already registered"});return}
 res.status(201).json({id:created.id,name:created.name});
});
router.post("/platform/admissions/programmes",async(req,res)=>{
 const user=identity(req,res);if(!user)return;
 if(!isPlatformSuperadmin(user)){res.sendStatus(403);return}
 const body=z.object({institutionId:z.number().int().positive(),name:z.string().trim().min(3).max(200),faculty:z.string().max(120).default(""),qualification:z.string().max(100).default(""),requirements:z.string().max(4000).default("")}).safeParse(req.body);
 if(!body.success){res.sendStatus(400);return}
 const [institution]=await db.select({id:admissionInstitutionsTable.id}).from(admissionInstitutionsTable).where(eq(admissionInstitutionsTable.id,body.data.institutionId)).limit(1);
 if(!institution){res.sendStatus(404);return}
 const [created]=await db.insert(admissionProgrammesTable).values({...body.data,status:"draft"}).returning();
 res.status(201).json({id:created.id,status:created.status});
});
router.get("/admissions/applications/me",async(req,res)=>{
 const user=identity(req,res);if(!user)return;
 res.setHeader("Cache-Control","private, no-store");
 res.json(await db.select({id:admissionApplicationsTable.id,programmeId:admissionApplicationsTable.programmeId,status:admissionApplicationsTable.status,externalReference:admissionApplicationsTable.externalReference,createdAt:admissionApplicationsTable.createdAt}).from(admissionApplicationsTable).where(eq(admissionApplicationsTable.candidateId,user)).orderBy(desc(admissionApplicationsTable.createdAt)));
});
router.post("/admissions/applications",async(req,res)=>{
 const user=identity(req,res);if(!user)return;
 const body=z.object({programmeId:z.number().int().positive(),candidateStatement:z.string().trim().max(4000).default("")}).safeParse(req.body);
 if(!body.success){res.sendStatus(400);return}
 const [programme]=await db.select({id:admissionProgrammesTable.id}).from(admissionProgrammesTable).where(and(eq(admissionProgrammesTable.id,body.data.programmeId),eq(admissionProgrammesTable.status,"published"))).limit(1);
 if(!programme){res.status(404).json({error:"Programme not currently listed"});return}
 const [row]=await db.insert(admissionApplicationsTable).values({candidateId:user,...body.data,status:"draft"}).onConflictDoNothing().returning();
 if(!row){res.status(409).json({error:"You have already started an application for this programme"});return}
 res.status(201).json({id:row.id,status:"draft",universitySubmission:false});
});
router.patch("/admissions/applications/:applicationId",async(req,res)=>{
 const user=identity(req,res);if(!user)return;
 const application=id.safeParse(req.params.applicationId),body=z.object({status:z.enum(["ready_for_handoff","external_submission_recorded","withdrawn","accepted","declined"]),externalReference:z.string().trim().min(3).max(150).optional()}).safeParse(req.body);
 if(!application.success||!body.success){res.sendStatus(400);return}
 const result=await db.transaction(async tx=>{
  const [record]=await tx.select().from(admissionApplicationsTable).where(and(eq(admissionApplicationsTable.id,application.data),eq(admissionApplicationsTable.candidateId,user))).for("update").limit(1);
  if(!record)return {error:"Not found",code:404} as const;
  if(!admissionTransitionAllowed(record.status as AdmissionStatus,body.data.status)||!learnerMayTransition(record.status as AdmissionStatus,body.data.status))return {error:"Invalid application transition",code:409} as const;
  if(body.data.status==="external_submission_recorded"&&!body.data.externalReference)return {error:"Enter the official confirmation reference",code:400} as const;
  const [updated]=await tx.update(admissionApplicationsTable).set({status:body.data.status,externalReference:body.data.externalReference??record.externalReference,disclosureApprovedAt:body.data.status==="ready_for_handoff"?new Date():record.disclosureApprovedAt,updatedAt:new Date()}).where(eq(admissionApplicationsTable.id,record.id)).returning();
  await tx.insert(admissionEventsTable).values({applicationId:record.id,actorId:user,fromStatus:record.status,toStatus:updated.status});
  return {id:updated.id,status:updated.status,universitySubmissionVerified:false} as const;
 });
 if("error" in result){res.status(result.code??400).json({error:result.error});return}
 res.json(result);
});
export default router;
