import {Router,type IRouter} from "express";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,organizationMembersTable,schoolAttendanceTable,schoolNoticesTable,guardianRelationshipsTable,careerOpportunitiesTable,careerApplicationsTable,assessmentPassportsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
const router:IRouter=Router();
const pos=z.coerce.number().int().positive();
function who(req:any,res:any):string|null{if(!req.isAuthenticated()){res.status(401).json({error:"Sign in required"});return null}return req.user.id}
async function role(org:number,user:string){if(isPlatformSuperadmin(user))return "owner";const [m]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);return m?.role}
router.get("/school/attendance/me",async(req,res)=>{const u=who(req,res);if(!u)return;res.setHeader("Cache-Control","no-store");res.json(await db.select().from(schoolAttendanceTable).where(eq(schoolAttendanceTable.learnerId,u)).orderBy(desc(schoolAttendanceTable.day)).limit(180))});
router.post("/organizations/:orgId/attendance",async(req,res)=>{
 const u=who(req,res);if(!u)return;const org=pos.safeParse(req.params.orgId),body=z.object({learnerId:z.string().min(1),day:z.iso.date(),status:z.enum(["present","absent","late","excused"]),note:z.string().max(1000).default("")}).safeParse(req.body);
 if(!org.success||!body.success){res.sendStatus(400);return}if(!["owner","admin"].includes((await role(org.data,u))??"")){res.sendStatus(403);return}
 const member=await role(org.data,body.data.learnerId);if(member!=="learner"){res.status(409).json({error:"Learner must belong to this institution"});return}
 const [row]=await db.insert(schoolAttendanceTable).values({organizationId:org.data,recordedBy:u,...body.data}).onConflictDoUpdate({target:[schoolAttendanceTable.organizationId,schoolAttendanceTable.learnerId,schoolAttendanceTable.day],set:{status:body.data.status,note:body.data.note,recordedBy:u}}).returning();res.json(row);
});
router.get("/organizations/:orgId/notices",async(req,res)=>{
 const u=who(req,res);if(!u)return;const org=pos.safeParse(req.params.orgId);if(!org.success){res.sendStatus(400);return}
 const member=await role(org.data,u);if(!member){res.sendStatus(403);return}
 const notices=await db.select().from(schoolNoticesTable).where(eq(schoolNoticesTable.organizationId,org.data)).orderBy(desc(schoolNoticesTable.createdAt)).limit(100);
 res.json(["owner","admin","teacher","assessor"].includes(member)?notices:notices.filter(n=>n.audience==="all"||n.audience==="learners"));
});
router.post("/organizations/:orgId/notices",async(req,res)=>{
 const u=who(req,res);if(!u)return;const org=pos.safeParse(req.params.orgId),body=z.object({subject:z.string().trim().min(3).max(180),message:z.string().trim().min(10).max(5000),audience:z.enum(["all","learners","staff"])}).safeParse(req.body);
 if(!org.success||!body.success){res.sendStatus(400);return}if(!["owner","admin"].includes((await role(org.data,u))??"")){res.sendStatus(403);return}
 const [row]=await db.insert(schoolNoticesTable).values({...body.data,organizationId:org.data,createdBy:u}).returning();res.status(201).json(row);
});
router.post("/opportunities/:id/applications",async(req,res)=>{
 const u=who(req,res);if(!u)return;
 if(process.env.ENABLE_CAREER_APPLICATIONS_PILOT!=="true"){res.status(503).json({error:"Applications remain disabled until candidate age and verified employer safeguards are complete"});return}
 const oid=pos.safeParse(req.params.id),body=z.object({statement:z.string().trim().min(20).max(3000)}).safeParse(req.body);
 if(!oid.success||!body.success){res.sendStatus(400);return}
 const [opportunity]=await db.select({id:careerOpportunitiesTable.id}).from(careerOpportunitiesTable).where(and(eq(careerOpportunitiesTable.id,oid.data),eq(careerOpportunitiesTable.status,"active"))).limit(1);
 if(!opportunity){res.sendStatus(404);return}
 const [row]=await db.insert(careerApplicationsTable).values({opportunityId:oid.data,candidateId:u,...body.data}).onConflictDoNothing().returning();
 if(!row){res.status(409).json({error:"Already applied"});return}res.status(201).json({id:row.id,status:row.status});
});
router.get("/opportunities/applications/me",async(req,res)=>{
 const u=who(req,res);if(!u)return;res.setHeader("Cache-Control","no-store");
 res.json(await db.select({id:careerApplicationsTable.id,opportunityId:careerApplicationsTable.opportunityId,status:careerApplicationsTable.status,createdAt:careerApplicationsTable.createdAt}).from(careerApplicationsTable).where(eq(careerApplicationsTable.candidateId,u)).orderBy(desc(careerApplicationsTable.createdAt)));
});
router.get("/organizations/:orgId/opportunities/:opportunityId/applications",async(req,res)=>{
 const u=who(req,res);if(!u)return;const org=pos.safeParse(req.params.orgId),op=pos.safeParse(req.params.opportunityId);
 if(!org.success||!op.success){res.sendStatus(400);return}if(!["owner","admin"].includes((await role(org.data,u))??"")){res.sendStatus(403);return}
 const [owned]=await db.select({id:careerOpportunitiesTable.id}).from(careerOpportunitiesTable).where(and(eq(careerOpportunitiesTable.id,op.data),eq(careerOpportunitiesTable.organizationId,org.data))).limit(1);
 if(!owned){res.sendStatus(404);return}
 // Intentionally omits candidate's private portfolio, psychometric answers and learner timeline.
 res.json(await db.select({id:careerApplicationsTable.id,candidateId:careerApplicationsTable.candidateId,status:careerApplicationsTable.status,statement:careerApplicationsTable.statement,createdAt:careerApplicationsTable.createdAt}).from(careerApplicationsTable).where(eq(careerApplicationsTable.opportunityId,op.data)));
});
router.get("/passport/me",async(req,res)=>{
 const u=who(req,res);if(!u)return;res.setHeader("Cache-Control","no-store");
 res.json(await db.select().from(assessmentPassportsTable).where(eq(assessmentPassportsTable.candidateId,u)).orderBy(desc(assessmentPassportsTable.assessedAt)));
});
router.post("/passport/development-evidence",async(req,res)=>{
 const u=who(req,res);if(!u)return;
 const body=z.object({instrumentName:z.string().trim().min(3).max(160),provider:z.string().trim().min(2).max(160),version:z.string().max(64),assessedAt:z.iso.datetime(),summary:z.string().max(2000)}).safeParse(req.body);
 if(!body.success){res.sendStatus(400);return}
 const assessedAt=new Date(body.data.assessedAt);if(assessedAt.getTime()>Date.now()){res.status(400).json({error:"Assessment date cannot be in the future"});return}
 const reviewDueAt=new Date(assessedAt);reviewDueAt.setUTCMonth(reviewDueAt.getUTCMonth()+6);
 const [row]=await db.insert(assessmentPassportsTable).values({...body.data,assessedAt,reviewDueAt,candidateId:u,evidenceType:"development",verificationStatus:"unverified"}).returning();
 res.status(201).json({id:row.id,reviewDueAt:row.reviewDueAt,verificationStatus:row.verificationStatus});
});
export default router;