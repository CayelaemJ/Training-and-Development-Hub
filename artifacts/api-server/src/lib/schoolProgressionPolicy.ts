export const schoolGrades=["RR","R",...Array.from({length:12},(_,i)=>String(i+1))] as const;
export function nextSchoolGrade(current:string):string|null{
 const index=schoolGrades.indexOf(current as typeof schoolGrades[number]);
 return index>=0&&index<schoolGrades.length-1?schoolGrades[index+1]:null;
}
export function canProgressToYear(currentYear:number,targetYear:number):boolean{
 return Number.isInteger(currentYear)&&targetYear===currentYear+1;
}
