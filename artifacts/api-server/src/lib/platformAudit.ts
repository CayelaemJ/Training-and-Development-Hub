import {db,platformAdminAuditTable} from "@workspace/db";
import {isPlatformSuperadmin} from "./portalAccess";
export async function auditSuperadmin(actorId:string,action:string,organizationId?:number){
 if(!isPlatformSuperadmin(actorId))return;
 await db.insert(platformAdminAuditTable).values({actorId,action,organizationId:organizationId??null});
}
