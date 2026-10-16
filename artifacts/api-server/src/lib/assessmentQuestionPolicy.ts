export type QuestionStatus="draft"|"submitted"|"approved"|"rejected"|"published"|"archived";
export type QuestionAction="submit"|"approve"|"reject"|"publish"|"archive";
export function questionActionAllowed(status:QuestionStatus,action:QuestionAction,creator:string,reviewer:string,role:string,note:string){
 const manager=role==="owner"||role==="admin";
 if(action==="submit")return status==="draft"&&(creator===reviewer||manager);
 if(action==="approve")return status==="submitted"&&manager&&creator!==reviewer;
 if(action==="reject")return status==="submitted"&&manager&&!!note.trim();
 if(action==="publish")return status==="approved"&&manager;
 if(action==="archive")return (status==="published"||status==="rejected")&&manager&&!!note.trim();
 return false;
}
