import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db, organizationMembersTable, usersTable, managementUnitsTable, managementRoleGrantsTable } from "@workspace/db";
import { roleNames, leadershipRanks, descendantIds, mayDelegate, type HierarchyRole } from "../lib/hierarchyPolicy";

const router:IRouter=Router();
const positive=z.coerce.number().int().positive();
const unitTypes=["national","province","district","group","school","department","grade","class"] as const;
function user(req:Request,res:Response){
 if(!req.isAuthenticated()){res.status(401).json({error:"Sign in required"});return null}
 return req.user!.id;
}
async function context(orgId:number,userId:string){
 const [member]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable)
  .where(and(eq(organizationMembersTable.organizationId,orgId),eq(organizationMembersTable.userId,userId))).limit(1);
 if(!member)return null;
 const units=await db.select().from(managementUnitsTable).where(eq(managementUnitsTable.organizationId,orgId));
 const grants=await db.select().from(managementRoleGrantsTable).where(eq(managementRoleGrantsTable.organizationId,orgId));
 const owned=member.role==="owner";
 // Legacy owner is bootstrap authority for their own organisation only, not a cross-tenant superuser.
 const myGrants=grants.filter(g=>g.userId===userId);
 const visible=new Set<number>();
 if(owned)units.forEach(unit=>visible.add(unit.id));
 else for(const g of myGrants){
  const descendants=descendantIds(units,g.unitId);
  // Teachers, assessors and school support staff see their own assigned unit, not subordinate organisational data.
  if(leadershipRanks[g.role as HierarchyRole]>=35)descendants.forEach(id=>visible.add(id));
  else visible.add(g.unitId);
 }
 return {member,units,grants,myGrants,visible,owned};
}
function bestAuthority(ctx:NonNullable<Awaited<ReturnType<typeof context>>>,target:number){
 if(ctx.owned)return 101;
 return ctx.myGrants.filter(g=>descendantIds(ctx.units,g.unitId).has(target))
  .reduce((rank,g)=>Math.max(rank,leadershipRanks[g.role as HierarchyRole]??0),0);
}
router.get("/organizations/:orgId/hierarchy",async(req,res)=>{
 const actor=user(req,res);if(!actor)return;
 const org=positive.safeParse(req.params.orgId);if(!org.success){res.sendStatus(400);return}
 const ctx=await context(org.data,actor);if(!ctx){res.sendStatus(403);return}
 // Learner and parent memberships only get their own identity and no organisation tree.
 const viewableUnits=ctx.units.filter(u=>ctx.visible.has(u.id));
 const grants=ctx.grants.filter(g=>ctx.visible.has(g.unitId)&&(
  ctx.owned||bestAuthority(ctx,g.unitId)>=(leadershipRanks[g.role as HierarchyRole]??0)
 ));
 res.setHeader("Cache-Control","no-store");
 res.json({role:ctx.member.role,owner:ctx.owned,units:viewableUnits,grants:grants.map(g=>({id:g.id,unitId:g.unitId,userId:g.userId,role:g.role})),mine:ctx.myGrants.map(g=>({unitId:g.unitId,role:g.role})),canManage:ctx.owned||ctx.myGrants.some(g=>leadershipRanks[g.role as HierarchyRole]>=40)});
});
router.post("/organizations/:orgId/hierarchy/units",async(req,res)=>{
 const actor=user(req,res);if(!actor)return;
 const org=positive.safeParse(req.params.orgId),payload=z.object({
  name:z.string().trim().min(2).max(160),
  type:z.enum(unitTypes),
  parentId:z.number().int().positive().nullable()
 }).safeParse(req.body);
 if(!org.success||!payload.success){res.status(400).json({error:"Invalid organisational unit"});return}
 const ctx=await context(org.data,actor);if(!ctx){res.sendStatus(403);return}
 if(payload.data.parentId===null){
  if(!ctx.owned||ctx.units.some(u=>u.parentId===null)){res.status(403).json({error:"Only the owner can create the single organisation root"});return}
 }else{
  const parent=ctx.units.find(u=>u.id===payload.data.parentId);
  if(!parent){res.sendStatus(404);return}
  if(bestAuthority(ctx,parent.id)<40){res.sendStatus(403);return}
  const level={national:0,province:1,district:2,group:3,school:4,department:5,grade:6,class:7};
  if(level[payload.data.type]<=level[parent.type as keyof typeof level]){res.status(400).json({error:"Child must be below its parent level"});return}
 }
 const [item]=await db.insert(managementUnitsTable).values({organizationId:org.data,...payload.data,createdBy:actor}).returning();
 res.status(201).json(item);
});
router.post("/organizations/:orgId/hierarchy/grants",async(req,res)=>{
 const actor=user(req,res);if(!actor)return;
 const org=positive.safeParse(req.params.orgId),payload=z.object({
  unitId:z.number().int().positive(),email:z.email(),role:z.enum(roleNames as [HierarchyRole,...HierarchyRole[]])
 }).safeParse(req.body);
 if(!org.success||!payload.success){res.sendStatus(400);return}
 const ctx=await context(org.data,actor);if(!ctx){res.sendStatus(403);return}
 const unit=ctx.units.find(u=>u.id===payload.data.unitId);if(!unit){res.sendStatus(404);return}
 const actorRank=bestAuthority(ctx,unit.id);
 if(!ctx.owned&&!ctx.myGrants.some(g=>descendantIds(ctx.units,g.unitId).has(unit.id)&&mayDelegate(g.role as HierarchyRole,payload.data.role))){res.sendStatus(403);return}
 if(!ctx.owned&&actorRank<=leadershipRanks[payload.data.role]){res.sendStatus(403);return}
 if(["parent","learner"].includes(payload.data.role)){res.status(400).json({error:"Learner and parent relationships use separate, consent-aware workflows"});return}
 const [person]=await db.select({id:usersTable.id}).from(usersTable).where(eq(usersTable.email,payload.data.email)).limit(1);
 if(!person){res.status(404).json({error:"The account must be registered first"});return}
 const [membership]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable)
  .where(and(eq(organizationMembersTable.organizationId,org.data),eq(organizationMembersTable.userId,person.id))).limit(1);
 if(!membership){res.status(409).json({error:"Add the user as an organisation member before assigning responsibility"});return}
 const [existing]=await db.select({id:managementRoleGrantsTable.id}).from(managementRoleGrantsTable)
  .where(and(eq(managementRoleGrantsTable.unitId,unit.id),eq(managementRoleGrantsTable.userId,person.id),eq(managementRoleGrantsTable.role,payload.data.role))).limit(1);
 if(existing){res.status(409).json({error:"That assignment already exists"});return}
 const [grant]=await db.insert(managementRoleGrantsTable).values({organizationId:org.data,unitId:unit.id,userId:person.id,role:payload.data.role,grantedBy:actor}).returning();
 res.status(201).json({id:grant.id,unitId:grant.unitId,role:grant.role,userId:grant.userId});
});
router.delete("/organizations/:orgId/hierarchy/grants/:grantId",async(req,res)=>{
 const actor=user(req,res);if(!actor)return;
 const org=positive.safeParse(req.params.orgId),gid=positive.safeParse(req.params.grantId);
 if(!org.success||!gid.success){res.sendStatus(400);return}
 const ctx=await context(org.data,actor);if(!ctx){res.sendStatus(403);return}
 const target=ctx.grants.find(g=>g.id===gid.data);
 if(!target){res.sendStatus(404);return}
 const rank=leadershipRanks[target.role as HierarchyRole]??0;
 if(!ctx.owned&&bestAuthority(ctx,target.unitId)<=rank){res.sendStatus(403);return}
 await db.delete(managementRoleGrantsTable).where(and(eq(managementRoleGrantsTable.id,gid.data),eq(managementRoleGrantsTable.organizationId,org.data)));
 res.sendStatus(204);
});
export default router;
