import { useEffect, useState } from "react";

/**
 * A short burst of colour for a strong result. Purely decorative (hidden from
 * screen readers) and skipped entirely when the person or their device asks
 * for reduced motion.
 */
export function Celebrate({ when }: { when: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!when) return;
    const reduced = document.documentElement.classList.contains("cabo-reduce-motion") ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(t);
  }, [when]);
  if (!show) return null;
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  return <div className="celebrate" aria-hidden="true">
    {pieces.map(i => <span key={i} style={{
      left: `${(i * 37) % 100}%`,
      animationDelay: `${(i % 7) * 70}ms`,
      background: ["#e07a5f", "#3d8b6e", "#f2cc8f", "#5b7fbf", "#c86b98"][i % 5],
      transform: `rotate(${(i * 47) % 360}deg)`,
    }} />)}
  </div>;
}
