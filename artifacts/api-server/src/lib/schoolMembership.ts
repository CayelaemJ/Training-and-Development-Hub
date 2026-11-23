import { and, desc, eq } from "drizzle-orm";
import {
  db, organizationMembersTable, managementRoleGrantsTable, institutionSetupTable,
  guardianRelationshipsTable, guardianVerificationEventsTable, verifiedEnrollmentsTable,
} from "@workspace/db";
import { isPlatformSuperadmin } from "./portalAccess";
import { regimeFor, type PrivacyRegime } from "./jurisdictionPolicy";
import type { MemberContext } from "./accountabilityPolicy";

/** Role and management grants of one account inside one school, read from the database. */
export async function memberContext(organizationId: number, userId: string): Promise<MemberContext> {
  const [member, grants] = await Promise.all([
    db.select({ role: organizationMembersTable.role }).from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.organizationId, organizationId), eq(organizationMembersTable.userId, userId))).limit(1),
    db.select({ role: managementRoleGrantsTable.role }).from(managementRoleGrantsTable)
      .where(and(eq(managementRoleGrantsTable.organizationId, organizationId), eq(managementRoleGrantsTable.userId, userId))).limit(20),
  ]);
  return { userId, orgRole: member[0]?.role ?? null, grants: grants.map(g => g.role), superadmin: isPlatformSuperadmin(userId) };
}

/** Whether the account is a school-verified guardian of a learner actively enrolled here. */
export async function isVerifiedGuardianAt(organizationId: number, guardianId: string, learnerId?: string): Promise<boolean> {
  const relationships = await db.select({ id: guardianRelationshipsTable.id, learnerId: guardianRelationshipsTable.learnerId })
    .from(guardianRelationshipsTable)
    .where(and(eq(guardianRelationshipsTable.guardianId, guardianId), eq(guardianRelationshipsTable.status, "verified"))).limit(30);
  for (const r of relationships) {
    if (learnerId && r.learnerId !== learnerId) continue;
    const [latest] = await db.select({ decision: guardianVerificationEventsTable.decision }).from(guardianVerificationEventsTable)
      .where(and(eq(guardianVerificationEventsTable.relationshipId, r.id), eq(guardianVerificationEventsTable.organizationId, organizationId)))
      .orderBy(desc(guardianVerificationEventsTable.createdAt), desc(guardianVerificationEventsTable.id)).limit(1);
    if (latest?.decision !== "verified") continue;
    const [enrolled] = await db.select({ id: verifiedEnrollmentsTable.id }).from(verifiedEnrollmentsTable)
      .where(and(eq(verifiedEnrollmentsTable.organizationId, organizationId), eq(verifiedEnrollmentsTable.learnerId, r.learnerId), eq(verifiedEnrollmentsTable.status, "active"))).limit(1);
    if (enrolled) return true;
  }
  return false;
}

/** The privacy regime that applies to one school, chosen from its recorded country. */
export async function regimeForOrganization(organizationId: number): Promise<PrivacyRegime> {
  const [setup] = await db.select({ countryCode: institutionSetupTable.countryCode }).from(institutionSetupTable)
    .where(eq(institutionSetupTable.organizationId, organizationId)).limit(1);
  return regimeFor(setup?.countryCode ?? null);
}
