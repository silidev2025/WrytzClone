"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { El, Page } from "@/lib/shared/types";
import { ancestorIds, descendantIds, isAncestor } from "@/lib/shared/doc";
import { isAutoLayout, layoutOf } from "@/lib/shared/elements";
import { frameWidthFor, isHugHeight } from "@/lib/shared/layout";
import { api, errorMessage } from "@/lib/client/api";
import { RuntimeContext, createRuntimeStore, type SchemaCollection } from "@/components/runtime/store";
import { PageFrame } from "@/components/runtime/PageView";
import { docFonts, useGoogleFonts } from "@/components/runtime/fonts";
import { invalidateAll } from "@/components/runtime/api";
import { effectiveFontSize } from "@/components/runtime/styles";
import { toast } from "@/components/ui/toast";
import {
  addSpec,
  insertBlock,
  beginGesture,
  boxAt,
  clearSelection,
  ed,
  endGesture,
  ensureMobileCustom,
  getPage,
  inFreeParent,
  materializeMobile,
  mutate,
  registerMobileMaterializer,
  reparent,
  select,
  setViewportCenter,
  syncHugHeights,
  updateEl,
  useEditor,
  type Guide,
} from "../store";
import { angleFrom, resizeRotated, snapMove, snapResize, unionRect, type Handle, type Rect } from "./geometry";
import { registerDropTarget, type Payload } from "./dragPayload";
import { Overlay } from "./Overlay";
import { CanvasScrollbars, CanvasZoomButtons, PeersOverlay } from "./CanvasExtras";
import { liveCursor } from "../live";
import { useCanvasContextMenu } from "./contextMenu";

/* ------------------------------------------------------------------ DOM helpers */

export function frameNode(host: HTMLElement | null): HTMLElement | null {
  return host?.querySelector<HTMLElement>(".rt-frame") ?? null;
}

export function elNode(frame: HTMLElement, id: string): HTMLElement | null {
  return frame.querySelector<HTMLElement>(`[data-el-id="${CSS.escape(id)}"]`);
}

export interface FrameBox {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

/** An element's box in frame coordinates (unrotated box + rotation when known). */
export function elFrameBox(page: Page, el: El, frame: HTMLElement, zoom: number): FrameBox | null {
  const node = elNode(frame, el.id);
  if (!node) return null;
  const s = ed();
  const fr = frame.getBoundingClientRect();
  const flow = s.bp === "mobile" && !page.mobileCustom;
  if (!flow && inFreeParent(page, el)) {
    let ox = 0;
    let oy = 0;
    if (el.parentId) {
      const pn = elNode(frame, el.parentId);
      if (!pn) return null;
      const pr = pn.getBoundingClientRect();
      ox = (pr.left - fr.left) / zoom + pn.clientLeft;
      oy = (pr.top - fr.top) / zoom + pn.clientTop;
    }
    const b = boxAt(page, el, s.bp);
    return { x: ox + b.x, y: oy + b.y, w: b.w, h: isHugHeight(el) ? node.offsetHeight : b.h, r: b.r || 0 };
  }
  const r = node.getBoundingClientRect();
  return { x: (r.left - fr.left) / zoom, y: (r.top - fr.top) / zoom, w: r.width / zoom, h: r.height / zoom, r: 0 };
}

function isPlainGroup(el: El | undefined): boolean {
  return !!el && el.type === "box" && !el.style.fill && !el.style.borderWidth && !el.style.shadow && !isAutoLayout(el);
}

/** Figma-like hit resolution: a click lands on the outermost group that isn't "entered" yet. */
function resolveHit(page: Page, id: string, deep: boolean): string {
  if (deep) return id;
  const sel = ed().selection;
  let result = id;
  for (const a of ancestorIds(page, id)) {
    if (!isPlainGroup(page.elements[a])) continue;
    const entered = sel.some((sid) => sid === a || isAncestor(page, a, sid));
    if (!entered) result = a;
  }
  return result;
}

function toSchema(cols: ReturnType<typeof ed>["collections"]): SchemaCollection[] {
  return cols.map((c) => ({
    id: c.id,
    name: c.name,
    access: c.access,
    fields: c.fields.map((f) => ({ id: f.id, name: f.name, type: f.type, required: !!f.required, options: f.options, currency: f.currency, refCollectionId: f.refCollectionId, min: f.min, max: f.max })),
  }));
}

/* ------------------------------------------------------------------ interaction state */

type Drag =
  | { kind: "pan"; startX: number; startY: number; pan: { x: number; y: number } }
  | { kind: "pending"; startX: number; startY: number; ids: string[]; hitId: string; drill: string | null; pointerId: number }
  | {
      kind: "move";
      startX: number;
      startY: number;
      ids: string[];
      starts: Map<string, { x: number; y: number }>;
      union: Rect;
      targets: Rect[];
      parentId: string | null;
    }
  | { kind: "reorder"; id: string; parentId: string; startIndex: number; index: number; out: boolean; startX: number; startY: number }
  | {
      kind: "resize";
      id: string;
      handle: Handle;
      startX: number;
      startY: number;
      start: { x: number; y: number; w: number; h: number; r?: number };
      frameOrigin: { x: number; y: number };
      free: boolean;
      targets: Rect[];
      keepRatio: boolean;
    }
  | { kind: "rotate"; id: string; center: { x: number; y: number } }
  | { kind: "marquee"; startX: number; startY: number; additive: boolean; base: string[] }
  | { kind: "height"; startY: number; start: number }
  /** two fingers: zoom around their midpoint and pan with it */
  | { kind: "pinch"; dist: number; zoom: number; mid: { x: number; y: number }; pan: { x: number; y: number } }
  /** one finger that may become a pan (moved) or a tap (didn't) */
  | { kind: "touch"; startX: number; startY: number; pan: { x: number; y: number }; tapId: string | null; moved: boolean };

const TOUCH_SLOP = 8;

/* ------------------------------------------------------------------ component */

export function Canvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const spaceRef = useRef(false);
  // fingers currently on the canvas (touch screens)
  const touches = useRef(new Map<number, { x: number; y: number }>());

