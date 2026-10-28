import {Router,type IRouter} from "express";
import {and,eq,sql} from "drizzle-orm";
import {z} from "zod/v4";
import {db,schoolTimetableSlotsTable,organizationMembersTable,timetableSubstitutionEventsTable} from "@workspace/db";
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

router.patch("/organizations/:orgId/timetable/:slotId/substitution",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),slotId=id.safeParse(req.params.slotId);
 const body=z.object({replacementTeacherId:z.string().min(1),reason:z.string().trim().min(5).max(1000)}).safeParse(req.body);
 if(!org.success||!slotId.success||!body.success){res.status(400).json({error:"A replacement teacher and reason are required"});return}
 if(!["owner","admin"].includes(await membership(org.data,req.user.id)??"")){res.sendStatus(403);return}
 const [teacher]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org.data),eq(organizationMembersTable.userId,body.data.replacementTeacherId))).limit(1);
 if(!teacher||!["teacher","owner","admin"].includes(teacher.role)){res.status(409).json({error:"Replacement must be authorised school staff"});return}
 const result=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(17042, ${org.data})`);
  const [slot]=await tx.select().from(schoolTimetableSlotsTable).where(and(eq(schoolTimetableSlotsTable.organizationId,org.data),eq(schoolTimetableSlotsTable.id,slotId.data))).for("update").limit(1);
  if(!slot)return {error:"not_found"} as const;
  if(slot.status==="cancelled"||slot.teacherId===body.data.replacementTeacherId)return {error:"invalid_replacement"} as const;
  const sameDay=await tx.select().from(schoolTimetableSlotsTable).where(and(eq(schoolTimetableSlotsTable.organizationId,org.data),eq(schoolTimetableSlotsTable.academicYear,slot.academicYear),eq(schoolTimetableSlotsTable.day,slot.day)));
  const clashesFound=sameDay.filter(other=>other.id!==slot.id&&other.status!=="cancelled"&&clashes({...slot,teacherId:body.data.replacementTeacherId},other as TimetableSlot).includes("teacher"));
  if(clashesFound.length)return {error:"replacement_teacher_has_conflict"} as const;
  await tx.update(schoolTimetableSlotsTable).set({teacherId:body.data.replacementTeacherId}).where(eq(schoolTimetableSlotsTable.id,slot.id));
  await tx.insert(timetableSubstitutionEventsTable).values({slotId:slot.id,originalTeacherId:slot.teacherId,replacementTeacherId:body.data.replacementTeacherId,changedBy:req.user!.id,reason:body.data.reason});
  return {id:slot.id,replacementTeacherId:body.data.replacementTeacherId,status:slot.status} as const;
 });
 if("error" in result){res.status(result.error==="not_found"?404:409).json(result);return}
 res.json(result);
});
export default router;