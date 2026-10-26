import {Router,type IRouter} from "express";
import {and,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,institutionSetupTable,organizationMembersTable,organizationsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {assessInstitutionProfileSubmission,countryChangeNeedsReview} from "../lib/countryCompliancePolicy";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
const profile=z.object({
 countryCode:z.enum(["ZA","BW"]).nullish(),
 institutionType:z.enum(["preprimary","primary","highschool","combined","special","independent","tvet","university","training"]),
 province:z.string().trim().min(2).max(60),
 district:z.string().trim().min(2).max(120),circuit:z.string().trim().max(120).default(""),
 officialReference:z.string().trim().max(100).default(""),
 curriculum:z.string().trim().min(2).max(40),
 language:z.string().trim().min(2).max(40).default("English"),
 academicYear:z.number().int().min(2020).max(2200),
 status:z.enum(["draft","submitted"]).default("draft")
});
async function manager(org:number,user:string){
 if(isPlatformSuperadmin(user))return true;
 const [m]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);
 return m?.role==="owner"||m?.role==="admin";
}
router.get("/organizations/:orgId/setup",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const oid=id.safeParse(req.params.orgId);if(!oid.success){res.sendStatus(400);return}
 if(!await manager(oid.data,req.user.id)){res.sendStatus(403);return}
 const [row]=await db.select().from(institutionSetupTable).where(eq(institutionSetupTable.organizationId,oid.data)).limit(1);
 res.setHeader("Cache-Control","private, no-store");res.json(row??null);
});
router.put("/organizations/:orgId/setup",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const oid=id.safeParse(req.params.orgId),body=profile.safeParse(req.body);
 if(!oid.success||!body.success){res.status(400).json({error:"Invalid institution configuration"});return}
 if(!await manager(oid.data,req.user.id)){res.sendStatus(403);return}
 const actorId=req.user.id;
 // Serialize a school's first country selection as well as later updates.
 // Locking the parent organization row prevents two concurrent first-time
 // setup requests from both seeing country=NULL and silently reclassifying it.
 const outcome=await db.transaction(async tx=>{
   const [org]=await tx.select({id:organizationsTable.id}).from(organizationsTable)
     .where(eq(organizationsTable.id,oid.data)).for("update").limit(1);
   if(!org)return {error:"not_found"} as const;
   const [previous]=await tx.select({countryCode:institutionSetupTable.countryCode})
     .from(institutionSetupTable)
     .where(eq(institutionSetupTable.organizationId,oid.data)).limit(1);
   const previousCode=previous?.countryCode??null;
   if(previousCode!==null && previousCode!=="ZA" && previousCode!=="BW")
     return {error:"invalid_jurisdiction"} as const;
   const countryCode=body.data.countryCode??previousCode;
   if(countryChangeNeedsReview(previousCode,countryCode))
     return {error:"country_change_requires_review"} as const;
   const decision=assessInstitutionProfileSubmission(countryCode,body.data.status,process.env);
   if(!decision.allowed)
     return {error:"missing_country_review",requiredReviewItems:decision.missing} as const;
   const [result]=await tx.insert(institutionSetupTable)
     .values({...body.data,countryCode,organizationId:oid.data,updatedBy:actorId})
     .onConflictDoUpdate({target:institutionSetupTable.organizationId,
       set:{...body.data,countryCode,updatedBy:actorId,updatedAt:new Date()}})
     .returning();
   return {result} as const;
 });
 if("error" in outcome){
   const errors:Record<string,string>={
     not_found:"Institution not found",
     invalid_jurisdiction:"Existing jurisdiction value requires administrator review",
     country_change_requires_review:"Changing an institution's country requires a documented, authorised data-governance migration",
     missing_country_review:"Country-specific institution review prerequisites have not been met"
   };
   res.status(outcome.error==="not_found"?404:409)
     .json({error:errors[outcome.error],...("requiredReviewItems" in outcome ? {requiredReviewItems:outcome.requiredReviewItems}: {})});
   return;
 }
 const result=outcome.result;
 res.setHeader("Cache-Control","private, no-store");
 res.json({organizationId:result.organizationId,status:result.status,countryCode:result.countryCode,
   readyForOfficialVerification:false,legalCertification:false,
   details:{institutionType:result.institutionType,province:result.province,
     district:result.district,circuit:result.circuit,curriculum:result.curriculum,
     academicYear:result.academicYear}});
});
export default router;