/**
 * Interest-aware BM25 retrieval for learner Q&A.
 *
 * Retrieves the most relevant passages from a material source document,
 * with a capped interest-boost so topical relevance always dominates.
 */

// ---------------------------------------------------------------------------
// Tokenisation helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","up","about","into","through","during","is","are","was",
  "were","be","been","being","have","has","had","do","does","did","will",
  "would","could","should","may","might","shall","can","need","dare",
  "ought","used","it","its","i","we","you","he","she","they","this","that",
  "these","those","not","no","nor","so","yet","both","either","neither",
  "each","few","more","most","other","some","such","only","own","same",
  "than","too","very","just","if","then","else","when","where","how",
  "what","which","who","whom","why","all","any","s","t","re","ve","ll",
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// ---------------------------------------------------------------------------
// BM25 (Okapi BM25) scoring
// ---------------------------------------------------------------------------

const BM25_K1 = 1.5;
const BM25_B = 0.75;

function computeIdf(
  term: string,
  docTokenSets: string[][],
  N: number,
): number {
  const df = docTokenSets.filter((tokens) => tokens.includes(term)).length;
  if (df === 0) return 0;
  return Math.log((N - df + 0.5) / (df + 0.5) + 1);
}

function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDocLen: number,
  idfMap: Map<string, number>,
): number {
  const docLen = docTokens.length;
  const freq: Map<string, number> = new Map();
  for (const t of docTokens) freq.set(t, (freq.get(t) ?? 0) + 1);

  let score = 0;
  for (const qt of queryTokens) {
    const idf = idfMap.get(qt) ?? 0;
    if (idf === 0) continue;
    const tf = freq.get(qt) ?? 0;
    const numerator = tf * (BM25_K1 + 1);
    const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgDocLen));
    score += idf * (numerator / denominator);
  }
  return score;
}

// ---------------------------------------------------------------------------
// Passage splitting
// ---------------------------------------------------------------------------

const PARAGRAPH_SPLIT = /\n{2,}/;
const MAX_CHUNK_CHARS = 600;
const MIN_CHUNK_CHARS = 60;

