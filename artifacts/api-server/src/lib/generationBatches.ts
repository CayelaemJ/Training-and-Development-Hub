const CONTEXT_SEPARATOR = "\n\n[Next section]\n\n";

/**
 * Select a bounded, document-wide context for generation. Preserve paragraph
 * boundaries where possible, and sample evenly so long documents are not
 * represented only by their opening pages. This is deliberately local: no
 * embedding service, vector store, or extra per-upload cost is required.
 */
export function sourceWindow(text: string, max = 6000): string {
  if (text.length <= max) return text;
  if (max <= 0) return "";

  const separatorSize = CONTEXT_SEPARATOR.length;
  const windows = Math.max(1, Math.floor((max + separatorSize) / (500 + separatorSize)));
  const budget = Math.max(1, Math.floor((max - (windows - 1) * separatorSize) / windows));
  const ranges: Array<{ start: number; end: number }> = [];
  const paragraphBreaks = [...text.matchAll(/\n{2,}/g)].map((match) => match.index! + match[0].length);

  for (let i = 0; i < windows; i++) {
    const center = windows === 1 ? Math.floor(text.length / 2) : Math.floor((i * (text.length - 1)) / (windows - 1));
    const targetStart = i === 0 ? 0 : i === windows - 1
      ? text.length - budget
      : Math.max(0, Math.min(text.length - budget, center - Math.floor(budget / 2)));
    const nearestStart = paragraphBreaks.reduce((best, point) =>
      point <= targetStart && point > best ? point : best, 0);
    const start = i === 0 || i === windows - 1 || targetStart - nearestStart > 100
      ? targetStart
      : nearestStart;
    ranges.push({ start, end: Math.min(text.length, start + budget) });
  }

  // Keep the actual prompt under its character budget after adding separators.
  const selected = ranges.map(({ start, end }) => text.slice(start, end).trim()).filter(Boolean);
  return selected.join(CONTEXT_SEPARATOR).slice(0, max);
}
export async function questionBatches<T>(
  source: string,
  count: number,
  generate: (text: string, count: number, index: number) => Promise<T[]>,
): Promise<T[]> {
  if (!Number.isSafeInteger(count) || count < 1 || count > 30)
    throw new RangeError("Question count must be between 1 and 30");
  const total = Math.ceil(count / 5),
    results: T[][] = [];
  // Sequential requests avoid competing for the provider's token allowance.
  for (let i = 0; i < total; i++) {
    const section = source.slice(Math.floor(i * source.length / total), Math.floor((i + 1) * source.length / total));
    results.push(await generate(sourceWindow(section), Math.min(5, count - i * 5), i));
  }
  return results.flat();
}
