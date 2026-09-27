"use client";

import { create } from "zustand";
import { produce, type Draft } from "immer";
import type { AppDoc, AppMeta, Box, Breakpoint, Collection, El, Page, PublicUser, Style } from "@/lib/shared/types";
import { FRAME_WIDTH } from "@/lib/shared/types";
import {
  ancestorIds,
  childIdsOf,
  descendantIds,
  extractSubtrees,
  insertElements,
  layerNames,
  newPage,
  pagePathFor,
  PHONE_PAGE_HEIGHT,
  remapElements,
  removeElements,
} from "@/lib/shared/doc";
import { DEFAULT_LAYOUT, ELEMENT_INFO, defaultFontSize, instantiateSpec, isAutoLayout, isContainerType, type ElementSpec } from "@/lib/shared/elements";
import { applyMobileRects, frameWidthFor, freeChildBoxes, isHugHeight, isMobileApp, mobileFontSize, resetMobileLayout } from "@/lib/shared/layout";
import { deepClone, uid, uniqueName } from "@/lib/shared/util";

export type LeftTab = "add" | "text" | "blocks" | "media" | "layers" | "pages" | "theme" | "data";
export type RightTab = "design" | "content" | "events" | "data";

export interface Guide {
  axis: "x" | "y";
  /** frame coordinate of the line */
  pos: number;
  from: number;
  to: number;
}

export type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

interface ClipboardData {
  els: El[];
}

export interface EditorState {
  app: AppMeta;
  doc: AppDoc;
  revision: number;
  collections: Collection[];
  user: PublicUser;

  pageId: string;
  bp: Breakpoint;
  zoom: number;
  pan: { x: number; y: number };
  selection: string[];
  hoverId: string | null;
  editingTextId: string | null;
  leftTab: LeftTab | null;
  rightTab: RightTab;
  inspectorOpen: boolean;
  view: "design" | "database";
  dbCollectionId: string | null;
  showDialogs: boolean;
  guides: Guide[];
  dropTargetId: string | null | undefined;
  insertLine: { x: number; y: number; w: number; h: number } | null;
  marquee: { x: number; y: number; w: number; h: number } | null;
  tabsShown: Record<string, number>;

  past: AppDoc[];
  future: AppDoc[];
  gesture: number;
  gestureChanged: boolean;

  saveState: SaveState;
  saveError: string | null;
  lastSavedAt: string | null;
  dataVersion: number;
  styleClipboard: Style | null;
}

const HISTORY_LIMIT = 150;

export interface EditorInit {
  app: AppMeta;
  doc: AppDoc;
  revision: number;
  collections: Collection[];
  user: PublicUser;
}

export const useEditor = create<EditorState>(() => ({}) as EditorState);

export function initEditor(init: EditorInit) {
  useEditor.setState(
    {
      app: init.app,
      doc: init.doc,
      revision: init.revision,
      collections: init.collections,
      user: init.user,
      pageId: init.doc.homePageId,
      bp: "desktop",
      zoom: 0.6,
      pan: { x: 40, y: 40 },
      selection: [],
      hoverId: null,
      editingTextId: null,
      leftTab: "add",
      rightTab: "design",
      inspectorOpen: false,
      view: "design",
      dbCollectionId: init.collections[0]?.id ?? null,
      showDialogs: false,
      guides: [],
      dropTargetId: undefined,
      insertLine: null,
      marquee: null,
      tabsShown: {},
      past: [],
      future: [],
      gesture: 0,
      gestureChanged: false,
      saveState: "saved",
      saveError: null,
      lastSavedAt: null,
      dataVersion: 0,
      styleClipboard: null,
    },
    true,
  );
}

/* ------------------------------------------------------------------ getters */

export const ed = () => useEditor.getState();

export function getPage(s: EditorState = ed()): Page {
  return s.doc.pages.find((p) => p.id === s.pageId) || s.doc.pages[0];
}

export function getEl(id: string, s: EditorState = ed()): El | undefined {
  return getPage(s).elements[id];
}

/** Width of an element's parent at a breakpoint (the frame for top-level elements). */
export function parentWidth(page: Page, el: El, bp: Breakpoint): number {
  const frame = frameWidthFor(ed().doc, bp);
  if (!el.parentId) return frame;
  const parent = page.elements[el.parentId];
  return parent ? boxAt(page, parent, bp).w : frame;
}

