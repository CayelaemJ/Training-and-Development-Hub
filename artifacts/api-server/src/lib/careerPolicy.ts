/** Commercial recruitment is disabled by default until candidate eligibility and employer verification pass. */
export function careerApplicationsEnabled(env:Record<string,string|undefined>):boolean {
 return env.ENABLE_CAREER_APPLICATIONS_PILOT==="true" && env.EMPLOYER_VERIFICATION_READY==="true" && env.CANDIDATE_ELIGIBILITY_READY==="true";
}
export function portablePsychometricReleaseEnabled(env:Record<string,string|undefined>):boolean {
 return env.ENABLE_PSYCHOMETRIC_DISCLOSURE==="true" && env.PSYCHOMETRIC_PROFESSIONAL_GOVERNANCE_READY==="true" && env.EMPLOYER_VERIFICATION_READY==="true";
}
