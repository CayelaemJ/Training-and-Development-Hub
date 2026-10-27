import {Router,type IRouter} from "express";
import { completeAIJson } from "../lib/aiCompletion";
import type { AiProviderName } from "../lib/aiRouting";
import {count,desc,eq,gte} from "drizzle-orm";
import {db,aiInferenceMetricsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {aiConfiguration,recordAiMetric} from "../lib/aiObservability";
const router:IRouter=Router();

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
 const requested=req.body?.provider;
 if(requested!==undefined && !["groq","huggingface","openai"].includes(requested)){
  res.status(400).json({error:"Invalid AI provider selection"});return;
 }
 if(requested && !configuration.providers.includes(requested)){
  res.status(503).json({error:"Selected AI provider is not configured"});return;
 }
 const start=Date.now();
 try {
  const completed=await completeAIJson({
   provider:requested as AiProviderName | undefined,
   task:"generic",
   system:"Return exactly one JSON object with the single property status equal to READY.",
   payload:{synthetic:true,purpose:"CABO provider connectivity check"},
   maxCompletionTokens:128,
   validate(value){
    const parsed=value as {status?:unknown};
    if(!parsed || parsed.status!=="READY")throw Error("Unexpected AI smoke test result");
    return {status:"READY" as const};
   },
  });
  await recordAiMetric("smoke_test",completed.provider,completed.modelId,"success",start);
  res.json({ok:true,provider:completed.provider,model:completed.modelId,latencyMs:Date.now()-start});
 }catch(e){
  await recordAiMetric("smoke_test",requested || "router","none","failure",start);
  console.warn("AI connection check failed",{provider:requested || "router",errorType:e instanceof Error?e.name:"unknown"});
  res.status(502).json({ok:false,error:"The selected AI provider could not complete the synthetic connectivity test. Check credentials, inference access, model and quota in Render."});
 }
});

export default router;