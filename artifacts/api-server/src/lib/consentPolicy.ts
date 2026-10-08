/**
 * Pure authorization policy for the opt-in potential-profile employer pilot.
 * IMPORTANT: This flag is not a substitute for verified adult status, employer billing,
 * contractual purpose limitation or legal review. Keep it off in public production.
 */
export const EMPLOYER_PILOT_FLAG = "ENABLE_EMPLOYER_ACCESS_PILOT";
export function employerPilotEnabled(env:Record<string,string|undefined>):boolean{
 return env[EMPLOYER_PILOT_FLAG]==="true";
}
export type GrantState="pending"|"approved"|"denied"|"revoked";
export type GrantDecision="approved"|"denied"|"revoked";
export function validDecision(previous:GrantState,decision:GrantDecision):boolean{
 return previous==="pending"&&(decision==="approved"||decision==="denied")||
 previous==="approved"&&decision==="revoked";
}
export function canReadGrant(state:string,expiresAt:Date|null,now:Date):boolean{
 return state==="approved"&&expiresAt!==null&&expiresAt.getTime()>now.getTime();
}
export function disclosedEvidenceCategories(scope:"professional"|"portfolio"):readonly string[]{
 return scope==="portfolio"?["project","achievement","skill"]:["skill","strength","project","achievement","interest"];
}
