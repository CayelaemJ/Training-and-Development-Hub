const TOKEN = /[\p{L}\p{N}]{2,}/gu;
const STOP_WORDS = new Set("a an and are as at be by can did do for from how i in is it of on or that the this to was what when where which who why with you your explain about".split(" "));

export type RetrievedPassage = { text: string; score: number };

/** Learner context used for interest-aware passage boosting (optional). */
export type LearnerRetrievalContext = {
  /** Short interest labels from the learner's AI profile (e.g. "soccer", "music"). */
  interests?: string[];
  /** Short goal phrases (e.g. "pass matric", "become an engineer"). */
  goals?: string[];
  /** Penalty factor applied to passages whose readability is well above the query complexity.
   *  Range 0–1; 0 = never penalise, 1 = fully penalise long-word-heavy passages. */
  complexityPenalty?: number;
} | null;

/**
 * Light, language-neutral stemming so "factorising", "factorise" and
 * "factorised" match, and British/American spellings meet. Deliberately
 * conservative: only common English endings on words of five letters or more.
 */
export function stem(term: string): string {
  let t = term.replace(/is(e|ed|es|ing|ation)$/, "iz$1");
  if (t.length < 5) return t;
  for (const [suffix, keep] of [["izations", ""], ["ization", ""], ["izing", ""], ["ized", ""], ["izes", ""], ["ize", ""],
    ["ations", ""], ["ation", ""], ["ingly", ""], ["ing", ""], ["edly", ""], ["ies", "y"], ["ied", "y"], ["ed", ""], ["es", ""], ["s", ""]] as const) {
    if (t.endsWith(suffix) && t.length - suffix.length >= 3) { t = t.slice(0, t.length - suffix.length) + keep; break; }
  }
  return t;
}

function terms(value: string): string[] {
  return (value.toLocaleLowerCase().match(TOKEN) ?? []).filter((term) => !STOP_WORDS.has(term)).map(stem);
}

/** Questions that ask about the whole material rather than one topic. */
const BROAD = /\b(?:summar(?:y|ise|ize)|overview|main (?:points|ideas)|key (?:points|ideas)|what is this (?:about|material)|outline|revise|revision)\b/i;

/** Split into bounded passages with a small overlap to preserve sentence context. */
export function chunkMaterial(text: string, chunkSize = 1200, overlap = 160): string[] {
  if (chunkSize < 200 || overlap < 0 || overlap >= chunkSize) throw new RangeError("Invalid passage sizing");
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);
      if (boundary > start + Math.floor(chunkSize / 2)) end = boundary;
    }
    const passage = text.slice(start, end).trim();
    if (passage) chunks.push(passage);
    if (end >= text.length) break;
    let nextStart = Math.max(start + 1, end - overlap);
    const nextBoundary = text.indexOf(" ", nextStart);
    if (nextBoundary >= 0 && nextBoundary < end) nextStart = nextBoundary + 1;
    start = nextStart;
  }
  return chunks;
}

/**
 * Build an expanded query by mixing the original query with learner context
 * terms so that passages touching those interests score higher.
 * Interest terms are down-weighted (×0.4) so they refine rather than replace
 * the topic match.
 */
function expandQueryWithContext(query: string, context: LearnerRetrievalContext): { queryTerms: string[]; interestTerms: string[] } {
  const queryTerms = [...new Set(terms(query))];
  if (!context) return { queryTerms, interestTerms: [] };
  const rawContext = [
    ...(context.interests ?? []),
    ...(context.goals ?? []),
  ].join(" ");
  const interestTerms = [...new Set(terms(rawContext))].filter((t) => !queryTerms.includes(t));
  return { queryTerms, interestTerms };
}

/** Lightweight BM25 ranking runs locally and keeps prompts limited to four passages. */
export function retrieveMaterialPassages(
  text: string,
  query: string,
  options: { maxPassages?: number; maxContextChars?: number } = {},
): RetrievedPassage[] {
  return retrieveMaterialPassagesForLearner(text, query, null, options);
}

/**
 * Interest-aware BM25 retrieval.
 *
 * Works identically to `retrieveMaterialPassages` when `context` is null, but
 * when learner interests and goals are present they are used to give a small
 * additive boost to passages whose language overlaps those terms.  This keeps
 * curriculum-relevant passages first while surfacing ones that connect to the
 * learner's world.
 *
 * The boost is capped at 20 % of the base BM25 score so that a highly
 * interest-relevant but off-topic passage cannot displace a genuinely
 * curriculum-relevant one.
 */
