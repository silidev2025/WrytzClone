"use client";

import { useEffect } from "react";
import { CATALOG } from "@/lib/shared/elements";
import {
  addSpec,
  beginGesture,
  boxAt,
  clearSelection,
  copySelection,
  copyStyle,
  deleteSelection,
  duplicateSelection,
  ed,
  endGesture,
  ensureMobileCustom,
  getPage,
  groupSelection,
  inFreeParent,
  mutate,
  pasteElements,
  pasteStyle,
  redo,
  reorder,
  select,
  toggleHidden,
  toggleLock,
  undo,
  ungroupSelection,
  useEditor,
} from "./store";
import { saveNow } from "./saving";

let nudgeTimer: ReturnType<typeof setTimeout> | null = null;

function nudge(dx: number, dy: number) {
  const s = ed();
  let page = getPage(s);
  const ids = s.selection.filter((id) => page.elements[id] && !page.elements[id].locked && inFreeParent(page, page.elements[id]));
  if (!ids.length) return;
  if (s.bp === "mobile" && !page.mobileCustom) {
    ensureMobileCustom();
    page = getPage();
  }
  if (!nudgeTimer) beginGesture();
  else clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(() => {
    nudgeTimer = null;
    endGesture();
  }, 600);
  const bp = s.bp;
  mutate((_d, pg) => {
    for (const id of ids) {
      const el = pg.elements[id];
      const b = boxAt(pg as never, el as never, bp);
      if (bp === "desktop") el.box = { ...el.box, x: b.x + dx, y: b.y + dy };
      else {
        el.responsive = el.responsive || {};
        el.responsive.mobile = { ...(el.responsive.mobile || {}), x: b.x + dx, y: b.y + dy };
      }
    }
  });
}

const TOOL_KEYS: Record<string, string> = { t: "paragraph", h: "heading", b: "button", r: "rect", o: "circle", i: "image", l: "line", f: "form" };

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const s = ed();
      if (mod && key === "s") {
        e.preventDefault();
        void saveNow();
        return;
      }
      if (typing || s.view !== "design") return;
      if (document.querySelector(".modal-backdrop")) return;

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.altKey && (key === "c" || e.code === "KeyC")) {
        e.preventDefault();
        copyStyle();
        return;
      }
      if (mod && e.altKey && (key === "v" || e.code === "KeyV")) {
        e.preventDefault();
        pasteStyle();
        return;
      }
      if (mod && key === "c") {
        if (copySelection()) e.preventDefault();
        return;
      }
      if (mod && key === "x") {
        if (copySelection(true)) e.preventDefault();
        return;
      }
      if (mod && key === "v") {
        e.preventDefault();
        pasteElements();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && key === "a") {
        e.preventDefault();
        select(getPage().rootIds.filter((id) => !getPage().elements[id]?.locked));
        return;
      }
      if (mod && key === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelection();
        else groupSelection();
        return;
      }
      if (mod && key === "l") {
        e.preventDefault();
        toggleLock();
        return;
      }
      if (mod && e.shiftKey && key === "h") {
        e.preventDefault();
        toggleHidden();
        return;
      }
      if (mod && (e.code === "BracketRight" || e.code === "BracketLeft")) {
        e.preventDefault();
        const up = e.code === "BracketRight";
        reorder(e.shiftKey ? (up ? "front" : "back") : up ? "forward" : "backward");
        return;
      }
      if (mod && key === "0") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("cb:zoom", { detail: 1 }));
        return;
      }
      if (mod && (key === "=" || key === "+")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("cb:zoom", { detail: s.zoom * 1.25 }));
        return;
      }
      if (mod && key === "-") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("cb:zoom", { detail: s.zoom / 1.25 }));
        return;
      }
      if (e.shiftKey && e.code === "Digit1") {
        e.preventDefault();
        window.dispatchEvent(new Event("cb:fit"));
        return;
      }
      if (key === "delete" || key === "backspace") {
        if (s.selection.length) {
          e.preventDefault();
          deleteSelection();
        }
        return;
      }
      if (key === "escape") {
        if (s.editingTextId) {
          useEditor.setState({ editingTextId: null });
          return;
        }
        const page = getPage(s);
        const first = s.selection[0] ? page.elements[s.selection[0]] : undefined;
        if (s.selection.length === 1 && first?.parentId) select([first.parentId]);
        else clearSelection();
        return;
      }
      if (key === "enter" && s.selection.length === 1) {
        const el = getPage(s).elements[s.selection[0]];
        if (!el) return;
        e.preventDefault();
        if ((el.type === "text" || el.type === "button") && !el.locked) useEditor.setState({ editingTextId: el.id });
        else if (el.childIds?.length) select([el.childIds[0]]);
        return;
      }
      if (key.startsWith("arrow") && s.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (key === "arrowleft") nudge(-step, 0);
        if (key === "arrowright") nudge(step, 0);
        if (key === "arrowup") nudge(0, -step);
        if (key === "arrowdown") nudge(0, step);
        return;
      }
      if (!mod && !e.altKey && !e.shiftKey && TOOL_KEYS[key]) {
        const item = CATALOG.find((c) => c.id === TOOL_KEYS[key]);
        if (item) {
          e.preventDefault();
          addSpec(item.spec());
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export { useEditor };