  const doc = useEditor((s) => s.doc);
  const pageId = useEditor((s) => s.pageId);
  const bp = useEditor((s) => s.bp);
  const zoom = useEditor((s) => s.zoom);
  const pan = useEditor((s) => s.pan);
  const selection = useEditor((s) => s.selection);
  const editingTextId = useEditor((s) => s.editingTextId);
  const showDialogs = useEditor((s) => s.showDialogs);
  const collections = useEditor((s) => s.collections);
  const user = useEditor((s) => s.user);
  const app = useEditor((s) => s.app);
  const dataVersion = useEditor((s) => s.dataVersion);
  const tabsShown = useEditor((s) => s.tabsShown);
  const ctxMenu = useCanvasContextMenu();

  useGoogleFonts(docFonts(doc));

  /* runtime store that renders the canvas */
  const rt = useMemo(
    () => createRuntimeStore({ mode: "editor", appId: app.id, appName: app.name, doc, bp, pageId }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useLayoutEffect(() => {
    rt.setState({
      doc,
      pageId,
      bp,
      selection,
      showDialogs,
      editingId: editingTextId,
      schema: toSchema(collections),
      user: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor, isAdmin: true },
      tabs: tabsShown,
      appName: app.name,
      commitText: (id, text) => {
        const el = getPage().elements[id];
        if (el) {
          const key = el.type === "button" ? "label" : "text";
          if ((el.props as Record<string, unknown>)[key] !== text)
            updateEl(id, (e) => {
              (e.props as Record<string, unknown>)[key] = text;
            });
        }
        if (ed().editingTextId === id) useEditor.setState({ editingTextId: null });
      },
      selectTab: (tabsId, index) => useEditor.setState((s) => ({ tabsShown: { ...s.tabsShown, [tabsId]: index } })),
    });
  }, [rt, doc, pageId, bp, selection, showDialogs, editingTextId, collections, user, tabsShown, app.name]);

  useEffect(() => {
    invalidateAll();
    rt.setState((s) => ({ dataVersion: s.dataVersion + 1 }));
  }, [rt, dataVersion]);

  /* ------------------------------------------------ view helpers */
  const frame = useCallback(() => frameNode(hostRef.current), []);

  const zoomTo = useCallback((next: number, anchor?: { x: number; y: number }) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const s = ed();
    const z = Math.max(0.1, Math.min(4, next));
    const a = anchor ?? { x: vp.clientWidth / 2, y: vp.clientHeight / 2 };
    const px = a.x - (a.x - s.pan.x) * (z / s.zoom);
    const py = a.y - (a.y - s.pan.y) * (z / s.zoom);
    useEditor.setState({ zoom: z, pan: { x: px, y: py } });
  }, []);

