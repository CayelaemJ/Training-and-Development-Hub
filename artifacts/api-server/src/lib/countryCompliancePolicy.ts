/**
 * Two-country institution setup classification and explicit review gates.
 * Passing these attestations NEVER means production child-data processing is legal.
 * Real learner onboarding must remain blocked at deployment/product level until
 * all processing paths, residency, vendor contracts and institutional authority
 * are independently validated.
 */
export type CountryCode = "ZA" | "BW";
export type SchoolSetupStatus = "draft" | "submitted";
export type SchoolSetupDecision = {
  allowed: boolean;
  missing: readonly string[];
  legalCertification: false;
};
export const COUNTRIES: Readonly<Record<CountryCode, {name: string; law: string}>> = {
  ZA: { name: "South Africa", law: "Protection of Personal Information Act 4 of 2013 (POPIA)" },
  BW: { name: "Botswana", law: "Data Protection Act 18 of 2024 (in force 14 January 2025)" }
};
const SETUP_ATTESTATIONS: Readonly<Record<CountryCode, readonly string[]>> = {
  ZA: [
    "CABO_ZA_INSTITUTION_AUTHORITY_REVIEWED",
    "CABO_ZA_CHILD_DATA_LAWFUL_BASIS_REVIEWED",
    "CABO_ZA_CROSS_BORDER_TRANSFERS_REVIEWED",
  ],
  BW: [
    "CABO_BW_INSTITUTION_AUTHORITY_REVIEWED",
    "CABO_BW_CHILD_DATA_LAWFUL_BASIS_REVIEWED",
    "CABO_BW_CROSS_BORDER_TRANSFERS_REVIEWED",
    "CABO_BW_LOCAL_TRANSFER_COPY_VERIFIED",
  ]
};

/** An absent country can be stored as a legacy draft, but cannot be submitted. */
export function assessInstitutionProfileSubmission(
  countryCode: CountryCode | null,
  status: SchoolSetupStatus,
  env: Readonly<Record<string, string | undefined>>
): SchoolSetupDecision {
  if (status === "draft") return {allowed:true,missing:[],legalCertification:false};
  if (countryCode === null) return {allowed:false,missing:["COUNTRY_CLASSIFICATION_REQUIRED"],legalCertification:false};
  const missing = SETUP_ATTESTATIONS[countryCode].filter(key => env[key] !== "true");
  return {allowed:missing.length===0,missing,legalCertification:false};
}

/** Country changes for an existing classified school need an authorised migration plan. */
export function countryChangeNeedsReview(
  previous: CountryCode | null,
  next: CountryCode | null
): boolean {
  return previous !== null && next !== previous;
}