function splitIntoPassages(text: string): string[] {
  const rawParas = text.split(PARAGRAPH_SPLIT).map((p) => p.trim()).filter(Boolean);
  const passages: string[] = [];
  for (const para of rawParas) {
    if (para.length <= MAX_CHUNK_CHARS) {
      if (para.length >= MIN_CHUNK_CHARS) passages.push(para);
      continue;
    }
    // Split long paragraph into sentences
    const sentences = para.split(/(?<=[.?!])\s+/);
    let chunk = "";
    for (const sentence of sentences) {
      if (chunk.length + sentence.length > MAX_CHUNK_CHARS && chunk.length >= MIN_CHUNK_CHARS) {
        passages.push(chunk.trim());
        chunk = "";
      }
      chunk += (chunk ? " " : "") + sentence;
    }
    if (chunk.trim().length >= MIN_CHUNK_CHARS) passages.push(chunk.trim());
  }
  return passages;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RetrievedPassage {
  text: string;
  score: number;
  index: number;
}

export interface RetrievalContext {
  interests: string[];
  goals: string[];
}

export interface RetrievalOptions {
  /** Maximum number of passages to return. Default 4. */
  maxPassages?: number;
  /** Maximum total characters across all returned passages. Default 4200. */
  maxContextChars?: number;
}

// ---------------------------------------------------------------------------
// Query expansion
// ---------------------------------------------------------------------------

/**
 * Expands the learner's raw question with their interest / goal keywords.
 * Deduplicates tokens and always puts the original query tokens first.
 */
export function expandQueryWithContext(
  query: string,
  context: RetrievalContext | null | undefined,
): string {
  const base = tokenise(query);
  if (!context) return base.join(" ");

  const extras = [...(context.interests ?? []), ...(context.goals ?? [])]
    .flatMap((phrase) => tokenise(phrase))
    .filter((t) => !base.includes(t));

  const unique = [...base, ...extras];
  return unique.join(" ");
}

// ---------------------------------------------------------------------------
// Citation validation
// ---------------------------------------------------------------------------

/**
 * Returns true if `excerpt` appears verbatim (or with ellipsis) in at least
 * one of the retrieved passages.
 */
export function excerptSupportedByPassages(
  passageTexts: string[],
  excerpt: string,
): boolean {
  if (!excerpt?.trim()) return false;
  const normalise = (s: string) =>
    s.replace(/\s+/g, " ").trim().toLowerCase();

  const normExcerpt = normalise(excerpt);

  // Direct match
  if (passageTexts.some((p) => normalise(p).includes(normExcerpt))) return true;

  // Ellipsis match: split on "..." and check each part
  const parts = normExcerpt
    .split(/\.{3,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 10);

  if (parts.length > 1) {
    return parts.every((part) =>
      passageTexts.some((p) => normalise(p).includes(part)),
    );
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main retrieval functions
// ---------------------------------------------------------------------------

/**
 * Basic passage retrieval without interest boosting.
 * Convenience wrapper — identical to `retrieveMaterialPassagesForLearner` with no context.
 */
export function retrieveMaterialPassages(
  source: string,
  query: string,
  options: RetrievalOptions = {},
): RetrievedPassage[] {
  return retrieveMaterialPassagesForLearner(source, query, null, options);
}

/**
 * Retrieves the most relevant passages from `source` for `query`,
 * boosted by learner interests (capped at 20% of base score).
 */
export function retrieveMaterialPassagesForLearner(
  source: string,
  query: string,
  context: RetrievalContext | null | undefined,
  options: RetrievalOptions = {},
): RetrievedPassage[] {
  const { maxPassages = 4, maxContextChars = 4200 } = options;

  if (!source?.trim() || !query?.trim()) return [];

  const passages = splitIntoPassages(source);
  if (passages.length === 0) return [];

  // Tokenise all passages up front
  const allTokenSets = passages.map(tokenise);
  const N = passages.length;
  const avgDocLen =
    allTokenSets.reduce((sum, t) => sum + t.length, 0) / N || 1;

  // Build IDF maps
  const queryTokens = tokenise(query);
  const queryIdf: Map<string, number> = new Map();
  for (const qt of queryTokens) {
    queryIdf.set(qt, computeIdf(qt, allTokenSets, N));
  }

  // Context IDF map (interests + goals)
  const contextTerms = [
    ...(context?.interests ?? []),
    ...(context?.goals ?? []),
  ].flatMap((phrase) => tokenise(phrase));

  const contextIdf: Map<string, number> = new Map();
  for (const ct of contextTerms) {
    if (!contextIdf.has(ct)) {
      contextIdf.set(ct, computeIdf(ct, allTokenSets, N));
    }
  }

  // Score each passage
  const scored = passages.map((text, i) => {
    const baseScore = bm25Score(queryTokens, allTokenSets[i], avgDocLen, queryIdf);

    let boostedScore = baseScore;
    if (contextTerms.length > 0 && baseScore > 0) {
      const contextScore = bm25Score(
        contextTerms,
        allTokenSets[i],
        avgDocLen,
        contextIdf,
      );
      // Cap interest boost at 20% of the base score so topic relevance dominates
      const boost = Math.min(contextScore, baseScore * 0.2);
      boostedScore = baseScore + boost;
    }

    return { text, score: boostedScore, index: i };
  });

  // Sort descending
  scored.sort((a, b) => b.score - a.score);

  // Apply limits
  const results: RetrievedPassage[] = [];
  let charCount = 0;
  for (const passage of scored) {
    if (passage.score <= 0) break;
    if (results.length >= maxPassages) break;
    if (charCount + passage.text.length > maxContextChars) break;
    results.push(passage);
    charCount += passage.text.length;
  }

  // Return in original document order for coherence
  results.sort((a, b) => a.index - b.index);
  return results;
}
