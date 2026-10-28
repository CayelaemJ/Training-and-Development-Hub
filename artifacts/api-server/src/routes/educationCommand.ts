import {Router,type IRouter} from "express";
import {and,eq,inArray,gte,lt} from "drizzle-orm";
import {z} from "zod/v4";
import {db,organizationsTable,organizationMembersTable,managementRoleGrantsTable,verifiedEnrollmentsTable,schoolAttendanceTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {safeAggregate,canSeeSchoolRollup} from "../lib/commandCentrePolicy";
const router:IRouter=Router();
router.get("/education-command/overview",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const year=z.coerce.number().int().min(2000).max(2200).safeParse(req.query.year);
 if(!year.success){res.sendStatus(400);return}
 const user=req.user.id,superadmin=isPlatformSuperadmin(user);
 const [members,grants]=await Promise.all([
  db.select({organizationId:organizationMembersTable.organizationId,role:organizationMembersTable.role}).from(organizationMembersTable).where(eq(organizationMembersTable.userId,user)),
  db.select({organizationId:managementRoleGrantsTable.organizationId,role:managementRoleGrantsTable.role}).from(managementRoleGrantsTable).where(eq(managementRoleGrantsTable.userId,user))
 ]);
 const known=new Set([...members.map(x=>x.organizationId),...grants.map(x=>x.organizationId)]);
 const all=superadmin?await db.select({id:organizationsTable.id,name:organizationsTable.name}).from(organizationsTable):known.size?await db.select({id:organizationsTable.id,name:organizationsTable.name}).from(organizationsTable).where(inArray(organizationsTable.id,[...known])):[];
 const authorized=all.filter(x=>canSeeSchoolRollup(members.find(m=>m.organizationId===x.id)?.role??null,grants.filter(g=>g.organizationId===x.id).map(g=>g.role),superadmin));
 const schools=[] as {id:number;name:string;learnerCount:number|null;attendanceRate:number|null;privacySuppressed:boolean}[];
 for(const org of authorized.slice(0,100)){
  const enrolled=await db.select({learnerId:verifiedEnrollmentsTable.learnerId}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.id),eq(verifiedEnrollmentsTable.academicYear,year.data),eq(verifiedEnrollmentsTable.status,"active")));
  const attendance=await db.select({status:schoolAttendanceTable.status}).from(schoolAttendanceTable).where(and(eq(schoolAttendanceTable.organizationId,org.id),gte(schoolAttendanceTable.day,year.data+"-01-01"),lt(schoolAttendanceTable.day,(year.data+1)+"-01-01")));
  const count=safeAggregate(enrolled.length),attendanceCount=safeAggregate(attendance.length);
  schools.push({id:org.id,name:org.name,learnerCount:count,attendanceRate:attendanceCount===null?null:Math.round(attendance.filter(x=>["present","late"].includes(x.status)).length/attendance.length*100),privacySuppressed:count===null});
 }
 res.setHeader("Cache-Control","private, no-store");
 res.json({year:year.data,authorization:"institution_membership_or_explicit_management_grant",minimumCohort:10,institutions:schools.length,schools,nationalVerified:false,officialDbEData:false});
});
export default router;