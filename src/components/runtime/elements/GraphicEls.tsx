"use client";

import type { CSSProperties } from "react";
import type { El } from "@/lib/shared/types";
import { fillToCss, resolveColor } from "@/lib/shared/theme";
import { safeUrl } from "@/lib/shared/util";
import { Icon } from "@/components/ui/Icon";
import { isStatic, useRT, useRTStore } from "../store";
import { animationProps, hoverProps, radiusCss } from "../styles";
import { SHAPE_PATHS, maskCss } from "../shapes";

export function IconContent({ el }: { el: El }) {
  const theme = useRT((s) => s.doc.theme);
  const mode = useRT((s) => s.mode);
  const store = useRTStore();
  const colorOverride = useRT((s) => s.overrides[el.id]?.color as string | undefined);
  const color = resolveColor(colorOverride ?? el.style.color ?? "$primary", theme);
  const pad = el.style.padding ?? 0;
  const link = el.props.link;
  const icon = <Icon name={el.props.icon} size="100%" strokeWidth={el.props.strokeWidth ?? 2} color={color} />;
  const style: CSSProperties = { display: "flex", width: "100%", height: "100%", padding: pad, color };
  if (!isStatic(mode) && link && (link.url || link.pageId)) {
    const href = link.url ? safeUrl(link.url) : null;
    return (
      <a
        href={href || "#"}
        target={link.newTab && href ? "_blank" : undefined}
        rel="noopener noreferrer"
        style={style}
        aria-label={el.name}
        onClick={(e) => {
          if (link.pageId) {
            e.preventDefault();
            store.getState().navigate(link.pageId, null);
          }
        }}
      >
        {icon}
      </a>
    );
  }
  return <div style={style}>{icon}</div>;
}

export function LineContent({ el }: { el: El }) {
  const theme = useRT((s) => s.doc.theme);
  const color = resolveColor(el.style.color ?? "$border", theme);
  const t = Math.max(1, el.props.thickness ?? 2);
  const head = el.props.arrowEnd ? Math.max(10, t * 4) : 0;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: head ? head - 1 : 0,
          top: "50%",
          borderTop: `${t}px ${el.props.dash || "solid"} ${color}`,
          transform: "translateY(-50%)",
          borderRadius: t,
        }}
      />
      {head > 0 && (
        <svg width={head} height={head} viewBox="0 0 10 10" style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }}>
          <path d="M0 0 L10 5 L0 10 Z" fill={color} />
        </svg>
      )}
    </div>
  );
}

/** Shapes: rectangles/ellipses are plain boxes; everything else is a masked box plus an outline. */
export function ShapeEl({
  el,
  style: pos,
  setNode,
  onClick,
}: {
  el: El;
  style: CSSProperties;
  setNode: (n: HTMLElement | null) => void;
  onClick?: () => void;
}) {
  const theme = useRT((s) => s.doc.theme);
  const mode = useRT((s) => s.mode);
  const overrides = useRT((s) => s.overrides[el.id]);
  const s = el.style;
  const kind = el.props.shape || "rect";
  const editor = isStatic(mode);
  const hover = editor ? { className: "", style: {} } : hoverProps(el, theme);
  const anim = animationProps(el, !editor);
  let background = fillToCss(s.fill, theme);
  if (overrides?.backgroundColor) background = resolveColor(String(overrides.backgroundColor), theme);
  const outer: CSSProperties = { ...pos, ...hover.style, ...anim.style };
  if (s.opacity !== undefined && s.opacity < 1) outer.opacity = s.opacity;
  if (onClick) outer.cursor = "pointer";
  const filters: string[] = [];
  if (s.shadow) filters.push(`drop-shadow(${s.shadow.x}px ${s.shadow.y}px ${s.shadow.blur / 2}px ${resolveColor(s.shadow.color, theme)})`);
  if (s.blur) filters.push(`blur(${s.blur}px)`);
  if (filters.length) outer.filter = filters.join(" ");

  let inner;
  if (kind === "rect" || kind === "ellipse") {
    const box: CSSProperties = { position: "absolute", inset: 0, background };
    if (kind === "ellipse") box.borderRadius = "50%";
    else {
      const r = radiusCss(el, theme);
      if (r) box.borderRadius = r;
    }
    if (s.borderWidth) box.border = `${s.borderWidth}px ${s.borderStyle || "solid"} ${resolveColor(s.borderColor || "$text", theme)}`;
    if (s.backdropBlur) box.backdropFilter = `blur(${s.backdropBlur}px)`;
    inner = <div className="rt-hover-target" style={box} />;
  } else {
    const d = SHAPE_PATHS[kind] || SHAPE_PATHS.hexagon!;
    inner = (
      <>
        <div className="rt-hover-target" style={{ position: "absolute", inset: 0, background, ...maskCss(d) }} />
        {!!s.borderWidth && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <path
              d={d}
              fill="none"
              stroke={resolveColor(s.borderColor || "$text", theme)}
              strokeWidth={s.borderWidth}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={s.borderStyle === "dashed" ? `${s.borderWidth * 3} ${s.borderWidth * 2}` : s.borderStyle === "dotted" ? `${s.borderWidth} ${s.borderWidth * 1.5}` : undefined}
              strokeLinejoin="round"
            />
          </svg>
        )}
      </>
    );
  }

  return (
    <div
      ref={setNode}
      data-el-id={el.id}
      className={`rt-el rt-shape ${hover.className} ${anim.className} ${el.startHidden && editor ? "rt-start-hidden" : ""}`}
      style={outer}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? el.name : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      } : undefined}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    >
      {inner}
    </div>
  );
}