  const fit = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const s = ed();
    const fw = frameWidthFor(s.doc, s.bp);
    const z = Math.max(0.15, Math.min(1, (vp.clientWidth - 96) / fw));
    useEditor.setState({ zoom: z, pan: { x: (vp.clientWidth - fw * z) / 2, y: 48 } });
  }, []);

  useEffect(() => {
    fit();
  }, [bp, fit]);

  useEffect(() => {
    const onFit = () => fit();
    const onZoom = (e: Event) => zoomTo((e as CustomEvent<number>).detail);
    window.addEventListener("cb:fit", onFit);
    window.addEventListener("cb:zoom", onZoom);
    return () => {
      window.removeEventListener("cb:fit", onFit);
      window.removeEventListener("cb:zoom", onZoom);
    };
  }, [fit, zoomTo]);

  // the centre of the visible canvas, in frame coordinates (new elements go there)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    setViewportCenter({ x: (vp.clientWidth / 2 - pan.x) / zoom, y: (vp.clientHeight / 2 - pan.y) / zoom });
  }, [pan, zoom]);

  /* ------------------------------------------------ freeze the auto mobile layout */
  useEffect(() => {
    registerMobileMaterializer(() => {
      const f = frame();
      const s = ed();
      const page = getPage(s);
      if (!f || s.bp !== "mobile" || page.mobileCustom) return;
      const z = s.zoom;
      const fr = f.getBoundingClientRect();
      const rects = new Map<string, { x: number; y: number; w: number; h: number }>();
      const fonts = new Map<string, number>();
      for (const el of Object.values(page.elements)) {
        if (el.parentId) {
          const parent = page.elements[el.parentId];
          if (!parent || isAutoLayout(parent) || parent.type === "list" || parent.type === "tabs") continue;
        }
        if (el.type === "dialog") {
          rects.set(el.id, { x: 16, y: 60, w: Math.min(el.box.w, 358), h: el.box.h });
          continue;
        }
        const node = elNode(f, el.id);
        if (!node) continue;
        const r = node.getBoundingClientRect();
        let ox = fr.left;
        let oy = fr.top;
        if (el.parentId) {
          const pn = elNode(f, el.parentId);
          if (!pn) continue;
          const pr = pn.getBoundingClientRect();
          ox = pr.left + pn.clientLeft * z;
          oy = pr.top + pn.clientTop * z;
        }
        rects.set(el.id, { x: (r.left - ox) / z, y: (r.top - oy) / z, w: r.width / z, h: r.height / z });
        if (el.type === "text") fonts.set(el.id, effectiveFontSize(el, "mobile"));
      }
      materializeMobile(rects, fr.height / z, fonts);
    });
    return () => registerMobileMaterializer(null);
  }, [frame]);

  /* ------------------------------------------------ keep hug heights in sync */
  useEffect(() => {
    const t = setInterval(() => {
      const f = frame();
      const s = ed();
      if (!f || s.gesture > 0 || s.editingTextId) return;
      const page = getPage(s);
      const measured = new Map<string, number>();
      for (const el of Object.values(page.elements)) {
        if (!isHugHeight(el)) continue;
        const node = elNode(f, el.id);
        if (node) measured.set(el.id, node.offsetHeight);
      }
      syncHugHeights(measured);
    }, 400);
    return () => clearInterval(t);
  }, [frame]);

  /* ------------------------------------------------ wheel: zoom + scroll */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest?.(".rt-text-editing")) return;
      e.preventDefault();
      const s = ed();
      const rect = vp.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022));
        zoomTo(s.zoom * factor, { x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        useEditor.setState({ pan: { x: s.pan.x - dx, y: s.pan.y - dy } });
      }
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  /* space bar = hand tool */
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !typing(e.target)) {
        if (!spaceRef.current) viewportRef.current?.classList.add("hand");
        spaceRef.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceRef.current = false;
        viewportRef.current?.classList.remove("hand");
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* ------------------------------------------------ drop targets for panel drags + files */
  const containerAt = useCallback(
    (clientX: number, clientY: number, exclude: Set<string>): string | null => {
      const f = frame();
      if (!f) return null;
      const page = getPage();
      for (const node of document.elementsFromPoint(clientX, clientY)) {
        const id = node.getAttribute("data-el-id");
        if (!id || !f.contains(node) || exclude.has(id)) continue;
        const el = page.elements[id];
        if (!el || el.locked) continue;
        if (el.type === "box" || el.type === "form" || el.type === "dialog") return id;
        if (el.type === "list" && !el.childIds?.length) return id;
      }
      return null;
    },
    [frame],
  );

  const toFrame = useCallback(
    (clientX: number, clientY: number) => {
      const f = frame();
      const z = ed().zoom;
      if (!f) return { x: 0, y: 0 };
      const r = f.getBoundingClientRect();
      return { x: (clientX - r.left) / z, y: (clientY - r.top) / z };
    },
    [frame],
  );

  /** Position (in the container's own coordinates) for something dropped at a point. */
  const localPoint = useCallback(
    (containerId: string | null, clientX: number, clientY: number) => {
      const p = toFrame(clientX, clientY);
      if (!containerId) return p;
      const f = frame();
      const page = getPage();
      const el = page.elements[containerId];
      const fb = f && el ? elFrameBox(page, el, f, ed().zoom) : null;
      return fb ? { x: p.x - fb.x, y: p.y - fb.y } : p;
    },
    [frame, toFrame],
  );

  const insideViewport = (clientX: number, clientY: number) => {
    const r = viewportRef.current?.getBoundingClientRect();
    return !!r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  };

  const dropImageOnImage = useCallback((src: string, clientX: number, clientY: number) => {
    const f = frame();
    if (!f) return false;
    const page = getPage();
    for (const node of document.elementsFromPoint(clientX, clientY)) {
      const id = node.getAttribute("data-el-id");
      if (!id || !f.contains(node)) continue;
      const el = page.elements[id];
      if (el?.type === "image" && !el.locked) {
        updateEl(id, (e) => {
          e.props.src = src;
        });
        select([id]);
        return true;
      }
      if (el && (el.type === "shape" || el.type === "box") && !el.locked && ed().selection.includes(id)) {
        updateEl(id, (e) => {
          e.style.fill = { type: "image", src, fit: "cover" };
        });
        return true;
      }
      break;
    }
    return false;
  }, [frame]);

  useEffect(() => {
    registerDropTarget({
      over: (p, x, y) => {
        if (!insideViewport(x, y)) {
          if (ed().dropTargetId !== undefined) useEditor.setState({ dropTargetId: undefined });
          return;
        }
        const target = containerAt(x, y, new Set());
        if (ed().dropTargetId !== target) useEditor.setState({ dropTargetId: target });
        void p;
      },
      leave: () => useEditor.setState({ dropTargetId: undefined }),
      drop: (p: Payload, x, y) => {
        useEditor.setState({ dropTargetId: undefined });
        if (!insideViewport(x, y)) return false;
        if (p.kind === "image" && dropImageOnImage(p.src, x, y)) return true;
        if (p.kind === "block") {
          // full-width sections go on the page itself, starting where they were dropped
          const at = localPoint(null, x, y);
          insertBlock(p.spec, Math.max(0, Math.round(at.y)));
          return true;
        }
        const target = containerAt(x, y, new Set());
        const at = localPoint(target, x, y);
        if (p.kind === "spec") addSpec(p.spec, { parentId: target, at });
        else if (p.kind === "image") {
          const w = Math.min(420, p.width || 360);
          const h = p.width && p.height ? Math.round((w * p.height) / p.width) : 260;
          addSpec({ type: "image", box: { w, h }, props: { src: p.src, alt: p.label } }, { parentId: target, at });
        } else if (p.kind === "icon") addSpec({ type: "icon", box: { w: 64, h: 64 }, props: { icon: p.icon } }, { parentId: target, at });
        return true;
      },
    });
    return () => registerDropTarget(null);
  }, [containerAt, localPoint, dropImageOnImage]);

  const onFileDrop = async (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    for (const file of files.slice(0, 6)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("appId", ed().app.id);
        const { media } = await api<{ media: { url: string; name: string } }>("/api/media", { body: fd });
        const dims = await imageSize(media.url);
        if (!dropImageOnImage(media.url, x, y)) {
          const target = containerAt(x, y, new Set());
          const w = Math.min(420, dims.w);
          addSpec({ type: "image", box: { w, h: Math.round((w * dims.h) / dims.w) }, props: { src: media.url, alt: media.name } }, { parentId: target, at: localPoint(target, x, y) });
        }
        window.dispatchEvent(new Event("cb:media-changed"));
      } catch (err) {
        toast.error(errorMessage(err));
      }
    }
  };

  /* ------------------------------------------------ pointer interactions */
  const threshold = () => 6 / ed().zoom;

  const snapTargets = (page: Page, parentId: string | null, exclude: Set<string>, f: HTMLElement, z: number): Rect[] => {
    const targets: Rect[] = [];
    const parent = parentId ? page.elements[parentId] : null;
    const pb = parent ? elFrameBox(page, parent, f, z) : null;
    const fr = f.getBoundingClientRect();
    targets.push(pb ? { x: pb.x, y: pb.y, w: pb.w, h: pb.h } : { x: 0, y: 0, w: fr.width / z, h: fr.height / z });
    const sibs = parentId ? parent?.childIds || [] : page.rootIds;
    for (const id of sibs) {
      if (exclude.has(id)) continue;
      const el = page.elements[id];
      if (!el || el.hidden || el.type === "dialog") continue;
      const b = elFrameBox(page, el, f, z);
      if (b) targets.push({ x: b.x, y: b.y, w: b.w, h: b.h });
    }
    return targets;
  };

  const beginMove = (ids: string[], startX: number, startY: number): Drag | null => {
    const f = frame();
    if (!f) return null;
    let page = getPage();
    const movable = ids.filter((id) => page.elements[id] && !page.elements[id].locked);
    if (!movable.length) return null;
    const first = page.elements[movable[0]];
    // a child of an auto layout: reorder instead of moving freely
    if (movable.length === 1 && first.parentId && !inFreeParent(page, first)) {
      const parent = page.elements[first.parentId];
      if (!parent || parent.type === "list" || parent.type === "tabs") return null;
      beginGesture();
      const idx = parent.childIds!.indexOf(first.id);
      return { kind: "reorder", id: first.id, parentId: parent.id, startIndex: idx, index: idx, out: false, startX, startY };
    }
    const free = movable.filter((id) => inFreeParent(page, page.elements[id]));
    if (!free.length) return null;
    if (ed().bp === "mobile" && !page.mobileCustom) {
      ensureMobileCustom();
      page = getPage();
    }
    beginGesture();
    const z = ed().zoom;
    const starts = new Map<string, { x: number; y: number }>();
    const frameRects: Rect[] = [];
    for (const id of free) {
      const el = page.elements[id];
      const b = boxAt(page, el, ed().bp);
      starts.set(id, { x: b.x, y: b.y });
      const fb = elFrameBox(page, el, f, z);
      if (fb) frameRects.push({ x: fb.x, y: fb.y, w: fb.w, h: fb.h });
    }
    const exclude = new Set<string>();
    for (const id of free) {
      exclude.add(id);
      for (const d of descendantIds(page, id)) exclude.add(d);
    }
    const parentId = page.elements[free[0]].parentId;
    return {
      kind: "move",
      startX,
      startY,
      ids: free,
      starts,
      union: frameRects.length ? unionRect(frameRects) : { x: 0, y: 0, w: 1, h: 1 },
      targets: snapTargets(page, parentId, exclude, f, z),
      parentId,
    };
  };

  /** A second finger turns whatever the first one started into a pinch. */
  const startPinch = (vp: HTMLDivElement) => {
    const d = dragRef.current;
    if (d && (d.kind === "move" || d.kind === "resize" || d.kind === "rotate" || d.kind === "height" || d.kind === "reorder")) endGesture();
    useEditor.setState({ guides: [], dropTargetId: undefined, insertLine: null, marquee: null });
    const [a, b] = [...touches.current.values()];
    const r = vp.getBoundingClientRect();
    const s = ed();
    dragRef.current = {
      kind: "pinch",
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      zoom: s.zoom,
      mid: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top },
      pan: { ...s.pan },
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const target = e.target as HTMLElement;
    if (target.closest(".rt-text-editing")) return;
    if (target.closest("[data-canvas-ui]")) return;
    ctxMenu.close();

    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      vp.setPointerCapture(e.pointerId);
      if (touches.current.size === 2) return startPinch(vp);
      if (touches.current.size > 2) return;
      // one finger: resize handles and already-selected elements behave as with a mouse; anything
      // else scrolls the canvas when dragged, and selects when tapped
      const s0 = ed();
      const page0 = getPage(s0);
      const f0 = frame();
      // browsers snap touches onto nearby small controls (like the page-height handle): use what's
      // really under the finger, so a drag next to a handle scrolls instead of resizing
      const under = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null) ?? target;
      const handle = under.closest("[data-handle]");
      const node0 = under.closest<HTMLElement>("[data-el-id]");
      const hit0 = node0 && f0?.contains(node0) && page0.elements[node0.dataset.elId!] ? resolveHit(page0, node0.dataset.elId!, false) : null;
      const onSelected = !!hit0 && s0.selection.some((id) => id === hit0 || isAncestor(page0, id, hit0));
      if (!handle && !onSelected && !under.closest("[data-tab-index]")) {
        dragRef.current = { kind: "touch", startX: e.clientX, startY: e.clientY, pan: { ...s0.pan }, tapId: hit0, moved: false };
        return;
      }
    }

    // pan: middle button, space + drag, or right-button drag on empty canvas
    if (e.button === 1 || (e.button === 0 && spaceRef.current)) {
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      dragRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, pan: { ...ed().pan } };
      vp.classList.add("panning");
      return;
    }
    if (e.button !== 0) return;
    const s = ed();
    if (s.editingTextId) {
      // finish in-place text editing: blurring saves the text, then leaves edit mode
      const active = document.activeElement as HTMLElement | null;
      if (active?.isContentEditable) active.blur();
      if (ed().editingTextId) useEditor.setState({ editingTextId: null });
    }

    const handleEl = target.closest<HTMLElement>("[data-handle]");
    if (handleEl) {
      const kind = handleEl.dataset.handle!;
      const id = s.selection[0];
      const f = frame();
      let page = getPage();
      const el = id ? page.elements[id] : undefined;
      if (!el || !f) return;
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      if (kind === "height") {
        const start = s.bp === "desktop" ? page.height : page.heights?.mobile || f.getBoundingClientRect().height / s.zoom;
        if (s.bp === "mobile") ensureMobileCustom();
        beginGesture();
        dragRef.current = { kind: "height", startY: e.clientY, start };
        return;
      }
      const free = inFreeParent(page, el);
      if (free && s.bp === "mobile" && !page.mobileCustom) {
        ensureMobileCustom();
        page = getPage();
      }
      const fb = elFrameBox(page, page.elements[id], f, s.zoom);
      if (!fb) return;
      beginGesture();
      if (kind === "rotate") {
        const fr = f.getBoundingClientRect();
        dragRef.current = { kind: "rotate", id, center: { x: fr.left + (fb.x + fb.w / 2) * s.zoom, y: fr.top + (fb.y + fb.h / 2) * s.zoom } };
        return;
      }
      const cur = page.elements[id];
      const b = free ? boxAt(page, cur, s.bp) : { x: 0, y: 0, w: fb.w, h: fb.h };
      const exclude = new Set([id, ...descendantIds(page, id)]);
      dragRef.current = {
        kind: "resize",
        id,
        handle: kind as Handle,
        startX: e.clientX,
        startY: e.clientY,
        start: { x: b.x, y: b.y, w: b.w, h: isHugHeight(cur) ? fb.h : b.h, r: b.r },
        frameOrigin: { x: fb.x - b.x, y: fb.y - b.y },
        free,
        targets: free ? snapTargets(page, cur.parentId, exclude, f, s.zoom) : [],
        keepRatio: ["image", "icon", "video"].includes(cur.type),
      };
      return;
    }

    const tabNode = target.closest<HTMLElement>("[data-tab-index]");
    if (tabNode?.dataset.tabsId) {
      const tabsId = tabNode.dataset.tabsId;
      useEditor.setState((st) => ({ tabsShown: { ...st.tabsShown, [tabsId]: Number(tabNode.dataset.tabIndex) } }));
      select([tabsId]);
      return;
    }

    const f = frame();
    const node = target.closest<HTMLElement>("[data-el-id]");
    const page = getPage();
    if (!node || !f || !f.contains(node) || !page.elements[node.dataset.elId!]) {
      // empty canvas: start a selection box
      vp.setPointerCapture(e.pointerId);
      dragRef.current = { kind: "marquee", startX: e.clientX, startY: e.clientY, additive: e.shiftKey, base: e.shiftKey ? s.selection : [] };
      if (!e.shiftKey) clearSelection();
      return;
    }
    const rawId = node.dataset.elId!;
    const hitId = resolveHit(page, rawId, e.altKey || e.ctrlKey || e.metaKey);
    if (e.shiftKey) {
      select([hitId], { additive: true });
      return;
    }
    const selectedAncestor = s.selection.find((id) => id === hitId || isAncestor(page, id, hitId)) || null;
    const ids = selectedAncestor ? s.selection : [hitId];
    if (!selectedAncestor) select([hitId]);
    vp.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "pending", startX: e.clientX, startY: e.clientY, ids, hitId, drill: selectedAncestor && selectedAncestor !== hitId ? hitId : null, pointerId: e.pointerId };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    else if (e.pointerType !== "touch") liveCursor(toFrame(e.clientX, e.clientY));
    const d = dragRef.current;
    const s = ed();
    if (d?.kind === "pinch") {
      const vp = viewportRef.current;
      const pts = [...touches.current.values()];
      if (!vp || pts.length < 2) return;
      const [a, b] = pts;
      const r = vp.getBoundingClientRect();
      const z = Math.max(0.1, Math.min(4, d.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / d.dist)));
      const mid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      // keep the point that was under the fingers under them
      const wx = (d.mid.x - d.pan.x) / d.zoom;
      const wy = (d.mid.y - d.pan.y) / d.zoom;
      useEditor.setState({ zoom: z, pan: { x: mid.x - wx * z, y: mid.y - wy * z } });
      return;
    }
    if (d?.kind === "touch") {
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < TOUCH_SLOP) return;
      d.moved = true;
      useEditor.setState({ pan: { x: d.pan.x + e.clientX - d.startX, y: d.pan.y + e.clientY - d.startY } });
      return;
    }
    if (!d) {
      // hover highlight
      const node = (e.target as HTMLElement).closest?.<HTMLElement>("[data-el-id]");
      const f = frame();
      const page = getPage(s);
      let id: string | null = null;
      if (node && f?.contains(node) && page.elements[node.dataset.elId!]) id = resolveHit(page, node.dataset.elId!, e.altKey || e.ctrlKey || e.metaKey);
      if (id !== s.hoverId) useEditor.setState({ hoverId: id });
      return;
    }
    const z = s.zoom;
    switch (d.kind) {
      case "pan":
        useEditor.setState({ pan: { x: d.pan.x + e.clientX - d.startX, y: d.pan.y + e.clientY - d.startY } });
        return;
      case "pending": {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
        const next = beginMove(d.ids, d.startX, d.startY);
        dragRef.current = next;
        if (next) onPointerMove(e);
        return;
      }
      case "move": {
        let dx = (e.clientX - d.startX) / z;
        let dy = (e.clientY - d.startY) / z;
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        let guides: Guide[] = [];
        if (!e.altKey) {
          const moved = { ...d.union, x: d.union.x + dx, y: d.union.y + dy };
          const snap = snapMove(moved, d.targets, threshold());
          dx += snap.dx;
          dy += snap.dy;
          guides = snap.guides;
        }
        const bpNow = s.bp;
        mutate((_doc, page) => {
          for (const id of d.ids) {
            const el = page.elements[id];
            const st = d.starts.get(id);
            if (!el || !st) continue;
            const nx = Math.round(st.x + dx);
            const ny = Math.round(st.y + dy);
            if (bpNow === "desktop") el.box = { ...el.box, x: nx, y: ny };
            else {
              el.responsive = el.responsive || {};
              el.responsive.mobile = { ...(el.responsive.mobile || {}), x: nx, y: ny };
            }
          }
        });
        // dragging into / out of containers (desktop only)
        let dropTargetId: string | null | undefined = undefined;
        if (bpNow === "desktop" && d.ids.length === 1) {
          const page = getPage();
          const exclude = new Set([d.ids[0], ...descendantIds(page, d.ids[0])]);
          const c = containerAt(e.clientX, e.clientY, exclude);
          if (c !== d.parentId) dropTargetId = c;
        }
        useEditor.setState({ guides, dropTargetId });
        return;
      }
      case "reorder": {
        const f = frame();
        const page = getPage();
        const parent = page.elements[d.parentId];
        const pn = f ? elNode(f, d.parentId) : null;
        if (!f || !pn || !parent) return;
        const pr = pn.getBoundingClientRect();
        const out = e.clientX < pr.left - 24 || e.clientX > pr.right + 24 || e.clientY < pr.top - 24 || e.clientY > pr.bottom + 24;
        if (out && s.bp === "desktop") {
          const exclude = new Set([d.id, ...descendantIds(page, d.id)]);
          const c = containerAt(e.clientX, e.clientY, exclude);
          dragRef.current = { ...d, out: true };
          useEditor.setState({ dropTargetId: c, insertLine: null });
          return;
        }
        const L = layoutOf(parent);
        const kids = (parent.childIds || []).filter((c) => c !== d.id);
        let index = kids.length;
        const vr = viewportRef.current!.getBoundingClientRect();
        let line: { x: number; y: number; w: number; h: number } | null = null;
        for (let i = 0; i < kids.length; i++) {
          const kn = elNode(f, kids[i]);
          if (!kn) continue;
          const r = kn.getBoundingClientRect();
          const before = L.mode === "column" ? e.clientY < r.top + r.height / 2 : L.mode === "row" ? e.clientX < r.left + r.width / 2 : e.clientY < r.top || (e.clientY < r.bottom && e.clientX < r.left + r.width / 2);
          if (before) {
            index = i;
            line = L.mode === "column" ? { x: r.left - vr.left, y: r.top - vr.top - 4, w: r.width, h: 3 } : { x: r.left - vr.left - 4, y: r.top - vr.top, w: 3, h: r.height };
            break;
          }
        }
        if (!line && kids.length) {
          const kn = elNode(f, kids[kids.length - 1]);
          if (kn) {
            const r = kn.getBoundingClientRect();
            line = L.mode === "column" ? { x: r.left - vr.left, y: r.bottom - vr.top + 2, w: r.width, h: 3 } : { x: r.right - vr.left + 2, y: r.top - vr.top, w: 3, h: r.height };
          }
        }
        dragRef.current = { ...d, index, out: false };
        useEditor.setState({ insertLine: line, dropTargetId: undefined });
        return;
      }
      case "resize": {
        const dx = (e.clientX - d.startX) / z;
        const dy = (e.clientY - d.startY) / z;
        // corners keep proportions for pictures (Shift flips that); edges only when Shift is held
        const keep = d.handle.length === 2 ? d.keepRatio !== e.shiftKey : e.shiftKey;
        let nb = resizeRotated(d.start, d.handle, dx, dy, { keepRatio: keep, fromCenter: e.altKey, min: 4 });
        let guides: Guide[] = [];
        if (d.free && !d.start.r && !e.altKey) {
          const fr = { x: d.frameOrigin.x + nb.x, y: d.frameOrigin.y + nb.y, w: nb.w, h: nb.h };
          const snapped = snapResize(fr, d.handle, d.targets, threshold());
          nb = { ...nb, x: snapped.rect.x - d.frameOrigin.x, y: snapped.rect.y - d.frameOrigin.y, w: snapped.rect.w, h: snapped.rect.h };
          guides = snapped.guides;
        }
        const bpNow = s.bp;
        const vertical = d.handle.includes("n") || d.handle.includes("s");
        mutate((_doc, page) => {
          const el = page.elements[d.id];
          if (!el) return;
          const hug = isHugHeight(el as El);
          if (hug && vertical) el.sizing = { w: el.sizing?.w ?? "fixed", h: "fixed" };
          const keepHug = hug && !vertical;
          if (!d.free) {
            el.box.w = Math.round(nb.w);
            if (!keepHug) el.box.h = Math.round(nb.h);
            el.sizing = { w: "fixed", h: keepHug ? "hug" : "fixed" };
            return;
          }
          const patch = { x: Math.round(nb.x), y: Math.round(nb.y), w: Math.max(4, Math.round(nb.w)), h: Math.max(4, Math.round(keepHug ? d.start.h : nb.h)) };
          if (bpNow === "desktop") el.box = { ...el.box, ...patch };
          else {
            el.responsive = el.responsive || {};
            el.responsive.mobile = { ...(el.responsive.mobile || {}), ...patch };
          }
        });
        useEditor.setState({ guides });
        return;
      }
      case "rotate": {
        const angle = angleFrom(d.center, { x: e.clientX, y: e.clientY }, e.shiftKey);
        const bpNow = s.bp;
        mutate((_doc, page) => {
          const el = page.elements[d.id];
          if (!el) return;
          if (bpNow === "desktop") el.box = { ...el.box, r: angle || undefined };
          else {
            el.responsive = el.responsive || {};
            el.responsive.mobile = { ...(el.responsive.mobile || {}), r: angle };
          }
        });
        return;
      }
      case "height": {
        const nh = Math.max(200, Math.round(d.start + (e.clientY - d.startY) / z));
        const bpNow = s.bp;
        mutate((_doc, page) => {
          if (bpNow === "desktop") page.height = nh;
          else page.heights = { ...(page.heights || {}), mobile: nh };
        });
        return;
      }
      case "marquee": {
        const vr = viewportRef.current!.getBoundingClientRect();
        const x = Math.min(d.startX, e.clientX);
        const y = Math.min(d.startY, e.clientY);
        const w = Math.abs(e.clientX - d.startX);
        const h = Math.abs(e.clientY - d.startY);
        useEditor.setState({ marquee: { x: x - vr.left, y: y - vr.top, w, h } });
        const f = frame();
        if (!f || w < 3 || h < 3) return;
        const fr = f.getBoundingClientRect();
        const box: Rect = { x: (x - fr.left) / z, y: (y - fr.top) / z, w: w / z, h: h / z };
        const page = getPage();
        const hits: string[] = [];
        for (const id of page.rootIds) {
          const el = page.elements[id];
          if (!el || el.hidden || el.locked) continue;
          const b = elFrameBox(page, el, f, z);
          if (b && box.x < b.x + b.w && b.x < box.x + box.w && box.y < b.y + b.h && b.y < box.y + box.h) hits.push(id);
        }
        const next = d.additive ? Array.from(new Set([...d.base, ...hits])) : hits;
        const cur = ed().selection;
        if (next.length !== cur.length || next.some((id, i) => cur[i] !== id)) useEditor.setState({ selection: next });
        return;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      touches.current.delete(e.pointerId);
      const cur = dragRef.current;
      if (cur?.kind === "pinch") {
        // lifting one finger of a pinch doesn't start anything new
        if (touches.current.size === 0) dragRef.current = null;
        return;
      }
      if (cur?.kind === "touch") {
        dragRef.current = null;
        try {
          viewportRef.current?.releasePointerCapture(e.pointerId);
        } catch {
          /* not captured */
        }
        if (!cur.moved) {
          if (cur.tapId) select([cur.tapId]);
          else clearSelection();
        }
        return;
      }
    }
    const d = dragRef.current;
    dragRef.current = null;
    viewportRef.current?.classList.remove("panning");
    try {
      viewportRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    if (!d) return;
    const s = ed();
    switch (d.kind) {
      case "pending":
        if (d.drill) select([d.drill]);
        break;
      case "move": {
        const target = s.dropTargetId;
        if (target !== undefined && d.ids.length === 1 && s.bp === "desktop") {
          const f = frame();
          const page = getPage();
          const el = page.elements[d.ids[0]];
          const fb = f && el ? elFrameBox(page, el, f, s.zoom) : null;
          if (fb) {
            const t = target ? page.elements[target] : null;
            if (t && (isAutoLayout(t) || t.type === "list")) reparent(d.ids[0], target, {});
            else reparent(d.ids[0], target, { frameX: fb.x, frameY: fb.y });
          }
        }
        // grow the page when something was dropped below the bottom
        const page = getPage();
        const bottom = Math.max(
          ...d.ids.map((id) => {
            const el = page.elements[id];
            if (!el || el.parentId) return 0;
            const b = boxAt(page, el, s.bp);
            return b.y + b.h;
          }),
        );
        const current = s.bp === "desktop" ? page.height : page.heights?.mobile || 0;
        if (bottom + 40 > current)
          mutate((_doc, pg) => {
            if (s.bp === "desktop") pg.height = Math.round(bottom + 40);
            else pg.heights = { ...(pg.heights || {}), mobile: Math.round(bottom + 40) };
          });
        endGesture();
        break;
      }
      case "reorder": {
        if (d.out && s.dropTargetId !== undefined) {
          const f = frame();
          const page = getPage();
          const el = page.elements[d.id];
          const p = toFrame(e.clientX, e.clientY);
          const t = s.dropTargetId ? page.elements[s.dropTargetId] : null;
          if (t && (isAutoLayout(t) || t.type === "list")) reparent(d.id, s.dropTargetId, {});
          else if (el && f) {
            const fb = elFrameBox(page, el, f, s.zoom);
            const w = fb?.w ?? el.box.w;
            const h = fb?.h ?? el.box.h;
            mutate((_doc, pg) => {
              const e2 = pg.elements[d.id];
              e2.box.w = Math.round(w);
              e2.box.h = Math.round(h);
            });
            reparent(d.id, s.dropTargetId, { frameX: p.x - w / 2, frameY: p.y - h / 2 });
          }
        } else if (!d.out && d.index !== d.startIndex) {
          mutate((_doc, page) => {
            const parent = page.elements[d.parentId];
            if (!parent?.childIds) return;
            const list = parent.childIds.filter((c) => c !== d.id);
            list.splice(d.index, 0, d.id);
            parent.childIds = list;
          });
        }
        endGesture();
        break;
      }
      case "resize":
      case "rotate":
      case "height":
        endGesture();
        break;
      case "marquee":
        break;
    }
    useEditor.setState({ guides: [], dropTargetId: undefined, insertLine: null, marquee: null });
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    // the canvas captures the pointer while clicking, so look up what's under the cursor
    const hit = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const node = hit?.closest<HTMLElement>("[data-el-id]") ?? null;
    const f = frame();
    if (!node || !f?.contains(node)) {
      if (!node) fit();
      return;
    }
    const page = getPage();
    const rawId = node.dataset.elId!;
    const el = page.elements[rawId];
    if (!el) return;
    const s = ed();
    // inside a group that's selected: step into it
    if (s.selection.length === 1 && s.selection[0] !== rawId && isAncestor(page, s.selection[0], rawId)) {
      const chain = [rawId, ...ancestorIds(page, rawId)];
      const idx = chain.indexOf(s.selection[0]);
      select([chain[Math.max(0, idx - 1)]]);
      return;
    }
    if ((el.type === "text" || el.type === "button") && !el.locked) {
      select([rawId]);
      useEditor.setState({ editingTextId: rawId });
    } else if (el.type === "image") {
      select([rawId]);
      useEditor.setState({ rightTab: "content" });
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const node = (e.target as HTMLElement).closest<HTMLElement>("[data-el-id]");
    const f = frame();
    const page = getPage();
    if (node && f?.contains(node) && page.elements[node.dataset.elId!]) {
      const id = resolveHit(page, node.dataset.elId!, e.altKey || e.ctrlKey || e.metaKey);
      if (!ed().selection.includes(id)) select([id]);
      ctxMenu.openFor(e, "element");
    } else ctxMenu.openFor(e, "canvas", toFrame(e.clientX, e.clientY));
  };

  const hoverId = useEditor((st) => st.hoverId);
  const flowMobile = useEditor((st) => st.bp === "mobile" && !getPage(st).mobileCustom);

  return (
    <div
      ref={viewportRef}
      className="canvas-viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") liveCursor(null);
        if (!dragRef.current && hoverId) useEditor.setState({ hoverId: null });
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={onFileDrop}
    >
      <div className="canvas-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <div ref={hostRef} className={`frame-host rt-editor ${bp}`}>
          <RuntimeContext.Provider value={rt}>
            <PageFrame />
          </RuntimeContext.Provider>
        </div>
      </div>
      <Overlay viewportRef={viewportRef} hostRef={hostRef} flowMobile={flowMobile} />
      <PeersOverlay viewportRef={viewportRef} hostRef={hostRef} />
      <CanvasScrollbars viewportRef={viewportRef} hostRef={hostRef} />
      <CanvasZoomButtons />
      {ctxMenu.node}
    </div>
  );
}

function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = src;
  });
}
