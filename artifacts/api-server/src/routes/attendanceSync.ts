import {Router,type IRouter} from "express";
import {and,eq,gte,lt} from "drizzle-orm";
import {z} from "zod/v4";
import {db,organizationMembersTable,verifiedEnrollmentsTable,schoolAttendanceTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
const day=z.iso.date();
const entry=z.object({learnerId:z.string().min(1).max(160),day,status:z.enum(["present","absent","late","excused"]),note:z.string().max(350).default("")});
async function manager(org:number,user:string){if(isPlatformSuperadmin(user))return true;const [m]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);return !!m&&["owner","admin"].includes(m.role)}
/** Offline clients may replay exact attendance events; the DB's unique day/learner index deduplicates. */
router.post("/organizations/:orgId/attendance/sync",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),parsed=z.object({entries:z.array(entry).min(1).max(100)}).safeParse(req.body);
 if(!org.success||!parsed.success){res.status(400).json({error:"Supply up to 100 valid attendance entries"});return}
 if(!await manager(org.data,req.user.id)){res.sendStatus(403);return}
 const items=parsed.data.entries;
 const duplicateKeys=new Set(items.map(x=>x.learnerId+":"+x.day));
 if(duplicateKeys.size!==items.length){res.status(400).json({error:"Repeated learner/day in batch"});return}
 const accepted=[] as {learnerId:string;day:string;result:string}[];
 for(const v of items){
  const year=Number(v.day.slice(0,4));
  const [enrollment]=await db.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.learnerId,v.learnerId),eq(verifiedEnrollmentsTable.academicYear,year),eq(verifiedEnrollmentsTable.status,"active"))).limit(1);
  if(!enrollment){accepted.push({learnerId:v.learnerId,day:v.day,result:"rejected_no_active_enrollment"});continue}
  const [existing]=await db.select({id:schoolAttendanceTable.id,status:schoolAttendanceTable.status}).from(schoolAttendanceTable).where(and(eq(schoolAttendanceTable.organizationId,org.data),eq(schoolAttendanceTable.learnerId,v.learnerId),eq(schoolAttendanceTable.day,v.day))).limit(1);
  if(existing){accepted.push({learnerId:v.learnerId,day:v.day,result:existing.status===v.status?"already_synced":"conflict_manual_review"});continue}
  const [created]=await db.insert(schoolAttendanceTable).values({organizationId:org.data,learnerId:v.learnerId,day:v.day,status:v.status,note:v.note,recordedBy:req.user.id}).onConflictDoNothing().returning();
  accepted.push({learnerId:v.learnerId,day:v.day,result:created?"synced":"already_synced"});
 }
 res.setHeader("Cache-Control","private, no-store");res.json({results:accepted,synced:accepted.filter(x=>x.result==="synced").length,conflicts:accepted.filter(x=>x.result==="conflict_manual_review").length});
});
router.get("/organizations/:orgId/attendance/summary",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),year=z.coerce.number().int().min(2000).max(2200).safeParse(req.query.year);
 if(!org.success||!year.success){res.sendStatus(400);return}
 if(!await manager(org.data,req.user.id)){res.sendStatus(403);return}
 const rows=await db.select({day:schoolAttendanceTable.day,status:schoolAttendanceTable.status}).from(schoolAttendanceTable).where(and(eq(schoolAttendanceTable.organizationId,org.data),gte(schoolAttendanceTable.day,year.data+"-01-01"),lt(schoolAttendanceTable.day,(year.data+1)+"-01-01")));
 const counts:Record<string,number>={present:0,absent:0,late:0,excused:0};for(const row of rows)counts[row.status]=(counts[row.status]??0)+1;
 res.setHeader("Cache-Control","private, no-store");res.json({year:year.data,records:rows.length,counts,officialDistrictData:false});
});
export default router;