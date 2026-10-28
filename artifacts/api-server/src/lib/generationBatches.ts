// Cover the document rather than silently reading only its opening paragraphs.
export function sourceWindow(text: string, max = 6000): string {
  if (text.length <= max) return text;
  const size = Math.floor(max / 12);
  return Array.from({ length: 12 }, (_, i) =>
    text.slice(
      Math.floor((i * (text.length - size)) / 11),
      Math.floor((i * (text.length - size)) / 11) + size,
    ),
  ).join("\n\n[Next section]\n\n");
}
export async function questionBatches<T>(
  source: string,
  count: number,
  generate: (text: string, count: number, index: number) => Promise<T[]>,
): Promise<T[]> {
  const total = Math.ceil(count / 5),
    results: T[][] = [];
  // Sequential requests avoid competing for the provider's token allowance.
  for (let i = 0; i < total; i++) {
    const section = source.slice(Math.floor(i * source.length / total), Math.floor((i + 1) * source.length / total));
    results.push(await generate(sourceWindow(section), Math.min(5, count - i * 5), i));
  }
  return results.flat();
}