/** The element's box at a breakpoint (relative to its parent). */
export function boxAt(page: Page, el: El, bp: Breakpoint): Box {
  if (bp === "desktop") return el.box;
  const b = freeChildBoxes(page, el.parentId, "mobile", parentWidth(page, el, bp)).get(el.id);
  return b ?? el.box;
}

export function inFreeParent(page: Page, el: El): boolean {
  if (!el.parentId) return true;
  const parent = page.elements[el.parentId];
  return !!parent && !isAutoLayout(parent) && parent.type !== "list" && parent.type !== "tabs";
}

/* ------------------------------------------------------------------ mutations + history */

type Recipe = (doc: Draft<AppDoc>, page: Draft<Page>) => void;

/**
 * Change the document. Outside a gesture every call is one undo step; inside a gesture
 * (a drag, a slider) the whole gesture becomes one step.
 */
export function mutate(recipe: Recipe, opts: { history?: boolean } = {}) {
  const s = ed();
  const next = produce(s.doc, (d) => {
    const page = d.pages.find((p) => p.id === s.pageId) || d.pages[0];
    recipe(d, page);
  });
  if (next === s.doc) return;
  const record = opts.history !== false;
  if (record && s.gesture === 0) {
    useEditor.setState({
      doc: next,
      past: [...s.past.slice(-HISTORY_LIMIT + 1), s.doc],
      future: [],
      saveState: s.saveState === "conflict" ? "conflict" : "dirty",
    });
  } else {
    useEditor.setState({ doc: next, gestureChanged: s.gesture > 0 ? true : s.gestureChanged, saveState: s.saveState === "conflict" ? "conflict" : "dirty" });
  }
}

/** Group every change until endGesture() into one undo step. */
export function beginGesture() {
  const s = ed();
  if (s.gesture === 0) useEditor.setState({ gesture: 1, gestureChanged: false, past: [...s.past.slice(-HISTORY_LIMIT + 1), s.doc], future: [] });
  else useEditor.setState({ gesture: s.gesture + 1 });
}

export function endGesture() {
  const s = ed();
  if (s.gesture <= 0) return;
  if (s.gesture === 1) {
    // nothing changed: drop the snapshot we took
    if (!s.gestureChanged) useEditor.setState({ gesture: 0, past: s.past.slice(0, -1) });
    else useEditor.setState({ gesture: 0, gestureChanged: false });
  } else useEditor.setState({ gesture: s.gesture - 1 });
}

function cleanSelection(doc: AppDoc, pageId: string, ids: string[]) {
  const page = doc.pages.find((p) => p.id === pageId);
  return page ? ids.filter((id) => page.elements[id]) : [];
}

export function undo() {
  const s = ed();
  if (!s.past.length) return;
  const prev = s.past[s.past.length - 1];
  const pageId = prev.pages.some((p) => p.id === s.pageId) ? s.pageId : prev.homePageId;
  useEditor.setState({
    doc: prev,
    past: s.past.slice(0, -1),
    future: [s.doc, ...s.future].slice(0, HISTORY_LIMIT),
    pageId,
    selection: cleanSelection(prev, pageId, s.selection),
    editingTextId: null,
    saveState: "dirty",
  });
}

export function redo() {
  const s = ed();
  if (!s.future.length) return;
  const next = s.future[0];
  const pageId = next.pages.some((p) => p.id === s.pageId) ? s.pageId : next.homePageId;
  useEditor.setState({
    doc: next,
    past: [...s.past, s.doc].slice(-HISTORY_LIMIT),
    future: s.future.slice(1),
    pageId,
    selection: cleanSelection(next, pageId, s.selection),
    editingTextId: null,
    saveState: "dirty",
  });
}

/* ------------------------------------------------------------------ selection */

export function select(ids: string[], opts: { additive?: boolean } = {}) {
  const s = ed();
  let next = ids;
  if (opts.additive) {
    const set = new Set(s.selection);
    for (const id of ids) {
      if (set.has(id)) set.delete(id);
      else set.add(id);
    }
    next = Array.from(set);
  }
  // never select an element together with its own ancestor
  const page = getPage(s);
  next = next.filter((id) => !ancestorIds(page, id).some((a) => next.includes(a)));
  const changed = next.length !== s.selection.length || next.some((id, i) => id !== s.selection[i]);
  if (changed) useEditor.setState({ selection: next, editingTextId: null, rightTab: s.rightTab === "content" || s.rightTab === "events" || s.rightTab === "data" ? s.rightTab : "design" });
}

