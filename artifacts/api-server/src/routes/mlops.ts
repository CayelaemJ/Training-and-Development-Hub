import {Router,type IRouter} from "express";
import OpenAI from "openai";
import {and,desc,eq,gte} from "drizzle-orm";
import {z} from "zod/v4";
import {db,aiInferenceMetricsTable,organizationMembersTable,mlModelVersionsTable,mlEvaluationRunsTable,mlOperationalEventsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {aiConfiguration,recordAiMetric} from "../lib/aiObservability";
import {evaluateAiMarking} from "../lib/mlopsEvaluation";
import {recordMLOpsEvent} from "../lib/mlopsTelemetry";
import {canAccessMLOps} from "../lib/mlopsAccessPolicy";
const router:IRouter=Router();

const organizationIdSchema=z.coerce.number().int().positive();
const modelInput=z.object({
 modelKey:z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
 version:z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:+/-]*$/),
 provider:z.enum(["groq","openai","huggingface"]),
}).strict();
const evaluationInput=z.object({
 domain:z.literal("academic_grading"),
 samples:z.array(z.object({
  aiMarks:z.number().finite().min(0).max(1000),
  educatorMarks:z.number().finite().min(0).max(1000),
  maximumMarks:z.number().finite().min(1).max(1000),
  flaggedForReview:z.boolean().optional(),
 }).strict()).min(1).max(500),
}).strict();

async function organizationMember(organizationId:number,userId:string):Promise<{organizationId:number;role:string}|undefined>{
 const [member]=await db.select({organizationId:organizationMembersTable.organizationId,role:organizationMembersTable.role}).from(organizationMembersTable)
  .where(and(eq(organizationMembersTable.organizationId,organizationId),eq(organizationMembersTable.userId,userId))).limit(1);
 return member;
}
function registryEnabled():boolean{return process.env.ENABLE_MLOPS_REGISTRY==="true"}

router.get("/organizations/:orgId/mlops",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!registryEnabled()){res.sendStatus(404);return}
 const organizationId=organizationIdSchema.safeParse(req.params.orgId);
 if(!organizationId.success){res.sendStatus(400);return}
 const member=await organizationMember(organizationId.data,req.user!.id);
 if(!canAccessMLOps(member,organizationId.data,"view")){res.sendStatus(403);return}
 const since=new Date(Date.now()-30*86400000);
 const [models,evaluations,events]=await Promise.all([
  db.select({id:mlModelVersionsTable.id,modelKey:mlModelVersionsTable.modelKey,version:mlModelVersionsTable.version,provider:mlModelVersionsTable.provider,status:mlModelVersionsTable.status,createdAt:mlModelVersionsTable.createdAt})
   .from(mlModelVersionsTable).where(eq(mlModelVersionsTable.organizationId,organizationId.data)).orderBy(desc(mlModelVersionsTable.createdAt)).limit(100),
  db.select({id:mlEvaluationRunsTable.id,modelVersionId:mlEvaluationRunsTable.modelVersionId,domain:mlEvaluationRunsTable.domain,sampleCount:mlEvaluationRunsTable.sampleCount,meanAbsoluteError:mlEvaluationRunsTable.meanAbsoluteError,normalizedMeanAbsoluteError:mlEvaluationRunsTable.normalizedMeanAbsoluteError,agreementRate:mlEvaluationRunsTable.agreementRate,humanReviewRate:mlEvaluationRunsTable.humanReviewRate,passed:mlEvaluationRunsTable.passed,createdAt:mlEvaluationRunsTable.createdAt})
   .from(mlEvaluationRunsTable).where(eq(mlEvaluationRunsTable.organizationId,organizationId.data)).orderBy(desc(mlEvaluationRunsTable.createdAt)).limit(100),
  db.select({eventType:mlOperationalEventsTable.eventType,status:mlOperationalEventsTable.status,durationMs:mlOperationalEventsTable.durationMs,createdAt:mlOperationalEventsTable.createdAt})
   .from(mlOperationalEventsTable).where(and(eq(mlOperationalEventsTable.organizationId,organizationId.data),gte(mlOperationalEventsTable.createdAt,since))).orderBy(desc(mlOperationalEventsTable.createdAt)).limit(500),
 ]);
 const completed=events.filter(event=>event.status==="success");
 res.setHeader("Cache-Control","private, no-store");
 res.json({organizationId:organizationId.data,windowDays:30,models,evaluations,telemetry:{eventCount:events.length,successes:completed.length,failures:events.length-completed.length,averageLatencyMs:events.length?Math.round(events.reduce((total,event)=>total+(event.durationMs??0),0)/events.length):null}});
});

router.post("/organizations/:orgId/mlops/models",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!registryEnabled()){res.sendStatus(404);return}
 const organizationId=organizationIdSchema.safeParse(req.params.orgId),input=modelInput.safeParse(req.body);
 if(!organizationId.success||!input.success){res.status(400).json({error:"Invalid model registration"});return}
 const member=await organizationMember(organizationId.data,req.user!.id);
 if(!canAccessMLOps(member,organizationId.data,"register-model")){res.sendStatus(403);return}
 try{
  const [model]=await db.insert(mlModelVersionsTable).values({organizationId:organizationId.data,...input.data,status:"shadow"}).returning({id:mlModelVersionsTable.id,modelKey:mlModelVersionsTable.modelKey,version:mlModelVersionsTable.version,provider:mlModelVersionsTable.provider,status:mlModelVersionsTable.status,createdAt:mlModelVersionsTable.createdAt});
  res.status(201).json(model);
 }catch(error){
  const code=typeof error==="object"&&error!==null&&"code" in error?(error as {code?:unknown}).code:null;
  if(code==="23505"){res.status(409).json({error:"Model version already exists"});return}
  req.log.error({code},"MLOps model registration failed");
  res.sendStatus(500);
 }
});

