"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import type { El, Page } from "@/lib/shared/types";
import { descendantIds } from "@/lib/shared/doc";
import { ELEMENT_INFO, isContainerType } from "@/lib/shared/elements";
import { Icon } from "@/components/ui/Icon";
import { getPage, mutate, renameEl, select, toggleHidden, toggleLock, useEditor } from "../store";

type Drop = { id: string; pos: "before" | "after" | "inside" } | null;

/** Absolute (desktop) position of an element, adding up its ancestors' boxes. */
function absPos(page: Page, id: string) {
  let x = 0;
  let y = 0;
  let cur: El | undefined = page.elements[id];
  while (cur) {
    x += cur.box.x;
    y += cur.box.y;
    cur = cur.parentId ? page.elements[cur.parentId] : undefined;
  }
  return { x, y };
}

function moveLayer(dragId: string, drop: NonNullable<Drop>) {
  mutate((_d, page) => {
    const el = page.elements[dragId];
    const target = page.elements[drop.id];
    if (!el || !target || dragId === drop.id) return;
    if (descendantIds(page as Page, dragId).includes(drop.id)) return;
    const abs = absPos(page as Page, dragId);
    // detach
    const from = el.parentId ? page.elements[el.parentId].childIds! : page.rootIds;
    from.splice(from.indexOf(dragId), 1);
    let parentId: string | null;
    let list: string[];
    let index: number;
    if (drop.pos === "inside") {
      parentId = target.id;
      list = target.childIds ||= [];
      index = list.length; // on top
    } else {
      parentId = target.parentId;
      list = parentId ? page.elements[parentId].childIds! : page.rootIds;
      const ti = list.indexOf(target.id);
      // the panel lists the top-most layer first, so "before" means above = later in paint order
      index = drop.pos === "before" ? ti + 1 : ti;
    }
    list.splice(index, 0, dragId);
    if (el.parentId !== parentId) {
      el.parentId = parentId;
      if (parentId) delete el.pin;
      const origin = parentId ? absPos(page as Page, parentId) : { x: 0, y: 0 };
      el.box.x = abs.x - origin.x;
      el.box.y = abs.y - origin.y;
      if (el.responsive?.mobile) delete el.responsive.mobile;
    }
  });
}

function LayerRow({ id, depth, drag, setDrag, drop, setDrop }: { id: string; depth: number; drag: string | null; setDrag: (v: string | null) => void; drop: Drop; setDrop: (d: Drop) => void }) {
  const el = useEditor((s) => getPage(s).elements[id]);
  const selected = useEditor((s) => s.selection.includes(id));
  const [open, setOpen] = useState(depth < 1);
  const [renaming, setRenaming] = useState(false);
  if (!el) return null;
  const kids = el.childIds || [];
  const container = isContainerType(el.type);
  const dropCls = drop?.id === id ? `drop-${drop.pos}` : "";

  return (
    <>
      <div
        className={`layer-row ${selected ? "selected" : ""} ${el.hidden ? "hidden-layer" : ""} ${dropCls}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        draggable={!renaming}
        onDragStart={(e) => {
          setDrag(id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
        }}
        onDragEnd={() => {
          setDrag(null);
          setDrop(null);
        }}
        onDragOver={(e) => {
          if (!drag || drag === id) return;
          e.preventDefault();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const f = (e.clientY - r.top) / r.height;
          const pos = container && f > 0.28 && f < 0.72 ? "inside" : f < 0.5 ? "before" : "after";
          if (drop?.id !== id || drop.pos !== pos) setDrop({ id, pos });
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (drag && drop) moveLayer(drag, drop);
          setDrag(null);
          setDrop(null);
        }}
        onClick={(e) => select([id], { additive: e.shiftKey })}
        onDoubleClick={() => setRenaming(true)}
        onMouseEnter={() => useEditor.setState({ hoverId: id })}
        onMouseLeave={() => useEditor.setState({ hoverId: null })}
      >
        <button
          className="twisty"
          style={{ visibility: kids.length ? "visible" : "hidden" }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <Icon name={ELEMENT_INFO[el.type].icon} size={14} />
        {renaming ? (
          <input
            className="layer-rename"
            autoFocus
            defaultValue={el.name}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              renameEl(id, e.target.value);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <span className="layer-name" title={`${el.name} · ${ELEMENT_INFO[el.type].label}`}>
            {el.name}
            {el.startHidden && <span className="mini-note"> · starts hidden</span>}
          </span>
        )}
        <span className={`layer-tools ${el.locked || el.hidden ? "pinned" : ""}`}>
          <button
            className="icon-btn sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleLock([id]);
            }}
            aria-label={el.locked ? "Unlock" : "Lock"}
            title={el.locked ? "Unlock" : "Lock"}
          >
            {el.locked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
          <button
            className="icon-btn sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleHidden([id]);
            }}
            aria-label={el.hidden ? "Show" : "Hide"}
            title={el.hidden ? "Show" : "Hide"}
          >
            {el.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </span>
      </div>
      {open &&
        kids
          .slice()
          .reverse()
          .map((cid) => <LayerRow key={cid} id={cid} depth={depth + 1} drag={drag} setDrag={setDrag} drop={drop} setDrop={setDrop} />)}
    </>
  );
}

export function LayersPanel() {
  const rootIds = useEditor((s) => getPage(s).rootIds);
  const pageName = useEditor((s) => getPage(s).name);
  const showDialogs = useEditor((s) => s.showDialogs);
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  return (
    <>
      <div className="panel-head">
        <h2>Layers</h2>
        <label className="checkbox-row" style={{ fontSize: 12 }}>
          <input type="checkbox" checked={showDialogs} onChange={(e) => useEditor.setState({ showDialogs: e.target.checked })} />
          Show pop-ups
        </label>
      </div>
      <div className="panel-scroll" onMouseLeave={() => setDrop(null)}>
        <p className="panel-hint" style={{ marginBottom: 8 }}>
          {pageName}: the top of the list is in front. Drag to reorder or drop onto a box to put it inside. Double-click to rename.
        </p>
        {rootIds.length === 0 && <p className="panel-hint">This page is empty. Add something from the Add panel.</p>}
        {rootIds
          .slice()
          .reverse()
          .map((id) => (
            <LayerRow key={id} id={id} depth={0} drag={drag} setDrag={setDrag} drop={drop} setDrop={setDrop} />
          ))}
      </div>
    </>
  );
}