export function clearSelection() {
  const s = ed();
  if (s.selection.length || s.editingTextId) useEditor.setState({ selection: [], editingTextId: null });
}

export function setPage(pageId: string) {
  const s = ed();
  if (s.pageId === pageId) return;
  useEditor.setState({ pageId, selection: [], editingTextId: null, hoverId: null });
}

/* ------------------------------------------------------------------ element helpers */

/** Where new things go: into the selected container, else onto the page. */
export function insertionParent(): string | null {
  const s = ed();
  const page = getPage(s);
  if (s.selection.length !== 1) return null;
  const sel = page.elements[s.selection[0]];
  if (!sel) return null;
  if (isContainerType(sel.type) && sel.type !== "tabs") return sel.id;
  return null;
}

/** Make sure the page has a hand-editable mobile layout before changing mobile positions. */
export type MobileMaterializer = () => void;
let materializer: MobileMaterializer | null = null;
export function registerMobileMaterializer(fn: MobileMaterializer | null) {
  materializer = fn;
}
export function ensureMobileCustom() {
  const s = ed();
  if (s.bp !== "mobile") return;
  if (getPage(s).mobileCustom) return;
  materializer?.();
}

export function setBox(id: string, box: Partial<Box>, bp: Breakpoint = ed().bp) {
  mutate((_d, page) => {
    const el = page.elements[id];
    if (!el) return;
    if (bp === "desktop") {
      el.box = { ...el.box, ...roundBox(box) };
      if (el.box.r === 0) delete el.box.r;
    } else {
      const current = boxAt(page as Page, el as El, "mobile");
      el.responsive = el.responsive || {};
      el.responsive.mobile = { ...(el.responsive.mobile || {}), ...current, ...roundBox(box) };
    }
  });
}

function roundBox(b: Partial<Box>): Partial<Box> {
  const out: Partial<Box> = {};
  for (const k of ["x", "y", "w", "h", "r"] as const) if (b[k] !== undefined) out[k] = Math.round(b[k]! * 10) / 10;
  if (out.w !== undefined) out.w = Math.max(4, out.w);
  if (out.h !== undefined) out.h = Math.max(4, out.h);
  return out;
}

export function updateEl(id: string, fn: (el: Draft<El>, page: Draft<Page>) => void, opts?: { history?: boolean }) {
  mutate((_d, page) => {
    const el = page.elements[id];
    if (el) fn(el, page);
  }, opts);
}

export function updateEls(ids: string[], fn: (el: Draft<El>, page: Draft<Page>) => void) {
  mutate((_d, page) => {
    for (const id of ids) {
      const el = page.elements[id];
      if (el) fn(el, page);
    }
  });
}

export function setStyle(ids: string[], patch: Partial<Style>) {
  updateEls(ids, (el) => {
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete (el.style as Record<string, unknown>)[k];
      else (el.style as Record<string, unknown>)[k] = v;
    }
  });
}

