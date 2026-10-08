import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, desc, count, avg } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable, organizationsTable, organizationMembersTable, learnerGroupsTable, learnerGroupMembersTable, examAssignmentsTable, assignmentSubmissionsTable, writtenExamsTable, writtenExamAttemptsTable, assessorOverridesTable } from "@workspace/db";
const router: IRouter=Router();
const num=z.coerce.number().int().positive();
function me(req:Request,res:Response):string|null {if (!req.isAuthenticated()){res.status(401).json({error:"Sign in required"});return null;} return req.user!.id;}
async function member(orgId:number,userId:string) {
 const [m]=await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,orgId),eq(organizationMembersTable.userId,userId))).limit(1);return m;
}
async function guard(req:Request,res:Response,orgId:number,roles?:string[]) {
 const user=me(req,res);if(!user)return null;
 const m=await member(orgId,user);if(!m||roles&&!roles.includes(m.role)){res.status(403).json({error:"Not authorised in this organization"});return null;}return m;
}
const staff=["owner","admin","teacher","assessor"];
router.get("/organizations",async(req,res)=>{
 const id=me(req,res);if(!id)return;
 const rows=await db.select({id:organizationsTable.id,name:organizationsTable.name,role:organizationMembersTable.role}).from(organizationMembersTable).innerJoin(organizationsTable,eq(organizationsTable.id,organizationMembersTable.organizationId)).where(eq(organizationMembersTable.userId,id));
 res.json(rows);
});
router.post("/organizations",async(req,res)=>{
 const id=me(req,res);if(!id)return;
 const body=z.object({name:z.string().trim().min(2).max(200)}).safeParse(req.body);
 if(!body.success){res.status(400).json({error:"Invalid organization name"});return;}
 const org=await db.transaction(async tx=>{
  const [created]=await tx.insert(organizationsTable).values({name:body.data.name,ownerId:id}).returning();
  await tx.insert(organizationMembersTable).values({organizationId:created.id,userId:id,role:"owner"});return created;
 });
 res.status(201).json(org);
});
router.get("/organizations/:orgId/members",async(req,res)=>{
 const id=num.safeParse(req.params.orgId);if(!id.success){res.sendStatus(400);return;}
 if(!await guard(req,res,id.data))return;
 res.json(await db.select({userId:organizationMembersTable.userId,role:organizationMembersTable.role,email:usersTable.email,firstName:usersTable.firstName,lastName:usersTable.lastName}).from(organizationMembersTable).innerJoin(usersTable,eq(usersTable.id,organizationMembersTable.userId)).where(eq(organizationMembersTable.organizationId,id.data)));
});
router.post("/organizations/:orgId/members",async(req,res)=>{
 const oid=num.safeParse(req.params.orgId);
 const body=z.object({email:z.email(),role:z.enum(["admin","teacher","assessor","learner"])}).safeParse(req.body);
 if(!oid.success||!body.success){res.status(400).json({error:"Invalid member details"});return;}
 if(!await guard(req,res,oid.data,["owner","admin"]))return;
 if(body.data.role==="admin" && (await member(oid.data,req.user!.id))?.role!=="owner"){res.sendStatus(403);return;}
 const [person]=await db.select().from(usersTable).where(eq(usersTable.email,body.data.email)).limit(1);
 if(!person){res.status(404).json({error:"User must sign up before they can be added"});return;}
 try {await db.insert(organizationMembersTable).values({organizationId:oid.data,userId:person.id,role:body.data.role});res.status(201).json({userId:person.id,role:body.data.role});}
 catch {res.status(409).json({error:"Already a member"});}
});
router.get("/organizations/:orgId/groups",async(req,res)=>{
 const oid=num.safeParse(req.params.orgId);if(!oid.success){res.sendStatus(400);return;}
 if(!await guard(req,res,oid.data))return;
 res.json(await db.select().from(learnerGroupsTable).where(eq(learnerGroupsTable.organizationId,oid.data)));
});
router.post("/organizations/:orgId/groups",async(req,res)=>{
 const oid=num.safeParse(req.params.orgId),body=z.object({name:z.string().trim().min(2).max(200)}).safeParse(req.body);
 if(!oid.success||!body.success){res.sendStatus(400);return;}
 if(!await guard(req,res,oid.data,staff))return;
 const [row]=await db.insert(learnerGroupsTable).values({organizationId:oid.data,name:body.data.name}).returning();res.status(201).json(row);
});
router.post("/organizations/:orgId/groups/:groupId/learners",async(req,res)=>{
 const oid=num.safeParse(req.params.orgId),gid=num.safeParse(req.params.groupId),body=z.object({userId:z.string().min(1)}).safeParse(req.body);
 if(!oid.success||!gid.success||!body.success){res.sendStatus(400);return;}
 if(!await guard(req,res,oid.data,staff))return;
 const [group]=await db.select().from(learnerGroupsTable).where(and(eq(learnerGroupsTable.id,gid.data),eq(learnerGroupsTable.organizationId,oid.data))).limit(1);
 const learner=await member(oid.data,body.data.userId);
 if(!group||!learner||learner.role!=="learner"){res.status(400).json({error:"Group or learner not eligible"});return;}
 await db.insert(learnerGroupMembersTable).values({groupId:gid.data,userId:body.data.userId}).onConflictDoNothing();
 res.status(201).json({ok:true});
});
router.get("/organizations/:orgId/groups/:groupId/learners",async(req,res)=>{
 const oid=num.safeParse(req.params.orgId),gid=num.safeParse(req.params.groupId);
 if(!oid.success||!gid.success){res.sendStatus(400);return;}
 if(!await guard(req,res,oid.data))return;
 const [group]=await db.select().from(learnerGroupsTable).where(and(eq(learnerGroupsTable.id,gid.data),eq(learnerGroupsTable.organizationId,oid.data))).limit(1);
 if(!group){res.sendStatus(404);return;}
 res.json(await db.select({userId:usersTable.id,email:usersTable.email}).from(learnerGroupMembersTable).innerJoin(usersTable,eq(usersTable.id,learnerGroupMembersTable.userId)).where(eq(learnerGroupMembersTable.groupId,gid.data)));
});
router.post("/organizations/:orgId/assignments",async(req,res)=>{
 const oid=num.safeParse(req.params.orgId),body=z.object({groupId:z.number().int().positive(),examId:z.number().int().positive(),dueAt:z.iso.datetime().optional()}).safeParse(req.body);
 if(!oid.success||!body.success){res.sendStatus(400);return;}
 if(!await guard(req,res,oid.data,staff))return;
 const [group]=await db.select().from(learnerGroupsTable).where(and(eq(learnerGroupsTable.id,body.data.groupId),eq(learnerGroupsTable.organizationId,oid.data))).limit(1);
 const [exam]=await db.select().from(writtenExamsTable).where(and(eq(writtenExamsTable.id,body.data.examId),eq(writtenExamsTable.userId,req.user!.id))).limit(1);
 if(!group||!exam){res.status(400).json({error:"Group or exam not available"});return;}
 try {const [assignment]=await db.insert(examAssignmentsTable).values({organizationId:oid.data,groupId:group.id,examId:exam.id,createdBy:req.user!.id,dueAt:body.data.dueAt?new Date(body.data.dueAt):null}).returning();res.status(201).json(assignment);}
 catch{res.status(409).json({error:"This exam is already assigned to the group"});}
});
router.get("/organizations/:orgId/assignments",async(req,res)=>{
 const oid=num.safeParse(req.params.orgId);if(!oid.success){res.sendStatus(400);return;}
 if(!await guard(req,res,oid.data))return;
 res.json(await db.select().from(examAssignmentsTable).where(eq(examAssignmentsTable.organizationId,oid.data)).orderBy(desc(examAssignmentsTable.createdAt)));
});
router.get("/my-assignments",async(req,res)=>{
 const id=me(req,res);if(!id)return;
 const rows=await db.select({id:examAssignmentsTable.id,examId:examAssignmentsTable.examId,title:writtenExamsTable.title,organizationId:organizationsTable.id,organization:organizationsTable.name,dueAt:examAssignmentsTable.dueAt}).from(learnerGroupMembersTable)
 .innerJoin(learnerGroupsTable,eq(learnerGroupsTable.id,learnerGroupMembersTable.groupId))
 .innerJoin(organizationMembersTable,and(eq(organizationMembersTable.organizationId,learnerGroupsTable.organizationId),eq(organizationMembersTable.userId,learnerGroupMembersTable.userId)))
 .innerJoin(examAssignmentsTable,eq(examAssignmentsTable.groupId,learnerGroupsTable.id))
 .innerJoin(organizationsTable,eq(organizationsTable.id,examAssignmentsTable.organizationId))
 .innerJoin(writtenExamsTable,eq(writtenExamsTable.id,examAssignmentsTable.examId))
 .where(eq(learnerGroupMembersTable.userId,id));
 res.json(rows);
});
router.get("/organizations/:orgId/dashboard",async(req,res)=>{
 const oid=num.safeParse(req.params.orgId);if(!oid.success){res.sendStatus(400);return;}
 if(!await guard(req,res,oid.data,staff))return;
 const [members]=await db.select({value:count()}).from(organizationMembersTable).where(eq(organizationMembersTable.organizationId,oid.data));
 const [groups]=await db.select({value:count()}).from(learnerGroupsTable).where(eq(learnerGroupsTable.organizationId,oid.data));
 const [assignments]=await db.select({value:count()}).from(examAssignmentsTable).where(eq(examAssignmentsTable.organizationId,oid.data));
 const [submissions]=await db.select({value:count(),mean:avg(writtenExamAttemptsTable.percentage)}).from(assignmentSubmissionsTable).innerJoin(examAssignmentsTable,eq(examAssignmentsTable.id,assignmentSubmissionsTable.assignmentId)).innerJoin(writtenExamAttemptsTable,eq(writtenExamAttemptsTable.id,assignmentSubmissionsTable.attemptId)).where(eq(examAssignmentsTable.organizationId,oid.data));
 res.json({members:members.value,groups:groups.value,assignments:assignments.value,submissions:submissions.value,averageAiScore:submissions.mean===null?null:Number(submissions.mean)});
});
router.get("/organizations/:orgId/submissions",async(req,res)=>{
 const oid=num.safeParse(req.params.orgId);if(!oid.success){res.sendStatus(400);return;}
 if(!await guard(req,res,oid.data,staff))return;
 res.json(await db.select({id:assignmentSubmissionsTable.id,assignmentId:assignmentSubmissionsTable.assignmentId,userId:assignmentSubmissionsTable.userId,attemptId:assignmentSubmissionsTable.attemptId,percentage:writtenExamAttemptsTable.percentage,awardedMarks:writtenExamAttemptsTable.awardedMarks,maxMarks:writtenExamAttemptsTable.maxMarks,feedback:writtenExamAttemptsTable.feedback,answers:writtenExamAttemptsTable.answers}).from(assignmentSubmissionsTable).innerJoin(examAssignmentsTable,eq(examAssignmentsTable.id,assignmentSubmissionsTable.assignmentId)).innerJoin(writtenExamAttemptsTable,eq(writtenExamAttemptsTable.id,assignmentSubmissionsTable.attemptId)).where(eq(examAssignmentsTable.organizationId,oid.data)));
});
router.post("/organizations/:orgId/submissions/:submissionId/overrides",async(req,res)=>{
 const oid=num.safeParse(req.params.orgId),sid=num.safeParse(req.params.submissionId);
 const body=z.object({questionIndex:z.number().int().min(0),awardedMarks:z.number().min(0),reason:z.string().trim().min(5).max(2000)}).safeParse(req.body);
 if(!oid.success||!sid.success||!body.success){res.sendStatus(400);return;}
 if(!await guard(req,res,oid.data,staff))return;
 const [submission]=await db.select({attempt:writtenExamAttemptsTable,exam:writtenExamsTable}).from(assignmentSubmissionsTable)
 .innerJoin(examAssignmentsTable,eq(examAssignmentsTable.id,assignmentSubmissionsTable.assignmentId))
 .innerJoin(writtenExamAttemptsTable,eq(writtenExamAttemptsTable.id,assignmentSubmissionsTable.attemptId))
 .innerJoin(writtenExamsTable,eq(writtenExamsTable.id,examAssignmentsTable.examId))
 .where(and(eq(assignmentSubmissionsTable.id,sid.data),eq(examAssignmentsTable.organizationId,oid.data))).limit(1);
 if(!submission||body.data.questionIndex>=submission.exam.questions.length||body.data.awardedMarks>submission.exam.questions[body.data.questionIndex].maxMarks){res.status(400).json({error:"Invalid question or marks"});return;}
 const [row]=await db.insert(assessorOverridesTable).values({submissionId:sid.data,assessorId:req.user!.id,...body.data}).returning();
 res.status(201).json(row);
});
router.get("/organizations/:orgId/submissions/:submissionId/overrides",async(req,res)=>{
 const oid=num.safeParse(req.params.orgId),sid=num.safeParse(req.params.submissionId);
 if(!oid.success||!sid.success){res.sendStatus(400);return;}
 if(!await guard(req,res,oid.data,staff))return;
 const [s]=await db.select({id:assignmentSubmissionsTable.id}).from(assignmentSubmissionsTable).innerJoin(examAssignmentsTable,eq(examAssignmentsTable.id,assignmentSubmissionsTable.assignmentId)).where(and(eq(assignmentSubmissionsTable.id,sid.data),eq(examAssignmentsTable.organizationId,oid.data))).limit(1);
 if(!s){res.sendStatus(404);return;}
 res.json(await db.select().from(assessorOverridesTable).where(eq(assessorOverridesTable.submissionId,sid.data)).orderBy(desc(assessorOverridesTable.createdAt)));
});
export default router;