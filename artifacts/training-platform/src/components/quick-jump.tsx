import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";

type Item = { href: string; label: string };

/**
 * Ctrl+K / ⌘K (or "/") opens a quick-jump box listing only the pages this
 * person may open. Type to filter, arrow keys to move, Enter to go, Esc to close.
 */
export function QuickJump({ items }: { items: Item[] }) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); toggle(true); }
      else if (e.key === "/" && !typing && !open) { e.preventDefault(); toggle(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle(next: boolean) {
    if (next) { returnFocus.current = document.activeElement as HTMLElement; setQuery(""); setActive(0); }
    else returnFocus.current?.focus?.();
    setOpen(next);
  }
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const seen = new Set<string>();
    return items.filter(i => !seen.has(i.href) && seen.add(i.href))
      .filter(i => !q || i.label.toLowerCase().includes(q) || i.href.includes(q))
      .slice(0, 12);
  }, [items, query]);

  function go(item?: Item) {
    if (!item) return;
    setOpen(false);
    navigate(item.href);
  }

  return <>
    <button type="button" className="quick-jump-trigger" onClick={() => toggle(true)} aria-label="Quick jump to a page (Control K)">
      <Search size={15} aria-hidden="true" /><span>Jump to…</span><kbd>Ctrl K</kbd>
    </button>
    {open && <div className="quick-jump-backdrop" onMouseDown={() => toggle(false)}>
      <div className="quick-jump" role="dialog" aria-modal="true" aria-label="Quick jump" onMouseDown={e => e.stopPropagation()}>
        <input
          ref={input}
          value={query}
          onChange={e => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={e => {
            if (e.key === "Escape") { e.preventDefault(); toggle(false); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(results.length - 1, a + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
          }}
          placeholder="Where to? Try “chat”, “credits” or “profile”"
          aria-label="Search pages"
          aria-controls="quick-jump-list"
          aria-activedescendant={results[active] ? `qj-${active}` : undefined}
          role="combobox"
          aria-expanded="true"
        />
        <ul id="quick-jump-list" role="listbox" aria-label="Pages">
          {results.map((item, i) => <li key={item.href} id={`qj-${i}`} role="option" aria-selected={i === active}
            className={i === active ? "active" : ""} onMouseEnter={() => setActive(i)} onClick={() => go(item)}>{item.label}</li>)}
          {results.length === 0 && <li className="empty" role="option" aria-selected="false">No matching page</li>}
        </ul>
        <p className="quick-jump-hint">↑ ↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>}
  </>;
}
