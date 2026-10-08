import { and,eq } from "drizzle-orm";
import { db,organizationMembersTable,managementRoleGrantsTable,guardianRelationshipsTable } from "@workspace/db";
import { leadershipRanks, type HierarchyRole } from "./hierarchyPolicy";
import { isTestSuperadmin } from "./platformPolicy";

// An account ID is not a password or a role by itself. Enable only in the isolated test environment.
export function isPlatformSuperadmin(userId:string):boolean {
 return isTestSuperadmin(userId,process.env);
}
export type PortalRole="superadmin"|"national_director"|"provincial_director"|"district_director"|"group_executive"|"governing_body_chair"|"headmaster"|"deputy_headmaster"|"department_head"|"grade_head"|"teacher"|"assessor"|"administrator"|"parent"|"learner";
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
  role=(top==="head_of_department"?"department_head":top) as PortalRole;
  if(rank<15)role="learner";
 }else if(members.some(m=>["owner","admin"].includes(m.role)))role="headmaster";
 else if(members.some(m=>m.role==="assessor"))role="assessor";
 else if(members.some(m=>m.role==="teacher"))role="teacher";
 else if(guardian.length)role="parent";
 return {role,organizationIds:members.map(m=>m.organizationId),scopes:grants};
}
