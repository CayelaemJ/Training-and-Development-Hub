/** Browser-only attendance outbox. Learner IDs are sensitive: opt-in device storage only. */
export type AttendanceDraft={ownerId:string;organizationId:number;learnerId:string;day:string;status:"present"|"absent"|"late"|"excused";note:string;createdAt:string};
const DB_NAME="cabo-attendance-drafts-v1",STORE="queue";
function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(!("indexedDB" in window))return reject(Error("Offline device storage is not supported"));
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:"key"})};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error??Error("Offline storage unavailable"));
 });
}
async function transaction<T>(mode:IDBTransactionMode,execute:(store:IDBObjectStore,resolve:(value:T)=>void,reject:(reason:unknown)=>void)=>void):Promise<T>{
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
  let value:T;
  tx.oncomplete=()=>{db.close();resolve(value)};
  tx.onerror=()=>{db.close();reject(tx.error)};
  tx.onabort=()=>{db.close();reject(tx.error)};
  execute(store,x=>{value=x},reject);
 });
}
const key=(x:Pick<AttendanceDraft,"ownerId"|"organizationId"|"learnerId"|"day">)=>[x.ownerId,x.organizationId,x.learnerId,x.day].join(":");
export async function listAttendanceDrafts():Promise<AttendanceDraft[]>{
 return transaction("readonly",(store,resolve,reject)=>{
  const request=store.getAll();request.onsuccess=()=>resolve((request.result as {key:string;data:AttendanceDraft}[]).map(x=>x.data));request.onerror=()=>reject(request.error);
 });
}
export async function queueAttendanceDraft(draft:AttendanceDraft){
 return transaction<void>("readwrite",(store,resolve)=>{store.put({key:key(draft),data:draft});resolve()});
}
export async function removeAttendanceDraft(draft:AttendanceDraft){
 return transaction<void>("readwrite",(store,resolve)=>{store.delete(key(draft));resolve()});
}
export async function clearAttendanceDrafts(){
 return transaction<void>("readwrite",(store,resolve)=>{store.clear();resolve()});
}
