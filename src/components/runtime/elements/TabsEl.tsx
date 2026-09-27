"use client";

import type { CSSProperties } from "react";
import type { El, Page } from "@/lib/shared/types";
import { fontStack, resolveColor, withAlpha } from "@/lib/shared/theme";
import { buildMobileFlow } from "@/lib/shared/layout";
import { currentPage, useRT, useRTStore } from "../store";
import { ElementView } from "../ElementView";
import { effectiveFontSize } from "../styles";

export function TabsContent({ el }: { el: El }) {
  const store = useRTStore();
  const theme = useRT((s) => s.doc.theme);
  const bp = useRT((s) => s.bp);
  const mode = useRT((s) => s.mode);
  const page = useRT((s) => currentPage(s)) as Page;
  const active = useRT((s) => s.tabs[el.id] ?? el.props.activeTab ?? 0);
  const tabs = el.props.tabs || [];
  const panels = el.childIds || [];
  const idx = Math.min(Math.max(0, active), Math.max(0, panels.length - 1));
  const panelId = panels[idx];
  const fs = effectiveFontSize(el, bp);
  const accent = theme.colors.primary;
  const text = resolveColor(el.style.color ?? "$text", theme);
  const variant = el.props.variant || "underline";
  const border = resolveColor("$border", theme);
  const flowMobile = bp === "mobile" && !page.mobileCustom;

  const tabStyle = (on: boolean): CSSProperties => {
    const base: CSSProperties = {
      fontFamily: fontStack(el.style.fontFamily ?? "$body", theme),
      fontSize: fs,
      fontWeight: on ? 650 : 500,
      color: on ? accent : text,
      whiteSpace: "nowrap",
    };
    if (variant === "pills") return { ...base, padding: "8px 16px", borderRadius: 999, background: on ? withAlpha(accent, 0.12) : "transparent" };
    if (variant === "boxed")
      return { ...base, padding: "9px 16px", borderRadius: `${theme.radius}px ${theme.radius}px 0 0`, background: on ? theme.colors.background : "transparent", border: `1px solid ${on ? border : "transparent"}`, borderBottomColor: on ? theme.colors.background : "transparent", marginBottom: -1 };
    return { ...base, padding: "10px 4px", borderBottom: `2px solid ${on ? accent : "transparent"}`, marginBottom: -1 };
  };

  const panel = panelId ? (
    flowMobile ? (
      <ElementView
        id={panelId}
        placement={{
          kind: "flow",
          entry: { id: panelId, width: null, height: null, aspect: null, children: buildMobileFlow(page, panelId, page.elements[panelId]?.box.w || 600, 320) },
        }}
      />
    ) : (
      <ElementView id={panelId} placement={{ kind: "fill" }} />
    )
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="rt-tabs-head" role="tablist" style={{ gap: variant === "underline" ? 22 : 6, borderBottom: variant === "pills" ? "none" : `1px solid ${border}` }}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={i === idx}
            data-tab-index={i}
            data-tabs-id={el.id}
            tabIndex={mode === "editor" ? -1 : undefined}
            style={tabStyle(i === idx)}
            onClick={() => {
              if (mode === "editor") return;
              store.setState((s) => ({ tabs: { ...s.tabs, [el.id]: i } }));
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: flowMobile ? undefined : 40 }}>{panel}</div>
    </div>
  );
}
