"use client";

import { useState, type CSSProperties } from "react";
import type { El, MenuItem } from "@/lib/shared/types";
import { fontStack, resolveColor, withAlpha } from "@/lib/shared/theme";
import { safeUrl } from "@/lib/shared/util";
import { guessPageIcon } from "@/lib/shared/pageIcons";
import { Icon } from "@/components/ui/Icon";
import { isStatic, useRT, useRTStore } from "../store";
import { effectiveFontSize } from "../styles";

export function MenuContent({ el }: { el: El }) {
  const store = useRTStore();
  const theme = useRT((s) => s.doc.theme);
  const pages = useRT((s) => s.doc.pages);
  const pageId = useRT((s) => s.pageId);
  const bp = useRT((s) => s.bp);
  const mode = useRT((s) => s.mode);
  const user = useRT((s) => s.user);
  const [open, setOpen] = useState(false);
  const editor = isStatic(mode);

  const items: MenuItem[] = el.props.items?.length
    ? el.props.items
    : pages
        .filter((p) => !p.recordCollectionId && !p.hideInNav && (p.access !== "admins" || user?.isAdmin || editor))
        .map((p) => ({ id: p.id, label: p.name, pageId: p.id }));
  const iconOf = (it: MenuItem) => {
    if (it.icon) return it.icon;
    const p = it.pageId ? pages.find((pg) => pg.id === it.pageId) : null;
    return p ? p.icon || guessPageIcon(p.name) : guessPageIcon(it.label);
  };

  const fs = effectiveFontSize(el, bp);
  const color = resolveColor(el.style.color ?? "$text", theme);
  const accent = theme.colors.primary;
  const variant = el.props.variant || "links";
  const vertical = el.props.orientation === "vertical";
  const tabbar = variant === "tabbar";
  const collapse = bp === "mobile" && !vertical && !tabbar && items.length > 2;
  const align = el.style.textAlign === "center" ? "center" : el.style.textAlign === "right" ? "flex-end" : "flex-start";

  const go = (it: MenuItem) => {
    setOpen(false);
    if (editor) return;
    if (it.pageId) store.getState().navigate(it.pageId, null);
    else if (it.url) {
      const href = safeUrl(it.url);
      if (href) window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  const itemStyle = (active: boolean): CSSProperties => {
    const base: CSSProperties = {
      fontFamily: fontStack(el.style.fontFamily ?? "$body", theme),
      fontSize: fs,
      fontWeight: active ? 650 : (el.style.fontWeight ?? 500),
      color: active ? accent : color,
      letterSpacing: el.style.letterSpacing,
      textTransform: el.style.textTransform && el.style.textTransform !== "none" ? el.style.textTransform : undefined,
    };
    if (variant === "pills") return { ...base, background: active ? withAlpha(accent, 0.12) : "transparent", borderRadius: 999, padding: "8px 14px" };
    if (variant === "underline") return { ...base, borderBottom: `2px solid ${active ? accent : "transparent"}`, padding: "8px 2px", borderRadius: 0 };
    if (variant === "buttons")
      return {
        ...base,
        background: active ? accent : "transparent",
        color: active ? "#fff" : color,
        border: `1.5px solid ${active ? accent : resolveColor("$border", theme)}`,
        borderRadius: theme.buttonStyle === "pill" ? 999 : theme.radius,
        padding: "8px 16px",
      };
    return { ...base, padding: "8px 4px" };
  };

  if (tabbar) {
    // phone-style tab bar: icon over a small label, spread evenly
    const muted = resolveColor(el.style.color ?? "$muted", theme);
    return (
      <nav className="rt-menu rt-tabbar" style={{ height: "100%", alignItems: "stretch" }}>
        {items.map((it) => {
          const active = it.pageId === pageId;
          return (
            <button
              key={it.id}
              type="button"
              tabIndex={editor ? -1 : undefined}
              onClick={() => go(it)}
              aria-current={active ? "page" : undefined}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                color: active ? accent : muted,
                fontFamily: fontStack(el.style.fontFamily ?? "$body", theme),
                fontSize: Math.max(10, fs - 3),
                fontWeight: active ? 650 : 500,
              }}
            >
              <Icon name={iconOf(it)} size={Math.round(fs * 1.45)} strokeWidth={active ? 2.3 : 1.9} />
              <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  const withIcons = !!el.props.showIcons;
  const label = (it: MenuItem) =>
    withIcons ? (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <Icon name={iconOf(it)} size={Math.round(fs * 1.15)} />
        {it.label}
      </span>
    ) : (
      it.label
    );

  if (collapse) {
    return (
      <div className="rt-menu" style={{ justifyContent: "flex-end", height: "100%" }}>
        <button type="button" className="rt-burger" style={{ color }} aria-label="Open menu" aria-expanded={open} onClick={() => !editor && setOpen((o) => !o)}>
          <Icon name={open ? "X" : "Menu"} size={Math.round(fs * 1.5)} />
        </button>
        {open && (
          <div className="rt-menu-panel" style={{ background: theme.colors.background, borderColor: resolveColor("$border", theme) }}>
            {items.map((it) => (
              <button key={it.id} type="button" onClick={() => go(it)} style={{ ...itemStyle(it.pageId === pageId), textAlign: "left", width: "100%" }}>
                {label(it)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <nav
      className="rt-menu"
      style={{ flexDirection: vertical ? "column" : "row", justifyContent: vertical ? "flex-start" : align, alignItems: vertical ? align : "center", gap: vertical ? 4 : variant === "links" ? 22 : 8, height: "100%" }}
    >
      {items.map((it) => (
        <button key={it.id} type="button" tabIndex={editor ? -1 : undefined} onClick={() => go(it)} style={itemStyle(it.pageId === pageId)} aria-current={it.pageId === pageId ? "page" : undefined}>
          {label(it)}
        </button>
      ))}
    </nav>
  );
}
