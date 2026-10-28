import {Router,type IRouter} from "express";
import {and,desc,eq} from "drizzle-orm";
import {z} from "zod/v4";
import {db,admissionApplicationsTable,admissionProgrammesTable,admissionInstitutionsTable,issuedSchoolReportsTable} from "@workspace/db";
import {canExportAdmissionEvidence,limitedEvidenceRecord} from "../lib/admissionEvidencePolicy";
const router:IRouter=Router();
router.get("/admissions/applications/:applicationId/evidence-export",async(req,res)=>{
 if(!req.isAuthenticated()){res.sendStatus(401);return}
 const id=z.coerce.number().int().positive().safeParse(req.params.applicationId);if(!id.success){res.sendStatus(400);return}
 const [application]=await db.select().from(admissionApplicationsTable).where(eq(admissionApplicationsTable.id,id.data)).limit(1);
 if(!application||!canExportAdmissionEvidence(application.candidateId,req.user.id,application.status,application.disclosureApprovedAt)){res.sendStatus(403);return}
 const [programme]=await db.select().from(admissionProgrammesTable).where(eq(admissionProgrammesTable.id,application.programmeId)).limit(1);
 const [institution]=programme?await db.select().from(admissionInstitutionsTable).where(eq(admissionInstitutionsTable.id,programme.institutionId)).limit(1):[];
 const records=await db.select({academicYear:issuedSchoolReportsTable.academicYear,contentHash:issuedSchoolReportsTable.contentHash,snapshot:issuedSchoolReportsTable.snapshot}).from(issuedSchoolReportsTable).where(and(eq(issuedSchoolReportsTable.learnerId,req.user.id),eq(issuedSchoolReportsTable.status,"issued"))).orderBy(desc(issuedSchoolReportsTable.academicYear)).limit(20);
 res.setHeader("Cache-Control","private, no-store");
 res.setHeader("Content-Disposition",`attachment; filename="cabo-application-${application.id}-evidence.json"`);
 res.json({format:"cabo.application-evidence.v1",applicationId:application.id,programme:programme?.name??null,institution:institution?.name??null,universitySubmission:false,sourceAuthentication:"candidate-session",issuerSignaturesVerified:false,academicEvidence:records.map(limitedEvidenceRecord),warning:"Student-controlled export only. No university has received or verified this bundle. SHA-256 fingerprints alone are not cryptographic signatures."});
});
export default router;