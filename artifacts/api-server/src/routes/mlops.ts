import {Router,type IRouter} from "express";
import OpenAI from "openai";
import {and,desc,eq,gte} from "drizzle-orm";
import {z} from "zod/v4";
import {db,pool,aiInferenceMetricsTable,clientPlatformHeartbeatsTable,organizationMembersTable,mlModelVersionsTable,mlEvaluationRunsTable,mlOperationalEventsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {aiConfiguration,recordAiMetric} from "../lib/aiObservability";
import {aiCostPricingConfigured} from "../lib/aiObservability";
import {groqApiKey} from "../lib/aiProviderPolicy";
import {checkRedisReadiness} from "../lib/redisReadiness";
import {redisConfigStatus} from "../lib/redisRateLimit";
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

router.get("/platform/health",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!isPlatformSuperadmin(req.user.id)){res.sendStatus(403);return}
 res.setHeader("Cache-Control","private, no-store");
 const now=new Date(),since=new Date(now.getTime()-24*60*60_000);
 let database:"healthy"|"unavailable"="unavailable";
 try{await pool.query("SELECT 1");database="healthy"}catch{}
 const redisState=redisConfigStatus();
 const redis=redisState==="disabled"?"disabled":redisState==="invalid"?"unavailable":
  await checkRedisReadiness().then(ok=>ok?"healthy":"unavailable").catch(()=>"unavailable");
 let platforms:Record<string,unknown>[]=[];
 let series:Record<string,unknown>[]=[];
 let operations:Record<string,unknown>[]=[];
 let telemetryReady=database==="healthy";
 if(database==="healthy"){
  const [heartbeats,metrics,operationMetrics]=await Promise.allSettled([
   db.select({platform:clientPlatformHeartbeatsTable.platform,version:clientPlatformHeartbeatsTable.version,lastSeenAt:clientPlatformHeartbeatsTable.lastSeenAt,lastHttpStatus:clientPlatformHeartbeatsTable.lastHttpStatus})
    .from(clientPlatformHeartbeatsTable).orderBy(desc(clientPlatformHeartbeatsTable.lastSeenAt)).limit(40),
   pool.query(`SELECT date_trunc('hour', created_at) AS bucket,
     count(*)::int AS requests,
     count(*) FILTER (WHERE outcome = 'failure')::int AS failures,
     round(avg(duration_ms))::int AS average_latency_ms,
     percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95_latency_ms,
     coalesce(sum(input_tokens),0)::bigint AS input_tokens,
     coalesce(sum(output_tokens),0)::bigint AS output_tokens,
     sum(estimated_cost_usd)::numeric AS estimated_cost_usd,
     count(estimated_cost_usd)::int AS priced_requests
    FROM ai_inference_metrics WHERE created_at >= $1
    GROUP BY date_trunc('hour', created_at) ORDER BY bucket`,[since]),
   pool.query(`SELECT operation,count(*)::int AS requests,
     count(*) FILTER (WHERE outcome = 'failure')::int AS failures,
     round(avg(duration_ms))::int AS average_latency_ms,
     percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95_latency_ms,
     coalesce(sum(input_tokens),0)::bigint AS input_tokens,
     coalesce(sum(output_tokens),0)::bigint AS output_tokens,
     sum(estimated_cost_usd)::numeric AS estimated_cost_usd,
     count(estimated_cost_usd)::int AS priced_requests,
     max(created_at) AS last_request_at
    FROM ai_inference_metrics WHERE created_at >= $1 GROUP BY operation ORDER BY requests DESC`,[since]),
  ]);
  const latest=new Map<string,{platform:string;version:string;lastSeenAt:Date;lastHttpStatus:number}>();
  if(heartbeats.status==="fulfilled"){
   for(const row of heartbeats.value)if(!latest.has(row.platform))latest.set(row.platform,row);
  }else telemetryReady=false;
  const expected=["web","ios","android","windows"];
  platforms=expected.map(platform=>{
   const row=latest.get(platform),ageSeconds=row?Math.max(0,Math.floor((now.getTime()-row.lastSeenAt.getTime())/1000)):null;
   return {platform,version:row?.version??null,lastSeenAt:row?.lastSeenAt.toISOString()??null,ageSeconds,lastHttpStatus:row?.lastHttpStatus??null,
    state:!row?"no_signal":row.lastHttpStatus>=500&&ageSeconds!<300?"degraded":ageSeconds!<300?"active":ageSeconds!<3600?"recent":"stale"};
  });
  if(metrics.status==="fulfilled")series=metrics.value.rows.map(row=>({
   bucket:new Date(row.bucket).toISOString(),requests:Number(row.requests),failures:Number(row.failures),
   averageLatencyMs:Number(row.average_latency_ms),p95LatencyMs:Number(row.p95_latency_ms),
   inputTokens:Number(row.input_tokens),outputTokens:Number(row.output_tokens),
   estimatedCostUsd:row.estimated_cost_usd===null?null:Number(row.estimated_cost_usd),pricedRequests:Number(row.priced_requests),
  }));
  else telemetryReady=false;
  if(operationMetrics.status==="fulfilled")operations=operationMetrics.value.rows.map(row=>({
   operation:row.operation,requests:Number(row.requests),failures:Number(row.failures),
   averageLatencyMs:Number(row.average_latency_ms),p95LatencyMs:Number(row.p95_latency_ms),
   inputTokens:Number(row.input_tokens),outputTokens:Number(row.output_tokens),
   estimatedCostUsd:row.estimated_cost_usd===null?null:Number(row.estimated_cost_usd),pricedRequests:Number(row.priced_requests),
   lastRequestAt:row.last_request_at?new Date(row.last_request_at).toISOString():null,
  }));
  else telemetryReady=false;
 }
 const configuration=aiConfiguration();
 const groqConfigured=configuration.configured;
 res.json({observedAt:now.toISOString(),windowHours:24,telemetryReady,services:{api:{state:"healthy"},database:{state:database},redis:{state:redis},groq:{state:groqConfigured?"configured":"unconfigured",provider:configuration.preferredProvider,model:configuration.developmentModel,liveProbe:"manual"}},platforms,ai:{series,operations,costPricingConfigured:aiCostPricingConfigured(),costMethod:"estimated from token usage and model-specific configured rates",rawPromptsStored:false}});
});

