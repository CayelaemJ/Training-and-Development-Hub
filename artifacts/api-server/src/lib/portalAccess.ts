import { and,eq } from "drizzle-orm";
import { db,organizationMembersTable,managementRoleGrantsTable,guardianRelationshipsTable } from "@workspace/db";
import { leadershipRanks, type HierarchyRole } from "./hierarchyPolicy";

// An account ID is not a password or a role by itself. Enable only in the isolated test environment.
export function isPlatformSuperadmin(userId:string):boolean {
 return process.env.RAILWAY_ENVIRONMENT_NAME==="testing" &&
   process.env.ENABLE_CABO_SUPERADMIN==="true" &&
   !!process.env.CABO_SUPERADMIN_USER_ID &&
   userId===process.env.CABO_SUPERADMIN_USER_ID;
}
export type PortalRole="superadmin"|"executive"|"headmaster"|"teacher"|"assessor"|"parent"|"learner";
export async function resolvePortal(userId:string):Promise<{role:PortalRole;organizationIds:number[];scopes:{organizationId:number;unitId:number;role:string}[]}>{
 if(isPlatformSuperadmin(userId))return {role:"superadmin",organizationIds:[],scopes:[]};
 const [members,grants,guardian]=await Promise.all([
  db.select({organizationId:organizationMembersTable.organizationId,role:organizationMembersTable.role}).from(organizationMembersTable).where(eq(organizationMembersTable.userId,userId)),
  db.select({organizationId:managementRoleGrantsTable.organizationId,unitId:managementRoleGrantsTable.unitId,role:managementRoleGrantsTable.role}).from(managementRoleGrantsTable).where(eq(managementRoleGrantsTable.userId,userId)),
  db.select({id:guardianRelationshipsTable.id}).from(guardianRelationshipsTable).where(and(eq(guardianRelationshipsTable.guardianId,userId),eq(guardianRelationshipsTable.status,"accepted"))).limit(1)
 ]);
 const ordered=[...grants].sort((a,b)=>(leadershipRanks[b.role as HierarchyRole]??0)-(leadershipRanks[a.role as HierarchyRole]??0));
 const top=ordered[0]?.role;
 let role:PortalRole="learner";
 if(top){
  const rank=leadershipRanks[top as HierarchyRole]??0;
  role=rank>=70?"executive":rank>=35?"headmaster":top==="assessor"?"assessor":"teacher";
 }else if(members.some(m=>["owner","admin"].includes(m.role)))role="headmaster";
 else if(members.some(m=>m.role==="assessor"))role="assessor";
 else if(members.some(m=>m.role==="teacher"))role="teacher";
 else if(guardian.length)role="parent";
 return {role,organizationIds:members.map(m=>m.organizationId),scopes:grants};
}
