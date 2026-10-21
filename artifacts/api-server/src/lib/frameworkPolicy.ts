export function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
export function validLanguage(value: string) {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}
export function validGradingScale(
  scale: { label: string; minimumPercent: number }[],
) {
  return (
    scale.length > 0 &&
    scale.some((x) => x.minimumPercent === 0) &&
    new Set(scale.map((x) => x.minimumPercent)).size === scale.length &&
    new Set(scale.map((x) => x.label)).size === scale.length &&
    scale.every(
      (x) =>
        Number.isFinite(x.minimumPercent) &&
        x.minimumPercent >= 0 &&
        x.minimumPercent <= 100,
    )
  );
}

export function configuredNextLevel(
  levels: readonly string[],
  current: string,
): string | null {
  const i = levels.indexOf(current);
  return i >= 0 && i < levels.length - 1 ? levels[i + 1] : null;
}
export function validFrameworkLevel(
  levels: readonly string[],
  current: string,
) {
  return current.length > 0 && current.length <= 28 && levels.includes(current);
}
