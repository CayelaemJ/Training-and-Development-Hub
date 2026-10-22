// Cover the document rather than silently reading only its opening paragraphs.
export function sourceWindow(text: string, max = 48000): string {
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
  // Two bounded requests at a time; failures never publish an incomplete assessment.
  for (let index = 0; index < total; index += 2) {
    const group = await Promise.all(
      Array.from({ length: Math.min(2, total - index) }, async (_, offset) => {
        const i = index + offset;
        const section = source.slice(
          Math.floor((i * source.length) / total),
          Math.floor(((i + 1) * source.length) / total),
        );
        return generate(sourceWindow(section), Math.min(5, count - i * 5), i);
      }),
    );
    results.push(...group);
  }
  return results.flat();
}
