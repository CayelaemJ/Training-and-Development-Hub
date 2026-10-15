export const transitions={
 draft:["submitted","cancelled"],
 submitted:["approved","rejected"],
 approved:["active","archived"],
 active:["completed","archived"],
 rejected:["draft","archived"],
 completed:["archived"],
 cancelled:[],
 archived:[]
} as const;
export type WorkflowState=keyof typeof transitions;
export function validTransition(from:WorkflowState,to:WorkflowState){return (transitions[from] as readonly string[]).includes(to)}
export function canTransition(role:string|null,from:WorkflowState,to:WorkflowState,createdBy:string,actor:string){
 if(!validTransition(from,to))return false;
 if(role==="owner"||role==="admin")return true;
 return actor===createdBy && from==="draft" && to==="submitted";
}
