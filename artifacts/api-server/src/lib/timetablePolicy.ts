export type TimetableSlot={day:number;startsAt:string;endsAt:string;teacherId:string;room:string;grade:string;group:string};
export function clashes(a:TimetableSlot,b:TimetableSlot):string[]{
 if(a.day!==b.day||a.startsAt>=b.endsAt||b.startsAt>=a.endsAt)return [];
 const conflicts:string[]=[];
 if(a.teacherId===b.teacherId)conflicts.push("teacher");
 if(a.room.trim().toLowerCase()===b.room.trim().toLowerCase())conflicts.push("room");
 if(a.grade===b.grade&&a.group.toLowerCase()===b.group.toLowerCase())conflicts.push("class");
 return conflicts;
}
export function validSlot(slot:TimetableSlot):boolean{
 const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
 return Number.isInteger(slot.day)&&slot.day>=1&&slot.day<=7&&time.test(slot.startsAt)&&time.test(slot.endsAt)&&slot.startsAt<slot.endsAt&&!!slot.room.trim()&&!!slot.teacherId.trim();
}
