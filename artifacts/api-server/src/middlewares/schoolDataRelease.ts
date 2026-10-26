import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, institutionSetupTable, institutionDataClearancesTable } from "@workspace/db";
import {
  assessSchoolDataRelease, identifyCountryScopedSchoolRoute
} from "../lib/schoolDataReleasePolicy";

/**
 * Country data release requires a school-specific approval in PostgreSQL.
 * Not a legal certification. Mounted AFTER authentication and request throttling.
 *
 * Hard default denial is intentional. This must not be merged/deployed until
 * staging migrations, per-school approvals and all legacy route regressions
 * are reviewed. A school can still edit /organizations/:id/setup to be classified.
 */
export async function schoolDataReleaseMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS") { next(); return; }
  const route = identifyCountryScopedSchoolRoute(req.path, req.query.organizationId);
  if (route.kind === "not_scoped") { next(); return; }
  // Never query the country of an institution for an unauthenticated caller.
  if (!req.isAuthenticated()) {
    res.status(401).json({error:"Sign in required"}); return;
  }
  res.setHeader("Cache-Control","private, no-store");
  if (route.kind === "invalid") {
    res.status(400).json({error:"Invalid institution identifier"}); return;
  }
  if (route.kind === "unscoped_sensitive") {
    res.status(409).json({error:"Country-specific learner record scoping is not yet enabled for this feature"}); return;
  }
  try {
    const [record] = await db.select({
      countryCode: institutionSetupTable.countryCode,
      setupStatus: institutionSetupTable.status,
      approvalCountry: institutionDataClearancesTable.countryCode,
      approvalState: institutionDataClearancesTable.state,
      evidenceReference: institutionDataClearancesTable.evidenceReference,
      transferState: institutionDataClearancesTable.transferState,
      transferAssessmentReference: institutionDataClearancesTable.transferAssessmentReference,
      botswanaLocalCopyReference: institutionDataClearancesTable.botswanaLocalCopyReference,
      botswanaLocalCopyVerifiedAt: institutionDataClearancesTable.botswanaLocalCopyVerifiedAt,
      approvedAt: institutionDataClearancesTable.approvedAt,
      expiresAt: institutionDataClearancesTable.expiresAt,
    }).from(institutionSetupTable)
      .leftJoin(institutionDataClearancesTable,
        eq(institutionDataClearancesTable.organizationId,institutionSetupTable.organizationId))
      .where(eq(institutionSetupTable.organizationId,route.orgId)).limit(1);
    const decision = assessSchoolDataRelease(record ?? null);
    if (!decision.allowed) {
      // Do not disclose evidence identifiers or whether an organisation exists.
      res.status(409).json({error:"Institution data processing is pending a jurisdiction-specific review"}); return;
    }
    next();
  } catch {
    // Schema mismatch, unavailable DB, or query failure must not expose learner data.
    res.status(503).json({error:"School data release verification is unavailable"}); return;
  }
}
