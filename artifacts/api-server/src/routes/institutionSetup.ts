import {Router,type IRouter} from "express";
import {and,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,institutionSetupTable,organizationMembersTable,organizationsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
const profile=z.object({
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
 const [org]=await db.select({id:organizationsTable.id}).from(organizationsTable).where(eq(organizationsTable.id,oid.data)).limit(1);
 if(!org){res.sendStatus(404);return}
 const [result]=await db.insert(institutionSetupTable).values({...body.data,organizationId:oid.data,updatedBy:req.user.id}).onConflictDoUpdate({target:institutionSetupTable.organizationId,set:{...body.data,updatedBy:req.user.id,updatedAt:new Date()}}).returning();
 res.json({organizationId:result.organizationId,status:result.status,readyForOfficialVerification:false,details:{institutionType:result.institutionType,province:result.province,district:result.district,circuit:result.circuit,curriculum:result.curriculum,academicYear:result.academicYear}});
});
export default router;