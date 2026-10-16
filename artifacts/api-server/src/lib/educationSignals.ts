export function validAttendanceBatch(rows:{learnerId:string;day:string;status:string}[]):boolean{
 if(rows.length<1||rows.length>100)return false;
 const keys=new Set<string>();
 for(const x of rows){if(!/^\d{4}-\d{2}-\d{2}$/.test(x.day)||!["present","absent","late","excused"].includes(x.status))return false;const k=x.learnerId+":"+x.day;if(keys.has(k))return false;keys.add(k)}
 return true;
}
export function academicAttention(subjects:{percentage:number}[],attendanceRate:number|null){
 return subjects.some(x=>x.percentage<50)||(attendanceRate!==null&&attendanceRate<80);
}
