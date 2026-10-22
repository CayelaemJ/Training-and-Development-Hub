export const PASSPORT_AI_PROMPT_VERSION="cabo-passport-reflection-v1";
export const PASSPORT_AI_DISCLOSURE="AI interpretation only. It may be incomplete or wrong. It is not evidence, a verified achievement, an accredited qualification, a prediction of success or a hiring decision.";
export function canHumanVerify(role:string|undefined,actorId:string,subjectId:string){
 return actorId!==subjectId && ["owner","admin","assessor"].includes(role??"");
}
export function decisionAllowed(current:string,decision:"verified"|"rejected"|"revoked"){
 return current==="pending"&&(decision==="verified"||decision==="rejected")||
        current==="verified"&&decision==="revoked";
}
