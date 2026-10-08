/**
 * CABO school governance roles. Ranks determine delegation power, not human worth.
 * Family / learner roles cannot grant or manage anyone else's access.
 */
export const leadershipRanks={
 national_director:100,
 provincial_director:90,
 district_director:80,
 group_executive:75,
 governing_body_chair:70,
 headmaster:60,
 deputy_headmaster:50,
 head_of_department:40,
 grade_head:35,
 teacher:20,
 assessor:20,
 administrator:15,
 parent:0,
 learner:0
} as const;
export type HierarchyRole=keyof typeof leadershipRanks;
export const roleNames:HierarchyRole[]=Object.keys(leadershipRanks) as HierarchyRole[];
export const roleTitle=(role:HierarchyRole)=>role.split("_").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ");
export const mayDelegate=(actor:HierarchyRole,target:HierarchyRole)=>
 leadershipRanks[actor]>leadershipRanks[target]&&leadershipRanks[actor]>=40;
export const managementRole=(role:HierarchyRole)=>leadershipRanks[role]>=15;
export function descendantIds(units:{id:number;parentId:number|null}[],rootId:number):Set<number>{
 const result=new Set<number>([rootId]);
 for(let i=0;i<units.length;i++){
  const size=result.size;
  for(const unit of units)if(unit.parentId!==null&&result.has(unit.parentId))result.add(unit.id);
  if(result.size===size)break;
 }
 return result;
}
