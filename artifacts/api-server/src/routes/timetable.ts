import {Router,type IRouter} from "express";
import {and,eq,sql} from "drizzle-orm";
import {z} from "zod/v4";
import {db,schoolTimetableSlotsTable,organizationMembersTable} from "@workspace/db";
import {clashes,validSlot,type TimetableSlot} from "../lib/timetablePolicy";
import {isPlatformSuperadmin} from "../lib/portalAccess";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
const input=z.object({academicYear:z.number().int().min(2000).max(2200),day:z.number().int().min(1).max(7),startsAt:z.string().length(5),endsAt:z.string().length(5),grade:z.string().min(1).max(16),group:z.string().min(1).max(40),subject:z.string().min(2).max(100),room:z.string().min(1).max(80),teacherId:z.string().min(1),status:z.enum(["draft","published"]).default("draft")});
async function membership(org:number,user:string){if(isPlatformSuperadmin(user))return "owner";const [x]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);return x?.role??null}
router.get("/organizations/:orgId/timetable",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),year=z.coerce.number().int().min(2000).max(2200).safeParse(req.query.year);
 if(!org.success||!year.success){res.sendStatus(400);return}
 const role=await membership(org.data,req.user.id);if(!role){res.sendStatus(403);return}
 const rows=await db.select().from(schoolTimetableSlotsTable).where(and(eq(schoolTimetableSlotsTable.organizationId,org.data),eq(schoolTimetableSlotsTable.academicYear,year.data)));
 res.setHeader("Cache-Control","private, no-store");
 res.json(["owner","admin"].includes(role)?rows:rows.filter(r=>r.status==="published"&&(role==="teacher"?r.teacherId===req.user.id:role==="learner")));
});
router.post("/organizations/:orgId/timetable",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),body=input.safeParse(req.body);
 if(!org.success||!body.success){res.sendStatus(400);return}
 if(!["owner","admin"].includes(await membership(org.data,req.user.id)??"")){res.sendStatus(403);return}
 if(!validSlot(body.data)){res.status(400).json({error:"Invalid start/end time"});return}
 const [staff]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org.data),eq(organizationMembersTable.userId,body.data.teacherId))).limit(1);
 if(!staff||!["teacher","admin","owner"].includes(staff.role)){res.status(409).json({error:"Teacher must be authorised at the school"});return}
 const result=await db.transaction(async tx=>{
  // Lock the organisation row to serialize timetable writes for one school.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(17042, ${org.data})`);
  const existing=await tx.select().from(schoolTimetableSlotsTable).where(and(eq(schoolTimetableSlotsTable.organizationId,org.data),eq(schoolTimetableSlotsTable.academicYear,body.data.academicYear),eq(schoolTimetableSlotsTable.day,body.data.day)));
  const collisions=existing.filter(s=>s.status!=="cancelled"&&clashes(body.data,s as TimetableSlot).length>0).map(s=>({id:s.id,conflicts:clashes(body.data,s as TimetableSlot)}));
  if(collisions.length)return {conflicts:collisions} as const;
  const [created]=await tx.insert(schoolTimetableSlotsTable).values({...body.data,organizationId:org.data,createdBy:req.user!.id}).returning();
  return {slot:created} as const;
 });
 if("conflicts" in result){res.status(409).json({error:"Teacher/room/class timetable conflict",conflicts:result.conflicts});return}
 res.status(201).json(result.slot);
});
export default router;