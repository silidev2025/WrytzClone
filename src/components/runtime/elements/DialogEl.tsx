"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { El, Page } from "@/lib/shared/types";
import { ancestorIds } from "@/lib/shared/doc";
import { layoutOf } from "@/lib/shared/elements";
import { Icon } from "@/components/ui/Icon";
import { useModalFocus } from "@/components/ui/useModalFocus";
import { currentPage, useRT, useRTStore } from "../store";
import { ContainerChildren, type Placement } from "../ElementView";
import { surfaceStyle } from "../styles";

/** Pop-ups: shown in place while designing, as a centred overlay when the app runs. */
export function DialogEl({ el, placement }: { el: El; placement: Placement }) {
  const store = useRTStore();
  const theme = useRT((s) => s.doc.theme);
  const mode = useRT((s) => s.mode);
  const scale = useRT((s) => s.scale);
  const open = useRT((s) => !!s.dialogs[el.id]);
  const page = useRT((s) => currentPage(s)) as Page;
  const visibleInEditor = useRT((s) => s.showDialogs || s.selection.some((id) => id === el.id || ancestorIds(page, id).includes(el.id)));
  const [mounted, setMounted] = useState(false);
  const close = () => store.setState((s) => ({ dialogs: { ...s.dialogs, [el.id]: false } }));
  const panelRef = useModalFocus(mode !== "editor" && open && mounted, close);
  useEffect(() => setMounted(true), []);

  const surface = surfaceStyle(el, theme);
  const auto = layoutOf(el).mode !== "free";

  if (mode === "editor") {
    if (!visibleInEditor || placement.kind !== "abs") return null;
    const b = placement.box;
    return (
      <div
        data-el-id={el.id}
        className="rt-el rt-dialog rt-dialog-editor"
        style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: auto ? "auto" : b.h, minHeight: auto ? b.h : undefined, zIndex: 50, ...surface }}
      >
        <span className="rt-dialog-badge">
          <Icon name="AppWindow" size={12} /> Pop-up · hidden until opened
        </span>
        <ContainerChildren el={el} width={b.w} />
      </div>
    );
  }

  if (!open || !mounted) return null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const zoom = auto ? Math.min(scale || 1, 1) : Math.min(scale || 1, (vw - 32) / Math.max(1, el.box.w));
  const panelWidth = auto ? Math.min(el.box.w, (vw - 32) / zoom) : el.box.w;
  const panel: CSSProperties = {
    ...surface,
    position: "relative",
    width: panelWidth,
    height: auto ? "auto" : el.box.h,
    minHeight: auto ? Math.min(el.box.h, 200) : undefined,
    maxHeight: `calc(${100 / zoom}vh - ${48 / zoom}px)`,
    overflow: "auto",
    zoom,
  };
  return createPortal(
    <div
      className="rt-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && el.props.closeOnBackdrop !== false) close();
      }}
    >
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={el.props.title || el.name} data-el-id={el.id} className="rt-dialog-panel" style={panel}>
        <button type="button" className="rt-dialog-close" aria-label="Close" onClick={close}>
          <Icon name="X" size={18} />
        </button>
        <ContainerChildren el={el} width={panelWidth} />
      </div>
    </div>,
    document.getElementById("rt-overlay-root") || document.body,
  );
}
