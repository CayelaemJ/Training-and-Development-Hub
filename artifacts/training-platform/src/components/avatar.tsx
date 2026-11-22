import { ACCENTS, type Appearance } from "@/lib/appearance";

// Generated avatar (initials or a geometric pattern) or an approved photo.
// Decorative when a visible name sits next to it, so screen readers skip it.
export function Avatar({ initials, color = "clay", style = "initials", photoUrl, size = 36, label }: {
  initials: string; color?: Appearance["accent"]; style?: "initials" | "pattern" | "photo"; photoUrl?: string | null; size?: number; label?: string;
}) {
  const bg = ACCENTS[color]?.swatch ?? ACCENTS.clay.swatch;
  const common = { className: "cabo-avatar", style: { width: size, height: size, background: bg, fontSize: Math.round(size * 0.4) } };
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  if (style === "photo" && photoUrl) return <span {...common} {...a11y}><img src={photoUrl} alt="" width={size} height={size} /></span>;
  if (style === "pattern") {
    const seed = [...initials].reduce((n, c) => n * 31 + c.charCodeAt(0), 7);
    const cells = Array.from({ length: 9 }, (_, i) => ((seed >> i) & 1) === 1);
    return <span {...common} {...a11y}><svg viewBox="0 0 3 3" width={size * 0.62} height={size * 0.62}>{cells.map((on, i) => on ? <rect key={i} x={i % 3} y={Math.floor(i / 3)} width="1" height="1" fill="rgba(255,255,255,.85)" /> : null)}</svg></span>;
  }
  return <span {...common} {...a11y}>{initials.slice(0, 2)}</span>;
}
