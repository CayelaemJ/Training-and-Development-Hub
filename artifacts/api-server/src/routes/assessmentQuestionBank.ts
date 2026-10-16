import {Router,type IRouter} from "express";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,organizationMembersTable,assessmentQuestionBankTable,assessmentQuestionEventsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {questionActionAllowed,type QuestionStatus} from "../lib/assessmentQuestionPolicy";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
async function role(org:number,user:string){if(isPlatformSuperadmin(user))return "owner";const [x]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);return x?.role??null}
const question=z.object({grade:z.string().trim().min(1).max(24),subject:z.string().trim().min(2).max(120),curriculum:z.string().trim().min(2).max(32),stem:z.string().trim().min(10).max(8000),answerGuide:z.string().trim().min(3).max(8000),rubric:z.string().trim().max(6000).default(""),sourceAttribution:z.string().trim().min(5).max(2000),license:z.enum(["original","CC-BY","CC-BY-SA","public-domain","institution-licensed"])});
router.get("/organizations/:orgId/question-bank",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId);if(!org.success){res.sendStatus(400);return}
 const currentRole=await role(org.data,req.user.id);
 if(!["owner","admin","teacher","assessor"].includes(currentRole??"")){res.sendStatus(403);return}
 const rows=await db.select().from(assessmentQuestionBankTable).where(eq(assessmentQuestionBankTable.organizationId,org.data)).orderBy(desc(assessmentQuestionBankTable.createdAt)).limit(200);
 const visible=["owner","admin"].includes(currentRole??"")?rows:rows.filter(x=>x.status==="published"||x.createdBy===req.user.id);
 res.setHeader("Cache-Control","private, no-store");res.json(visible);
});
router.post("/organizations/:orgId/question-bank",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),body=question.safeParse(req.body);
 if(!org.success||!body.success){res.status(400).json({error:"Valid, licensed and attributed assessment question is required"});return}
 if(!["owner","admin","teacher"].includes(await role(org.data,req.user.id)??"")){res.sendStatus(403);return}
 const [created]=await db.insert(assessmentQuestionBankTable).values({...body.data,organizationId:org.data,createdBy:req.user.id}).returning();
 await db.insert(assessmentQuestionEventsTable).values({questionId:created.id,actorId:req.user.id,action:"created"});
 res.status(201).json({id:created.id,status:created.status});
});
router.post("/organizations/:orgId/question-bank/:questionId/decision",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),qid=id.safeParse(req.params.questionId),body=z.object({action:z.enum(["submit","approve","reject","publish","archive"]),note:z.string().trim().max(1500).default("")}).safeParse(req.body);
 if(!org.success||!qid.success||!body.success){res.sendStatus(400);return}
 const currentRole=await role(org.data,req.user.id);
 if(!currentRole){res.sendStatus(403);return}
 const output=await db.transaction(async tx=>{
  const [original]=await tx.select().from(assessmentQuestionBankTable).where(and(eq(assessmentQuestionBankTable.id,qid.data),eq(assessmentQuestionBankTable.organizationId,org.data))).for("update").limit(1);
  if(!original)return {error:"not_found"} as const;
  if(!questionActionAllowed(original.status as QuestionStatus,body.data.action,original.createdBy,req.user!.id,currentRole,body.data.note))return {error:"forbidden_transition"} as const;
  const next={submit:"submitted",approve:"approved",reject:"rejected",publish:"published",archive:"archived"}[body.data.action];
  const [updated]=await tx.update(assessmentQuestionBankTable).set({status:next,reviewedBy:body.data.action==="approve"?req.user!.id:original.reviewedBy,updatedAt:new Date()}).where(eq(assessmentQuestionBankTable.id,original.id)).returning();
  await tx.insert(assessmentQuestionEventsTable).values({questionId:original.id,actorId:req.user!.id,action:body.data.action,note:body.data.note});
  return {id:updated.id,status:updated.status} as const;
 });
 if("error" in output){res.status(output.error==="not_found"?404:403).json(output);return}
 res.json(output);
});
export default router;