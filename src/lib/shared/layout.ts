import type { AppDoc, Box, Breakpoint, El, ElementType, Page } from "./types";
import { FRAME_WIDTH } from "./types";
import { childIdsOf } from "./doc";
import { ELEMENT_INFO, isAutoLayout, isContainerType, layoutOf } from "./elements";

/*
 * Layout rules
 * ------------
 * Desktop: every element in a free-layout parent (the page or a free Box) sits at its `box`.
 * Mobile, before any hand edits ("auto"): elements flow top-to-bottom in reading order;
 *   see buildMobileFlow(). The browser does the stacking, so text wrapping can't overlap.
 * Mobile, after hand edits ("custom"): `responsive.mobile` holds each element's box.
 *   Elements added later on desktop (no mobile box yet) are placed below everything else.
 * Runtime (preview + published): elements whose content grows (lists, long text …) push
 *   whatever sits below them down; see computePushDown().
 */

export const MOBILE_MARGIN = 20;

export function mobileFontSize(size: number): number {
  return size <= 22 ? size : Math.round(22 + (size - 22) * 0.5);
}

export function isHiddenAt(el: El, bp: Breakpoint): boolean {
  return !!el.hidden || !!el.hideOn?.[bp];
}

export function sizeMode(el: El, axis: "w" | "h"): "fixed" | "hug" | "fill" {
  return el.sizing?.[axis] ?? ELEMENT_INFO[el.type].defaultSizing?.[axis] ?? "fixed";
}

export function isHugHeight(el: El): boolean {
  return sizeMode(el, "h") === "hug";
}

export function mobileOverrideBox(el: El): Box | null {
  const m = el.responsive?.mobile;
  if (!m || m.x === undefined || m.y === undefined) return null;
  return { x: m.x, y: m.y, w: m.w ?? el.box.w, h: m.h ?? el.box.h, r: m.r ?? el.box.r };
}

/** Reading order: top to bottom, then left to right for things on the same line. */
export function byReadingOrder(a: { box: Box }, b: { box: Box }): number {
  const sameLine = Math.abs(a.box.y - b.box.y) < Math.min(a.box.h, b.box.h) * 0.5;
  if (sameLine) return a.box.x - b.box.x;
  return a.box.y - b.box.y;
}

const KEEP_ASPECT: ElementType[] = ["image", "shape", "video", "map", "embed", "chart"];

/**
 * Boxes of the children of a free-layout parent (or the page when parentId is null).
 * Desktop uses stored boxes; custom mobile uses overrides and parks unplaced elements
 * below the rest.
 */
export function freeChildBoxes(page: Page, parentId: string | null, bp: Breakpoint, parentWidth: number): Map<string, Box> {
  const out = new Map<string, Box>();
  const ids = childIdsOf(page, parentId);
  // Small free-layout groups (logos, badges, card headings) keep their authored
  // internal arrangement in auto flow. Only custom phone canvases park new layers.
  if (bp === "desktop" || (parentId !== null && !page.mobileCustom && !ids.some((id) => page.elements[id] && mobileOverrideBox(page.elements[id])))) {
    for (const id of ids) {
      const el = page.elements[id];
      if (el) out.set(id, el.box);
    }
    return out;
  }
  let bottom = 0;
  const unplaced: El[] = [];
  for (const id of ids) {
    const el = page.elements[id];
    if (!el) continue;
    const b = mobileOverrideBox(el);
    if (b) {
      out.set(id, b);
      if (!isHiddenAt(el, "mobile")) bottom = Math.max(bottom, b.y + b.h);
    } else unplaced.push(el);
  }
  unplaced.sort(byReadingOrder);
  const margin = parentId ? 12 : MOBILE_MARGIN;
  for (const el of unplaced) {
    const w = Math.max(24, Math.min(el.box.w, parentWidth - margin * 2));
    const h = KEEP_ASPECT.includes(el.type) ? Math.round(el.box.h * (w / el.box.w)) : el.box.h;
    const y = bottom + (bottom ? 24 : margin);
    out.set(el.id, { x: Math.round((parentWidth - w) / 2), y, w, h, r: el.box.r });
    if (!isHiddenAt(el, "mobile")) bottom = y + h;
  }
  return out;
}

export function contentBottom(page: Page, boxes: Map<string, Box>, bp: Breakpoint): number {
  let bottom = 0;
  for (const [id, b] of boxes) {
    const el = page.elements[id];
    if (!el || isHiddenAt(el, bp) || el.type === "dialog") continue;
    bottom = Math.max(bottom, b.y + b.h);
  }
  return bottom;
}

