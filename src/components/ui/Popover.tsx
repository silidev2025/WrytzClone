"use client";

import { cloneElement, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type Anchor = HTMLElement | { x: number; y: number } | null;
export type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "left-start";

function anchorRect(anchor: Anchor): DOMRect | null {
  if (!anchor) return null;
  if (anchor instanceof HTMLElement) return anchor.getBoundingClientRect();
  return new DOMRect(anchor.x, anchor.y, 0, 0);
}

/** A floating panel anchored to an element (or a point), kept inside the viewport. */
export function Popover({
  anchor,
  open,
  onClose,
  children,
  placement = "bottom-start",
  offset = 6,
  className,
  style,
  width,
}: {
  anchor: Anchor;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  placement?: Placement;
  offset?: number;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const r = anchorRect(anchor);
    const el = ref.current;
    if (!r || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = 0;
    let left = 0;
    if (placement.startsWith("bottom") || placement.startsWith("top")) {
      left = placement.endsWith("end") ? r.right - w : r.left;
      top = placement.startsWith("bottom") ? r.bottom + offset : r.top - h - offset;
      if (placement.startsWith("bottom") && top + h > vh - 8 && r.top - h - offset > 8) top = r.top - h - offset;
      if (placement.startsWith("top") && top < 8) top = r.bottom + offset;
    } else {
      top = r.top;
      left = placement.startsWith("right") ? r.right + offset : r.left - w - offset;
      if (placement.startsWith("right") && left + w > vw - 8) left = r.left - w - offset;
      if (placement.startsWith("left") && left < 8) left = r.right + offset;
    }
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, Math.min(top, vh - h - 8));
    setPos({ top, left });
  }, [anchor, placement, offset]);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const ro = el ? new ResizeObserver(() => place()) : null;
    if (el && ro) ro.observe(el);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (anchor instanceof HTMLElement && anchor.contains(t)) return;
      // clicks inside another popover (e.g. a nested color picker) don't close this one
      if ((t as HTMLElement).closest?.(".popover")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onResize = () => place();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, anchor, onClose, place]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      data-modal-owner={anchor instanceof HTMLElement ? (anchor.closest<HTMLElement>("[data-modal-scope]")?.dataset.modalScope || anchor.closest<HTMLElement>("[data-modal-owner]")?.dataset.modalOwner) : undefined}
      className={`popover ${className || ""}`}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, visibility: pos ? "visible" : "hidden", ...style }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}

export type MenuEntry =
  | "sep"
  | { heading: string }
  | {
      label: string;
      icon?: ReactNode;
      onClick?: () => void;
      danger?: boolean;
      shortcut?: string;
      disabled?: boolean;
      checked?: boolean;
    };

export function MenuList({ items, onDone }: { items: MenuEntry[]; onDone: () => void }) {
  return (
    <div role="menu">
      {items.map((it, i) => {
        if (it === "sep") return <div key={i} className="menu-sep" />;
        if ("heading" in it) return <div key={i} className="menu-label">{it.heading}</div>;
        return (
          <button
            key={i}
            role="menuitem"
            className={`menu-item ${it.danger ? "danger" : ""}`}
            disabled={it.disabled}
            onClick={() => {
              onDone();
              it.onClick?.();
            }}
          >
            {it.icon}
            <span>{it.label}</span>
            {it.checked && <span className="shortcut">✓</span>}
            {it.shortcut && <span className="shortcut">{it.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A button that opens a menu. */
export function Dropdown({
  trigger,
  items,
  placement = "bottom-end",
  width,
}: {
  trigger: ReactElement<{ onClick?: (e: React.MouseEvent) => void; "aria-expanded"?: boolean }>;
  items: MenuEntry[] | (() => MenuEntry[]);
  placement?: Placement;
  width?: number;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  const list = typeof items === "function" ? (anchor ? items() : []) : items;
  return (
    <>
      {isValidElement(trigger) &&
        cloneElement(trigger, {
          "aria-expanded": !!anchor,
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setAnchor(anchor ? null : (e.currentTarget as HTMLElement));
          },
        })}
      <Popover anchor={anchor} open={!!anchor} onClose={close} placement={placement} width={width}>
        <MenuList items={list} onDone={close} />
      </Popover>
    </>
  );
}

/** Context menu at the pointer. */
export function useContextMenu() {
  const [state, setState] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);
  const close = useCallback(() => setState(null), []);
  const open = useCallback((e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuEntry[]) => {
    e.preventDefault?.();
    setState({ x: e.clientX, y: e.clientY, items });
  }, []);
  const node = (
    <Popover anchor={state ? { x: state.x, y: state.y } : null} open={!!state} onClose={close} offset={2}>
      {state && <MenuList items={state.items} onDone={close} />}
    </Popover>
  );
  return { open, close, node };
}