export function retrieveMaterialPassagesForLearner(
  text: string,
  query: string,
  context: LearnerRetrievalContext,
  options: { maxPassages?: number; maxContextChars?: number } = {},
): RetrievedPassage[] {
  const passages = chunkMaterial(text);
  if (!passages.length) return [];
  const maxPassages = Math.min(4, Math.max(1, options.maxPassages ?? 4));
  const maxContextChars = Math.min(4800, Math.max(400, options.maxContextChars ?? 4800));
  const { queryTerms, interestTerms } = expandQueryWithContext(query, context ?? null);
  // A request for a summary has no topic words to match: give the model
  // passages spread evenly through the material instead of nothing.
  if (!queryTerms.length || BROAD.test(query)) {
    if (!BROAD.test(query)) return [];
    const step = Math.max(1, Math.floor(passages.length / maxPassages));
    const spread: RetrievedPassage[] = [];
    let used = 0;
    for (let i = 0; i < passages.length && spread.length < maxPassages; i += step) {
      const limit = Math.max(0, Math.floor(maxContextChars / maxPassages));
      let passage = passages[i].slice(0, limit);
      if (passage.length < passages[i].length) passage = passage.slice(0, Math.max(0, passage.lastIndexOf(" "))) || passage;
      if (!passage) break;
      spread.push({ text: passage, score: 0 });
      used += passage.length;
      if (used >= maxContextChars) break;
    }
    return spread;
  }

  const tokenized = passages.map(terms);
  const documentFrequency = new Map<string, number>();
  for (const passageTerms of tokenized) {
    for (const term of new Set(passageTerms)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const averageLength = tokenized.reduce((sum, row) => sum + row.length, 0) / tokenized.length || 1;
  const ranked = passages.map((passage, index) => {
    const row = tokenized[index];
    const frequencies = new Map<string, number>();
    for (const term of row) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    let score = 0;
    for (const term of queryTerms) {
      const frequency = frequencies.get(term) ?? 0;
      if (!frequency) continue;
      const df = documentFrequency.get(term) ?? 0;
      const inverseFrequency = Math.log(1 + (passages.length - df + 0.5) / (df + 0.5));
      score += inverseFrequency * (frequency * 2.2) / (frequency + 1.2 * (0.25 + 0.75 * row.length / averageLength));
    }
    // Interest-aware boost: add up to 20 % of the base score for passages that
    // overlap the learner's interests and goals.  Capped so topic relevance
    // always dominates.
    if (interestTerms.length && score > 0) {
      let interestScore = 0;
      for (const term of interestTerms) {
        const frequency = frequencies.get(term) ?? 0;
        if (!frequency) continue;
        const df = documentFrequency.get(term) ?? 0;
        const inverseFrequency = Math.log(1 + (passages.length - df + 0.5) / (df + 0.5));
        interestScore += inverseFrequency * (frequency * 1.5) / (frequency + 1.2 * (0.25 + 0.75 * row.length / averageLength));
      }
      // Normalise to a 0–0.2 fraction of base score so it only breaks ties.
      const maxInterestBoost = score * 0.2;
      const normaliser = interestTerms.length * Math.log(1 + passages.length * 0.5) || 1;
      score += Math.min(maxInterestBoost, (interestScore / normaliser) * maxInterestBoost);
    }
    return { text: passage, score, index };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);

  const selected: (RetrievedPassage & { index: number })[] = [];
  let used = 0;
  for (const item of ranked) {
    let passage = item.text.slice(0, maxContextChars - used);
    if (!passage) break;
    // Never end a passage mid-word: a cut word cannot be quoted back exactly.
    if (passage.length < item.text.length) passage = passage.slice(0, Math.max(0, passage.lastIndexOf(" "))) || passage;
    if (selected.some((existing) => existing.index === item.index)) continue;
    selected.push({ text: passage, score: item.score, index: item.index });
    used += passage.length;
    if (selected.length >= maxPassages || used >= maxContextChars) break;
  }
  // Present the chosen passages in reading order; the model follows the
  // material's own sequence better than a relevance-sorted jumble.
  return selected.sort((a, b) => a.index - b.index).map(({ text, score }) => ({ text, score }));
}

/** Compare text the way a reader would: case, spacing, quote marks and dashes do not matter. */
export function normalizeForQuote(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u2018\u2019\u201a\u201b\u2032`]/g, "'").replace(/[\u201c\u201d\u201e\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\u2026/g, "...")
    .replace(/\s+/g, " ").trim();
}

/**
 * A citation is supported when it appears in one passage. Models often shorten
 * a quote with an ellipsis; then every part of at least 12 characters must
 * appear, in order, in the same passage. Trailing punctuation is ignored.
 */
export function excerptSupportedByPassages(passages: string[], excerpt: string): boolean {
  const quote = normalizeForQuote(excerpt).replace(/^["'\s]+|["'.,;:!?\s]+$/g, "");
  if (quote.length < 20) return false;
  const parts = quote.split(/\s*\.\.\.\s*|\s*\[\u2026?\.{0,3}\]\s*/).map(p => p.trim()).filter(Boolean);
  if (parts.some(p => p.length < 12)) return false;
  return passages.some((raw) => {
    const passage = normalizeForQuote(raw);
    let from = 0;
    for (const part of parts) {
      const at = passage.indexOf(part, from);
      if (at < 0) return false;
      from = at + part.length;
    }
    return true;
  });
}
