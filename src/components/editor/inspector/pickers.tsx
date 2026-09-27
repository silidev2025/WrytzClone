"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Theme } from "@/lib/shared/types";
import { FONTS, fontStack, type FontCategory } from "@/lib/shared/theme";
import { ICON_CATEGORIES, LUCIDE } from "@/lib/client/lucideLibrary";
import { BRAND_ICON_NAMES } from "@/lib/client/brandIcons";
import { Icon } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { loadFonts } from "@/components/runtime/fonts";

let previewsLoaded = false;
/** One small stylesheet with just the letters needed to show every font's own name. */
function loadFontPreviews() {
  if (previewsLoaded || typeof document === "undefined") return;
  previewsLoaded = true;
  const google = FONTS.filter((f) => f.category !== "System");
  const chars = Array.from(new Set(google.map((f) => f.name).join("") + "Aa")).join("");
  const families = google.map((f) => `family=${f.name.replace(/ /g, "+")}`).join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent(chars)}&display=swap`;
  document.head.appendChild(link);
}

const CATS: (FontCategory | "All")[] = ["All", "Sans serif", "Serif", "Display", "Handwriting", "Monospace", "System"];

export function FontPicker({ value, onChange, theme, allowTheme = true }: { value: string | undefined; onChange: (v: string | undefined) => void; theme: Theme; allowTheme?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  useEffect(() => {
    if (anchor) loadFontPreviews();
  }, [anchor]);
  const label = !value ? "Theme font" : value === "$heading" ? `Heading · ${theme.headingFont}` : value === "$body" ? `Body · ${theme.bodyFont}` : value;
  const list = FONTS.filter((f) => (cat === "All" || f.category === cat) && f.name.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (v: string | undefined) => {
    if (v && !v.startsWith("$")) loadFonts([v]);
    onChange(v);
    setAnchor(null);
  };
  return (
    <>
      <button className="swatch-btn" style={{ paddingLeft: 9 }} onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}>
        <span className="label" style={{ fontFamily: fontStack(value, theme), fontSize: 13.5 }}>
          {label}
        </span>
        <ChevronDown size={13} />
      </button>
      <Popover anchor={anchor} open={!!anchor} onClose={() => setAnchor(null)} placement="left-start">
        <div className="font-pop">
          <div className="panel-search" style={{ margin: 0 }}>
            <Search size={14} />
            <input className="input" autoFocus placeholder="Search fonts…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="preset-chips" style={{ marginTop: 8 }}>
            {CATS.map((c) => (
              <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="font-list">
            {allowTheme && !q && (
              <>
                <button aria-pressed={value === "$heading"} onClick={() => pick("$heading")} style={{ fontFamily: fontStack(theme.headingFont, theme) }}>
                  {theme.headingFont} <small>theme heading</small>
                </button>
                <button aria-pressed={value === "$body" || !value} onClick={() => pick("$body")} style={{ fontFamily: fontStack(theme.bodyFont, theme) }}>
                  {theme.bodyFont} <small>theme body</small>
                </button>
                <div className="menu-sep" />
              </>
            )}
            {list.map((f) => (
              <button key={f.name} aria-pressed={value === f.name} onClick={() => pick(f.name)} style={{ fontFamily: `'${f.name}', ${f.fallback}` }}>
                {f.name} <small>{f.category}</small>
              </button>
            ))}
            {!list.length && <div className="mini-note" style={{ padding: 10 }}>No fonts match.</div>}
          </div>
        </div>
      </Popover>
    </>
  );
}

const ALL_ICONS = Array.from(new Set([...Object.keys(LUCIDE), ...BRAND_ICON_NAMES])).sort();
const ICON_CATS = ["All", ...Object.keys(ICON_CATEGORIES), "Brands"];

export function IconGrid({ onPick, onDragStart, filter, category }: { onPick: (name: string) => void; onDragStart?: (e: React.PointerEvent, name: string) => void; filter: string; category: string }) {
  const names = useMemo(() => {
    const base = category === "All" ? ALL_ICONS : category === "Brands" ? BRAND_ICON_NAMES : ICON_CATEGORIES[category] || [];
    const q = filter.trim().toLowerCase();
    return q ? ALL_ICONS.filter((n) => n.toLowerCase().includes(q)) : base;
  }, [filter, category]);
  return (
    <div className="icon-grid">
      {names.map((n) => (
        <button
          key={n}
          title={n.replace(/([a-z])([A-Z0-9])/g, "$1 $2")}
          onPointerDown={onDragStart ? (e) => onDragStart(e, n) : undefined}
          onClick={onDragStart ? undefined : () => onPick(n)}
        >
          <Icon name={n} size={20} />
        </button>
      ))}
      {!names.length && <div className="mini-note" style={{ gridColumn: "1 / -1", padding: 8 }}>No icons match.</div>}
    </div>
  );
}

export function IconPicker({ value, onChange, allowNone }: { value: string | undefined; onChange: (v: string | undefined) => void; allowNone?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Popular");
  return (
    <>
      <button className="swatch-btn" onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}>
        <span className="swatch" style={{ display: "grid", placeItems: "center", background: "var(--panel)" }}>
          {value ? <Icon name={value} size={15} /> : null}
        </span>
        <span className="label">{value ? value.replace(/([a-z])([A-Z0-9])/g, "$1 $2") : "No icon"}</span>
        <ChevronDown size={13} />
      </button>
      <Popover anchor={anchor} open={!!anchor} onClose={() => setAnchor(null)} placement="left-start">
        <div className="icon-pop">
          <div className="panel-search" style={{ margin: 0 }}>
            <Search size={14} />
            <input className="input" autoFocus placeholder="Search icons…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {!q && (
            <select className="txt-field" style={{ marginTop: 8 }} value={cat} onChange={(e) => setCat(e.target.value)}>
              {ICON_CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          {allowNone && (
            <button
              className="btn sm ghost"
              style={{ marginTop: 8 }}
              onClick={() => {
                onChange(undefined);
                setAnchor(null);
              }}
            >
              No icon
            </button>
          )}
          <IconGrid
            filter={q}
            category={cat}
            onPick={(n) => {
              onChange(n);
              setAnchor(null);
            }}
          />
        </div>
      </Popover>
    </>
  );
}

export { ICON_CATS };
