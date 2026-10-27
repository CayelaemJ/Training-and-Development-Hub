import {db,aiInferenceMetricsTable} from "@workspace/db";
export type AiOperation="development_plan"|"written_exam"|"quiz"|"grading"|"smoke_test";
export async function recordAiMetric(operation:AiOperation,provider:string,model:string,outcome:"success"|"failure",started:number){
 try{await db.insert(aiInferenceMetricsTable).values({operation,provider,model,outcome,durationMs:Math.max(0,Math.min(120000,Date.now()-started))})}
 catch{console.error("AI telemetry write failed")}
}
export function aiConfiguration(){
 const groq=!!process.env.GROQ_API_KEY?.trim(),huggingface=!!(process.env.HF_TOKEN?.trim()||process.env.HUGGINGFACE_API_KEY?.trim()),openai=!!process.env.OPENAI_API_KEY?.trim();
 const providers=[...(groq?["groq"]:[]),...(huggingface?["huggingface"]:[]),...(openai?["openai"]:[])];
 return {configured:providers.length>0,providers,preferredProvider:groq?"groq":huggingface?"huggingface":openai?"openai":"none",developmentModel:groq?(process.env.GROQ_EXAM_MODEL||"openai/gpt-oss-20b"):huggingface?(process.env.HF_CHAT_MODEL||"openai/gpt-oss-120b:cheapest"):(process.env.OPENAI_EXAM_MODEL||"gpt-4.1-mini")};
}
