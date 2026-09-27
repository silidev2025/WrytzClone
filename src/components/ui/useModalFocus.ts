"use client";

import { useEffect, useId, useRef } from "react";

const dialogs: HTMLElement[] = [];
const inertLocks = new WeakMap<HTMLElement, { count: number; previous: boolean }>();
let scrollLocks = 0;
let previousOverflow = "";

/** Shared keyboard, background and focus lifecycle for stacked modal surfaces. */
export function useModalFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const scopeId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  const opener = useRef<HTMLElement | null>(null);
  if (!open && typeof document !== "undefined") opener.current = document.activeElement as HTMLElement;

  useEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    panel.dataset.modalScope = scopeId;
    const active = document.activeElement as HTMLElement | null;
    const restoreFocus = active && !panel.contains(active) ? active : opener.current;
    dialogs.push(panel);
    if (scrollLocks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    // Inert siblings at every level, including the page behind a portal root.
    const siblings: HTMLElement[] = [];
    for (let branch: HTMLElement | null = panel; branch?.parentElement; branch = branch.parentElement) {
      for (const node of Array.from(branch.parentElement.children)) {
        if (node !== branch && node instanceof HTMLElement) {
          siblings.push(node);
          const lock = inertLocks.get(node) || { count: 0, previous: node.inert };
          lock.count++;
          inertLocks.set(node, lock);
          node.inert = true;
        }
      }
      if (branch.parentElement === document.body) break;
    }
    // Dropdowns/color pickers portal to body. Keep those belonging to this dialog
    // in its focus scope rather than sending focus back to the underlying form.
    const roots = () => [panel, ...Array.from(document.querySelectorAll<HTMLElement>("[data-modal-owner]")).filter((node) => node.dataset.modalOwner === scopeId)];
    const contains = (node: Node | null) => roots().some((root) => root.contains(node));
    const focusable = () => roots().flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ))).filter((node) => node.tabIndex >= 0 && !node.matches(":disabled") && !node.closest("[inert]") && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden");
    const focusFirst = () => (focusable()[0] || panel).focus({ preventScroll: true });
    if (!panel.contains(document.activeElement)) focusFirst();
    const onKey = (e: KeyboardEvent) => {
      if (dialogs.at(-1) !== panel) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close.current();
      } else if (e.key === "Tab") {
        const nodes = focusable();
        const index = nodes.indexOf(document.activeElement as HTMLElement);
        if (!nodes.length || index < 0 || (e.shiftKey ? index === 0 : index === nodes.length - 1)) {
          e.preventDefault();
          (e.shiftKey ? nodes.at(-1) || panel : nodes[0] || panel).focus();
        }
      }
    };
    const onFocus = (e: FocusEvent) => {
      if (dialogs.at(-1) === panel && !contains(e.target as Node)) focusFirst();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus);
      const index = dialogs.indexOf(panel);
      if (index >= 0) dialogs.splice(index, 1);
      for (const node of siblings) {
        const lock = inertLocks.get(node)!;
        if (--lock.count === 0) {
          node.inert = lock.previous;
          inertLocks.delete(node);
        }
      }
      if (--scrollLocks === 0) document.body.style.overflow = previousOverflow;
      if (restoreFocus?.isConnected && !restoreFocus.closest("[inert]")) restoreFocus.focus({ preventScroll: true });
    };
  }, [open, scopeId]);
  return ref;
}
