const finiteRatio = (n, d) => d === 0 ? null : n / d;

/** Evaluate retrieval results against a small, synthetic, human-curated benchmark.
 * Tenant mismatches are treated as critical failures, never merely quality penalties.
 * No prompts, learner records, or retrieved text are returned in metrics.
 */
export function evaluateRetrieval(cases, options = {}) {
  const k = options.k ?? 5;
  if (!Array.isArray(cases) || !Number.isInteger(k) || k < 1 || k > 100) throw new Error("Invalid evaluation input");
  let relevantFound = 0, relevantTotal = 0, reciprocalRank = 0, duplicates = 0, retrievedTotal = 0, leakage = 0, cited = 0, citationEligible = 0;
  for (const sample of cases) {
    if (!sample || typeof sample.tenantId !== "string" || !Array.isArray(sample.expectedDocIds) || !Array.isArray(sample.retrieved)) throw new Error("Malformed evaluation case");
    if (sample.expectedDocIds.some(x => typeof x !== "string") || sample.retrieved.some(x => !x || typeof x.docId !== "string" || typeof x.tenantId !== "string" || (x.cited !== undefined && typeof x.cited !== "boolean"))) throw new Error("Malformed evaluation document");
    const expected = new Set(sample.expectedDocIds);
    const results = sample.retrieved.slice(0, k);
    const ids = new Set();
    const relevantIds = new Set();
    let firstRelevant = -1;
    for (let i = 0; i < results.length; i++) {
      const item = results[i]; retrievedTotal++;
      if (item.tenantId !== sample.tenantId) leakage++;
      if (ids.has(item.docId)) duplicates++; else ids.add(item.docId);
      if (expected.has(item.docId)) {
        if (!relevantIds.has(item.docId)) { relevantIds.add(item.docId); relevantFound++; }
        if (firstRelevant < 0) firstRelevant = i;
      }
      if (item.cited !== undefined) { citationEligible++; if (item.cited) cited++; }
    }
    relevantTotal += expected.size;
    if (firstRelevant >= 0) reciprocalRank += 1 / (firstRelevant + 1);
  }
  const count = cases.length;
  const metrics = {
    caseCount: count,
    recallAtK: finiteRatio(relevantFound, relevantTotal),
    meanReciprocalRankAtK: finiteRatio(reciprocalRank, count),
    duplicateRate: finiteRatio(duplicates, retrievedTotal),
    tenantLeakageCount: leakage,
    citationCoverage: finiteRatio(cited, citationEligible),
    retrievedDocumentCount: retrievedTotal,
  };
  const minimumRecall = options.minimumRecall ?? 0.8;
  const maximumDuplicateRate = options.maximumDuplicateRate ?? 0.1;
  if (![minimumRecall, maximumDuplicateRate].every(Number.isFinite) || minimumRecall < 0 || minimumRecall > 1 || maximumDuplicateRate < 0 || maximumDuplicateRate > 1) throw new Error("Invalid evaluation thresholds");
  const reasons = [];
  if (!count) reasons.push("No evaluation cases");
  if (metrics.recallAtK === null || metrics.recallAtK < minimumRecall) reasons.push("Recall threshold not met");
  if (metrics.duplicateRate !== null && metrics.duplicateRate > maximumDuplicateRate) reasons.push("Duplicate retrieval threshold exceeded");
  if (leakage) reasons.push("Tenant isolation violation");
  return { metrics, passed: reasons.length === 0, reasons };
}
