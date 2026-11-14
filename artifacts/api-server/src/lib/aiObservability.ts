import {db,aiInferenceMetricsTable} from "@workspace/db";
import {aiProviderConfiguration} from "./aiProviderPolicy";
export type AiOperation="development_plan"|"written_exam"|"quiz"|"grading"|"material_qa"|"material_ocr"|"learner_support"|"passport_reflection"|"provider_smoke_test"|"ai_generation";
export type AiUsage={inputTokens?:number|null;outputTokens?:number|null};
type ModelRates={inputUsdPerMillion:number;outputUsdPerMillion:number};
function usageValue(value:number|undefined|null):number|null{return value!=null&&Number.isSafeInteger(value)&&value>=0?Math.min(value,1_000_000):null}
function modelRates(model:string):ModelRates|null{
 try{
  const parsed=JSON.parse(process.env.GROQ_MODEL_COST_RATES_JSON??"{}") as Record<string,Partial<ModelRates>>;
  const rates=parsed[model];
  if(!rates||!Number.isFinite(rates.inputUsdPerMillion)||!Number.isFinite(rates.outputUsdPerMillion)||rates.inputUsdPerMillion!<0||rates.outputUsdPerMillion!<0)return null;
  return {inputUsdPerMillion:rates.inputUsdPerMillion!,outputUsdPerMillion:rates.outputUsdPerMillion!};
 }catch{return null}
}
export function aiCostPricingConfigured():boolean{
 try{
  const parsed=JSON.parse(process.env.GROQ_MODEL_COST_RATES_JSON??"{}") as Record<string,Partial<ModelRates>>;
  return Object.values(parsed).some(r=>Number.isFinite(r.inputUsdPerMillion)&&Number.isFinite(r.outputUsdPerMillion)&&r.inputUsdPerMillion!>=0&&r.outputUsdPerMillion!>=0);
 }catch{return false}
}
export async function recordAiMetric(operation:AiOperation,provider:string,model:string,outcome:"success"|"failure",started:number,usage:AiUsage={}){
 const inputTokens=usageValue(usage.inputTokens),outputTokens=usageValue(usage.outputTokens);
 const rates=modelRates(model);
 const estimatedCostUsd=inputTokens!==null&&outputTokens!==null&&rates
  ? Number(((inputTokens*rates.inputUsdPerMillion+outputTokens*rates.outputUsdPerMillion)/1_000_000).toFixed(8)):null;
 try{await db.insert(aiInferenceMetricsTable).values({operation,provider,model,outcome,durationMs:Math.max(0,Math.min(120000,Date.now()-started)),inputTokens,outputTokens,estimatedCostUsd})}
 catch{console.error("AI telemetry write failed")}
}
export function aiConfiguration(){
 return aiProviderConfiguration();
}
