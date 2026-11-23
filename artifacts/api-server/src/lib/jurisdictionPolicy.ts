/**
 * Data-protection regime selection for South Africa (POPIA) and Botswana
 * (Data Protection Act 18 of 2024).
 *
 * The regime is chosen automatically from the INSTITUTION's recorded country
 * (institution_setup.country_code), because the school is the responsible party
 * whose obligations apply to its learners. A device time zone may *suggest* a
 * country when a school has not yet recorded one, but a suggestion never
 * relaxes protection: until a country is recorded, the strictest combination
 * of both regimes applies.
 *
 * Every rule carries its legal basis and whether it is a statutory figure or
 * an internal CABO target. This is a working control register, NOT legal
 * advice; see docs/legal/ZA_BW_COMPLIANCE_APPLICABILITY_MATRIX_2026-10-26.md.
 */
import type { CountryCode } from "./countryCompliancePolicy";

export type RegimeCode = CountryCode | "UNSET";

export type Rule<T> = {
  value: T;
  basis: string;
  /** statutory: stated in the Act; internal: CABO's own target where the Act sets no number. */
  kind: "statutory" | "internal";
};

export type PrivacyRegime = {
  code: RegimeCode;
  country: string;
  law: string;
  regulator: { name: string; url: string };
  /** Anyone younger than this is a child. */
  childUnderAge: Rule<number>;
  /** Age from which a child may consent alone to an online service offered directly to them; null = never alone. */
  childSelfConsentAge: Rule<number | null>;
  /** Hours from awareness of a qualifying breach to notifying the regulator. */
  breachRegulatorHours: Rule<number>;
  /** Days to answer a data-subject request (access, correction, deletion). */
  subjectRequestDays: Rule<number>;
  /** Whether a transfer out of the country needs a retained local copy (counsel to confirm scope). */
  localCopyOnTransfer: Rule<boolean>;
  /** Default days that class chat messages are kept before deletion. */
  chatRetentionDays: Rule<number>;
  /** Rights the institution must be able to honour. */
  rights: readonly string[];
};

const SOURCE_MATRIX = "docs/legal/ZA_BW_COMPLIANCE_APPLICABILITY_MATRIX_2026-10-26.md";

export const REGIMES: Readonly<Record<CountryCode, PrivacyRegime>> = {
  ZA: {
    code: "ZA",
    country: "South Africa",
    law: "Protection of Personal Information Act 4 of 2013 (POPIA)",
    regulator: { name: "Information Regulator (South Africa)", url: "https://inforegulator.org.za/" },
    childUnderAge: { value: 18, basis: "POPIA s 1 (definition of child); Children's Act 38 of 2005", kind: "statutory" },
    childSelfConsentAge: { value: null, basis: "POPIA ss 34-35: a competent person consents for a child", kind: "statutory" },
    breachRegulatorHours: { value: 72, basis: "POPIA s 22 requires notice 'as soon as reasonably possible'; 72 hours is CABO's internal ceiling", kind: "internal" },
    subjectRequestDays: { value: 30, basis: "PAIA request period of 30 days used as CABO's target for POPIA s 23 access", kind: "internal" },
    localCopyOnTransfer: { value: false, basis: "POPIA s 72 governs transfers; no local-copy rule", kind: "statutory" },
    chatRetentionDays: { value: 365, basis: "POPIA s 14 (retain no longer than necessary); one school year is CABO's default", kind: "internal" },
    rights: ["access", "correction", "deletion", "objection", "complaint to the Information Regulator"],
  },
  BW: {
    code: "BW",
    country: "Botswana",
    law: "Data Protection Act 18 of 2024 (in force 14 January 2025)",
    // Official Commission website not yet verified; link the Act text instead.
    regulator: { name: "Information and Data Protection Commission (Botswana)", url: "https://botswanalaws.com/consolidated-statutes/principle-legislation/data-protection" },
    childUnderAge: { value: 18, basis: "DPA 2024 adopts the Children's Act 2009 definition", kind: "statutory" },
    childSelfConsentAge: { value: 16, basis: "DPA 2024 s 29: a child of 16 may consent for information-society services", kind: "statutory" },
    breachRegulatorHours: { value: 72, basis: "DPA 2024: notify the Commission where feasible within 72 hours of awareness", kind: "statutory" },
    subjectRequestDays: { value: 30, basis: "CABO target pending counsel's reading of DPA 2024 Part VIII", kind: "internal" },
    localCopyOnTransfer: { value: true, basis: "DPA 2024 s 74 (scope to be confirmed by Botswana counsel)", kind: "statutory" },
    chatRetentionDays: { value: 365, basis: "DPA 2024 storage limitation; one school year is CABO's default", kind: "internal" },
    rights: ["access", "rectification", "erasure", "restriction", "portability", "objection to automated decisions", "complaint to the Commission"],
  },
};

