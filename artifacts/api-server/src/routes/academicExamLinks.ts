import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, academicAssessmentsTable, academicGradesTable, academicGradeEventsTable, academicExamLinksTable, academicExamReviewsTable, examAssignmentsTable, assignmentSubmissionsTable, writtenExamAttemptsTable, writtenExamsTable, courseEnrollmentsTable, organizationMembersTable } from "@workspace/db";
const router:IRouter=Router();
const positive=z.coerce.number().int().positive();
const staff=["owner","admin","teacher","assessor"];
async function permitted(org:number,user:string){const [m]=await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);return m&&staff.includes(m.role)}
router.post("/organizations/:orgId/academic/assessments/:assessmentId/link-exam",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=positive.safeParse(req.params.orgId),id=positive.safeParse(req.params.assessmentId),body=z.object({assignmentId:z.number().int().positive()}).safeParse(req.body);
 if(!org.success||!id.success||!body.success){res.sendStatus(400);return}
 if(!await permitted(org.data,req.user!.id)){res.sendStatus(403);return}
 const [a]=await db.select().from(academicAssessmentsTable).where(and(eq(academicAssessmentsTable.id,id.data),eq(academicAssessmentsTable.organizationId,org.data))).limit(1);
 const [assignment]=await db.select().from(examAssignmentsTable).where(and(eq(examAssignmentsTable.id,body.data.assignmentId),eq(examAssignmentsTable.organizationId,org.data))).limit(1);
 if(!a||!assignment){res.sendStatus(404);return}
 const [exam]=await db.select().from(writtenExamsTable).where(eq(writtenExamsTable.id,assignment.examId)).limit(1);
 if(!exam){res.sendStatus(404);return}
 try {const [link]=await db.insert(academicExamLinksTable).values({assessmentId:a.id,assignmentId:assignment.id}).returning();res.status(201).json(link)}
 catch{res.status(409).json({error:"Assessment or exam assignment already linked"})}
});
router.get("/organizations/:orgId/academic/pending-exams",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=positive.safeParse(req.params.orgId);if(!org.success){res.sendStatus(400);return}
 if(!await permitted(org.data,req.user!.id)){res.sendStatus(403);return}
 const records=await db.select({linkId:academicExamLinksTable.id,assessmentId:academicAssessmentsTable.id,assessmentTitle:academicAssessmentsTable.title,learnerId:assignmentSubmissionsTable.userId,attemptId:writtenExamAttemptsTable.id,score:writtenExamAttemptsTable.percentage,awardedMarks:writtenExamAttemptsTable.awardedMarks,maxMarks:writtenExamAttemptsTable.maxMarks,reviewRequired:writtenExamAttemptsTable.reviewRequired,feedback:writtenExamAttemptsTable.feedback,answers:writtenExamAttemptsTable.answers})
 .from(academicExamLinksTable).innerJoin(academicAssessmentsTable,eq(academicAssessmentsTable.id,academicExamLinksTable.assessmentId))
 .innerJoin(assignmentSubmissionsTable,eq(assignmentSubmissionsTable.assignmentId,academicExamLinksTable.assignmentId))
 .innerJoin(writtenExamAttemptsTable,eq(writtenExamAttemptsTable.id,assignmentSubmissionsTable.attemptId))
 .where(eq(academicAssessmentsTable.organizationId,org.data)).orderBy(desc(writtenExamAttemptsTable.completedAt));
 const reviewed=records.length?await db.select().from(academicExamReviewsTable).where(eq(academicExamReviewsTable.linkId,records[0].linkId)):[]; // Review flags are resolved below for all links
 const fullReviews=records.length?await db.select().from(academicExamReviewsTable):[];
 const ids=new Set(fullReviews.map(r=>r.attemptId));
 res.json(records.map(r=>({...r,reviewed:ids.has(r.attemptId)})));
});
router.post("/organizations/:orgId/academic/attempts/:attemptId/publish",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=positive.safeParse(req.params.orgId),attemptId=positive.safeParse(req.params.attemptId);
 const body=z.object({marks:z.number().min(0),reason:z.string().trim().min(5).max(2000),publish:z.boolean().default(true)}).safeParse(req.body);
 if(!org.success||!attemptId.success||!body.success){res.sendStatus(400);return}
 if(!await permitted(org.data,req.user!.id)){res.sendStatus(403);return}
 const [row]=await db.select({link:academicExamLinksTable,assessment:academicAssessmentsTable,submission:assignmentSubmissionsTable,attempt:writtenExamAttemptsTable})
 .from(academicExamLinksTable).innerJoin(academicAssessmentsTable,eq(academicAssessmentsTable.id,academicExamLinksTable.assessmentId))
 .innerJoin(assignmentSubmissionsTable,eq(assignmentSubmissionsTable.assignmentId,academicExamLinksTable.assignmentId))
 .innerJoin(writtenExamAttemptsTable,eq(writtenExamAttemptsTable.id,assignmentSubmissionsTable.attemptId))
 .where(and(eq(academicAssessmentsTable.organizationId,org.data),eq(writtenExamAttemptsTable.id,attemptId.data))).limit(1);
 if(!row){res.sendStatus(404);return}
 if(body.data.marks>row.assessment.maxMarks){res.status(400).json({error:"Marks exceed assessment maximum"});return}
 const [enrolled]=await db.select().from(courseEnrollmentsTable).where(and(eq(courseEnrollmentsTable.courseId,row.assessment.courseId),eq(courseEnrollmentsTable.userId,row.submission.userId))).limit(1);
 if(!enrolled){res.status(409).json({error:"Learner must be enrolled in this subject"});return}
 try {
 const grade=await db.transaction(async tx=>{
   const [already]=await tx.select().from(academicExamReviewsTable).where(eq(academicExamReviewsTable.attemptId,row.attempt.id)).limit(1);
   if(already)throw new Error("Attempt already reviewed");
   const [prior]=await tx.select().from(academicGradesTable).where(and(eq(academicGradesTable.assessmentId,row.assessment.id),eq(academicGradesTable.learnerId,row.submission.userId))).limit(1);
   const status=body.data.publish?"published":"draft";
   const [g]=await tx.insert(academicGradesTable).values({assessmentId:row.assessment.id,learnerId:row.submission.userId,marks:body.data.marks,status,reviewedBy:req.user!.id,feedback:body.data.reason})
    .onConflictDoUpdate({target:[academicGradesTable.assessmentId,academicGradesTable.learnerId],set:{marks:body.data.marks,status,reviewedBy:req.user!.id,feedback:body.data.reason,updatedAt:new Date()}}).returning();
   await tx.insert(academicGradeEventsTable).values({gradeId:g.id,changedBy:req.user!.id,oldMarks:prior?.marks??null,newMarks:g.marks,oldStatus:prior?.status??null,newStatus:status,reason:body.data.reason});
   await tx.insert(academicExamReviewsTable).values({linkId:row.link.id,attemptId:row.attempt.id,reviewerId:req.user!.id});
   return g;
 });res.status(201).json(grade)
 }catch(e){req.log.error({err:e},"Academic exam approval failed");res.status(409).json({error:"This attempt may already be reviewed; refresh before retrying"})}
});
export default router;