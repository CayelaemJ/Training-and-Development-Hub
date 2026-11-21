const TOKEN = /[\p{L}\p{N}]{2,}/gu;
const STOP_WORDS = new Set("a an and are as at be by can did do for from how i in is it of on or that the this to was what when where which who why with you your explain about".split(" "));

export type RetrievedPassage = { text: string; score: number };

function terms(value: string): string[] {
  return (value.toLocaleLowerCase().match(TOKEN) ?? []).filter((term) => !STOP_WORDS.has(term));
}

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

/** Lightweight BM25 ranking runs locally and keeps prompts limited to four passages. */
export function retrieveMaterialPassages(
  text: string,
  query: string,
  options: { maxPassages?: number; maxContextChars?: number } = {},
): RetrievedPassage[] {
  const queryTerms = [...new Set(terms(query))];
  if (!queryTerms.length) return [];
  const passages = chunkMaterial(text);
  if (!passages.length) return [];

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
    return { text: passage, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);

  const maxPassages = Math.min(4, Math.max(1, options.maxPassages ?? 4));
  const maxContextChars = Math.min(4800, Math.max(400, options.maxContextChars ?? 4800));
  const selected: RetrievedPassage[] = [];
  let used = 0;
  for (const item of ranked) {
    const passage = item.text.slice(0, maxContextChars - used);
    if (!passage) break;
    // Skip overlapping near-duplicates returned for adjacent chunks.
    if (selected.some((existing) => existing.text.includes(passage.slice(0, Math.min(240, passage.length))))) continue;
    selected.push({ text: passage, score: item.score });
    used += passage.length;
    if (selected.length >= maxPassages || used >= maxContextChars) break;
  }
  return selected;
}

export function excerptSupportedByPassages(passages: string[], excerpt: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const quote = normalize(excerpt);
  return quote.length >= 20 && passages.some((passage) => normalize(passage).includes(quote));
}
