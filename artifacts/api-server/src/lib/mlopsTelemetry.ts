import {db,mlOperationalEventsTable} from "@workspace/db";

export async function recordMLOpsEvent(input:{organizationId:number;modelKey:string;version:string;eventType:"grading"|"evaluation";durationMs:number;status:"success"|"failure"|"timeout"}):Promise<boolean>{
 if(process.env.ENABLE_MLOPS_REGISTRY!=="true")return false;
 try{
  await db.insert(mlOperationalEventsTable).values({
   organizationId:input.organizationId,
   modelKey:input.modelKey.slice(0,100),
   version:input.version.slice(0,100),
   eventType:input.eventType,
   durationMs:Math.max(0,Math.min(900000,Math.round(input.durationMs))),
   status:input.status,
  });
  return true;
 }catch{return false;}
}
