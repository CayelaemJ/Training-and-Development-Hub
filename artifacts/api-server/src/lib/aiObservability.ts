import {db,aiInferenceMetricsTable} from "@workspace/db";
export type AiOperation="development_plan"|"written_exam"|"quiz"|"grading";
export async function recordAiMetric(operation:AiOperation,provider:string,model:string,outcome:"success"|"failure",started:number){
 try{await db.insert(aiInferenceMetricsTable).values({operation,provider,model,outcome,durationMs:Math.max(0,Math.min(120000,Date.now()-started))})}
 catch{console.error("AI telemetry write failed")}
}
export function aiConfiguration(){
 const groq=!!process.env.GROQ_API_KEY,openai=!!process.env.OPENAI_API_KEY;
 return {configured:groq||openai,preferredProvider:groq?"groq":openai?"openai":"none",developmentModel:groq?(process.env.GROQ_EXAM_MODEL||"llama-3.3-70b-versatile"):(process.env.OPENAI_EXAM_MODEL||"gpt-5.4-mini")};
}
