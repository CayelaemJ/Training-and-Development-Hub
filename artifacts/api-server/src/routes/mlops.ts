import {Router,type IRouter} from "express";
import OpenAI from "openai";
import {count,desc,eq,gte} from "drizzle-orm";
import {db,aiInferenceMetricsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {aiConfiguration,recordAiMetric} from "../lib/aiObservability";
const router:IRouter=Router();
let previousSmoke=0;
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
 if(Date.now()-previousSmoke<60000){res.status(429).json({error:"One model smoke test per minute"});return}
 const configuration=aiConfiguration();
 if(!configuration.configured){res.status(503).json({error:"No model credentials configured"});return}
 previousSmoke=Date.now();const start=Date.now();
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