import {admissionTransitionAllowed,type AdmissionStatus} from "./admissionsPolicy";
export function syntheticCandidate(id:string):boolean{return /^cabo-(?:demo-|fixture-|isolated-test-)/.test(id)}
export function canAdvanceDemoApplication(candidateId:string,universityName:string,current:AdmissionStatus,next:"under_review"|"offer"|"unsuccessful"):boolean{
 return syntheticCandidate(candidateId)&&universityName==="CABO DEMO | University of Future Skills"&&admissionTransitionAllowed(current,next);
}
