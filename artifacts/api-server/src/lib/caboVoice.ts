/**
 * CABO Voice — warm SA/Botswana tutor persona with learner personalisation.
 *
 * Exports:
 *   CABO_VOICE          – the base persona string to prepend to every system prompt
 *   learnerVoice()      – builds a full system prompt: CABO_VOICE + task + personalisation
 *   learnerGreeting()   – short first-turn greeting for chat UIs
 *   learnerContextTerms() – {interests, goals} for RAG boosting
 *   preferencesPayload()  – serialisable preferences object for prompt payloads
 */

export type LearnerPersonalization = {
  goals: string[];
  interests: string[];
  preferredLanguage: string;
  explanationStyle: "step_by_step" | "examples_first" | "concise" | "practice_first" | "visual";
  learningPreferences: string[];
  displayName?: string | null;
  gradeLabel?: string | null;
} | null;

// ---------------------------------------------------------------------------
// Base persona
// ---------------------------------------------------------------------------

const PERSONA_STATEMENTS = [
  "You are CABO, a warm and encouraging academic tutor serving learners across South Africa and Botswana.",
  "You speak with energy and care, celebrating effort and progress, not just correct answers — use phrases like 'Sharp, you've got this!' and 'Eish, let's try that again together.'",
  "You ground explanations in local examples: township economies, Karoo geography, Kalahari ecosystems, public holidays, South African and Botswana history, and the everyday realities of learners in the region.",
  "You respect the learner's home language and may include a word or phrase in isiZulu, Setswana, Sesotho, isiXhosa, Afrikaans, Sepedi, siSwati, Tshivenda, Xitsonga, Kalanga, or Ndebele where it aids understanding, then continue in English.",
  "You follow the CAPS curriculum for South African learners and the BGCSE/IGCSE framework for Botswana learners, referencing local exam structures and mark schemes where relevant.",
  "You never share personally identifiable information about other learners, never produce adult content, never provide medical or legal advice, and always encourage learners in distress to contact a trusted adult or the Childline helpline on 116.",
  "You are factual, cite only the material you have been given, and clearly flag when a question is outside your knowledge.",
];

export const CABO_VOICE = PERSONA_STATEMENTS.join(" ");

// ---------------------------------------------------------------------------
// Explanation styles
// ---------------------------------------------------------------------------

const STYLE: Record<NonNullable<LearnerPersonalization>["explanationStyle"], string> = {
  step_by_step:
    "Break every explanation into clearly numbered steps. After each step, check for understanding with a brief prompt before moving on.",
  examples_first:
    "Lead with a concrete, locally-grounded example before introducing the concept or rule. Use at least two examples of increasing complexity.",
  concise:
    "Be direct and brief. Use short sentences, one key point per paragraph, and bold only the most critical terms.",
  practice_first:
    "Start with a practice question or mini-task before the explanation. Let the learner attempt it, then teach from their response.",
  visual:
    "Use ASCII diagrams, tables, or structured layouts to represent ideas spatially. Describe how elements relate to each other visually.",
};

// ---------------------------------------------------------------------------
// SA/BW language set (for validation and hints)
// ---------------------------------------------------------------------------

const SA_BW_LANGUAGES = new Set([
  "isizulu", "zulu",
  "setswana", "tswana",
  "sesotho", "sotho",
  "isixhosa", "xhosa",
  "afrikaans",
  "sepedi", "pedi", "northern sotho",
  "siswati", "swati", "swazi",
  "tshivenda", "venda",
  "xitsonga", "tsonga",
  "kalanga",
  "ndebele", "isindebele",
  "english",
]);

function isSaBwLanguage(lang: string): boolean {
  return SA_BW_LANGUAGES.has(lang.toLowerCase().trim());
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function languageInstruction(preferredLanguage: string): string {
  if (!preferredLanguage || !isSaBwLanguage(preferredLanguage)) return "";
  const lang = preferredLanguage.trim();
  if (lang.toLowerCase() === "english") return "";
  return `The learner's preferred home language is ${lang}. Where it aids understanding, include a brief phrase or key term in ${lang} and then continue in English.`;
}

function personalisationInstructions(p: NonNullable<LearnerPersonalization>): string {
  const parts: string[] = [];

  if (p.displayName?.trim()) {
    parts.push(`Address the learner by their name: ${p.displayName.trim()}.`);
  }

  if (p.gradeLabel?.trim()) {
    parts.push(`The learner is in ${p.gradeLabel.trim()}.`);
  }

  if (p.goals.length > 0) {
    parts.push(`The learner's academic goals include: ${p.goals.slice(0, 5).join(", ")}.`);
  }

  if (p.interests.length > 0) {
    parts.push(`The learner's interests include: ${p.interests.slice(0, 5).join(", ")}. Where natural, relate explanations to these interests.`);
  }

  const styleInstruction = STYLE[p.explanationStyle];
  if (styleInstruction) {
    parts.push(`Preferred explanation style: ${styleInstruction}`);
  }

  if (p.learningPreferences.length > 0) {
    parts.push(`Additional learning preferences: ${p.learningPreferences.slice(0, 3).join("; ")}.`);
  }

  const langInstruction = languageInstruction(p.preferredLanguage);
  if (langInstruction) parts.push(langInstruction);

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a complete system prompt: CABO persona + task instruction + learner personalisation.
 * Safe to call with personalization=null (returns persona + task only).
 */
export function learnerVoice(task: string, personalization: LearnerPersonalization): string {
  const sections = [CABO_VOICE, task];
  if (personalization) {
    const personalSection = personalisationInstructions(personalization);
    if (personalSection) sections.push(personalSection);
  }
  return sections.join(" ");
}

/**
 * Short greeting for the first turn of a chat session.
 * Returns a localised, name-aware opening line.
 */
export function learnerGreeting(personalization: LearnerPersonalization): string {
  if (!personalization) {
    return "Sawubona! I'm CABO, your study partner. What would you like to work on today?";
  }
  const name = personalization.displayName?.trim();
  const grade = personalization.gradeLabel?.trim();
  const namePart = name ? `, ${name}` : "";
  const gradePart = grade ? ` (${grade})` : "";
  return `Sawubona${namePart}! I'm CABO, your CABO study partner${gradePart}. What shall we tackle today?`;
}

/**
 * Returns the learner's interests and goals for use as RAG context terms.
 * Safe to call with null — returns empty arrays.
 */
export function learnerContextTerms(personalization: LearnerPersonalization): { interests: string[]; goals: string[] } {
  if (!personalization) return { interests: [], goals: [] };
  return {
    interests: personalization.interests.slice(0, 8),
    goals: personalization.goals.slice(0, 5),
  };
}

/**
 * Returns a serialisable preferences object to include in AI payload bodies.
 * Never includes null/undefined — safe to JSON.stringify.
 */
export function preferencesPayload(personalization: LearnerPersonalization): Record<string, unknown> | null {
  if (!personalization) return null;
  return {
    explanationStyle: personalization.explanationStyle,
    ...(personalization.preferredLanguage ? { preferredLanguage: personalization.preferredLanguage } : {}),
    ...(personalization.learningPreferences.length > 0 ? { learningPreferences: personalization.learningPreferences.slice(0, 3) } : {}),
  };
}
