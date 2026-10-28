export function canExportAdmissionEvidence(candidateId:string,requesterId:string,status:string,disclosureApprovedAt:Date|null):boolean{
 return candidateId===requesterId&&!!disclosureApprovedAt&&["ready_for_handoff","external_submission_recorded","under_review","offer","accepted"].includes(status);
}
export function limitedEvidenceRecord(row:{academicYear:number;contentHash:string;snapshot:unknown}){
 const info=row.snapshot&&typeof row.snapshot==="object"?row.snapshot as Record<string,unknown>:{};
 const subjects=Array.isArray(info.subjects)?info.subjects.filter(x=>x&&typeof x==="object").map(x=>({name:String(x.name??"").slice(0,140),percentage:typeof x.percentage==="number"?x.percentage:null})).filter(x=>x.name):[];
 return {academicYear:row.academicYear,grade:typeof info.grade==="string"?info.grade:"",subjects,contentHash:row.contentHash,credentialSignatureVerified:false};
}
