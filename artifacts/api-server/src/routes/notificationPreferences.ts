import {Router,type IRouter} from "express";
import {and,desc,eq,inArray} from "drizzle-orm";
import {z} from "zod/v4";
import {
 db,usersTable,organizationsTable,organizationMembersTable,
 guardianRelationshipsTable,guardianVerificationEventsTable,verifiedEnrollmentsTable,
 courseStaffAssignmentsTable,notificationPreferencesTable,notificationPreferenceEventsTable
} from "@workspace/db";
import {getSession,getSessionId} from "../lib/auth";
import {canConfirmEmailPreference,isPreferenceKindAllowed,type PreferenceKind,type PreferenceActor} from "../lib/preferenceConsentPolicy";

const router:IRouter=Router();
const kindSchema=z.enum(["guardian_review_requested","learner_support_updated"]);
const positive=z.coerce.number().int().positive();

/** Never derive school permission from a browser-supplied role or organization ID. */
async function availableSchools(userId:string) {
 const [members,relationships]=await Promise.all([
   db.select({organizationId:organizationMembersTable.organizationId,role:organizationMembersTable.role})
     .from(organizationMembersTable).where(and(
       eq(organizationMembersTable.userId,userId),
       inArray(organizationMembersTable.role,["teacher","assessor"])
     )).limit(101),
   db.select({id:guardianRelationshipsTable.id,learnerId:guardianRelationshipsTable.learnerId})
     .from(guardianRelationshipsTable).where(and(
       eq(guardianRelationshipsTable.guardianId,userId),
       eq(guardianRelationshipsTable.status,"verified")
     )).limit(101),
 ]);
 // Never grant from a truncated identity/guardian relationship collection.
 if(members.length>100 || relationships.length>100)throw Error("Notification scope inventory too large");
 const kinds=new Map<number,Set<PreferenceKind>>();
 const add=(orgId:number,kind:PreferenceKind)=>{const set=kinds.get(orgId)??new Set<PreferenceKind>();set.add(kind);kinds.set(orgId,set);};
 const staffOrgs=[...new Set(members.map(m=>m.organizationId))];
 if(staffOrgs.length) {
   const assignments=await db.select({organizationId:courseStaffAssignmentsTable.organizationId})
     .from(courseStaffAssignmentsTable)
     .where(and(eq(courseStaffAssignmentsTable.staffId,userId),
       inArray(courseStaffAssignmentsTable.organizationId,staffOrgs))).limit(501);
   if(assignments.length>500)throw Error("Educator assignment inventory too large");
   for(const a of assignments) add(a.organizationId,"learner_support_updated");
 }
 if(relationships.length) {
   const learners=[...new Set(relationships.map(r=>r.learnerId))];
   const enrollments=await db.select({organizationId:verifiedEnrollmentsTable.organizationId,learnerId:verifiedEnrollmentsTable.learnerId})
     .from(verifiedEnrollmentsTable).where(and(
       inArray(verifiedEnrollmentsTable.learnerId,learners),
       eq(verifiedEnrollmentsTable.status,"active")
     )).limit(501);
   if(enrollments.length>500)throw Error("Guardian school inventory too large");
   const orgIds=[...new Set(enrollments.map(e=>e.organizationId))];
   if(orgIds.length) {
     const decisions=await db.select({
       relationshipId:guardianVerificationEventsTable.relationshipId,
       organizationId:guardianVerificationEventsTable.organizationId,
       decision:guardianVerificationEventsTable.decision,
     }).from(guardianVerificationEventsTable).where(and(
       inArray(guardianVerificationEventsTable.relationshipId,relationships.map(r=>r.id)),
       inArray(guardianVerificationEventsTable.organizationId,orgIds),
     )).orderBy(desc(guardianVerificationEventsTable.createdAt),desc(guardianVerificationEventsTable.id)).limit(1001);
     if(decisions.length>1000)throw Error("Guardian review history too large");
     const latest=new Map<string,string>();
     for(const d of decisions) {
       const key=d.relationshipId+":"+d.organizationId;
       if(!latest.has(key))latest.set(key,d.decision);
     }
     for(const r of relationships)for(const e of enrollments){
       if(e.learnerId===r.learnerId&&latest.get(r.id+":"+e.organizationId)==="verified"){
         add(e.organizationId,"guardian_review_requested");
       }
     }
   }
 }
 return kinds;
}

