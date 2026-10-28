export type GuardianStatus="pending"|"accepted"|"declined"|"verified"|"revoked";
export function canVerifyGuardian(status:GuardianStatus,evidenceReviewed:boolean,activeEnrollment:boolean){
 return status==="accepted"&&evidenceReviewed&&activeEnrollment;
}
export function canRevokeGuardian(status:GuardianStatus,activeEnrollment:boolean){
 return status==="verified"&&activeEnrollment;
}
export function canReadChildReport(status:GuardianStatus,hasInstitutionVerification:boolean,activeEnrollment:boolean){
 return status==="verified"&&hasInstitutionVerification&&activeEnrollment;
}
