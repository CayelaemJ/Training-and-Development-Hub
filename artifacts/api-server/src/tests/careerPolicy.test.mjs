import test from "node:test";
import assert from "node:assert/strict";
import {careerApplicationsEnabled,portablePsychometricReleaseEnabled} from "../lib/careerPolicy.ts";
test("employment applications default off",()=>{
 assert.equal(careerApplicationsEnabled({}),false);
 assert.equal(careerApplicationsEnabled({ENABLE_CAREER_APPLICATIONS_PILOT:"true"}),false);
 assert.equal(careerApplicationsEnabled({ENABLE_CAREER_APPLICATIONS_PILOT:"true",EMPLOYER_VERIFICATION_READY:"true"}),false);
 assert.equal(careerApplicationsEnabled({ENABLE_CAREER_APPLICATIONS_PILOT:"true",EMPLOYER_VERIFICATION_READY:"true",CANDIDATE_ELIGIBILITY_READY:"true"}),true);
});
test("psychometric sharing always needs governance and verified employers",()=>{
 assert.equal(portablePsychometricReleaseEnabled({}),false);
 assert.equal(portablePsychometricReleaseEnabled({ENABLE_PSYCHOMETRIC_DISCLOSURE:"true"}),false);
 assert.equal(portablePsychometricReleaseEnabled({ENABLE_PSYCHOMETRIC_DISCLOSURE:"true",EMPLOYER_VERIFICATION_READY:"true",PSYCHOMETRIC_PROFESSIONAL_GOVERNANCE_READY:"true"}),true);
});