function stricter<T>(a: Rule<T>, b: Rule<T>, pick: (x: T, y: T) => T): Rule<T> {
  const value = pick(a.value, b.value);
  return { value, basis: `Strictest of South Africa and Botswana until the school records its country (${SOURCE_MATRIX})`, kind: a.kind === "statutory" || b.kind === "statutory" ? "statutory" : "internal" };
}

/** Applies while a school has no recorded country: never weaker than either regime. */
export const UNSET_REGIME: PrivacyRegime = {
  code: "UNSET",
  country: "Not yet recorded",
  law: "POPIA and Botswana DPA 2024 (strictest of both applies until the school records its country)",
  regulator: { name: "Depends on the school's country", url: "" },
  childUnderAge: stricter(REGIMES.ZA.childUnderAge, REGIMES.BW.childUnderAge, Math.max),
  // A guardian always consents while the country is unknown.
  childSelfConsentAge: stricter(REGIMES.ZA.childSelfConsentAge, REGIMES.BW.childSelfConsentAge, () => null),
  breachRegulatorHours: stricter(REGIMES.ZA.breachRegulatorHours, REGIMES.BW.breachRegulatorHours, Math.min),
  subjectRequestDays: stricter(REGIMES.ZA.subjectRequestDays, REGIMES.BW.subjectRequestDays, Math.min),
  localCopyOnTransfer: stricter(REGIMES.ZA.localCopyOnTransfer, REGIMES.BW.localCopyOnTransfer, (x, y) => x || y),
  chatRetentionDays: stricter(REGIMES.ZA.chatRetentionDays, REGIMES.BW.chatRetentionDays, Math.min),
  rights: [...new Set([...REGIMES.ZA.rights, ...REGIMES.BW.rights])],
};

export function regimeFor(countryCode: string | null | undefined): PrivacyRegime {
  return countryCode === "ZA" || countryCode === "BW" ? REGIMES[countryCode] : UNSET_REGIME;
}

/** IANA zones that identify each country; anything else gives no suggestion. */
const ZONES: Readonly<Record<string, CountryCode>> = {
  "Africa/Johannesburg": "ZA",
  "Africa/Gaborone": "BW",
};

/**
 * Suggest a country from a client-reported IANA time zone. Used only to
 * pre-fill a school's setup form or explain which rules will apply; it is
 * never used to choose rules for learner data.
 */
export function suggestCountry(timeZone: unknown): CountryCode | null {
  if (typeof timeZone !== "string" || timeZone.length > 64) return null;
  return ZONES[timeZone] ?? null;
}

/** Deadline from a starting instant, in hours. */
export function addHours(start: Date, hours: number): Date {
  return new Date(start.getTime() + hours * 3_600_000);
}

/**
 * Whether a child may consent alone under this regime. Returns false when the
 * age is unknown: without a verified age, a guardian consents.
 */
export function childMayConsentAlone(regime: PrivacyRegime, age: number | null): boolean {
  if (age === null || !Number.isFinite(age)) return false;
  if (age >= regime.childUnderAge.value) return true;
  const self = regime.childSelfConsentAge.value;
  return self !== null && age >= self;
}

/** Public, display-safe summary of a regime. */
export function describeRegime(regime: PrivacyRegime) {
  return {
    code: regime.code,
    country: regime.country,
    law: regime.law,
    regulator: regime.regulator,
    rules: {
      childUnderAge: regime.childUnderAge,
      childSelfConsentAge: regime.childSelfConsentAge,
      breachRegulatorHours: regime.breachRegulatorHours,
      subjectRequestDays: regime.subjectRequestDays,
      localCopyOnTransfer: regime.localCopyOnTransfer,
      chatRetentionDays: regime.chatRetentionDays,
    },
    rights: regime.rights,
    notLegalAdvice: "CABO's working register of the rules that apply. Not legal advice or certification.",
  };
}
