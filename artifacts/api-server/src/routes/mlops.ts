import {Router,type IRouter} from "express";
import {count,desc,eq,gte} from "drizzle-orm";
import {db,aiInferenceMetricsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {aiConfiguration} from "../lib/aiObservability";
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
export default router;