router.get("/notifications/preferences",async(req,res)=>{
 res.setHeader("Cache-Control","private, no-store");
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(process.env.CABO_NOTIFICATION_PREFERENCES_ENABLED!=="true"){
   res.json({enabled:false,schools:[],optInAvailable:false});return;
 }
 const available=await availableSchools(req.user.id),ids=[...available.keys()];
 // Previous school consent remains revocable even after a child transfers or
 // a guardian/educator is no longer allowed to view that institution.
 const prefs=await db.select({
   organizationId:notificationPreferencesTable.organizationId,kind:notificationPreferencesTable.kind,
   optedIn:notificationPreferencesTable.optedIn,confirmedAt:notificationPreferencesTable.confirmedAt,
   revokedAt:notificationPreferencesTable.revokedAt,
 }).from(notificationPreferencesTable)
   .where(eq(notificationPreferencesTable.userId,req.user.id)).limit(501);
 if(prefs.length>500){res.sendStatus(503);return}
 const schools=ids.length?await db.select({id:organizationsTable.id,name:organizationsTable.name})
   .from(organizationsTable).where(inArray(organizationsTable.id,ids)).limit(101):[];
 if(schools.length>100){res.sendStatus(503);return}
 const values=new Map(prefs.map(p=>[p.organizationId+":"+p.kind,p]));
 const active=schools.map(s=>({
   id:s.id,name:s.name,
   choices:[...(available.get(s.id)??[])].map(kind=>{
     const current=values.get(s.id+":"+kind);
     return {kind,canEnable:true,
       enabled:!!current?.optedIn && !!current.confirmedAt && current.revokedAt===null};
   }),
 }));
 const former=new Map<number,Array<{kind:"guardian_review_requested"|"learner_support_updated";enabled:boolean;canEnable:boolean}>>();
 for(const p of prefs){
   if(!p.optedIn||!p.confirmedAt||p.revokedAt!==null)continue;
   if(p.kind!=="guardian_review_requested"&&p.kind!=="learner_support_updated")continue;
   if(available.get(p.organizationId)?.has(p.kind))continue;
   const choices=former.get(p.organizationId)??[];
   choices.push({kind:p.kind,enabled:true,canEnable:false});
   former.set(p.organizationId,choices);
 }
 res.json({
   enabled:true,
   optInAvailable:process.env.CABO_NOTIFICATION_PREFERENCES_OPT_IN_ENABLED==="true",
   schools:[...active,...[...former].map(([id,choices])=>({
     id,name:"Previously connected institution",choices,
   }))],
 });
});

/** Read own consent, opt out always; opt in needs verified OIDC email and recent MFA. */
router.patch("/notifications/preferences/:orgId/:kind",async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 if(process.env.CABO_NOTIFICATION_PREFERENCES_ENABLED!=="true"){res.sendStatus(404);return}
 const org=positive.safeParse(req.params.orgId),kind=kindSchema.safeParse(req.params.kind);
 const data=z.object({enabled:z.boolean(),acknowledged:z.boolean().optional()}).strict().safeParse(req.body);
 if(!org.success||!kind.success||!data.success){res.sendStatus(400);return}
 const userId=req.user.id;
 if(!data.data.enabled) {
   // A former guardian or educator can always withdraw an existing consent,
   // even if institution permissions have since been revoked.
   await db.transaction(async tx=>{
     const changed=await tx.update(notificationPreferencesTable).set({
       optedIn:false,confirmedAt:null,revokedAt:new Date(),updatedAt:new Date(),
     }).where(and(eq(notificationPreferencesTable.userId,userId),
       eq(notificationPreferencesTable.organizationId,org.data),
       eq(notificationPreferencesTable.kind,kind.data),
       eq(notificationPreferencesTable.optedIn,true)))
       .returning({userId:notificationPreferencesTable.userId});
     if(changed.length)await tx.insert(notificationPreferenceEventsTable).values({
       userId,organizationId:org.data,kind:kind.data,action:"opt_out",
     });
   });
   res.json({enabled:false});return;
 }
 if(process.env.CABO_NOTIFICATION_PREFERENCES_OPT_IN_ENABLED!=="true"){
   res.status(423).json({error:"Verified notification consent is not available yet"});return;
 }
 const scope=await availableSchools(userId);
 if(!scope.get(org.data)?.has(kind.data)){
   res.sendStatus(403);return;
 }
 const sessionId=getSessionId(req),session=sessionId?await getSession(sessionId):null;
 const [account]=await db.select({email:usersTable.email}).from(usersTable)
   .where(eq(usersTable.id,userId)).limit(1);
 const actor:PreferenceActor=kind.data==="guardian_review_requested"?"verified_guardian":"assigned_educator";
 if(!session||session.user.id!==userId||
    !canConfirmEmailPreference({
      accountEmail:account?.email??null,verifiedSessionEmail:session.verified_email,
      recentMfa:session.trusted_mfa,actor,kind:kind.data,acknowledge:data.data.acknowledged===true
    }) || !isPreferenceKindAllowed(actor,kind.data)) {
    res.status(403).json({error:"Recent verified sign-in and explicit consent are required"});return;
 }
 // Never allow child accounts to self-consent: only verified guardian or
 // assigned educator eligibility from authoritative institution records.
 await db.transaction(async tx=>{
   const now=new Date();
   await tx.insert(notificationPreferencesTable).values({
     userId,organizationId:org.data,kind:kind.data,
     optedIn:true,confirmedAt:now,revokedAt:null,updatedAt:now,
   }).onConflictDoUpdate({
     target:[notificationPreferencesTable.userId,
       notificationPreferencesTable.organizationId,notificationPreferencesTable.kind],
     set:{optedIn:true,confirmedAt:now,revokedAt:null,updatedAt:now},
   });
   await tx.insert(notificationPreferenceEventsTable).values({
     userId,organizationId:org.data,kind:kind.data,action:"opt_in",
   });
 });
 res.json({enabled:true});
});
export default router;
