export type MLOpsMembership={organizationId:number;role:string};
export type MLOpsCapability="view"|"register-model"|"submit-evaluation";

export function canAccessMLOps(membership:MLOpsMembership|undefined,requestedOrganizationId:number,capability:MLOpsCapability):boolean{
 if(!membership||membership.organizationId!==requestedOrganizationId)return false;
 if(capability==="register-model")return membership.role==="owner"||membership.role==="admin";
 return ["owner","admin","teacher","assessor"].includes(membership.role);
}
