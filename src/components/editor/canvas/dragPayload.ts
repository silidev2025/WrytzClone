"use client";

import type { ElementSpec } from "@/lib/shared/elements";

export type Payload =
  | { kind: "spec"; spec: ElementSpec; label: string }
  | { kind: "block"; spec: ElementSpec; label: string }
  | { kind: "image"; src: string; label: string; width?: number; height?: number }
  | { kind: "icon"; icon: string; label: string };

export interface DropTarget {
  over: (p: Payload, clientX: number, clientY: number) => void;
  drop: (p: Payload, clientX: number, clientY: number) => boolean;
  leave: () => void;
}

let target: DropTarget | null = null;

export function registerDropTarget(t: DropTarget | null) {
  target = t;
}

function makeGhost(p: Payload): HTMLElement {
  const g = document.createElement("div");
  g.className = "drag-ghost";
  if (p.kind === "image") {
    const img = document.createElement("img");
    img.src = p.src;
    img.alt = "";
    g.appendChild(img);
  } else {
    g.textContent = p.label;
  }
  document.body.appendChild(g);
  return g;
}

/**
 * Pointer-based drag from a panel tile. A short press without movement counts as a click
 * (add in the middle of the view). Works with mouse, pen and touch.
 */
export function startPanelDrag(e: React.PointerEvent, payload: Payload, onClick: () => void) {
  if (e.button !== 0) return;
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging = false;
  let ghost: HTMLElement | null = null;
  const pointerId = e.pointerId;

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
      dragging = true;
      ghost = makeGhost(payload);
      document.body.classList.add("is-dragging-payload");
    }
    if (dragging && ghost) {
      ghost.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 12}px)`;
      target?.over(payload, ev.clientX, ev.clientY);
    }
  };
  const finish = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
    ghost?.remove();
    document.body.classList.remove("is-dragging-payload");
    if (dragging) {
      const handled = target?.drop(payload, ev.clientX, ev.clientY);
      if (!handled) target?.leave();
    } else onClick();
  };
  const cancel = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
    ghost?.remove();
    document.body.classList.remove("is-dragging-payload");
    target?.leave();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", cancel);
}