/** Add a spec (with children) to the page and select it. */
export function addSpec(spec: ElementSpec, opts: { parentId?: string | null; at?: { x: number; y: number }; center?: boolean; select?: boolean } = {}) {
  const s = ed();
  const page = getPage(s);
  let parentId = opts.parentId === undefined ? insertionParent() : opts.parentId;
  if (parentId && !page.elements[parentId]) parentId = null;
  // a list takes only one template; extra items go next to it instead
  if (parentId && page.elements[parentId]?.type === "list" && page.elements[parentId].childIds?.length) parentId = page.elements[parentId].parentId;
  const els = instantiateSpec(deepClone(spec), parentId, layerNames(page));
  const root = els[0];
  const parent = parentId ? page.elements[parentId] : null;
  const phone = isMobileApp(s.doc);
  if (phone) {
    // phone apps: text starts at phone-friendly sizes
    for (const el of els) if (el.type === "text" && el.style.fontSize === undefined) el.style.fontSize = mobileFontSize(defaultFontSize(el));
  }
  // position
  if (!parent || !isAutoLayout(parent)) {
    const pw = parent ? boxAt(page, parent, "desktop").w : frameWidthFor(s.doc, "desktop");
    if (phone && !parent && root.box.w > pw - 32) {
      // keep proportions for pictures, give everything else the full phone width
      if (["image", "video", "shape", "chart"].includes(root.type)) root.box.h = Math.round((root.box.h * (pw - 32)) / root.box.w);
      root.box.w = pw - 32;
    }
    const selected = s.selection.length === 1 ? page.elements[s.selection[0]] : undefined;
    if (opts.at) {
      root.box.x = opts.at.x - (opts.center === false ? 0 : root.box.w / 2);
      root.box.y = opts.at.y - (opts.center === false ? 0 : root.box.h / 2);
    } else if (spec.box?.x === undefined && selected && selected.parentId === parentId && !isContainerType(selected.type)) {
      // building a column of content: new things go right under the selected one
      root.box.x = selected.box.x;
      root.box.y = selected.box.y + selected.box.h + 24;
    } else if (spec.box?.x === undefined) {
      root.box.x = Math.max(0, (pw - root.box.w) / 2);
      root.box.y = parent ? 24 : Math.max(40, visibleCenterY(page) - root.box.h / 2);
      // don't stack exactly on top of something added the same way
      const siblings = childIdsOf(page, parentId).map((id) => page.elements[id]).filter(Boolean);
      const cx = (b: Box) => b.x + b.w / 2;
      const cy = (b: Box) => b.y + b.h / 2;
      for (let i = 0; i < 20 && siblings.some((o) => Math.abs(cx(o.box) - cx(root.box)) < 10 && Math.abs(cy(o.box) - cy(root.box)) < 10); i++) {
        root.box.x += 28;
        root.box.y += 28;
      }
    }
    if (root.box.w > pw && !parent) root.box.w = pw;
    root.box.x = Math.round(root.box.x);
    root.box.y = Math.round(Math.max(0, root.box.y));
  }
  // children of auto-layout parents fill the width by default when they're text/inputs
  if (parent && isAutoLayout(parent) && (root.type === "text" || root.type === "input") && !spec.sizing) root.sizing = { w: "fill", h: "hug" };

  const bp = s.bp;
  mutate((_d, pg) => {
    insertElements(pg as Page, els as El[], parentId);
    // placed while looking at the phone layout: give it a mobile position too
    if (bp === "mobile" && pg.mobileCustom && (!parent || !isAutoLayout(parent))) {
      const r = pg.elements[root.id];
      const mw = parent ? boxAt(pg as Page, parent, "mobile").w : FRAME_WIDTH.mobile;
      const w = Math.min(r.box.w, mw - 24);
      r.responsive = { mobile: { x: Math.round(opts.at ? opts.at.x - w / 2 : (mw - w) / 2), y: Math.round(opts.at ? opts.at.y - r.box.h / 2 : 40), w, h: r.box.h } };
    }
    // keep the page tall enough for what was just added
    if (!parent) {
      const bottom = root.box.y + root.box.h + 40;
      if (bottom > pg.height) pg.height = Math.round(bottom);
    }
  });
  if (opts.select !== false) useEditor.setState({ selection: [root.id], editingTextId: null });
  return root.id;
}

/**
 * Insert a full-width section. With `y` it goes there and pushes everything below it down;
 * without, it goes under the last thing on the page.
 */
export function insertBlock(spec: ElementSpec, y?: number) {
  const s = ed();
  const page = getPage(s);
  const bottom = Math.max(
    0,
    ...page.rootIds.map((id) => {
      const el = page.elements[id];
      return el && !el.hidden && el.type !== "dialog" ? el.box.y + el.box.h : 0;
    }),
  );
  const els = instantiateSpec(deepClone(spec), null, layerNames(page));
  const root = els[0];
  const h = root.box.h;
  // bars that stay on screen: headers go first, tab bars at the bottom of the screen
  if (root.pin === "top") y = 0;
  const top = root.pin === "bottom" ? Math.max(bottom, page.height - h) : y === undefined ? bottom : Math.min(y, bottom);
  root.box.x = 0;
  root.box.y = Math.round(top);
  mutate((_d, pg) => {
    if (y !== undefined && top < bottom) for (const id of pg.rootIds) if (pg.elements[id].box.y >= top - 1) pg.elements[id].box.y += h;
    insertElements(pg as Page, els, null);
    pg.height = Math.max(pg.height + (top < bottom ? h : 0), top + h);
  });
  useEditor.setState({ selection: [root.id], editingTextId: null });
  return root.id;
}

let viewportCenter = { x: 640, y: 400 };
export function setViewportCenter(p: { x: number; y: number }) {
  viewportCenter = p;
}
function visibleCenterY(page: Page) {
  return Math.min(viewportCenter.y, page.height - 60);
}
export function visibleCenter() {
  return viewportCenter;
}

