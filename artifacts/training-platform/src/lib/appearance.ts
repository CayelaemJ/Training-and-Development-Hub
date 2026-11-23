// Applies a person's chosen look and feel to the whole app. Settings are saved
// on the server (GET/PUT /api/me/appearance) and cached on the device so the
// page does not flash the default look while loading.
export type Appearance = {
  theme: "system" | "light" | "dark";
  accent: "clay" | "teal" | "gold" | "ink" | "violet" | "rose" | "sky" | "leaf";
  fontScale: number;
  density: "comfortable" | "compact" | "spacious";
  font: "default" | "easy_read" | "serif" | "mono";
  highContrast: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  captionsDefault: boolean;
  pinned: string[];
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "system", accent: "clay", fontScale: 1, density: "comfortable", font: "default",
  highContrast: false, reduceMotion: false, underlineLinks: false, captionsDefault: true, pinned: [],
};

/** HSL triplets for the --primary token (light, dark). All meet 4.5:1 with their foreground. */
export const ACCENTS: Record<Appearance["accent"], { label: string; light: string; dark: string; fg: string; swatch: string }> = {
  clay: { label: "CABO clay", light: "19 54% 44%", dark: "19 54% 58%", fg: "0 0% 100%", swatch: "#B05A31" },
  teal: { label: "Teal", light: "180 58% 27%", dark: "180 45% 50%", fg: "0 0% 100%", swatch: "#1D6B6B" },
  gold: { label: "Gold", light: "43 70% 32%", dark: "43 60% 58%", fg: "0 0% 100%", swatch: "#8A6A16" },
  ink: { label: "Ink", light: "216 28% 17%", dark: "216 20% 80%", fg: "0 0% 100%", swatch: "#1F2937" },
  violet: { label: "Violet", light: "262 52% 47%", dark: "262 70% 72%", fg: "0 0% 100%", swatch: "#6D3FC0" },
  rose: { label: "Rose", light: "343 63% 42%", dark: "343 75% 70%", fg: "0 0% 100%", swatch: "#AF2756" },
  sky: { label: "Sky", light: "205 80% 34%", dark: "205 80% 65%", fg: "0 0% 100%", swatch: "#11609C" },
  leaf: { label: "Leaf", light: "140 50% 28%", dark: "140 45% 55%", fg: "0 0% 100%", swatch: "#246B3A" },
};

const KEY = "cabo-appearance-v1";

export function cachedAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) } : DEFAULT_APPEARANCE;
  } catch { return DEFAULT_APPEARANCE; }
}

let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

export function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const dark = a.theme === "dark" || (a.theme === "system" && !!media?.matches);
  root.classList.toggle("dark", dark);
  const accent = ACCENTS[a.accent] ?? ACCENTS.clay;
  root.style.setProperty("--primary", dark ? accent.dark : accent.light);
  root.style.setProperty("--ring", dark ? accent.dark : accent.light);
  root.style.setProperty("--primary-foreground", dark ? "216 28% 7%" : accent.fg);
  root.style.fontSize = `${Math.round(16 * Math.min(1.75, Math.max(0.875, a.fontScale)))}px`;
  root.dataset.density = a.density;
  root.dataset.font = a.font;
  root.classList.toggle("cabo-high-contrast", a.highContrast);
  root.classList.toggle("cabo-reduce-motion", a.reduceMotion);
  root.classList.toggle("cabo-underline-links", a.underlineLinks);
  if (media) {
    if (mediaListener) media.removeEventListener?.("change", mediaListener);
    mediaListener = a.theme === "system" ? () => applyAppearance(a) : null;
    if (mediaListener) media.addEventListener?.("change", mediaListener);
  }
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage can be unavailable */ }
}
