export const admissionTransitions={
 draft:["ready_for_handoff","withdrawn"],
 ready_for_handoff:["external_submission_recorded","withdrawn"],
 external_submission_recorded:["under_review","withdrawn"],
 under_review:["offer","unsuccessful","withdrawn"],
 offer:["accepted","declined"],
 accepted:[],
 declined:[],
 unsuccessful:[],
 withdrawn:[]
} as const;
export type AdmissionStatus=keyof typeof admissionTransitions;
export function admissionTransitionAllowed(from:AdmissionStatus,to:AdmissionStatus){
 return (admissionTransitions[from] as readonly string[]).includes(to);
}
export function learnerMayTransition(from:AdmissionStatus,to:AdmissionStatus){
 return (from==="draft"&&to==="ready_for_handoff") ||
  (from==="ready_for_handoff"&&to==="external_submission_recorded") ||
  (["draft","ready_for_handoff","external_submission_recorded","under_review"].includes(from)&&to==="withdrawn") ||
  (from==="offer"&&["accepted","declined"].includes(to));
}
