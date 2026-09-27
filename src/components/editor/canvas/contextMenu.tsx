"use client";

import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, ClipboardPaste, Copy, CopyPlus, Eye, EyeOff, Group, Lock, Maximize, Paintbrush, Pencil, Scissors, Trash2, Ungroup, Unlock, ZoomIn, MousePointer2, CornerLeftUp, BoxSelect } from "lucide-react";
import { useContextMenu, type MenuEntry } from "@/components/ui/Popover";
import { promptDialog } from "@/components/ui/confirm";
import { isAutoLayout } from "@/lib/shared/elements";
import {
  copySelection,
  copyStyle,
  deleteSelection,
  duplicateSelection,
  ed,
  getPage,
  groupSelection,
  pasteElements,
  pasteStyle,
  readClipboard,
  renameEl,
  reorder,
  select,
  toggleHidden,
  toggleLock,
  ungroupSelection,
  useEditor,
} from "../store";

export function useCanvasContextMenu() {
  const menu = useContextMenu();

  const openFor = (e: React.MouseEvent, kind: "element" | "canvas", point?: { x: number; y: number }) => {
    const s = ed();
    const page = getPage(s);
    const sel = s.selection.map((id) => page.elements[id]).filter(Boolean);
    let items: MenuEntry[];
    if (kind === "element" && sel.length) {
      const first = sel[0];
      const locked = sel.every((el) => el.locked);
      const canUngroup = sel.some((el) => el.type === "box" && !!el.childIds?.length && !isAutoLayout(el));
      items = [
        { label: "Cut", icon: <Scissors size={15} />, shortcut: "Ctrl+X", onClick: () => copySelection(true) },
        { label: "Copy", icon: <Copy size={15} />, shortcut: "Ctrl+C", onClick: () => copySelection() },
        { label: "Paste", icon: <ClipboardPaste size={15} />, shortcut: "Ctrl+V", onClick: () => pasteElements(), disabled: !readClipboard() },
        { label: "Duplicate", icon: <CopyPlus size={15} />, shortcut: "Ctrl+D", onClick: duplicateSelection },
        { label: "Delete", icon: <Trash2 size={15} />, shortcut: "Del", onClick: deleteSelection, danger: true, disabled: locked },
        "sep",
        { label: "Copy style", icon: <Paintbrush size={15} />, shortcut: "Ctrl+Alt+C", onClick: copyStyle },
        { label: "Paste style", icon: <Paintbrush size={15} />, shortcut: "Ctrl+Alt+V", onClick: pasteStyle, disabled: !s.styleClipboard },
        "sep",
        { label: "Bring to front", icon: <ArrowUpToLine size={15} />, shortcut: "Ctrl+Shift+]", onClick: () => reorder("front") },
        { label: "Bring forward", icon: <ChevronUp size={15} />, shortcut: "Ctrl+]", onClick: () => reorder("forward") },
        { label: "Send backward", icon: <ChevronDown size={15} />, shortcut: "Ctrl+[", onClick: () => reorder("backward") },
        { label: "Send to back", icon: <ArrowDownToLine size={15} />, shortcut: "Ctrl+Shift+[", onClick: () => reorder("back") },
        "sep",
        { label: "Group", icon: <Group size={15} />, shortcut: "Ctrl+G", onClick: groupSelection },
        { label: "Ungroup", icon: <Ungroup size={15} />, shortcut: "Ctrl+Shift+G", onClick: ungroupSelection, disabled: !canUngroup },
        { label: locked ? "Unlock" : "Lock", icon: locked ? <Unlock size={15} /> : <Lock size={15} />, shortcut: "Ctrl+L", onClick: () => toggleLock() },
        { label: "Hide", icon: <EyeOff size={15} />, shortcut: "Ctrl+Shift+H", onClick: () => toggleHidden() },
        "sep",
        ...(first.parentId
          ? [{ label: "Select parent", icon: <CornerLeftUp size={15} />, shortcut: "Esc", onClick: () => select([first.parentId!]) } as MenuEntry]
          : []),
        ...(first.childIds?.length ? [{ label: "Select children", icon: <BoxSelect size={15} />, onClick: () => select(first.childIds!) } as MenuEntry] : []),
        {
          label: "Rename…",
          icon: <Pencil size={15} />,
          disabled: sel.length !== 1,
          onClick: async () => {
            const name = await promptDialog({ title: "Rename layer", label: "Layer name (used in bindings like {{Name.value}})", defaultValue: first.name, confirmLabel: "Rename" });
            if (name) renameEl(first.id, name);
          },
        },
      ];
    } else {
      const clip = readClipboard();
      items = [
        {
          label: "Paste here",
          icon: <ClipboardPaste size={15} />,
          disabled: !clip,
          onClick: () => {
            if (!clip) return;
            const roots = clip.els.filter((x) => !x.parentId || !clip.els.some((y) => y.id === x.parentId));
            const minX = Math.min(...roots.map((r) => r.box.x));
            const minY = Math.min(...roots.map((r) => r.box.y));
            const moved = clip.els.map((el) => (roots.includes(el) ? { ...el, box: { ...el.box, x: el.box.x - minX + (point?.x ?? 0), y: el.box.y - minY + (point?.y ?? 0) } } : el));
            pasteElements({ els: moved }, { parentId: null, offset: 0 });
          },
        },
        { label: "Select all", icon: <MousePointer2 size={15} />, shortcut: "Ctrl+A", onClick: () => select(getPage().rootIds) },
        "sep",
        { label: "Zoom to fit", icon: <Maximize size={15} />, shortcut: "Shift+1", onClick: () => window.dispatchEvent(new Event("cb:fit")) },
        { label: "Zoom to 100%", icon: <ZoomIn size={15} />, shortcut: "Ctrl+0", onClick: () => window.dispatchEvent(new CustomEvent("cb:zoom", { detail: 1 })) },
        "sep",
        {
          label: s.showDialogs ? "Hide pop-ups" : "Show all pop-ups",
          icon: <Eye size={15} />,
          onClick: () => useEditor.setState({ showDialogs: !ed().showDialogs }),
        },
      ];
    }
    menu.open(e, items);
  };

  return { openFor, close: menu.close, node: menu.node };
}
