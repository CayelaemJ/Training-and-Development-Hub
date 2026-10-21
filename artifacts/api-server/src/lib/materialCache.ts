import {db} from '@workspace/db';
import {sql} from 'drizzle-orm';
// Legacy Railway schemas remain usable until the optional cache migration is approved.
export function materialReadingEnabled(){return process.env.ENABLE_MATERIAL_READING==='true';}
export async function uploadReadingConsent(path:string,user:string){
 if(!materialReadingEnabled())return false;
 const result=await db.execute(sql`SELECT allow_ai_reading FROM upload_intents WHERE object_path=${path} AND user_id=${user}`);
 return result.rows[0]?.allow_ai_reading===true;
}
export async function cachedMaterial(id:number,user:string):Promise<{text:string|null;allowAiReading:boolean}>{
 if(!materialReadingEnabled())return {text:null,allowAiReading:false};
 const result=await db.execute(sql`SELECT extracted_text,allow_ai_reading FROM study_materials WHERE id=${id} AND user_id=${user}`);
 return {text:typeof result.rows[0]?.extracted_text==='string'?result.rows[0].extracted_text:null,allowAiReading:result.rows[0]?.allow_ai_reading===true};
}
export async function saveMaterialText(id:number,user:string,text:string){
 if(materialReadingEnabled())await db.execute(sql`UPDATE study_materials SET extracted_text=${text} WHERE id=${id} AND user_id=${user}`);
}
