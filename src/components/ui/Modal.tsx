"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useModalFocus } from "./useModalFocus";

/**
 * Classic "zoom rects": a few outline rectangles grow from the control that opened the dialog
 * to the dialog's frame, so it's clear where it came from. Skipped when motion is reduced.
 */
function zoomFrom(origin: DOMRect | null, panel: HTMLElement) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const to = panel.getBoundingClientRect();
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const from = origin && origin.width > 0 && origin.width < window.innerWidth * 0.9 ? origin : new DOMRect(cx - 20, cy - 12, 40, 24);
  const steps = 4;
  const rects: HTMLElement[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const r = document.createElement("div");
    r.className = "zoom-rect";
    r.style.left = `${from.left + (to.left - from.left) * t}px`;
    r.style.top = `${from.top + (to.top - from.top) * t}px`;
    r.style.width = `${from.width + (to.width - from.width) * t}px`;
    r.style.height = `${from.height + (to.height - from.height) * t}px`;
    r.animate([{ opacity: 1 }, { opacity: 1, offset: 0.99 }, { opacity: 0 }], { duration: 60, delay: (i - 1) * 32, fill: "both" });
    document.body.appendChild(r);
    rects.push(r);
  }
  panel.animate([{ opacity: 0 }, { opacity: 0, offset: 0.99 }, { opacity: 1 }], { duration: steps * 32 + 20, fill: "backwards" });
  window.setTimeout(() => rects.forEach((r) => r.remove()), steps * 32 + 120);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size,
  className = "",
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "wide" | "xl";
  /** kept for callers; the one-bit title bar carries no icon */
  icon?: ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useModalFocus(open && mounted, onClose);
  const origin = useRef<DOMRect | null>(null);
  useEffect(() => setMounted(true), []);
  // remember where the dialog is opened from, before focus moves into it
  if (open && !origin.current && typeof document !== "undefined") {
    const active = document.activeElement as HTMLElement | null;
    origin.current = active && active !== document.body ? active.getBoundingClientRect() : null;
  }
  if (!open && origin.current) origin.current = null;
  useLayoutEffect(() => {
    if (open && mounted && panelRef.current) zoomFrom(origin.current, panelRef.current);
  }, [open, mounted, panelRef]);
  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} tabIndex={-1} className={`modal ${size || ""} ${className}`} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : "Dialog"} aria-describedby={description ? descriptionId : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          {title ? <h2 id={titleId}>{title}</h2> : <span style={{ flex: 1 }} />}
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
        {description && (
          <p id={descriptionId} className="modal-desc">
            {description}
          </p>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
