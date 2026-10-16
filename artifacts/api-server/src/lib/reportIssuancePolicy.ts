export type ReportStatus="submitted"|"approved"|"rejected"|"issued"|"revoked";
export type ReportAction="approve"|"reject"|"issue"|"revoke";
export function mayChangeReport(status:ReportStatus,action:ReportAction,submitter:string,reviewer:string,reason:string):boolean{
 if(action==="approve")return status==="submitted"&&submitter!==reviewer;
 if(action==="reject")return status==="submitted"&&!!reason.trim();
 if(action==="issue")return status==="approved";
 if(action==="revoke")return status==="issued"&&!!reason.trim();
 return false;
}
