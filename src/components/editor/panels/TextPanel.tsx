"use client";

import { useEffect, type CSSProperties } from "react";
import type { Style } from "@/lib/shared/types";
import { DEFAULT_LAYOUT, type ElementSpec } from "@/lib/shared/elements";
import { fontStack, resolveColor } from "@/lib/shared/theme";
import { loadFonts } from "@/components/runtime/fonts";
import { addSpec, useEditor } from "../store";
import { startPanelDrag } from "../canvas/dragPayload";

interface Combo {
  id: string;
  label: string;
  preview: string;
  font: string;
  previewStyle?: CSSProperties;
  spec: () => ElementSpec;
}

const text = (t: string, style: Style, w: number, h: number, tag: "h1" | "h2" | "h3" | "p" | "small" = "h2", name?: string): ElementSpec => ({
  type: "text",
  name,
  box: { w, h },
  style,
  props: { text: t, tag },
});

const COMBOS: Combo[] = [
  { id: "sale", label: "Big & bold", preview: "BIG SALE", font: "Anton", spec: () => text("BIG SALE", { fontFamily: "Anton", fontSize: 88, color: "$primary", textTransform: "uppercase", lineHeight: 1 }, 460, 90, "h1", "BigTitle") },
  { id: "script", label: "Friendly script", preview: "Hello there", font: "Pacifico", spec: () => text("Hello there", { fontFamily: "Pacifico", fontSize: 58, color: "$secondary", fontWeight: 400 }, 420, 80, "h1", "Script") },
  { id: "journal", label: "Elegant serif", preview: "The Journal", font: "Playfair Display", previewStyle: { fontStyle: "italic" }, spec: () => text("The Journal", { fontFamily: "Playfair Display", fontSize: 60, italic: true, fontWeight: 700 }, 460, 76, "h1", "SerifTitle") },
  { id: "launch", label: "Condensed", preview: "LAUNCH DAY", font: "Bebas Neue", spec: () => text("LAUNCH DAY", { fontFamily: "Bebas Neue", fontSize: 80, letterSpacing: 4, fontWeight: 400 }, 420, 84, "h1", "Condensed") },
  { id: "tech", label: "Techy", preview: "Build faster", font: "Space Grotesk", spec: () => text("Build faster", { fontFamily: "Space Grotesk", fontSize: 54, fontWeight: 700, letterSpacing: -1.5 }, 440, 66, "h1", "TechTitle") },
  { id: "hand", label: "Handwritten", preview: "a little note", font: "Caveat", spec: () => text("a little note for you", { fontFamily: "Caveat", fontSize: 44, color: "$text", fontWeight: 600 }, 400, 56, "p", "Handwritten") },
  {
    id: "eyebrow",
    label: "Eyebrow",
    preview: "NEW ARRIVALS",
    font: "Inter",
    previewStyle: { fontSize: 12, letterSpacing: 3, fontWeight: 800 },
    spec: () => text("NEW ARRIVALS", { fontSize: 14, fontWeight: 800, letterSpacing: 3, color: "$primary", textTransform: "uppercase" }, 260, 22, "small", "Eyebrow"),
  },
  { id: "price", label: "Price", preview: "$29/mo", font: "Poppins", spec: () => text("$29/mo", { fontFamily: "Poppins", fontSize: 52, fontWeight: 800 }, 240, 64, "h2", "Price") },
  {
    id: "highlight",
    label: "Highlighted",
    preview: "Make it pop",
    font: "Poppins",
    previewStyle: { background: "#ffc53d", padding: "0 6px", borderRadius: 4 },
    spec: () => text("Make it pop", { fontFamily: "Poppins", fontSize: 48, fontWeight: 800, textHighlight: "$accent" }, 380, 62, "h1", "Highlight"),
  },
  {
    id: "outline",
    label: "Outline",
    preview: "OUTLINE",
    font: "Archivo Black",
    previewStyle: { color: "transparent", WebkitTextStroke: "1.5px currentColor" },
    spec: () => text("OUTLINE", { fontFamily: "Archivo Black", fontSize: 76, color: "transparent", textStroke: { width: 2, color: "$text" } }, 460, 84, "h1", "OutlineTitle"),
  },
  {
    id: "quote",
    label: "Quote",
    preview: "“Simply lovely.”",
    font: "Cormorant Garamond",
    previewStyle: { fontStyle: "italic" },
    spec: () => text("“Simply the easiest way we've ever built anything.”", { fontFamily: "Cormorant Garamond", fontSize: 34, italic: true, lineHeight: 1.3 }, 520, 90, "p", "Quote"),
  },
  {
    id: "stat",
    label: "Big number",
    preview: "98%",
    font: "Unbounded",
    spec: () => ({
      type: "box",
      name: "StatBlock",
      box: { w: 260, h: 120 },
      props: { layout: { ...DEFAULT_LAYOUT, mode: "column", gap: 2, padding: 0, align: "start" } },
      children: [
        text("98%", { fontFamily: "Unbounded", fontSize: 64, fontWeight: 800, color: "$primary", lineHeight: 1 }, 260, 70, "h2"),
        text("happy customers", { fontSize: 16, color: "$muted" }, 260, 24, "p"),
      ],
    }),
  },
];

const BASICS: { id: string; label: string; spec: () => ElementSpec; style: CSSProperties }[] = [
  { id: "h1", label: "Add a heading", spec: () => text("Add a heading", {}, 560, 64, "h1", "Heading"), style: { fontSize: 24, fontWeight: 800 } },
  { id: "h2", label: "Add a subheading", spec: () => text("Add a subheading", {}, 480, 44, "h2", "Subheading"), style: { fontSize: 17, fontWeight: 700 } },
  { id: "p", label: "Add a little bit of body text", spec: () => text("Add a little bit of body text. Double-click to change it.", {}, 440, 54, "p", "Paragraph"), style: { fontSize: 13 } },
];

export function TextPanel() {
  const theme = useEditor((s) => s.doc.theme);
  useEffect(() => {
    loadFonts(Array.from(new Set(COMBOS.map((c) => c.font))));
  }, []);
  return (
    <>
      <div className="panel-head">
        <h2>Text</h2>
      </div>
      <div className="panel-scroll">
        <p className="panel-hint" style={{ marginBottom: 10 }}>
          Click or drag text onto the page. Headings use your theme&apos;s heading font.
        </p>
        {BASICS.map((b) => (
          <button
            key={b.id}
            className="text-preset"
            style={{ ...b.style, fontFamily: fontStack(b.id === "p" ? "$body" : "$heading", theme) }}
            onPointerDown={(e) => startPanelDrag(e, { kind: "spec", spec: b.spec(), label: b.label }, () => addSpec(b.spec()))}
          >
            {b.label}
          </button>
        ))}
        <div className="panel-section-title">Font combinations</div>
        <div className="combo-grid">
          {COMBOS.map((c) => (
            <button
              key={c.id}
              className="combo"
              title={c.label}
              style={{ fontFamily: fontStack(c.font, theme), fontSize: 20, background: "var(--panel-2)", color: c.id === "sale" ? resolveColor("$primary", theme) : undefined, ...c.previewStyle }}
              onPointerDown={(e) => startPanelDrag(e, { kind: "spec", spec: c.spec(), label: c.label }, () => addSpec(c.spec()))}
            >
              <span>{c.preview}</span>
            </button>
          ))}
        </div>
        <div className="panel-section-title">Show data</div>
        <p className="panel-hint">
          Any text can show live values — a visitor&apos;s name, a variable or a database field. Add text, then use the <strong>{"{ }"}</strong> button in its Content tab.
        </p>
      </div>
    </>
  );
}
