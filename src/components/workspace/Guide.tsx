"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import { GUIDE } from "@/lib/guide";
import { Icon } from "@/components/ui/Icon";

/** Render **bold**, *italic* and `code` from the guide text, highlighting the search term. */
function rich(text: string, term: string): ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  const mark = (s: string) => {
    if (!term) return s;
    const i = s.toLowerCase().indexOf(term);
    if (i < 0) return s;
    return (
      <>
        {s.slice(0, i)}
        <mark>{s.slice(i, i + term.length)}</mark>
        {s.slice(i + term.length)}
      </>
    );
  };
  return parts.map((p, i) => {
    if (p.startsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
    if (p.startsWith("**")) return <strong key={i}>{mark(p.slice(2, -2))}</strong>;
    if (p.startsWith("*") && p.length > 2) return <em key={i}>{mark(p.slice(1, -1))}</em>;
    return <Fragment key={i}>{mark(p)}</Fragment>;
  });
}

export function Guide() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set(["start"]));
  const term = query.trim().toLowerCase();
  const topics = useMemo(
    () => GUIDE.filter((t) => !term || `${t.title} ${t.sub} ${t.steps.join(" ")}`.toLowerCase().includes(term)),
    [term],
  );
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="crumbs">Workspace / User guide</div>
      <div className="page-head">
        <div>
          <div className="eyebrow">User guide</div>
          <h1 className="page-title">Build with confidence.</h1>
          <p className="page-sub">Short, step-by-step answers for everything in the editor. Search for a word to jump straight to it.</p>
        </div>
      </div>
      <div className="toolbar">
        <div className="search-box" style={{ maxWidth: "100%" }}>
          <Search size={16} />
          <input className="input" placeholder="Search the guide… (try “form”, “mobile” or “variable”)" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the user guide" />
        </div>
      </div>
      {topics.length === 0 && (
        <div className="empty-state">
          <h3>Nothing matches “{query}”</h3>
          <p>Try a shorter word.</p>
        </div>
      )}
      <div className="guide-list">
        {topics.map((t) => {
          const isOpen = !!term || open.has(t.id);
          return (
            <div key={t.id} className="guide-item" id={t.id}>
              <button onClick={() => toggle(t.id)} aria-expanded={isOpen}>
                <span className="g-icon">
                  <Icon name={t.icon} size={19} />
                </span>
                <span style={{ flex: 1 }}>
                  <h3>{rich(t.title, term)}</h3>
                  <div className="g-sub">{rich(t.sub, term)}</div>
                </span>
                <ChevronDown size={18} style={{ transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform .2s", color: "var(--muted)" }} />
              </button>
              {isOpen && (
                <div className="guide-body">
                  <ol>
                    {t.steps.map((s, i) => (
                      <li key={i}>{rich(s, term)}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