/** Frame height for a breakpoint (desktop: stored; custom mobile: stored or fitted). */
export function frameHeight(page: Page, bp: Breakpoint, boxes?: Map<string, Box>): number {
  if (bp === "desktop") return page.height;
  const b = boxes ? contentBottom(page, boxes, bp) + 40 : 0;
  return Math.max(page.heights?.mobile ?? 0, b, 400);
}

/** Mobile apps are designed on one phone-sized frame; websites on a desktop frame. */
export function isMobileApp(doc: { settings: AppDoc["settings"] }): boolean {
  return doc.settings?.kind === "mobile";
}

export function baseWidth(doc: { settings: AppDoc["settings"] }): number {
  return isMobileApp(doc) ? FRAME_WIDTH.mobile : FRAME_WIDTH.desktop;
}

/** Frame width for a breakpoint ("desktop" is the main layout, whatever its size). */
export function frameWidthFor(doc: { settings: AppDoc["settings"] }, bp: Breakpoint): number {
  return bp === "mobile" ? FRAME_WIDTH.mobile : baseWidth(doc);
}

/* ------------------------------------------------------------------ push-down */

export interface PushItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** measured height for elements whose height follows their content */
  actualH?: number;
  /** background-like elements stretch to keep containing things that grew */
  canStretch?: boolean;
  /** hidden items don't anchor anything */
  ignore?: boolean;
}

export interface PushResult {
  dy: Map<string, number>;
  /** extra height for stretched backgrounds */
  dh: Map<string, number>;
  /** how much the parent's content bottom moved */
  growth: number;
}

export const STRETCHABLE: ElementType[] = ["shape", "image", "box"];

export function computePushDown(items: PushItem[], tolerance = 2): PushResult {
  const list = items.filter((i) => !i.ignore);
  const sorted = [...list].sort((a, b) => a.y - b.y || a.x - b.x);
  const dy = new Map<string, number>();
  const growthMemo = new Map<string, number>();
  const overlapX = (a: PushItem, b: PushItem) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1;
  const contains = (o: PushItem, i: PushItem) =>
    o !== i &&
    o.y <= i.y + tolerance &&
    o.y + o.h >= i.y + i.h - tolerance &&
    o.x <= i.x + tolerance &&
    o.x + o.w >= i.x + i.w - tolerance &&
    o.w * o.h > i.w * i.h;

  const visiting = new Set<string>();
  const growthOf = (it: PushItem): number => {
    if (growthMemo.has(it.id)) return growthMemo.get(it.id)!;
    if (it.actualH !== undefined) {
      const g = it.actualH - it.h;
      growthMemo.set(it.id, g);
      return g;
    }
    if (!it.canStretch || visiting.has(it.id)) return 0;
    visiting.add(it.id);
    const baseBottom = it.y + it.h;
    const myDy = dy.get(it.id) ?? 0;
    let newBottom = baseBottom + myDy;
    for (const c of list) {
      if (!contains(it, c)) continue;
      const pad = baseBottom - (c.y + c.h);
      newBottom = Math.max(newBottom, c.y + c.h + (dy.get(c.id) ?? 0) + Math.max(0, growthOf(c)) + pad);
    }
    visiting.delete(it.id);
    const g = newBottom - (baseBottom + myDy);
    growthMemo.set(it.id, g);
    return g;
  };

  /*
   * Each element follows the nearest thing above it (its "anchor": the bottom closest to it,
   * give or take ANCHOR_SLACK), up or down. Anything else above that grew still pushes it
   * down by the full amount, and nothing is ever pulled up into something above it.
   */
  const ANCHOR_SLACK = 24;
  const MIN_GAP = 16;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const above: PushItem[] = [];
    let nearest = -Infinity;
    for (let j = 0; j < i; j++) {
      const a = sorted[j];
      if (a.y + a.h > e.y + tolerance) continue;
      if (!overlapX(a, e)) continue;
      above.push(a);
      nearest = Math.max(nearest, a.y + a.h);
    }
    let best = -Infinity;
    for (const a of above) {
      const shift = (dy.get(a.id) ?? 0) + growthOf(a);
      const bottom = a.y + a.h;
      if (bottom >= nearest - ANCHOR_SLACK || shift > 0) best = Math.max(best, shift);
      // never closer than the original gap (or MIN_GAP, if that was bigger) to anything above
      else best = Math.max(best, shift - Math.max(0, e.y - bottom - MIN_GAP));
    }
    dy.set(e.id, best === -Infinity ? 0 : best);
  }

  const dh = new Map<string, number>();
  let maxBefore = 0;
  let maxAfter = 0;
  for (const it of list) {
    const g = growthOf(it);
    if (it.canStretch && it.actualH === undefined && g > 0) dh.set(it.id, g);
    maxBefore = Math.max(maxBefore, it.y + it.h);
    maxAfter = Math.max(maxAfter, it.y + (dy.get(it.id) ?? 0) + it.h + g);
  }
  return { dy, dh, growth: list.length ? maxAfter - maxBefore : 0 };
}

