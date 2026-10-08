import { Router, type IRouter } from "express";
import { count,eq,desc } from "drizzle-orm";
import { db, organizationsTable,organizationMembersTable,managementUnitsTable,guardianRelationshipsTable,learnerJourneysTable,learnerMilestonesTable,platformAdminAuditTable } from "@workspace/db";
import { isPlatformSuperadmin,resolvePortal } from "../lib/portalAccess";
import { auditSuperadmin } from "../lib/platformAudit";
const router:IRouter=Router();
const cards={
 superadmin:[["Organisation registry","/organizations"],["Governance structures","/governance"],["Institution records","/institution-records"],["Academic operations","/academics"]],
 national_director:[["National oversight","/governance"],["Organisation registry","/organizations"]],
 provincial_director:[["Provincial governance","/governance"],["Institution oversight","/organizations"]],
 district_director:[["District schools","/organizations"],["District reporting structure","/governance"]],
 group_executive:[["School group overview","/organizations"],["Leadership governance","/governance"]],
 governing_body_chair:[["Governance and appointments","/governance"],["Institution overview","/organizations"]],
 headmaster:[["School governance","/governance"],["School operations","/organizations"],["Institution records","/institution-records"],["Academic overview","/academics"]],
 deputy_headmaster:[["School operations","/organizations"],["Governance delegation","/governance"],["Academic coordination","/academics"]],
 department_head:[["Department operations","/organizations"],["Subject delivery","/academics"],["Governance","/governance"]],
 grade_head:[["Grade coordination","/organizations"],["Grade academic oversight","/academics"],["Governance","/governance"]],
 administrator:[["Institution administration","/organizations"],["Governance","/governance"]],
 teacher:[["Teaching workspace","/organizations"],["Study materials","/materials"],["Written examinations","/written-exams"]],
 assessor:[["Assessment review","/organizations"],["Written examinations","/written-exams"]],
 learner:[["Study materials","/materials"],["Practice tests","/quizzes"],["My journey","/learner-journey"],["My potential","/potential"]],
 parent:[["Guardian relationships","/institution-records"]]
} as const;
router.get("/portal/me",async(req,res)=>{
 if(!req.isAuthenticated()){res.status(401).json({error:"Sign in required"});return}
 const current=await resolvePortal(req.user.id);
 res.setHeader("Cache-Control","private, no-store");
 let summary:Record<string,number>={};
 if(current.role==="superadmin"){
  const [orgs,members,units]=await Promise.all([
   db.select({total:count()}).from(organizationsTable),
   db.select({total:count()}).from(organizationMembersTable),
   db.select({total:count()}).from(managementUnitsTable)
  ]);
  summary={organisations:orgs[0]?.total??0,memberships:members[0]?.total??0,managementUnits:units[0]?.total??0};
 }else if(current.role==="learner"){
  const [journeys,milestones]=await Promise.all([
   db.select({total:count()}).from(learnerJourneysTable).where(eq(learnerJourneysTable.userId,req.user.id)),
   db.select({total:count()}).from(learnerMilestonesTable).where(eq(learnerMilestonesTable.userId,req.user.id))
  ]);
  summary={learningStages:journeys[0]?.total??0,milestones:milestones[0]?.total??0};
 }else if(current.role==="parent"){
  const [linked]=await db.select({total:count()}).from(guardianRelationshipsTable).where(eq(guardianRelationshipsTable.guardianId,req.user.id));
  summary={relationshipRequests:linked?.total??0};
 }
 res.json({role:current.role,organizationIds:current.organizationIds,scopes:current.scopes,summary,cards:cards[current.role].map(([label,href])=>({label,href}))});
});
router.get("/platform/overview",async(req,res)=>{
 if(!req.isAuthenticated()){res.status(401).json({error:"Sign in required"});return}
 if(!isPlatformSuperadmin(req.user.id)){res.status(403).json({error:"Platform superadmin required"});return}
 await auditSuperadmin(req.user.id,"platform_overview");
 const organizations=await db.select({id:organizationsTable.id,name:organizationsTable.name}).from(organizationsTable);
 res.setHeader("Cache-Control","private, no-store");
 res.json({organizations});
});
router.get("/platform/audit",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(!isPlatformSuperadmin(req.user.id)){res.sendStatus(403);return}
 const rows=await db.select({id:platformAdminAuditTable.id,action:platformAdminAuditTable.action,organizationId:platformAdminAuditTable.organizationId,createdAt:platformAdminAuditTable.createdAt}).from(platformAdminAuditTable).orderBy(desc(platformAdminAuditTable.createdAt)).limit(50);
 res.setHeader("Cache-Control","private, no-store");
 res.json(rows);
});
export default router;
