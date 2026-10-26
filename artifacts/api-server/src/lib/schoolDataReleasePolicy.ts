import type { CountryCode } from "./countryCompliancePolicy";

export type SchoolDataClearanceSnapshot = {
  countryCode: string | null | undefined;
  setupStatus: string | null | undefined;
  approvalCountry: string | null | undefined;
  approvalState: string | null | undefined;
  evidenceReference: string | null | undefined;
  transferState: string | null | undefined;
  transferAssessmentReference: string | null | undefined;
  botswanaLocalCopyReference: string | null | undefined;
  botswanaLocalCopyVerifiedAt: Date | null | undefined;
  approvedAt: Date | null | undefined;
  expiresAt: Date | null | undefined;
};
export type SchoolDataDecision = {allowed: boolean; reason:
  "approved"|"missing_country"|"not_submitted"|"missing_approval"|
  "country_mismatch"|"expired"|"missing_evidence"|"not_approved"|
  "transfer_unreviewed"|"botswana_local_copy_missing"};

/** Never use a client-supplied country or a UI flag for data release. */
export function assessSchoolDataRelease(
  current: SchoolDataClearanceSnapshot | null,
  now: Date = new Date()
): SchoolDataDecision {
  if (!current || (current.countryCode!=="ZA" && current.countryCode!=="BW"))
    return {allowed:false,reason:"missing_country"};
  if (current.setupStatus!=="submitted") return {allowed:false,reason:"not_submitted"};
  if (!current.approvalCountry) return {allowed:false,reason:"missing_approval"};
  if (current.approvalCountry!==current.countryCode)
    return {allowed:false,reason:"country_mismatch"};
  if (current.approvalState!=="approved")
    return {allowed:false,reason:"not_approved"};
  if (!current.evidenceReference?.trim())
    return {allowed:false,reason:"missing_evidence"};
  // Every school must have a documented determination of whether a transfer
  // occurs. A no-transfer assertion is not a substitute for verifying vendors.
  if (!current.transferAssessmentReference?.trim() ||
      (current.transferState!=="no_transfer" &&
       current.transferState!=="approved_transfer"))
    return {allowed:false,reason:"transfer_unreviewed"};
  if (current.countryCode==="BW" && current.transferState==="approved_transfer" &&
      (!current.botswanaLocalCopyReference?.trim() ||
       !(current.botswanaLocalCopyVerifiedAt instanceof Date) ||
       Number.isNaN(current.botswanaLocalCopyVerifiedAt.getTime()) ||
       current.botswanaLocalCopyVerifiedAt.getTime()>now.getTime()))
    return {allowed:false,reason:"botswana_local_copy_missing"};
  if (!(current.approvedAt instanceof Date) || Number.isNaN(current.approvedAt.getTime()) ||
      !(current.expiresAt instanceof Date) || Number.isNaN(current.expiresAt.getTime()) ||
      current.approvedAt.getTime()>now.getTime() ||
      current.expiresAt.getTime()<=now.getTime() ||
      current.expiresAt.getTime()<=current.approvedAt.getTime())
    return {allowed:false,reason:"expired"};
  return {allowed:true,reason:"approved"};
}

/** Only numeric org path parameters and explicit organizationId query selectors. */
export type ScopedRoute =
  | {kind:"scoped"; orgId:number}
  | {kind:"not_scoped"}
  | {kind:"invalid"}
  | {kind:"unscoped_sensitive"};

export function identifyCountryScopedSchoolRoute(
  path: string,
  queryOrgId: unknown,
): ScopedRoute {
  // Express 5 routes are case-insensitive and tolerate a trailing slash by
  // default. Classify the same canonical path Express can dispatch, otherwise
  // /INSTITUTION-RECORDS/ME bypasses the privacy gate completely.
  let routePath: string;
  try {
    routePath = decodeURIComponent(path).toLowerCase().replace(/\/+$/, "") || "/";
  } catch {
    return {kind:"invalid"};
  }
  // A percent sign after decoding indicates ambiguous/double-encoded routing.
  // Reject rather than interpreting a different school route from Express.
  if(routePath.includes("%")) return {kind:"invalid"};
  // Transfer records can reveal a learner and their origin school. A recipient
  // school's approval alone is not authority to expose origin-country data.
  // Keep incoming queues and decisions closed until both schools' clearances,
  // current transfer lawful basis and explicit source/recipient approval exist.
  if (/^\/organizations\/[^/]+\/transfers(?:\/|$)/.test(routePath))
    return {kind:"unscoped_sensitive"};
  if (routePath === "/dashboard" || routePath === "/development/overview")
    return {kind:"unscoped_sensitive"};
  const direct = /^\/organizations\/([^/]+)(?:\/|$)/.exec(routePath);
  if (direct) {
    // Only an institution's metadata may be configured without learner approval.
    if (/^\/organizations\/[^/]+\/setup\/?$/.test(routePath))
      return {kind:"not_scoped"};
    if (!/^[1-9][0-9]*$/.test(direct[1]) || !Number.isSafeInteger(Number(direct[1])))
      return {kind:"invalid"};
    return {kind:"scoped",orgId:Number(direct[1])};
  }
  if (/^\/(?:reports\/me|guardian\/reports\/[^/]+|guardian\/issued-reports\/[^/]+)$/.test(routePath)) {
    const val=typeof queryOrgId==="string"?queryOrgId:"";
    if (!/^[1-9][0-9]*$/.test(val)||!Number.isSafeInteger(Number(val)))
      return {kind:"invalid"};
    return {kind:"scoped",orgId:Number(val)};
  }
  // These personal records have no trustworthy institution selector. Until the
  // authorised per-school scoping design is implemented they must not be
  // released under the strict country pilot gate.
  if (/^\/(?:institution-records(?:\/|$)|guardian-relationships(?:\/|$)|learner-journey(?:\/|$)|native\/mobile\/parent(?:\/|$)|my-assignments\/?$|learner-passport(?:\/|$)|school\/attendance\/me\/?$|school-stages\/me\/?$|report-issuance\/(?:me\/?$|[1-9][0-9]*\/integrity\/?$)|guardian\/issued-reports(?:\/|$)|assignments(?:\/|$)|written-exams(?:\/|$)|quizzes(?:\/|$)|materials(?:\/|$)|storage(?:\/|$)|admissions\/applications(?:\/|$)|development-plans(?:\/|$)|education-command(?:\/|$)|potential(?:\/|$)|passport(?:\/|$)|career(?:\/|$)|opportunities(?:\/|$)|platform(?:\/|$))/.test(routePath))
    return {kind:"unscoped_sensitive"};
  return {kind:"not_scoped"};
}

export function isCountrySupported(value: string | null): value is CountryCode {
  return value==="ZA" || value==="BW";
}