export function deleteSelection() {
  const s = ed();
  const page = getPage(s);
  const ids = s.selection.filter((id) => page.elements[id] && !page.elements[id].locked);
  if (!ids.length) return;
  mutate((_d, pg) => removeElements(pg as Page, ids));
  useEditor.setState({ selection: [], editingTextId: null });
}

/* ------------------------------------------------------------------ clipboard */

const CLIP_KEY = "cb-clipboard";

export function copySelection(cut = false) {
  const s = ed();
  const page = getPage(s);
  if (!s.selection.length) return false;
  const els = extractSubtrees(page, s.selection);
  const data: ClipboardData = { els };
  try {
    localStorage.setItem(CLIP_KEY, JSON.stringify(data));
  } catch {
    /* too big or blocked */
  }
  memoryClipboard = data;
  if (cut) deleteSelection();
  return true;
}

let memoryClipboard: ClipboardData | null = null;

export function readClipboard(): ClipboardData | null {
  try {
    const raw = localStorage.getItem(CLIP_KEY);
    if (raw) return JSON.parse(raw) as ClipboardData;
  } catch {
    /* ignore */
  }
  return memoryClipboard;
}

/** Paste (or duplicate) a copied set of elements, offset so it's visible. */
export function pasteElements(data: ClipboardData | null = readClipboard(), opts: { offset?: number; parentId?: string | null } = {}) {
  if (!data?.els.length) return;
  const s = ed();
  const page = getPage(s);
  let parentId = opts.parentId === undefined ? insertionParent() : opts.parentId;
  const roots = data.els.filter((e) => !e.parentId || !data.els.some((x) => x.id === e.parentId));
  // pasting into one of the copied elements themselves would be odd — use its parent
  if (parentId && roots.some((r) => r.id === parentId || descendantIds(page, r.id).includes(parentId!))) parentId = page.elements[parentId]?.parentId ?? null;
  if (parentId && !page.elements[parentId]) parentId = null;
  const fresh = remapElements(data.els, layerNames(page));
  const freshRoots = fresh.filter((e) => !e.parentId);
  const off = opts.offset ?? 24;
  for (const r of freshRoots) {
    r.box = { ...r.box, x: r.box.x + off, y: r.box.y + off };
    if (r.responsive?.mobile?.x !== undefined) r.responsive.mobile = { ...r.responsive.mobile, x: r.responsive.mobile.x + off / 2, y: (r.responsive.mobile.y ?? 0) + off / 2 };
  }
  mutate((_d, pg) => {
    insertElements(pg as Page, fresh, parentId);
  });
  useEditor.setState({ selection: freshRoots.map((r) => r.id), editingTextId: null });
}

export function duplicateSelection() {
  const s = ed();
  const page = getPage(s);
  if (!s.selection.length) return;
  const els = extractSubtrees(page, s.selection);
  const parentId = page.elements[s.selection[0]]?.parentId ?? null;
  pasteElements({ els }, { parentId, offset: 20 });
}

export function copyStyle() {
  const s = ed();
  const el = s.selection[0] ? getEl(s.selection[0]) : undefined;
  if (el) useEditor.setState({ styleClipboard: deepClone(el.style) });
}

export function pasteStyle() {
  const s = ed();
  if (!s.styleClipboard || !s.selection.length) return;
  const style = s.styleClipboard;
  updateEls(s.selection, (el) => {
    el.style = deepClone(style);
  });
}

/* ------------------------------------------------------------------ structure */

export function reorder(dir: "forward" | "backward" | "front" | "back") {
  const s = ed();
  const ids = s.selection;
  if (!ids.length) return;
  mutate((_d, page) => {
    for (const id of dir === "forward" || dir === "front" ? [...ids].reverse() : ids) {
      const el = page.elements[id];
      if (!el) continue;
      const list = el.parentId ? page.elements[el.parentId].childIds! : page.rootIds;
      const i = list.indexOf(id);
      if (i < 0) continue;
      list.splice(i, 1);
      const to = dir === "front" ? list.length : dir === "back" ? 0 : dir === "forward" ? Math.min(list.length, i + 1) : Math.max(0, i - 1);
      list.splice(to, 0, id);
    }
  });
}

