export const AGGREGATE_MIN_COHORT=10;
/** Small-cohort suppression prevents demographic or performance re-identification. */
export function safeAggregate(count:number,threshold=AGGREGATE_MIN_COHORT):number|null{
 return Number.isInteger(count)&&count>=threshold?count:null;
}
export function canSeeSchoolRollup(membership:string|null,delegatedRoles:string[],superadmin:boolean){
 return superadmin||membership==="owner"||membership==="admin"||
 delegatedRoles.some(r=>["district_director","provincial_director","national_director","group_executive"].includes(r));
}
