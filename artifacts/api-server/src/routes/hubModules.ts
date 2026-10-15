import {Router,type IRouter} from "express";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,hubRecordsTable,organizationMembersTable,verifiedEnrollmentsTable,guardianRelationshipsTable} from "@workspace/db";
import {isPlatformSuperadmin} from "../lib/portalAccess";
import {hubKinds,canCreateHubRecord,mayViewHubRecord} from "../lib/hubPolicy";
const router:IRouter=Router();
const kind=z.enum(hubKinds),positive=z.coerce.number().int().positive();
function principal(req:any,res:any):string|null {if(!req.isAuthenticated()){res.status(401).json({error:"Sign in required"});return null}return req.user.id}
async function membership(org:number,user:string){
 if(isPlatformSuperadmin(user))return "owner";
 const [m]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);
 return m?.role??null;
}
async function allowRead(org:number,user:string){
 const role=await membership(org,user);
 if(role)return role;
 const [active]=await db.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org),eq(verifiedEnrollmentsTable.learnerId,user),eq(verifiedEnrollmentsTable.status,"active"))).limit(1);
 return active?"learner":null;
}
router.get("/hub/modules",async(req,res)=>{
 const user=principal(req,res);if(!user)return;
 res.json(hubKinds.map((id)=>({id,active:true,pilot:true})));
});
router.get("/organizations/:orgId/hub-records",async(req,res)=>{
 const user=principal(req,res);if(!user)return;
 const org=positive.safeParse(req.params.orgId),filter=kind.safeParse(req.query.kind);
 if(!org.success||!filter.success){res.status(400).json({error:"Valid institution and module required"});return}
 const role=await allowRead(org.data,user);if(!role){res.sendStatus(403);return}
 let rows=await db.select({id:hubRecordsTable.id,kind:hubRecordsTable.kind,title:hubRecordsTable.title,description:hubRecordsTable.description,startAt:hubRecordsTable.startAt,endAt:hubRecordsTable.endAt,subjectId:hubRecordsTable.subjectId,createdAt:hubRecordsTable.createdAt})
 .from(hubRecordsTable).where(and(eq(hubRecordsTable.organizationId,org.data),eq(hubRecordsTable.kind,filter.data))).orderBy(desc(hubRecordsTable.createdAt)).limit(100);
 rows=rows.filter(r=>mayViewHubRecord(role,filter.data,user,r.subjectId));
 res.setHeader("Cache-Control","private, no-store");
 res.json(rows);
});
router.post("/organizations/:orgId/hub-records",async(req,res)=>{
 const user=principal(req,res);if(!user)return;
 const org=positive.safeParse(req.params.orgId);
 const body=z.object({kind,title:z.string().trim().min(3).max(180),description:z.string().trim().max(5000).default(""),startAt:z.iso.datetime().optional(),endAt:z.iso.datetime().optional(),subjectId:z.string().min(1).optional()}).safeParse(req.body);
 if(!org.success||!body.success){res.status(400).json({error:"Invalid module record"});return}
 const role=await membership(org.data,user);
 if(!["owner","admin"].includes(role??"")){res.sendStatus(403);return}
 if(!canCreateHubRecord(role,body.data.kind,body.data.subjectId??null)){res.status(409).json({error:"The requested module requires individual record ownership or verified issuance controls"});return}
 if(body.data.subjectId){
  const [eligible]=await db.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.learnerId,body.data.subjectId))).limit(1);
  if(!eligible){res.status(409).json({error:"Person must have an institution enrolment before an individual record is created"});return}
 }
 const [r]=await db.insert(hubRecordsTable).values({organizationId:org.data,kind:body.data.kind,title:body.data.title,description:body.data.description,subjectId:body.data.subjectId??null,startAt:body.data.startAt?new Date(body.data.startAt):null,endAt:body.data.endAt?new Date(body.data.endAt):null,createdBy:user}).returning();
 res.status(201).json({id:r.id,kind:r.kind,title:r.title});
});
export default router;