/** Move an element to a new parent (and index), converting its position. */
export function reparent(id: string, newParentId: string | null, opts: { index?: number; frameX?: number; frameY?: number } = {}) {
  mutate((_d, page) => {
    const el = page.elements[id];
    if (!el) return;
    if (newParentId && (newParentId === id || descendantIds(page as Page, id).includes(newParentId))) return;
    const oldList = el.parentId ? page.elements[el.parentId]?.childIds : page.rootIds;
    if (oldList) {
      const i = oldList.indexOf(id);
      if (i >= 0) oldList.splice(i, 1);
    }
    const newList = newParentId ? (page.elements[newParentId].childIds ||= []) : page.rootIds;
    const at = opts.index === undefined ? newList.length : Math.max(0, Math.min(newList.length, opts.index));
    newList.splice(at, 0, id);
    el.parentId = newParentId;
    if (newParentId) delete el.pin;
    if (opts.frameX !== undefined && opts.frameY !== undefined) {
      // frame coordinates -> new parent's coordinates
      let ox = 0;
      let oy = 0;
      let cur = newParentId ? page.elements[newParentId] : null;
      while (cur) {
        ox += cur.box.x;
        oy += cur.box.y;
        cur = cur.parentId ? page.elements[cur.parentId] : null;
      }
      el.box.x = Math.round(opts.frameX - ox);
      el.box.y = Math.round(opts.frameY - oy);
    }
    // moved into an auto layout: drop mobile position (the layout decides)
    if (newParentId && isAutoLayout(page.elements[newParentId] as El) && el.responsive?.mobile) {
      delete el.responsive.mobile.x;
      delete el.responsive.mobile.y;
    }
  });
}

export function groupSelection() {
  const s = ed();
  const page = getPage(s);
  const ids = s.selection.filter((id) => page.elements[id]);
  if (ids.length < 1) return;
  const parentId = page.elements[ids[0]].parentId;
  if (ids.some((id) => page.elements[id].parentId !== parentId)) return;
  const parent = parentId ? page.elements[parentId] : null;
  if (parent && isAutoLayout(parent)) return;
  const boxes = ids.map((id) => page.elements[id].box);
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const b = Math.max(...boxes.map((bb) => bb.y + bb.h));
  const groupId = uid("el");
  const list = parentId ? parent!.childIds! : page.rootIds;
  const order = ids.slice().sort((a, bb) => list.indexOf(a) - list.indexOf(bb));
  const insertAt = list.indexOf(order[order.length - 1]) - (order.length - 1);
  mutate((_d, pg) => {
    const group: El = {
      id: groupId,
      type: "box",
      name: uniqueName("Group", Object.values(pg.elements).map((e) => e.name)).replace(/\s/g, ""),
      parentId,
      childIds: order,
      box: { x, y, w: r - x, h: b - y },
      style: {},
      props: { layout: { ...DEFAULT_LAYOUT } },
    };
    const sibs = parentId ? pg.elements[parentId].childIds! : pg.rootIds;
    for (const id of order) {
      const i = sibs.indexOf(id);
      if (i >= 0) sibs.splice(i, 1);
      const el = pg.elements[id];
      el.parentId = groupId;
      delete el.pin;
      el.box.x -= x;
      el.box.y -= y;
      if (el.responsive?.mobile) delete el.responsive.mobile;
    }
    sibs.splice(Math.max(0, insertAt), 0, groupId);
    pg.elements[groupId] = group;
  });
  useEditor.setState({ selection: [groupId] });
}

export function ungroupSelection() {
  const s = ed();
  const page = getPage(s);
  const groups = s.selection.map((id) => page.elements[id]).filter((e): e is El => !!e && e.type === "box" && !!e.childIds?.length && !isAutoLayout(e));
  if (!groups.length) return;
  const released: string[] = [];
  mutate((_d, pg) => {
    for (const g of groups) {
      const grp = pg.elements[g.id];
      const sibs = grp.parentId ? pg.elements[grp.parentId].childIds! : pg.rootIds;
      const at = sibs.indexOf(grp.id);
      const kids = grp.childIds || [];
      for (const cid of kids) {
        const c = pg.elements[cid];
        c.parentId = grp.parentId;
        c.box.x += grp.box.x;
        c.box.y += grp.box.y;
        if (c.responsive?.mobile) delete c.responsive.mobile;
        released.push(cid);
      }
      sibs.splice(at, 1, ...kids);
      delete pg.elements[grp.id];
    }
  });
  useEditor.setState({ selection: released });
}

export function toggleLock(ids = ed().selection) {
  const page = getPage();
  const lock = !ids.every((id) => page.elements[id]?.locked);
  updateEls(ids, (el) => {
    if (lock) el.locked = true;
    else delete el.locked;
  });
}