router.post("/organizations/:orgId/mlops/models/:modelVersionId/evaluations",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!registryEnabled()){res.sendStatus(404);return}
 const organizationId=organizationIdSchema.safeParse(req.params.orgId),modelVersionId=organizationIdSchema.safeParse(req.params.modelVersionId),input=evaluationInput.safeParse(req.body);
 if(!organizationId.success||!modelVersionId.success||!input.success){res.status(400).json({error:"Invalid evaluation input"});return}
 const member=await organizationMember(organizationId.data,req.user!.id);
 if(!canAccessMLOps(member,organizationId.data,"submit-evaluation")){res.sendStatus(403);return}
 const [model]=await db.select({id:mlModelVersionsTable.id}).from(mlModelVersionsTable)
  .where(and(eq(mlModelVersionsTable.id,modelVersionId.data),eq(mlModelVersionsTable.organizationId,organizationId.data))).limit(1);
 if(!model){res.sendStatus(404);return}
 let evaluation;
 try{evaluation=evaluateAiMarking(input.data.samples)}catch{res.status(400).json({error:"Evaluation marks are invalid"});return}
 const startedAt=Date.now();
 const [run]=await db.insert(mlEvaluationRunsTable).values({organizationId:organizationId.data,modelVersionId:model.id,domain:input.data.domain,sampleCount:evaluation.sampleCount,meanAbsoluteError:evaluation.meanAbsoluteError,normalizedMeanAbsoluteError:evaluation.normalizedMeanAbsoluteError,agreementRate:evaluation.agreementRate,humanReviewRate:evaluation.humanReviewRate,passed:evaluation.passed}).returning({id:mlEvaluationRunsTable.id,createdAt:mlEvaluationRunsTable.createdAt});
 await recordMLOpsEvent({organizationId:organizationId.data,modelKey:"cabo-evaluation",version:"1",eventType:"evaluation",durationMs:Date.now()-startedAt,status:"success"});
 res.status(201).json({...run,evaluation});
});

router.get("/ai/capabilities",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const config=aiConfiguration();
 res.setHeader("Cache-Control","no-store");
 res.json({configured:config.configured,provider:config.preferredProvider,planningEnabled:config.configured,medicalAndHighStakesDecisionsEnabled:false});
});
router.get("/platform/mlops",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!isPlatformSuperadmin(req.user.id)){res.sendStatus(403);return}
 const since=new Date(Date.now()-7*86400000);
 const records=await db.select({operation:aiInferenceMetricsTable.operation,provider:aiInferenceMetricsTable.provider,model:aiInferenceMetricsTable.model,outcome:aiInferenceMetricsTable.outcome,durationMs:aiInferenceMetricsTable.durationMs,createdAt:aiInferenceMetricsTable.createdAt}).from(aiInferenceMetricsTable).where(gte(aiInferenceMetricsTable.createdAt,since)).orderBy(desc(aiInferenceMetricsTable.createdAt)).limit(500);
 const config=aiConfiguration();
 const successful=records.filter(x=>x.outcome==="success");
 res.setHeader("Cache-Control","private, no-store");
 res.json({configured:config.configured,provider:config.preferredProvider,model:config.developmentModel,windowDays:7,requests:records.length,successes:successful.length,failures:records.length-successful.length,averageLatencyMs:records.length?Math.round(records.reduce((n,r)=>n+r.durationMs,0)/records.length):null,recent:records.slice(0,30)});
});

router.post("/platform/mlops/smoke-test",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!isPlatformSuperadmin(req.user.id)){res.sendStatus(403);return}
 const configuration=aiConfiguration();
 if(!configuration.configured){res.status(503).json({error:"No model credentials configured"});return}
 const start=Date.now();
 const groq=configuration.preferredProvider==="groq";
 try {
  const client=new OpenAI({apiKey:groq?process.env.GROQ_API_KEY:process.env.OPENAI_API_KEY,baseURL:groq?"https://api.groq.com/openai/v1":undefined,timeout:12000,maxRetries:0});
  const answer=await client.chat.completions.create({model:configuration.developmentModel,max_completion_tokens:512,...(groq && configuration.developmentModel.startsWith("openai/gpt-oss-") ? {reasoning_effort:"low" as const} : {}),messages:[{role:"system",content:"Return the exact word READY, and no other text."},{role:"user",content:"Synthetic CABO infrastructure availability test. Respond READY."}]});
  if(!answer.choices[0]?.message?.content?.includes("READY"))throw Error("Unexpected output");
  await recordAiMetric("development_plan",configuration.preferredProvider,configuration.developmentModel,"success",start);
  res.json({ok:true,provider:configuration.preferredProvider,model:configuration.developmentModel,latencyMs:Date.now()-start});
 }catch(e){
  await recordAiMetric("development_plan",configuration.preferredProvider,configuration.developmentModel,"failure",start);
  const status = typeof (e as {status?:unknown})?.status === "number" ? (e as {status:number}).status : null;
  console.warn("AI connection check failed", {provider: configuration.preferredProvider, status});
  const error = status === 401 ? "The AI provider rejected this API key. Check the key in Render settings." : status === 403 ? "The AI provider refused access. Check this project's permissions and provider restrictions." : status === 429 ? "The AI provider has reached its usage limit. Check the account quota and try again later." : status === 404 ? "This AI model is unavailable. Choose an available model in Render settings." : "The AI service could not complete the connection check. Please try again shortly.";
  res.status(502).json({ok:false,error,providerStatus:status});
 }
});
export default router;
