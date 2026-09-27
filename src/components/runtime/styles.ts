import type { CSSProperties } from "react";
import type { Breakpoint, El, Theme } from "@/lib/shared/types";
import { fillToCss, fontStack, resolveColor, shadowCss } from "@/lib/shared/theme";
import { defaultFontSize, defaultRadius, isHeadingEl, textDefaults } from "@/lib/shared/elements";
import { mobileFontSize } from "@/lib/shared/layout";

export function radiusCss(el: El, theme: Theme): string | undefined {
  const r = el.style.radii;
  if (r && r.some((v) => v)) return r.map((v) => `${v}px`).join(" ");
  const base = el.style.radius ?? defaultRadius(el, theme);
  return base ? `${base}px` : undefined;
}

/** Background, border, corners, shadow, opacity and effects shared by every element. */
export function surfaceStyle(el: El, theme: Theme, opts: { skipFill?: boolean } = {}): CSSProperties {
  const s = el.style;
  const css: CSSProperties = {};
  if (!opts.skipFill) {
    const bg = fillToCss(s.fill, theme);
    if (bg) css.background = bg;
  }
  if (s.borderWidth) css.border = `${s.borderWidth}px ${s.borderStyle || "solid"} ${resolveColor(s.borderColor || "$border", theme)}`;
  const radius = radiusCss(el, theme);
  if (radius) css.borderRadius = radius;
  const shadow = shadowCss(s.shadow, theme);
  if (shadow) css.boxShadow = shadow;
  if (s.opacity !== undefined && s.opacity < 1) css.opacity = Math.max(0, s.opacity);
  const filters: string[] = [];
  if (s.blur) filters.push(`blur(${s.blur}px)`);
  if (filters.length) css.filter = filters.join(" ");
  if (s.backdropBlur) {
    css.backdropFilter = `blur(${s.backdropBlur}px)`;
    css.WebkitBackdropFilter = `blur(${s.backdropBlur}px)`;
  }
  if (s.cursor === "pointer") css.cursor = "pointer";
  return css;
}

export function effectiveFontSize(el: El, bp: Breakpoint): number {
  const base = el.style.fontSize ?? defaultFontSize(el);
  if (bp === "mobile") {
    const o = el.responsive?.mobile?.fontSize;
    if (o) return o;
    if (el.type === "text") return mobileFontSize(base);
  }
  return base;
}

export function textStyle(el: El, theme: Theme, bp: Breakpoint, fallbackColor = "$text"): CSSProperties {
  const s = el.style;
  const td = el.type === "text" ? textDefaults(el) : null;
  const css: CSSProperties = {
    fontFamily: fontStack(s.fontFamily ?? (isHeadingEl(el) ? "$heading" : "$body"), theme),
    fontSize: effectiveFontSize(el, bp),
    fontWeight: s.fontWeight ?? td?.weight ?? (el.type === "button" ? 600 : 400),
    lineHeight: s.lineHeight ?? td?.lh ?? 1.4,
    color: resolveColor(s.color ?? fallbackColor, theme),
  };
  if (s.italic) css.fontStyle = "italic";
  const deco = [s.underline && "underline", s.strike && "line-through"].filter(Boolean).join(" ");
  if (deco) css.textDecoration = deco;
  if (s.textAlign) css.textAlign = s.textAlign;
  if (s.letterSpacing) css.letterSpacing = `${s.letterSpacing}px`;
  if (s.textTransform && s.textTransform !== "none") css.textTransform = s.textTransform;
  if (s.textShadow) css.textShadow = `${s.textShadow.x}px ${s.textShadow.y}px ${s.textShadow.blur}px ${resolveColor(s.textShadow.color, theme)}`;
  if (s.textStroke?.width) css.WebkitTextStroke = `${s.textStroke.width}px ${resolveColor(s.textStroke.color, theme)}`;
  return css;
}

export function imageFilterCss(el: El): string | undefined {
  const f = el.style.filters;
  if (!f) return undefined;
  const parts: string[] = [];
  if (f.brightness !== undefined && f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== undefined && f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== undefined && f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.grayscale) parts.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia) parts.push(`sepia(${f.sepia}%)`);
  if (f.hue) parts.push(`hue-rotate(${f.hue}deg)`);
  if (f.blur) parts.push(`blur(${f.blur}px)`);
  return parts.length ? parts.join(" ") : undefined;
}

/** Hover effects are CSS variables consumed by classes in runtime.css. */
export function hoverProps(el: El, theme: Theme): { className: string; style: Record<string, string> } {
  const h = el.style.hover;
  if (!h) return { className: "", style: {} };
  const cls: string[] = ["rt-hover"];
  const style: Record<string, string> = {};
  if (h.fill && h.fill.type !== "none") {
    const bg = fillToCss(h.fill, theme);
    if (bg) {
      style["--h-bg"] = bg;
      cls.push("rt-h-bg");
    }
  }
  if (h.color) {
    style["--h-color"] = resolveColor(h.color, theme);
    cls.push("rt-h-color");
  }
  if (h.borderColor) {
    style["--h-border"] = resolveColor(h.borderColor, theme);
    cls.push("rt-h-border");
  }
  if (h.scale && h.scale !== 1) style["--h-scale"] = String(h.scale);
  if (h.lift) cls.push("rt-h-lift");
  if (h.opacity !== undefined && h.opacity !== 1) {
    style["--h-opacity"] = String(h.opacity);
    cls.push("rt-h-opacity");
  }
  return { className: cls.join(" "), style };
}

export function animationProps(el: El, enabled: boolean): { className: string; style: CSSProperties } {
  const a = el.style.animation;
  if (!enabled || !a || a.name === "none") return { className: "", style: {} };
  return {
    className: `rt-anim rt-anim-${a.name}${a.trigger === "scroll" ? " rt-anim-scroll" : ""}${a.loop ? " rt-anim-loop" : ""}`,
    style: { animationDuration: `${a.duration || 700}ms`, animationDelay: `${a.delay || 0}ms` },
  };
}
