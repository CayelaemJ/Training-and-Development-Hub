export const hubKinds=["academic_intervention","timetable","family_meeting","credential","bursary","sports","assessment_blueprint","university_module","talent_skill","governance_action","learning_resource","education_integration"] as const;
export type HubKind=typeof hubKinds[number];
export function canCreateHubRecord(role:string|null,kind:HubKind,subjectId:string|null):boolean{
 if(role!=="owner"&&role!=="admin")return false;
 if(kind==="credential"||kind==="assessment_blueprint")return false;
 if(["academic_intervention","family_meeting","talent_skill"].includes(kind)&&!subjectId)return false;
 return true;
}
export function mayViewHubRecord(role:string,kind:HubKind,currentUser:string,subjectId:string|null):boolean {
 if(kind==="governance_action"||kind==="education_integration")return role==="owner"||role==="admin";
 if(["academic_intervention","family_meeting","credential","talent_skill"].includes(kind)){
  if(role==="owner"||role==="admin")return true;
  return subjectId!==null&&subjectId===currentUser;
 }
 return true;
}
