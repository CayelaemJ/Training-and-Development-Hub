import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable, organizationsTable, organizationMembersTable, potentialProfilesTable, potentialEvidenceTable, careerOpportunitiesTable, employerAccessRequestsTable, employerAccessAuditTable } from "@workspace/db";
const router:IRouter=Router();
const pos=z.coerce.number().int().positive();
function identity(req:Parameters<typeof router.get>[1] extends infer U?any:any,res:any):string|null {
 if(!req.isAuthenticated()){res.status(401).json({error:"Login required"});return null}
 return req.user!.id;
}
const profileInput=z.object({headline:z.string().trim().max(180),about:z.string().trim().max(4000),aspirations:z.string().trim().max(4000)});
const evidenceInput=z.object({category:z.enum(["skill","strength","growth_area","project","achievement","interest","reflection"]),title:z.string().trim().min(2).max(160),description:z.string().trim().min(10).max(4000)});
async function employer(orgId:number,userId:string){
 const [r]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,orgId),eq(organizationMembersTable.userId,userId))).limit(1);
 return r&&["owner","admin"].includes(r.role);
}
router.get("/potential/me",async(req,res)=>{
 const id=identity(req,res);if(!id)return;
 const [profile]=await db.select().from(potentialProfilesTable).where(eq(potentialProfilesTable.userId,id)).limit(1);
 const evidence=await db.select().from(potentialEvidenceTable).where(eq(potentialEvidenceTable.userId,id)).orderBy(desc(potentialEvidenceTable.createdAt));
 res.json({profile:profile??{userId:id,headline:"",about:"",aspirations:""},evidence});
});
router.put("/potential/me",async(req,res)=>{
 const id=identity(req,res);if(!id)return;const body=profileInput.safeParse(req.body);
 if(!body.success){res.status(400).json({error:"Invalid profile"});return}
 const [p]=await db.insert(potentialProfilesTable).values({userId:id,...body.data}).onConflictDoUpdate({target:potentialProfilesTable.userId,set:{...body.data,updatedAt:new Date()}}).returning();res.json(p);
});
router.post("/potential/evidence",async(req,res)=>{
 const id=identity(req,res);if(!id)return;const body=evidenceInput.safeParse(req.body);
 if(!body.success){res.status(400).json({error:"Invalid evidence"});return}
 const [item]=await db.insert(potentialEvidenceTable).values({userId:id,...body.data,source:"self_report"}).returning();res.status(201).json(item);
});
router.delete("/potential/evidence/:id",async(req,res)=>{
 const user=identity(req,res);if(!user)return;const item=pos.safeParse(req.params.id);if(!item.success){res.sendStatus(400);return}
 await db.delete(potentialEvidenceTable).where(and(eq(potentialEvidenceTable.id,item.data),eq(potentialEvidenceTable.userId,user)));res.status(204).end();
});
router.get("/opportunities",async(req,res)=>{
 if(!identity(req,res))return;
 const rows=await db.select({id:careerOpportunitiesTable.id,title:careerOpportunitiesTable.title,kind:careerOpportunitiesTable.kind,description:careerOpportunitiesTable.description,organization:organizationsTable.name,createdAt:careerOpportunitiesTable.createdAt}).from(careerOpportunitiesTable).innerJoin(organizationsTable,eq(organizationsTable.id,careerOpportunitiesTable.organizationId)).where(eq(careerOpportunitiesTable.status,"active")).orderBy(desc(careerOpportunitiesTable.createdAt));
 res.json(rows);
});
router.post("/organizations/:orgId/opportunities",async(req,res)=>{
 const id=identity(req,res);if(!id)return;const org=pos.safeParse(req.params.orgId);
 const body=z.object({title:z.string().trim().min(3).max(180),kind:z.enum(["job","internship","learnership","bursary","mentorship","university_programme"]),description:z.string().trim().min(20).max(8000)}).safeParse(req.body);
 if(!org.success||!body.success){res.sendStatus(400);return}if(!await employer(org.data,id)){res.sendStatus(403);return}
 const [item]=await db.insert(careerOpportunitiesTable).values({organizationId:org.data,createdBy:id,...body.data}).returning();res.status(201).json(item);
});
router.post("/organizations/:orgId/potential-access",async(req,res)=>{
 const id=identity(req,res);if(!id)return;const org=pos.safeParse(req.params.orgId);
 const body=z.object({personId:z.string().min(1),purpose:z.string().trim().min(15).max(2000),scope:z.enum(["professional","portfolio"])}).safeParse(req.body);
 if(!org.success||!body.success){res.sendStatus(400);return}if(!await employer(org.data,id)){res.sendStatus(403);return}
 if(body.data.personId===id){res.status(400).json({error:"Self access request not needed"});return}
 const [person]=await db.select({id:usersTable.id}).from(usersTable).where(eq(usersTable.id,body.data.personId)).limit(1);
 if(!person){res.sendStatus(404);return}
 const row=await db.transaction(async tx=>{
 const [r]=await tx.insert(employerAccessRequestsTable).values({organizationId:org.data,requesterId:id,...body.data}).returning();
 await tx.insert(employerAccessAuditTable).values({requestId:r.id,actorId:id,action:"requested"});return r;});
 res.status(201).json(row);
});
router.get("/potential/access-requests",async(req,res)=>{
 const id=identity(req,res);if(!id)return;
 const rows=await db.select({id:employerAccessRequestsTable.id,organizationId:employerAccessRequestsTable.organizationId,organization:organizationsTable.name,purpose:employerAccessRequestsTable.purpose,scope:employerAccessRequestsTable.scope,status:employerAccessRequestsTable.status,expiresAt:employerAccessRequestsTable.expiresAt,createdAt:employerAccessRequestsTable.createdAt}).from(employerAccessRequestsTable).innerJoin(organizationsTable,eq(organizationsTable.id,employerAccessRequestsTable.organizationId)).where(eq(employerAccessRequestsTable.personId,id)).orderBy(desc(employerAccessRequestsTable.createdAt));
 res.json(rows);
});
router.post("/potential/access-requests/:id/decision",async(req,res)=>{
 const user=identity(req,res);if(!user)return;const id=pos.safeParse(req.params.id);
 const body=z.object({decision:z.enum(["approved","denied","revoked"])}).safeParse(req.body);
 if(!id.success||!body.success){res.sendStatus(400);return}
 const [row]=await db.select().from(employerAccessRequestsTable).where(and(eq(employerAccessRequestsTable.id,id.data),eq(employerAccessRequestsTable.personId,user))).limit(1);
 if(!row){res.sendStatus(404);return}
 if(row.status!=="pending"&&!(row.status==="approved"&&body.data.decision==="revoked")){res.status(409).json({error:"Request already resolved"});return}
 if(row.status==="pending"&&body.data.decision==="revoked"){res.sendStatus(400);return}
 const result=await db.transaction(async tx=>{
 const [r]=await tx.update(employerAccessRequestsTable).set({status:body.data.decision,decidedAt:new Date(),expiresAt:body.data.decision==="approved"?new Date(Date.now()+7*86400000):new Date()}).where(and(eq(employerAccessRequestsTable.id,id.data),eq(employerAccessRequestsTable.status,row.status))).returning();
 if(!r)throw new Error("Consent updated concurrently");
 await tx.insert(employerAccessAuditTable).values({requestId:r.id,actorId:user,action:body.data.decision});return r;});
 res.json({id:result.id,status:result.status,expiresAt:result.expiresAt});
});
router.get("/organizations/:orgId/potential-access/:requestId",async(req,res)=>{
 const user=identity(req,res);if(!user)return;const org=pos.safeParse(req.params.orgId),rid=pos.safeParse(req.params.requestId);
 if(!org.success||!rid.success){res.sendStatus(400);return}if(!await employer(org.data,user)){res.sendStatus(403);return}
 const [request]=await db.select().from(employerAccessRequestsTable).where(and(eq(employerAccessRequestsTable.id,rid.data),eq(employerAccessRequestsTable.organizationId,org.data),eq(employerAccessRequestsTable.status,"approved"))).limit(1);
 if(!request||!request.expiresAt||request.expiresAt<=new Date()){res.status(403).json({error:"Active authorisation required"});return}
 const [profile]=await db.select({headline:potentialProfilesTable.headline,about:potentialProfilesTable.about,aspirations:potentialProfilesTable.aspirations}).from(potentialProfilesTable).where(eq(potentialProfilesTable.userId,request.personId)).limit(1);
 const all=await db.select({category:potentialEvidenceTable.category,title:potentialEvidenceTable.title,description:potentialEvidenceTable.description,source:potentialEvidenceTable.source}).from(potentialEvidenceTable).where(eq(potentialEvidenceTable.userId,request.personId));
 const evidence=all.filter(e=>request.scope==="portfolio"?["project","achievement","skill"].includes(e.category):["skill","strength","project","achievement","interest"].includes(e.category));
 await db.insert(employerAccessAuditTable).values({requestId:request.id,actorId:user,action:"viewed"});
 res.json({profile:profile??null,evidence,scope:request.scope,expiresAt:request.expiresAt});
});
export default router;