export function toggleHidden(ids = ed().selection) {
  const page = getPage();
  const hide = !ids.every((id) => page.elements[id]?.hidden);
  updateEls(ids, (el) => {
    if (hide) el.hidden = true;
    else delete el.hidden;
  });
}

export function renameEl(id: string, name: string) {
  const clean = name.trim().replace(/[{}.|]/g, "").slice(0, 60);
  if (!clean) return;
  updateEl(id, (el) => {
    el.name = clean;
  });
}

/* ------------------------------------------------------------------ align & distribute */

export type AlignKind = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

export function alignSelection(kind: AlignKind) {
  const s = ed();
  const page = getPage(s);
  const bp = s.bp;
  const ids = s.selection.filter((id) => page.elements[id] && inFreeParent(page, page.elements[id]) && !page.elements[id].locked);
  if (!ids.length) return;
  if (bp === "mobile") ensureMobileCustom();
  const pg = getPage();
  const boxes = ids.map((id) => ({ id, b: boxAt(pg, pg.elements[id], bp) }));
  let ref: { x: number; y: number; w: number; h: number };
  if (ids.length === 1) {
    const el = pg.elements[ids[0]];
    const pw = parentWidth(pg, el, bp);
    const ph = el.parentId ? boxAt(pg, pg.elements[el.parentId], bp).h : bp === "desktop" ? pg.height : pg.heights?.mobile || 800;
    ref = { x: 0, y: 0, w: pw, h: ph };
  } else {
    const x = Math.min(...boxes.map((o) => o.b.x));
    const y = Math.min(...boxes.map((o) => o.b.y));
    ref = { x, y, w: Math.max(...boxes.map((o) => o.b.x + o.b.w)) - x, h: Math.max(...boxes.map((o) => o.b.y + o.b.h)) - y };
  }
  beginGesture();
  for (const { id, b } of boxes) {
    const next: Partial<Box> = {};
    if (kind === "left") next.x = ref.x;
    if (kind === "hcenter") next.x = ref.x + (ref.w - b.w) / 2;
    if (kind === "right") next.x = ref.x + ref.w - b.w;
    if (kind === "top") next.y = ref.y;
    if (kind === "vcenter") next.y = ref.y + (ref.h - b.h) / 2;
    if (kind === "bottom") next.y = ref.y + ref.h - b.h;
    setBox(id, next, bp);
  }
  endGesture();
}

export function distributeSelection(axis: "x" | "y") {
  const s = ed();
  const page = getPage(s);
  const bp = s.bp;
  const ids = s.selection.filter((id) => page.elements[id] && inFreeParent(page, page.elements[id]));
  if (ids.length < 3) return;
  if (bp === "mobile") ensureMobileCustom();
  const pg = getPage();
  const items = ids.map((id) => ({ id, b: boxAt(pg, pg.elements[id], bp) })).sort((a, b) => (axis === "x" ? a.b.x - b.b.x : a.b.y - b.b.y));
  const start = axis === "x" ? items[0].b.x : items[0].b.y;
  const last = items[items.length - 1];
  const end = axis === "x" ? last.b.x + last.b.w : last.b.y + last.b.h;
  const total = items.reduce((sum, it) => sum + (axis === "x" ? it.b.w : it.b.h), 0);
  const gap = (end - start - total) / (items.length - 1);
  let cursor = start;
  beginGesture();
  for (const it of items) {
    setBox(it.id, axis === "x" ? { x: cursor } : { y: cursor }, bp);
    cursor += (axis === "x" ? it.b.w : it.b.h) + gap;
  }
  endGesture();
}

/* ------------------------------------------------------------------ mobile layout */

export function materializeMobile(rects: Map<string, Box>, height: number, fontSizes: Map<string, number>) {
  mutate((_d, page) => applyMobileRects(page as Page, rects, height, fontSizes));
}

export function resetMobile() {
  mutate((_d, page) => resetMobileLayout(page as Page));
}

/* ------------------------------------------------------------------ pages */

