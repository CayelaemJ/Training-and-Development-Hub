import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyAppearance, cachedAppearance, DEFAULT_APPEARANCE, type Appearance } from "@/lib/appearance";

const ORDER: Appearance["theme"][] = ["system", "light", "dark"];
const LABEL: Record<Appearance["theme"], string> = { system: "Match my device", light: "Light", dark: "Dark" };

/**
 * One tap cycles Match my device → Light → Dark. Applies instantly and saves
 * to the account (so it follows the person to other devices). If saving fails
 * the choice still applies on this device.
 */
export function ThemeToggle({ appearance }: { appearance: Appearance | null }) {
  const [look, setLook] = useState<Appearance>(() => ({ ...DEFAULT_APPEARANCE, ...(appearance ?? cachedAppearance()) }));
  // Pick up the account's saved look once the profile has loaded.
  useEffect(() => { if (appearance) setLook({ ...DEFAULT_APPEARANCE, ...appearance }); }, [appearance]);
  const current = look;
  const Icon = current.theme === "dark" ? Moon : current.theme === "light" ? Sun : Monitor;
  const next = ORDER[(ORDER.indexOf(current.theme) + 1) % ORDER.length];

  async function cycle() {
    const base = { ...DEFAULT_APPEARANCE, ...(appearance ?? {}), ...look };
    const updated: Appearance = {
      theme: next, accent: base.accent, fontScale: base.fontScale, density: base.density, font: base.font,
      highContrast: base.highContrast, reduceMotion: base.reduceMotion, underlineLinks: base.underlineLinks,
      captionsDefault: base.captionsDefault, pinned: base.pinned,
    };
    setLook(updated);
    applyAppearance(updated);
    try {
      await fetch("/api/me/appearance", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated),
      });
    } catch { /* applied on this device; saving can be retried from My profile & look */ }
  }

  return <button type="button" className="theme-toggle" onClick={cycle}
    aria-label={`Theme: ${LABEL[current.theme]}. Switch to ${LABEL[next]}`} title={`Theme: ${LABEL[current.theme]}`}>
    <Icon size={17} aria-hidden="true" />
  </button>;
}