/* ------------------------------------------------------------------ mobile auto flow */

export interface FlowEntry {
  id: string;
  /** px width, or null for the full available width */
  width: number | null;
  /** px height, or null when the element should size itself */
  height: number | null;
  /** width / height, for media that keeps its proportions */
  aspect: number | null;
  /** free containers that are too wide get their children re-flowed */
  children?: FlowBlock[];
}

export type FlowBlock =
  | { kind: "row"; key: string; justify: "start" | "center" | "end"; marginTop: number; entries: FlowEntry[] }
  | {
      kind: "band";
      key: string;
      bgId: string;
      /** full-bleed bands ignore the side margins */
      bleed: boolean;
      marginTop: number;
      paddingTop: number;
      paddingBottom: number;
      blocks: FlowBlock[];
    };

const BAND_TYPES: ElementType[] = ["shape", "image", "box"];

function center(b: Box) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function insideBox(inner: Box, outer: Box) {
  const c = center(inner);
  return c.x >= outer.x && c.x <= outer.x + outer.w && c.y >= outer.y && c.y <= outer.y + outer.h && inner.w * inner.h < outer.w * outer.h;
}

/**
 * Build the auto (flow) mobile layout for the children of `parentId`.
 * `parentWidth` is the desktop width of the parent, `avail` the mobile width to fill.
 */
export function buildMobileFlow(page: Page, parentId: string | null, parentWidth: number, avail: number): FlowBlock[] {
  const els = childIdsOf(page, parentId)
    .map((id) => page.elements[id])
    .filter((el): el is El => !!el && !isHiddenAt(el, "mobile") && el.type !== "dialog");
  const order = new Map(els.map((e, i) => [e.id, i]));

  // Backgrounds: wide shapes/images/empty boxes drawn below other elements.
  const bands = els.filter(
    (el) =>
      BAND_TYPES.includes(el.type) &&
      !(el.childIds && el.childIds.length) &&
      el.box.w >= parentWidth * 0.55 &&
      el.box.h >= 60 &&
      els.some((o) => o !== el && order.get(o.id)! > order.get(el.id)! && insideBox(o.box, el.box)),
  );
  // smallest containing band for each element
  const owner = new Map<string, string | null>();
  for (const el of els) {
    let best: El | null = null;
    for (const b of bands) {
      if (b === el || order.get(el.id)! < order.get(b.id)! || !insideBox(el.box, b.box)) continue;
      if (!best || b.box.w * b.box.h < best.box.w * best.box.h) best = b;
    }
    owner.set(el.id, best ? best.id : null);
  }

  const build = (ownerId: string | null, top: number): FlowBlock[] => {
    const members = els.filter((e) => owner.get(e.id) === ownerId).sort(byReadingOrder);
    // group into lines
    const rows: El[][] = [];
    let rowBottom = -Infinity;
    let rowTop = 0;
    for (const el of members) {
      const current = rows[rows.length - 1];
      const isBand = bands.includes(el);
      const overlaps =
        current &&
        !isBand &&
        !current.some((c) => bands.includes(c)) &&
        el.box.y < rowBottom - Math.min(el.box.h, rowBottom - rowTop) * 0.5;
      if (overlaps) {
        current.push(el);
        rowBottom = Math.max(rowBottom, el.box.y + el.box.h);
      } else {
        rows.push([el]);
        rowTop = el.box.y;
        rowBottom = el.box.y + el.box.h;
      }
    }
    const blocks: FlowBlock[] = [];
    let prevBottom = top;
    rows.forEach((row, i) => {
      const rTop = Math.min(...row.map((e) => e.box.y));
      const rBottom = Math.max(...row.map((e) => e.box.y + e.box.h));
      const gap = rTop - prevBottom;
      const marginTop = i === 0 ? clampN(gap * 0.5, ownerId ? 0 : 16, 48) : clampN(gap * 0.5, 10, 40);
      prevBottom = rBottom;
      if (row.length === 1 && bands.includes(row[0])) {
        const band = row[0];
        const inner = build(band.id, band.box.y);
        const kids = els.filter((e) => owner.get(e.id) === band.id);
        const lastBottom = kids.length ? Math.max(...kids.map((k) => k.box.y + k.box.h)) : band.box.y + band.box.h;
        const firstTop = kids.length ? Math.min(...kids.map((k) => k.box.y)) : band.box.y;
        blocks.push({
          kind: "band",
          key: band.id,
          bgId: band.id,
          bleed: band.box.w >= parentWidth * 0.9,
          marginTop: i === 0 && band.box.y <= 4 ? 0 : marginTop,
          paddingTop: clampN((firstTop - band.box.y) * 0.6, 16, 56),
          paddingBottom: clampN((band.box.y + band.box.h - lastBottom) * 0.6, 16, 56),
          blocks: inner,
        });
        return;
      }
      row.sort((a, b) => a.box.x - b.box.x);
      const minX = Math.min(...row.map((e) => e.box.x));
      const maxX = Math.max(...row.map((e) => e.box.x + e.box.w));
      const mid = (minX + maxX) / 2;
      let justify: "start" | "center" | "end" = "start";
      if (Math.abs(mid - parentWidth / 2) < parentWidth * 0.08) justify = "center";
      else if (minX > parentWidth * 0.5) justify = "end";
      if (row.length === 1 && row[0].type === "text" && row[0].style.textAlign === "center") justify = "center";
      blocks.push({ kind: "row", key: row.map((r) => r.id).join("-"), justify, marginTop, entries: row.map((el) => flowEntry(page, el, avail)) });
    });
    return blocks;
  };

  return build(null, parentId ? 0 : 0);
}

