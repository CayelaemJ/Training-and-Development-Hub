import {Router,type IRouter} from "express";
import {and,desc,eq,inArray} from "drizzle-orm";
import {z} from "zod/v4";
import {db,organizationMembersTable,assessmentQuestionBankTable,assessmentPapersTable,assessmentPaperEventsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {canChangePaper,type PaperAction,type PaperStatus} from "../lib/assessmentPaperPolicy";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
async function role(org:number,user:string){if(isPlatformSuperadmin(user))return "owner";const [m]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);return m?.role??null}
const input=z.object({academicYear:z.number().int().min(2000).max(2200),grade:z.string().min(1).max(24),subject:z.string().min(2).max(120),curriculum:z.string().min(2).max(32),title:z.string().trim().min(5).max(180),questionIds:z.array(z.number().int().positive()).min(1).max(50)});
router.post("/organizations/:orgId/assessment-papers",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),body=input.safeParse(req.body);
 if(!org.success||!body.success){res.sendStatus(400);return}
 if(!["owner","admin","teacher"].includes(await role(org.data,req.user.id)??"")){res.sendStatus(403);return}
 const ids=body.data.questionIds;
 if(new Set(ids).size!==ids.length){res.status(400).json({error:"Duplicate question IDs"});return}
 const questions=await db.select().from(assessmentQuestionBankTable).where(and(eq(assessmentQuestionBankTable.organizationId,org.data),inArray(assessmentQuestionBankTable.id,ids)));
 if(questions.length!==ids.length||questions.some(q=>q.grade!==body.data.grade||q.subject!==body.data.subject||q.curriculum!==body.data.curriculum||q.status!=="published")){
  res.status(409).json({error:"Only published, curriculum-matched institution questions may enter a paper"});return
 }
 const ordered=ids.map(i=>questions.find(q=>q.id===i)!);
 const snapshot=ordered.map(q=>({sourceQuestionId:q.id,stem:q.stem,answerGuide:q.answerGuide,rubric:q.rubric,sourceAttribution:q.sourceAttribution,license:q.license,reviewedBy:q.reviewedBy}));
 const [paper]=await db.transaction(async tx=>{
  const [created]=await tx.insert(assessmentPapersTable).values({organizationId:org.data,academicYear:body.data.academicYear,grade:body.data.grade,subject:body.data.subject,curriculum:body.data.curriculum,title:body.data.title,status:"draft",questions:snapshot,createdBy:req.user!.id}).returning();
  await tx.insert(assessmentPaperEventsTable).values({paperId:created.id,actorId:req.user!.id,action:"created"});
  return [created];
 });
 res.status(201).json({id:paper.id,status:paper.status,questionCount:snapshot.length});
});
router.get("/organizations/:orgId/assessment-papers",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId);if(!org.success){res.sendStatus(400);return}
 const currentRole=await role(org.data,req.user.id);
 if(!["owner","admin","teacher","assessor"].includes(currentRole??"")){res.sendStatus(403);return}
 const papers=await db.select().from(assessmentPapersTable).where(eq(assessmentPapersTable.organizationId,org.data)).orderBy(desc(assessmentPapersTable.createdAt)).limit(100);
 const visible=["owner","admin"].includes(currentRole??"")?papers:papers.filter(p=>p.createdBy===req.user.id||p.status==="published");
 res.setHeader("Cache-Control","private, no-store");
 res.json(visible.map(p=>({id:p.id,title:p.title,grade:p.grade,subject:p.subject,curriculum:p.curriculum,academicYear:p.academicYear,status:p.status,createdBy:p.createdBy,approvedBy:p.approvedBy,questionCount:Array.isArray(p.questions)?p.questions.length:0})));
});
router.post("/organizations/:orgId/assessment-papers/:paperId/decision",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),paperId=id.safeParse(req.params.paperId),body=z.object({action:z.enum(["submit","approve","reject","publish"]),note:z.string().trim().max(1000).default("")}).safeParse(req.body);
 if(!org.success||!paperId.success||!body.success){res.sendStatus(400);return}
 const currentRole=await role(org.data,req.user.id);
 if(!currentRole){res.sendStatus(403);return}
 const result=await db.transaction(async tx=>{
  const [paper]=await tx.select().from(assessmentPapersTable).where(and(eq(assessmentPapersTable.organizationId,org.data),eq(assessmentPapersTable.id,paperId.data))).for("update").limit(1);
  if(!paper)return {error:"not_found"} as const;
  if(!canChangePaper(paper.status as PaperStatus,body.data.action as PaperAction,paper.createdBy,req.user!.id,["owner","admin"].includes(currentRole),body.data.note))return {error:"forbidden_transition"} as const;
  const to={submit:"submitted",approve:"approved",reject:"rejected",publish:"published"}[body.data.action];
  const [updated]=await tx.update(assessmentPapersTable).set({status:to,approvedBy:body.data.action==="approve"?req.user!.id:paper.approvedBy}).where(eq(assessmentPapersTable.id,paper.id)).returning();
  await tx.insert(assessmentPaperEventsTable).values({paperId:paper.id,actorId:req.user!.id,action:body.data.action,note:body.data.note});
  return {id:updated.id,status:updated.status} as const;
 });
 if("error" in result){res.status(result.error==="not_found"?404:403).json(result);return}
 res.json(result);
});
export default router;