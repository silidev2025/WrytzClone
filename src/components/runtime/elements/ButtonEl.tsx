"use client";

import { useState, type CSSProperties } from "react";
import type { El } from "@/lib/shared/types";
import { hasBindings, interpolate } from "@/lib/shared/expressions";
import { buttonColors, defaultRadius } from "@/lib/shared/elements";
import { fillToCss, resolveColor, shadowCss } from "@/lib/shared/theme";
import { Icon } from "@/components/ui/Icon";
import { isStatic, useRT } from "../store";
import { useActions, useBindingContext } from "../hooks";
import { animationProps, hoverProps, radiusCss, textStyle } from "../styles";

export function ButtonEl({ el, style: pos, setNode }: { el: El; style: CSSProperties; setNode: (n: HTMLElement | null) => void }) {
  const theme = useRT((s) => s.doc.theme);
  const bp = useRT((s) => s.bp);
  const mode = useRT((s) => s.mode);
  const override = useRT((s) => s.overrides[el.id]);
  const { run, submit, formId } = useActions();
  const [busy, setBusy] = useState(false);
  const rawLabel = (override?.text as string | undefined) ?? el.props.label ?? "";
  const ctx = useBindingContext(hasBindings(rawLabel));
  const label = ctx ? interpolate(rawLabel, ctx) : rawLabel;
  const editor = isStatic(mode);
  const configured = !!el.events?.click?.length || !!(el.props.submit && formId);

  const colors = buttonColors(el, theme);
  const s = el.style;
  const css: CSSProperties = {
    ...pos,
    ...textStyle(el, theme, bp, colors.color),
    color: override?.color ? resolveColor(String(override.color), theme) : colors.color,
    // "no fill" means see-through (a <button> would otherwise paint the browser's grey)
    background: fillToCss(s.fill, theme) ?? colors.background ?? "transparent",
    border: s.borderWidth
      ? `${s.borderWidth}px ${s.borderStyle || "solid"} ${resolveColor(s.borderColor || "$primary", theme)}`
      : colors.borderWidth
        ? `${colors.borderWidth}px solid ${colors.borderColor}`
        : "none",
    borderRadius: radiusCss(el, theme) ?? `${defaultRadius(el, theme)}px`,
    boxShadow: shadowCss(s.shadow, theme),
    opacity: s.opacity !== undefined && s.opacity < 1 ? s.opacity : undefined,
    display: "flex",
    alignItems: "center",
    justifyContent: s.textAlign === "left" ? "flex-start" : s.textAlign === "right" ? "flex-end" : "center",
    gap: 8,
    padding: `${s.paddingY ?? 0}px ${s.paddingX ?? (label ? 18 : 0)}px`,
    cursor: editor ? undefined : busy ? "progress" : "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.1,
    userSelect: "none",
  };
  if (override?.backgroundColor) css.background = resolveColor(String(override.backgroundColor), theme);
  const hover = editor ? { className: "", style: {} } : hoverProps(el, theme);
  const anim = animationProps(el, !editor);
  const iconSize = Math.round(((css.fontSize as number) || 16) * 1.15);
  const icon = el.props.icon ? <Icon name={el.props.icon} size={iconSize} /> : null;

  const content = (
    <>
      {busy ? <span className="spinner" style={{ width: iconSize, height: iconSize }} /> : el.props.iconPos !== "right" && icon}
      {label && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
      {!busy && el.props.iconPos === "right" && icon}
    </>
  );

  const className = `rt-el rt-button ${hover.className} ${anim.className} ${el.startHidden && editor ? "rt-start-hidden" : ""}`;
  if (editor)
    return (
      <div ref={setNode} data-el-id={el.id} className={className} style={{ ...css, ...hover.style, ...anim.style }}>
        {content}
      </div>
    );

  return (
    <button
      ref={setNode}
      type={el.props.submit && formId ? "submit" : "button"}
      data-el-id={el.id}
      className={className}
      style={{ ...css, ...hover.style, ...anim.style }}
      disabled={busy || !configured}
      title={!configured ? "This button hasn't been configured yet" : undefined}
      aria-label={el.props.ariaLabel || label || el.name}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;
        setBusy(true);
        try {
          const ok = await run(el.events?.click, el.id);
          if (ok && el.props.submit && formId) await submit(formId);
        } finally {
          setBusy(false);
        }
      }}
    >
      {content}
    </button>
  );
}
