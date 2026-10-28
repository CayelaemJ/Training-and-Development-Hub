export type PaperStatus="draft"|"submitted"|"approved"|"published"|"rejected";
export type PaperAction="submit"|"approve"|"reject"|"publish";
export function canChangePaper(status:PaperStatus,action:PaperAction,creator:string,actor:string,manager:boolean,note:string){
 if(action==="submit")return status==="draft"&&actor===creator;
 if(action==="approve")return status==="submitted"&&manager&&actor!==creator;
 if(action==="reject")return status==="submitted"&&manager&&!!note.trim();
 if(action==="publish")return status==="approved"&&manager;
 return false;
}
