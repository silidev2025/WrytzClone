import type { Box } from "@/lib/shared/types";
import type { Guide } from "../store";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function unionRect(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
}

export function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const xs = (r: Rect) => [r.x, r.x + r.w / 2, r.x + r.w];
const ys = (r: Rect) => [r.y, r.y + r.h / 2, r.y + r.h];

/**
 * Snap a moving rectangle to target rectangles (edges and centres). Returns the offset to
 * apply and the guide lines to draw.
 */
export function snapMove(moving: Rect, targets: Rect[], threshold: number): { dx: number; dy: number; guides: Guide[] } {
  let bestX: number | null = null;
  let bestY: number | null = null;
  const mx = xs(moving);
  const my = ys(moving);
  for (const t of targets) {
    for (const a of mx) for (const b of xs(t)) if (Math.abs(b - a) <= threshold && (bestX === null || Math.abs(b - a) < Math.abs(bestX))) bestX = b - a;
    for (const a of my) for (const b of ys(t)) if (Math.abs(b - a) <= threshold && (bestY === null || Math.abs(b - a) < Math.abs(bestY))) bestY = b - a;
  }
  const dx = bestX ?? 0;
  const dy = bestY ?? 0;
  const snapped = { ...moving, x: moving.x + dx, y: moving.y + dy };
  return { dx, dy, guides: guidesFor(snapped, targets, bestX !== null, bestY !== null) };
}

/** Guide lines for every edge/centre of `r` that lines up with a target. */
export function guidesFor(r: Rect, targets: Rect[], checkX = true, checkY = true): Guide[] {
  const guides: Guide[] = [];
  if (checkX)
    for (const a of xs(r)) {
      const hits = targets.filter((t) => xs(t).some((b) => Math.abs(b - a) < 0.5));
      if (hits.length) {
        const all = [r, ...hits];
        guides.push({ axis: "x", pos: a, from: Math.min(...all.map((h) => h.y)), to: Math.max(...all.map((h) => h.y + h.h)) });
      }
    }
  if (checkY)
    for (const a of ys(r)) {
      const hits = targets.filter((t) => ys(t).some((b) => Math.abs(b - a) < 0.5));
      if (hits.length) {
        const all = [r, ...hits];
        guides.push({ axis: "y", pos: a, from: Math.min(...all.map((h) => h.x)), to: Math.max(...all.map((h) => h.x + h.w)) });
      }
    }
  return guides;
}

/** Snap only the edges a resize handle moves. */
export function snapResize(r: Rect, handle: Handle, targets: Rect[], threshold: number): { rect: Rect; guides: Guide[] } {
  const out = { ...r };
  const moveX = handle.includes("e") ? "right" : handle.includes("w") ? "left" : null;
  const moveY = handle.includes("s") ? "bottom" : handle.includes("n") ? "top" : null;
  let bx: number | null = null;
  let by: number | null = null;
  const edgeX = moveX === "right" ? r.x + r.w : r.x;
  const edgeY = moveY === "bottom" ? r.y + r.h : r.y;
  for (const t of targets) {
    if (moveX) for (const b of xs(t)) if (Math.abs(b - edgeX) <= threshold && (bx === null || Math.abs(b - edgeX) < Math.abs(bx))) bx = b - edgeX;
    if (moveY) for (const b of ys(t)) if (Math.abs(b - edgeY) <= threshold && (by === null || Math.abs(b - edgeY) < Math.abs(by))) by = b - edgeY;
  }
  if (bx !== null) {
    if (moveX === "right") out.w += bx;
    else {
      out.x += bx;
      out.w -= bx;
    }
  }
  if (by !== null) {
    if (moveY === "bottom") out.h += by;
    else {
      out.y += by;
      out.h -= by;
    }
  }
  return { rect: out, guides: guidesFor(out, targets, bx !== null, by !== null) };
}

/** Resize an unrotated box by dragging a handle. */
export function resizeBox(start: Rect, handle: Handle, dx: number, dy: number, opts: { keepRatio?: boolean; fromCenter?: boolean; min?: number } = {}): Rect {
  const min = opts.min ?? 8;
  const k = opts.fromCenter ? 2 : 1;
  const e = handle.includes("e");
  const w = handle.includes("w");
  const n = handle.includes("n");
  const s = handle.includes("s");
  let nw = start.w + (e ? dx : w ? -dx : 0) * k;
  let nh = start.h + (s ? dy : n ? -dy : 0) * k;
  if (opts.keepRatio && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    if ((e || w) && (n || s)) {
      if (Math.abs(nw / start.w) > Math.abs(nh / start.h)) nh = nw / ratio;
      else nw = nh * ratio;
    } else if (e || w) nh = nw / ratio;
    else nw = nh * ratio;
  }
  nw = Math.max(min, nw);
  nh = Math.max(min, nh);
  let x = start.x;
  let y = start.y;
  if (opts.fromCenter) {
    x = start.x + (start.w - nw) / 2;
    y = start.y + (start.h - nh) / 2;
  } else {
    if (w) x = start.x + start.w - nw;
    if (n) y = start.y + start.h - nh;
    // edge handles with locked ratio grow around the middle of the other axis
    if (opts.keepRatio && (e || w) && !(n || s)) y = start.y + (start.h - nh) / 2;
    if (opts.keepRatio && (n || s) && !(e || w)) x = start.x + (start.w - nw) / 2;
  }
  return { x, y, w: nw, h: nh };
}

/** Resize a rotated box: work in the box's own axes, then keep the opposite side in place. */
export function resizeRotated(start: Box, handle: Handle, dx: number, dy: number, opts: { keepRatio?: boolean; fromCenter?: boolean; min?: number } = {}): Box {
  const deg = start.r || 0;
  if (!deg) return { ...resizeBox(start, handle, dx, dy, opts), r: start.r };
  const t = (deg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const ldx = dx * cos + dy * sin;
  const ldy = -dx * sin + dy * cos;
  const local = resizeBox({ x: 0, y: 0, w: start.w, h: start.h }, handle, ldx, ldy, opts);
  const ox = local.x + local.w / 2 - start.w / 2;
  const oy = local.y + local.h / 2 - start.h / 2;
  const cx = start.x + start.w / 2 + ox * cos - oy * sin;
  const cy = start.y + start.h / 2 + ox * sin + oy * cos;
  return { x: cx - local.w / 2, y: cy - local.h / 2, w: local.w, h: local.h, r: start.r };
}

export function angleFrom(center: { x: number; y: number }, p: { x: number; y: number }, snap: boolean): number {
  let a = (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI + 90;
  if (a > 180) a -= 360;
  if (snap) a = Math.round(a / 15) * 15;
  if (Math.abs(a) < 2 && !snap) a = 0;
  return Math.round(a * 10) / 10;
}

export const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function handleCursor(h: Handle, rotation = 0): string {
  const base: Record<Handle, number> = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };
  const a = (((base[h] + rotation) % 360) + 360) % 360;
  const idx = Math.round(a / 45) % 8;
  return ["ns-resize", "nesw-resize", "ew-resize", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize", "nwse-resize"][idx];
}
