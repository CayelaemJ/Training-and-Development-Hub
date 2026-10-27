/** Privacy-first admission and transfer rules. Pure functions: no document bytes or PII. */
export type Country = "ZA" | "BW";
export type StudyStage = "preprimary" | "primary" | "secondary" | "college" | "undergraduate" | "postgraduate" | "adult_training";
export type PaymentClearance = "settled" | "waived" | "not_required" | "pending" | "unverified";
export type EvidenceDecision = "cleared" | "not_required" | "pending" | "rejected";
export type GuardianProof = {
  legallyVerified: boolean;
  active: boolean;
  purposeSpecificConsent: boolean;
  consentExpiresAt: Date | null;
};
export type HandoffSignals = {
  stage: StudyStage;
  adultStatus: "verified_adult" | "verified_minor" | "unknown";
  country: Country;
  institutionApprovedForIntake: boolean;
  institutionCountryCleared: boolean;
  receivingInstitutionAuthorized: boolean;
  applicantDisclosureApproved: boolean;
  guardian: GuardianProof | null;
  requiredDocuments: EvidenceDecision;
  qualificationAuthenticity: EvidenceDecision;
  fees: PaymentClearance;
};
export type HandoffOutcome = { code: 0 | 1; status: "blocked" | "ready_for_handoff"; blockers: string[] };
const schoolStages: readonly StudyStage[] = ["preprimary", "primary", "secondary"];
export function guardianRequired(stage: StudyStage, adultStatus: HandoffSignals["adultStatus"]): boolean {
  return schoolStages.includes(stage) || adultStatus === "verified_minor";
}
export function assessAdmissionHandoff(s: HandoffSignals, now: Date = new Date()): HandoffOutcome {
  const blockers: string[] = [];
  if (!s.institutionApprovedForIntake || !s.receivingInstitutionAuthorized) blockers.push("institution_not_authorized");
  if (!s.institutionCountryCleared) blockers.push("country_release_not_cleared");
  if (!s.applicantDisclosureApproved) blockers.push("applicant_disclosure_not_approved");
  if (s.adultStatus === "unknown" && !schoolStages.includes(s.stage)) blockers.push("age_or_capacity_not_verified");
  if (guardianRequired(s.stage, s.adultStatus)) {
    if (!s.guardian?.legallyVerified || !s.guardian.active || !s.guardian.purposeSpecificConsent ||
       !(s.guardian.consentExpiresAt instanceof Date) ||
       !Number.isFinite(s.guardian.consentExpiresAt.getTime()) ||
       s.guardian.consentExpiresAt.getTime() <= now.getTime()) {
      blockers.push("verified_guardian_and_current_consent_required");
    }
  }
  if (!["cleared", "not_required"].includes(s.requiredDocuments)) blockers.push("document_review_incomplete");
  if (!["cleared", "not_required"].includes(s.qualificationAuthenticity)) blockers.push("qualification_review_incomplete");
  if (!["settled", "waived", "not_required"].includes(s.fees)) blockers.push("fee_clearance_incomplete");
  return { code: blockers.length ? 0 : 1, status: blockers.length ? "blocked" : "ready_for_handoff", blockers };
}
/** Only release to an authorised institution; a 1 means gates passed, NOT admission or official identity validation. */
export function minimalAdmissionReceipt(outcome: HandoffOutcome): { verified: 0 | 1 } {
  return { verified: outcome.code };
}
export type EvidenceDispositionInput = {
  verificationFinal: boolean;
  requiredForOpenReview: boolean;
  applicableRetentionOrLegalHold: boolean;
  institutionHasAcceptedNecessaryRecords: boolean;
};
export function canPurgeTemporaryEvidence(s: EvidenceDispositionInput): boolean {
  return s.verificationFinal && !s.requiredForOpenReview && !s.applicableRetentionOrLegalHold && s.institutionHasAcceptedNecessaryRecords;
}
export type TransferSignals = {
  sourceAuthorized: boolean;
  destinationAuthorized: boolean;
  learnerOrVerifiedGuardianConsented: boolean;
  purposeLimitedScopeApproved: boolean;
  countryTransferCleared: boolean;
  officialTranscriptValidated: boolean;
  unresolvedDisputeOrHold: boolean;
};
export function assessAcademicTransfer(s: TransferSignals): { readyForHumanReview: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!s.sourceAuthorized || !s.destinationAuthorized) blockers.push("institution_authority_missing");
  if (!s.learnerOrVerifiedGuardianConsented) blockers.push("learner_or_guardian_consent_missing");
  if (!s.purposeLimitedScopeApproved) blockers.push("disclosure_scope_missing");
  if (!s.countryTransferCleared) blockers.push("cross_border_or_country_clearance_missing");
  if (!s.officialTranscriptValidated) blockers.push("official_transcript_not_verified");
  if (s.unresolvedDisputeOrHold) blockers.push("record_dispute_or_hold");
  return { readyForHumanReview: blockers.length === 0, blockers };
}
export type CatalogueModule = {
  code: string;
  credits: number;
  prerequisiteCodes: readonly string[];
  majorCode: string | null;
};
/** Guidance only: credits and prerequisite rules MUST come from an institution-approved catalogue. */
export function planModules(s: {
  catalogueConfirmed: boolean;
  modules: readonly CatalogueModule[];
  selectedCodes: readonly string[];
  completedCodes: readonly string[];
  creditLimit: number;
  doubleMajorRequested: boolean;
  doubleMajorApprovedByAdvisor: boolean;
}): { advisoryOnly: true; eligibleForSubmission: false; credits: number; missingPrerequisites: string[]; issues: string[] } {
  const issues: string[] = [];
  const catalogue = new Map(s.modules.map(m => [m.code, m]));
  const chosen = new Set(s.selectedCodes);
  const completed = new Set(s.completedCodes);
  if (!s.catalogueConfirmed) issues.push("catalogue_not_institution_confirmed");
  if (chosen.size !== s.selectedCodes.length) issues.push("duplicate_selection");
  if (!Number.isFinite(s.creditLimit) || s.creditLimit <= 0) issues.push("invalid_credit_limit");
  const missingPrerequisites: string[] = [];
  let credits = 0;
  for (const code of chosen) {
    const module = catalogue.get(code);
    if (!module) { issues.push("unknown_module"); continue; }
    if (!Number.isSafeInteger(module.credits) || module.credits <= 0) { issues.push("invalid_catalogue_credits"); continue; }
    credits += module.credits;
    for (const prereq of module.prerequisiteCodes) if (!completed.has(prereq)) missingPrerequisites.push(code + ":" + prereq);
  }
  if (credits > s.creditLimit) issues.push("credit_limit_exceeded");
  if (s.doubleMajorRequested && !s.doubleMajorApprovedByAdvisor) issues.push("double_major_advisor_approval_required");
  if (missingPrerequisites.length) issues.push("prerequisites_unmet");
  return { advisoryOnly: true, eligibleForSubmission: false, credits, missingPrerequisites, issues: [...new Set(issues)] };
}
