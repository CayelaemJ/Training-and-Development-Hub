export type DemoAdmissionStatus="draft"|"ready_for_handoff"|"external_submission_recorded"|"under_review"|"offer"|"unsuccessful";
export function syntheticCandidate(id:string):boolean{return /^cabo-(?:demo|fixture|isolated-test)-[a-z0-9-]{1,80}$/.test(id)}
export function canAdvanceDemoApplication(candidateId:string,universityName:string,current:DemoAdmissionStatus,next:"under_review"|"offer"|"unsuccessful"):boolean{
 return syntheticCandidate(candidateId)&&universityName==="CABO DEMO | University of Future Skills"&&
 (current==="external_submission_recorded"&&next==="under_review"||current==="under_review"&&(next==="offer"||next==="unsuccessful"));
}

export function demoAdmissionsEnabled(env:Record<string,string|undefined>):boolean {
 return env.CABO_ENVIRONMENT === "testing" && env.CABO_TEST_DATABASE_ISOLATED === "true" && env.ENABLE_DEMO_ADMISSIONS_INBOX === "true";
}
