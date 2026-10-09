export type TestPrincipal={username:string;userId:string;email:string;firstName:string;lastName:string;hash:string};
export function configuredPrincipals(raw?:string):TestPrincipal[]{
 if(!raw)return [];
 try {
  const value=JSON.parse(raw);
  if(!Array.isArray(value)||value.length>30)return [];
  const usernames=new Set<string>(),userIds=new Set<string>();
  const records:TestPrincipal[]=[];
  for(const item of value){
   if(!item||typeof item!=="object"||typeof item.username!=="string"||!/^cabo_(?:headmaster|teacher|assessor|learner|parent|district|university|company)_[a-z0-9_]{2,20}$/.test(item.username))return [];
   if(!/^cabo-fixture-[a-z0-9-]{3,60}$/.test(item.userId)||typeof item.email!=="string"||!item.email.endsWith("@example.invalid"))return [];
   if(typeof item.hash!=="string"||!/^([a-f0-9]{32}):([a-f0-9]{128})$/.test(item.hash))return [];
   if(typeof item.firstName!=="string"||typeof item.lastName!=="string"||item.firstName.length>80||item.lastName.length>80)return [];
   if(usernames.has(item.username)||userIds.has(item.userId))return [];
   usernames.add(item.username);userIds.add(item.userId);records.push(item as TestPrincipal);
  }
  return records;
 }catch{return []}
}
