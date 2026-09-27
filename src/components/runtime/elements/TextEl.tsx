"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { El } from "@/lib/shared/types";
import { hasBindings, interpolate } from "@/lib/shared/expressions";
import { resolveColor } from "@/lib/shared/theme";
import { safeUrl } from "@/lib/shared/util";
import { isStatic, useRT, useRTStore } from "../store";
import { useBindingContext } from "../hooks";
import { textStyle } from "../styles";

const JUSTIFY: Record<string, CSSProperties["justifyContent"]> = { top: "flex-start", middle: "center", bottom: "flex-end" };

export function TextContent({ el }: { el: El }) {
  const store = useRTStore();
  const theme = useRT((s) => s.doc.theme);
  const bp = useRT((s) => s.bp);
  const mode = useRT((s) => s.mode);
  const editing = useRT((s) => s.editingId === el.id);
  const override = useRT((s) => s.overrides[el.id]?.text as string | undefined);
  const colorOverride = useRT((s) => s.overrides[el.id]?.color as string | undefined);
  const raw = override ?? el.props.text ?? "";
  const bound = hasBindings(raw);
  const ctx = useBindingContext(bound);
  const editRef = useRef<HTMLDivElement>(null);

  let text = bound && ctx ? interpolate(raw, ctx) : raw;
  let placeholder = false;
  if (mode === "editor" && bound && !text.trim()) {
    text = raw;
    placeholder = true;
  }

  const style: CSSProperties = {
    ...textStyle(el, theme, bp),
    margin: 0,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    width: "100%",
  };
  if (colorOverride) style.color = resolveColor(colorOverride, theme);
  if (placeholder) style.opacity = 0.55;

  const pad = el.style.padding;
  const px = el.style.paddingX ?? pad ?? 0;
  const py = el.style.paddingY ?? pad ?? 0;
  const wrap: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: JUSTIFY[el.style.verticalAlign || "top"],
    height: "100%",
    padding: px || py ? `${py}px ${px}px` : undefined,
  };

  useEffect(() => {
    if (!editing || !editRef.current) return;
    const node = editRef.current;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing]);

  if (editing) {
    return (
      <div style={wrap}>
        <div
          ref={editRef}
          className="rt-text-editing"
          contentEditable="plaintext-only"
          suppressContentEditableWarning
          style={style}
          onBlur={(e) => store.getState().commitText(el.id, e.currentTarget.innerText.replace(/\n$/, ""))}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
              e.preventDefault();
              (e.currentTarget as HTMLElement).blur();
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {raw}
        </div>
      </div>
    );
  }

  const Tag = (el.props.tag || "p") as "h1" | "h2" | "h3" | "p" | "small";
  const highlight = el.style.textHighlight ? resolveColor(el.style.textHighlight, theme) : null;
  const inner = highlight ? (
    <span style={{ background: highlight, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "0.05em 0.25em", borderRadius: 4 }}>{text}</span>
  ) : (
    text
  );

  const link = el.props.link;
  if (!isStatic(mode) && link && (link.pageId || link.url)) {
    const href = link.url ? safeUrl(link.url) : null;
    return (
      <div style={wrap}>
        <Tag style={style}>
          <a
            href={href || "#"}
            target={link.newTab && href ? "_blank" : undefined}
            rel={link.newTab ? "noopener noreferrer" : undefined}
            style={{ color: "inherit", textDecoration: "inherit" }}
            onClick={(e) => {
              if (link.pageId) {
                e.preventDefault();
                store.getState().navigate(link.pageId, null);
              }
            }}
          >
            {inner}
          </a>
        </Tag>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <Tag style={style}>{inner}</Tag>
    </div>
  );
}