function clampN(v: number, min: number, max: number) {
  return Math.round(Math.max(min, Math.min(max, v)));
}

function flowEntry(page: Page, el: El, avail: number): FlowEntry {
  const w = el.box.w;
  const wide = w > avail * 0.75;
  const t = el.type;
  if (KEEP_ASPECT.includes(t)) {
    const width = wide ? null : w;
    return { id: el.id, width, height: null, aspect: el.box.w / Math.max(1, el.box.h) };
  }
  if (t === "text") return { id: el.id, width: w > avail * 0.6 ? null : w, height: isHugHeight(el) ? null : el.box.h, aspect: null };
  if (t === "input" || t === "list" || t === "table" || t === "menu" || t === "tabs" || t === "form")
    return {
      id: el.id,
      width: wide || t !== "input" ? null : w,
      height: t === "menu" ? el.box.h : null,
      aspect: null,
      children: t === "form" && !isAutoLayout(el) ? buildMobileFlow(page, el.id, el.box.w, avail - 24) : undefined,
    };
  if (isContainerType(t)) {
    if (!isAutoLayout(el)) {
      if (w <= avail) return { id: el.id, width: w, height: el.box.h, aspect: null };
      const pad = 16;
      return { id: el.id, width: null, height: null, aspect: null, children: buildMobileFlow(page, el.id, el.box.w, avail - pad * 2) };
    }
    const lay = layoutOf(el);
    return { id: el.id, width: wide || lay.mode === "grid" ? null : w, height: null, aspect: null };
  }
  if (t === "stat" || t === "countdown" || t === "progress") return { id: el.id, width: wide ? null : w, height: el.box.h, aspect: null };
  return { id: el.id, width: Math.min(w, avail), height: el.box.h, aspect: null };
}

/**
 * Freeze a mobile arrangement into per-element overrides. `rects` are measured from the
 * rendered flow (relative to each element's parent), `height` the frame content height.
 */
export function applyMobileRects(page: Page, rects: Map<string, Box>, height: number, fontSizes: Map<string, number>) {
  for (const [id, r] of rects) {
    const el = page.elements[id];
    if (!el) continue;
    el.responsive = {
      ...(el.responsive || {}),
      mobile: {
        ...(el.responsive?.mobile || {}),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.max(1, Math.round(r.w)),
        h: Math.max(1, Math.round(r.h)),
        ...(fontSizes.has(id) ? { fontSize: fontSizes.get(id) } : {}),
      },
    };
  }
  page.heights = { ...(page.heights || {}), mobile: Math.max(400, Math.round(height)) };
  page.mobileCustom = true;
}

/** Forget hand-made mobile positions so the page goes back to auto-arranging. */
export function resetMobileLayout(page: Page) {
  for (const el of Object.values(page.elements)) {
    if (!el.responsive?.mobile) continue;
    const { mobile: _m, ...rest } = el.responsive;
    el.responsive = Object.keys(rest).length ? rest : undefined;
  }
  page.mobileCustom = false;
  if (page.heights) delete page.heights.mobile;
}