router.post("/platform/mlops/smoke-test",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!isPlatformSuperadmin(req.user.id)){res.sendStatus(403);return}
 const configuration=aiConfiguration();
 if(!configuration.configured){res.status(503).json({error:"No model credentials configured"});return}
 const start=Date.now();
 try {
  const client=new OpenAI({apiKey:groqApiKey()!,baseURL:"https://api.groq.com/openai/v1",timeout:12000,maxRetries:0});
  const answer=await client.chat.completions.create({model:configuration.developmentModel,max_completion_tokens:512,...(configuration.developmentModel.startsWith("openai/gpt-oss-") ? {reasoning_effort:"low" as const} : {}),messages:[{role:"system",content:"Return the exact word READY, and no other text."},{role:"user",content:"Synthetic CABO infrastructure availability test. Respond READY."}]});
  if(!answer.choices[0]?.message?.content?.includes("READY"))throw Error("Unexpected output");
  await recordAiMetric("provider_smoke_test",configuration.preferredProvider,configuration.developmentModel,"success",start,{inputTokens:answer.usage?.prompt_tokens,outputTokens:answer.usage?.completion_tokens});
  res.json({ok:true,provider:configuration.preferredProvider,model:configuration.developmentModel,latencyMs:Date.now()-start});
 }catch(e){
  await recordAiMetric("provider_smoke_test",configuration.preferredProvider,configuration.developmentModel,"failure",start);
  const status = typeof (e as {status?:unknown})?.status === "number" ? (e as {status:number}).status : null;
  console.warn("AI connection check failed", {provider: configuration.preferredProvider, status});
  const error = status === 401 ? "The AI provider rejected this API key. Check the key in Render settings." : status === 403 ? "The AI provider refused access. Check this project's permissions and provider restrictions." : status === 429 ? "The AI provider has reached its usage limit. Check the account quota and try again later." : status === 404 ? "This AI model is unavailable. Choose an available model in Render settings." : "The AI service could not complete the connection check. Please try again shortly.";
  res.status(502).json({ok:false,error,providerStatus:status});
 }
});
export default router;
