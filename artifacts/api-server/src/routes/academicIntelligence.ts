import {Router,type IRouter} from "express";
import {and,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,organizationMembersTable,verifiedEnrollmentsTable,schoolStageProgressTable} from "@workspace/db";
import {gather} from "./reportCards";
import {isPlatformSuperadmin} from "../lib/portalAccess";
const router:IRouter=Router(),id=z.coerce.number().int().positive();
async function manager(org:number,user:string){if(isPlatformSuperadmin(user))return true;const [m]=await db.select({role:organizationMembersTable.role}).from(organizationMembersTable).where(and(eq(organizationMembersTable.organizationId,org),eq(organizationMembersTable.userId,user))).limit(1);return !!m&&["owner","admin"].includes(m.role)}
router.get("/organizations/:orgId/academic-intelligence",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const org=id.safeParse(req.params.orgId),year=z.coerce.number().int().min(2000).max(2200).safeParse(req.query.year);
 if(!org.success||!year.success){res.sendStatus(400);return}
 if(!await manager(org.data,req.user.id)){res.sendStatus(403);return}
 const enrolled=await db.select({learnerId:verifiedEnrollmentsTable.learnerId,grade:verifiedEnrollmentsTable.stage}).from(verifiedEnrollmentsTable).where(and(eq(verifiedEnrollmentsTable.organizationId,org.data),eq(verifiedEnrollmentsTable.academicYear,year.data),eq(verifiedEnrollmentsTable.status,"active"))).limit(400);
 const assessments=[] as {learnerId:string;grade:string;average:number|null;attendanceRate:number|null;subjectsAtRisk:string[];supportPlans:number}[];
 for(const learner of enrolled){
  const report=await gather(org.data,learner.learnerId,year.data);
  if(!report)continue;
  const support=await db.select({id:schoolStageProgressTable.id}).from(schoolStageProgressTable).where(and(eq(schoolStageProgressTable.organizationId,org.data),eq(schoolStageProgressTable.learnerId,learner.learnerId),eq(schoolStageProgressTable.academicYear,year.data)));
  assessments.push({learnerId:learner.learnerId,grade:learner.grade,average:report.average,attendanceRate:report.attendance.rate,subjectsAtRisk:report.subjects.filter(s=>s.percentage<50).map(s=>s.name),supportPlans:support.length});
 }
 res.setHeader("Cache-Control","private, no-store");
 res.json({year:year.data,analysisType:"educator_review_only",studentsReviewed:assessments.length,attentionNeeded:assessments.filter(x=>x.subjectsAtRisk.length>0||(x.attendanceRate!==null&&x.attendanceRate<80)).length,learners:assessments,notAutomatedPromotionDecision:true,thresholds:{subjectBelow:50,attendanceBelow:80}});
});
export default router;