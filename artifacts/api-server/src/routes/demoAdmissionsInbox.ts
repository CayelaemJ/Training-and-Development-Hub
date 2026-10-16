import {Router,type IRouter} from "express";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,admissionApplicationsTable,admissionInstitutionsTable,admissionProgrammesTable,admissionEventsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {syntheticCandidate,canAdvanceDemoApplication,type DemoAdmissionStatus} from "../lib/demoAdmissionsPolicy";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
const fictionalUniversity="CABO DEMO | University of Future Skills";
function permitted(req:any):boolean{return req.isAuthenticated()&&isPlatformSuperadmin(req.user.id)&&process.env.RAILWAY_ENVIRONMENT_NAME==="testing"}

router.get("/platform/demo/admissions-inbox",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!permitted(req)){res.sendStatus(403);return}
 const [uni]=await db.select({id:admissionInstitutionsTable.id}).from(admissionInstitutionsTable).where(eq(admissionInstitutionsTable.name,fictionalUniversity)).limit(1);
 if(!uni){res.json([]);return}
 const rows=await db.select({id:admissionApplicationsTable.id,candidateId:admissionApplicationsTable.candidateId,programme:admissionProgrammesTable.name,status:admissionApplicationsTable.status,externalReference:admissionApplicationsTable.externalReference,createdAt:admissionApplicationsTable.createdAt}).from(admissionApplicationsTable).innerJoin(admissionProgrammesTable,eq(admissionApplicationsTable.programmeId,admissionProgrammesTable.id)).where(eq(admissionProgrammesTable.institutionId,uni.id)).orderBy(desc(admissionApplicationsTable.createdAt)).limit(100);
 res.setHeader("Cache-Control","private, no-store");
 res.json(rows.filter(x=>syntheticCandidate(x.candidateId)).map(x=>({...x,externalReference:x.externalReference?"Provided by candidate — NOT independently verified":null})));
});
router.post("/platform/demo/admissions-inbox/:applicationId/decision",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!permitted(req)){res.sendStatus(403);return}
 const app=id.safeParse(req.params.applicationId),data=z.object({action:z.enum(["under_review","offer","unsuccessful"])}).safeParse(req.body);
 if(!app.success||!data.success){res.sendStatus(400);return}
 const result=await db.transaction(async tx=>{
  const [record]=await tx.select().from(admissionApplicationsTable).where(eq(admissionApplicationsTable.id,app.data)).for("update").limit(1);
  if(!record||!syntheticCandidate(record.candidateId))return {error:"not_found"} as const;
  const [programme]=await tx.select({institutionId:admissionProgrammesTable.institutionId}).from(admissionProgrammesTable).where(eq(admissionProgrammesTable.id,record.programmeId)).limit(1);
  const [university]=programme?await tx.select({name:admissionInstitutionsTable.name}).from(admissionInstitutionsTable).where(eq(admissionInstitutionsTable.id,programme.institutionId)).limit(1):[];
  if(university?.name!==fictionalUniversity)return {error:"not_demo_university"} as const;
  if(!canAdvanceDemoApplication(record.candidateId,university.name,record.status as DemoAdmissionStatus,data.data.action))return {error:"invalid_transition"} as const;
  const [updated]=await tx.update(admissionApplicationsTable).set({status:data.data.action,updatedAt:new Date()}).where(eq(admissionApplicationsTable.id,record.id)).returning();
  await tx.insert(admissionEventsTable).values({applicationId:record.id,actorId:req.user!.id,fromStatus:record.status,toStatus:updated.status});
  return {id:updated.id,status:updated.status,demoOnly:true,universityReceiptVerified:false} as const;
 });
 if("error" in result){res.status(result.error==="not_found"?404:409).json({error:result.error});return}
 res.json(result);
});
export default router;
