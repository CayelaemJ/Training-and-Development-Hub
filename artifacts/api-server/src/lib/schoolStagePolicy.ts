export const schoolPhases={
 preprimary:{grades:["RR","R"],domains:["early_language","early_numeracy","motor_development","social_emotional","creative_play","self_care"]},
 primary:{grades:["1","2","3","4","5","6","7"],domains:["literacy","numeracy","natural_sciences","social_sciences","languages","life_skills","learning_habits"]},
 highschool:{grades:["8","9","10","11","12"],domains:["subject_mastery","assessment_readiness","study_skills","career_guidance","practical_projects","wellbeing_support"]}
} as const;
export type SchoolPhase=keyof typeof schoolPhases;
export function phaseForGrade(grade:string):SchoolPhase|null{
 for(const phase of Object.keys(schoolPhases) as SchoolPhase[])if((schoolPhases[phase].grades as readonly string[]).includes(grade))return phase;
 return null;
}
export function validPhaseDomain(phase:SchoolPhase,domain:string):boolean{return (schoolPhases[phase].domains as readonly string[]).includes(domain)}
export function mayWriteSchoolProgress(role:string|null):boolean{return role==="owner"||role==="admin"}
export const progressStates=["observing","developing","meeting_expectations","needs_support"] as const;