export function addPage(name = "New page", opts: { duplicateOf?: string } = {}) {
  const s = ed();
  let page: Page;
  if (opts.duplicateOf) {
    const src = s.doc.pages.find((p) => p.id === opts.duplicateOf);
    if (!src) return;
    page = deepClone(src);
    page.id = uid("pg");
    page.name = uniqueName(`${src.name} copy`, s.doc.pages.map((p) => p.name));
    const srcEls = Object.values(src.elements);
    const fresh = remapElements(srcEls, new Set());
    const idMap = new Map(srcEls.map((e, i) => [e.id, fresh[i].id]));
    page.elements = Object.fromEntries(fresh.map((e) => [e.id, e]));
    page.rootIds = src.rootIds.map((id) => idMap.get(id)!).filter(Boolean);
    page.onLoad = page.onLoad?.map((a) => ({ ...a, id: uid("act"), targetId: a.targetId && idMap.get(a.targetId) ? idMap.get(a.targetId) : a.targetId }));
  } else {
    page = newPage(uniqueName(name, s.doc.pages.map((p) => p.name)), "");
    if (isMobileApp(s.doc)) {
      page.height = PHONE_PAGE_HEIGHT;
      // every screen of a phone app gets the home screen's pinned header / tab bar
      const home = s.doc.pages.find((p) => p.id === s.doc.homePageId);
      const pinned = home ? home.rootIds.filter((id) => home.elements[id]?.pin) : [];
      if (home && pinned.length) {
        const srcEls = extractSubtrees(home, pinned);
        const fresh = remapElements(srcEls, new Set());
        page.elements = Object.fromEntries(fresh.map((e) => [e.id, e]));
        page.rootIds = fresh.filter((e) => !e.parentId).map((e) => e.id);
        for (const id of page.rootIds) {
          const el = page.elements[id];
          if (el.pin === "bottom") el.box.y = page.height - el.box.h;
          if (el.pin === "top") el.box.y = 0;
        }
      }
    }
  }
  page.path = pagePathFor(page.name, s.doc.pages);
  mutate((d) => {
    d.pages.push(page);
  });
  useEditor.setState({ pageId: page.id, selection: [] });
  return page.id;
}

export function deletePage(pageId: string) {
  const s = ed();
  if (s.doc.pages.length <= 1) return;
  mutate((d) => {
    d.pages = d.pages.filter((p) => p.id !== pageId);
    if (d.homePageId === pageId) {
      d.homePageId = d.pages[0].id;
      d.pages[0].path = "";
    }
  });
  if (s.pageId === pageId) useEditor.setState({ pageId: ed().doc.homePageId, selection: [] });
}

export function updatePage(pageId: string, fn: (p: Draft<Page>, d: Draft<AppDoc>) => void) {
  mutate((d) => {
    const p = d.pages.find((x) => x.id === pageId);
    if (p) fn(p, d);
  });
}

export function setHomePage(pageId: string) {
  mutate((d) => {
    const oldHome = d.pages.find((p) => p.id === d.homePageId);
    const next = d.pages.find((p) => p.id === pageId);
    if (!next || !oldHome || oldHome === next) return;
    oldHome.path = pagePathFor(oldHome.name, d.pages as Page[], oldHome.id);
    next.path = "";
    d.homePageId = pageId;
  });
}

export function movePage(pageId: string, dir: -1 | 1) {
  mutate((d) => {
    const i = d.pages.findIndex((p) => p.id === pageId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= d.pages.length) return;
    const [p] = d.pages.splice(i, 1);
    d.pages.splice(j, 0, p);
  });
}

/* ------------------------------------------------------------------ misc */

export function setCollections(collections: Collection[]) {
  useEditor.setState((s) => ({ collections, dataVersion: s.dataVersion + 1 }));
}

export function bumpData() {
  useEditor.setState((s) => ({ dataVersion: s.dataVersion + 1 }));
}

/** Elements whose height follows their content keep `box.h` in sync with what's rendered. */
export function syncHugHeights(measured: Map<string, number>) {
  const s = ed();
  const page = getPage(s);
  const bp = s.bp;
  const changes: [string, number][] = [];
  for (const [id, h] of measured) {
    const el = page.elements[id];
    if (!el || !isHugHeight(el)) continue;
    const cur = bp === "desktop" ? el.box.h : el.responsive?.mobile?.h;
    if (bp === "mobile" && !page.mobileCustom) continue;
    if (cur === undefined || Math.abs(cur - h) > 1) changes.push([id, Math.round(h)]);
  }
  if (!changes.length) return;
  mutate(
    (_d, pg) => {
      for (const [id, h] of changes) {
        const el = pg.elements[id];
        if (bp === "desktop") el.box.h = h;
        else if (el.responsive?.mobile) el.responsive.mobile.h = h;
      }
    },
    { history: false },
  );
}

export function elementLabel(el: El): string {
  return el.name || ELEMENT_INFO[el.type].label;
}

export { childIdsOf, isContainerType };
