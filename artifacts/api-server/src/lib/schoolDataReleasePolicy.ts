import type { CountryCode } from "./countryCompliancePolicy";

export type SchoolDataClearanceSnapshot = {
  countryCode: string | null | undefined;
  setupStatus: string | null | undefined;
  approvalCountry: string | null | undefined;
  approvalState: string | null | undefined;
  evidenceReference: string | null | undefined;
  approvedAt: Date | null | undefined;
  expiresAt: Date | null | undefined;
};
export type SchoolDataDecision = {allowed: boolean; reason:
  "approved"|"missing_country"|"not_submitted"|"missing_approval"|
  "country_mismatch"|"expired"|"missing_evidence"|"not_approved"};

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
  const direct = /^\/organizations\/([^/]+)(?:\/|$)/.exec(path);
  if (direct) {
    // Only an institution's metadata may be configured without learner approval.
    if (/^\/organizations\/[^/]+\/setup\/?$/.test(path))
      return {kind:"not_scoped"};
    if (!/^[1-9][0-9]*$/.test(direct[1]) || !Number.isSafeInteger(Number(direct[1])))
      return {kind:"invalid"};
    return {kind:"scoped",orgId:Number(direct[1])};
  }
  if (/^\/(?:reports\/me|guardian\/reports\/[^/]+)$/.test(path)) {
    const val=typeof queryOrgId==="string"?queryOrgId:"";
    if (!/^[1-9][0-9]*$/.test(val)||!Number.isSafeInteger(Number(val)))
      return {kind:"invalid"};
    return {kind:"scoped",orgId:Number(val)};
  }
  // These personal records have no trustworthy institution selector. Until the
  // authorised per-school scoping design is implemented they must not be
  // released under the strict country pilot gate.
  if (/^\/(?:institution-records(?:\/|$)|guardian-relationships(?:\/|$)|learner-journey(?:\/|$)|native\/mobile\/parent(?:\/|$))/.test(path))
    return {kind:"unscoped_sensitive"};
  return {kind:"not_scoped"};
}

export function isCountrySupported(value: string | null): value is CountryCode {
  return value==="ZA" || value==="BW";
}
