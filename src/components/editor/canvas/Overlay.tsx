"use client";

import { useEffect, useState, type RefObject } from "react";
import { Lock, Pin, RotateCw, Smartphone, Undo2 } from "lucide-react";
import { ELEMENT_INFO } from "@/lib/shared/elements";
import { Icon } from "@/components/ui/Icon";
import { ed, getPage, inFreeParent, resetMobile, useEditor } from "../store";
import { elFrameBox, frameNode } from "./Canvas";
import { HANDLES, handleCursor } from "./geometry";

interface ScreenBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  fw: number;
  fh: number;
  locked: boolean;
  pin?: "top" | "bottom";
  name: string;
  icon: string;
  free: boolean;
}

interface View {
  frame: { x: number; y: number; w: number; h: number };
  sel: ScreenBox[];
  hover: ScreenBox | null;
  drop: { x: number; y: number; w: number; h: number; name: string } | null;
}

export function Overlay({ viewportRef, hostRef, flowMobile }: { viewportRef: RefObject<HTMLDivElement | null>; hostRef: RefObject<HTMLDivElement | null>; flowMobile: boolean }) {
  const [view, setView] = useState<View | null>(null);
  const guides = useEditor((s) => s.guides);
  const marquee = useEditor((s) => s.marquee);
  const insertLine = useEditor((s) => s.insertLine);
  const editing = useEditor((s) => s.editingTextId);
  const zoom = useEditor((s) => s.zoom);
  const bp = useEditor((s) => s.bp);
  const phoneApp = useEditor((s) => s.doc.settings.kind === "mobile");
  const pageName = useEditor((s) => getPage(s).name);
  const mobileCustom = useEditor((s) => !!getPage(s).mobileCustom);

  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      const vm = compute();
      const key = vm ? JSON.stringify(vm) : "";
      if (key !== last) {
        last = key;
        setView(vm);
      }
      raf = requestAnimationFrame(tick);
    };
    const compute = (): View | null => {
      const vp = viewportRef.current;
      const f = frameNode(hostRef.current);
      if (!vp || !f) return null;
      const s = ed();
      const page = getPage(s);
      const z = s.zoom;
      const vr = vp.getBoundingClientRect();
      const fr = f.getBoundingClientRect();
      const flow = s.bp === "mobile" && !page.mobileCustom;
      const box = (id: string): ScreenBox | null => {
        const el = page.elements[id];
        if (!el) return null;
        const fb = elFrameBox(page, el, f, z);
        if (!fb) return null;
        return {
          id,
          x: Math.round(fr.left - vr.left + fb.x * z),
          y: Math.round(fr.top - vr.top + fb.y * z),
          w: Math.round(fb.w * z),
          h: Math.round(fb.h * z),
          r: fb.r,
          fw: Math.round(fb.w),
          fh: Math.round(fb.h),
          locked: !!el.locked,
          pin: !el.parentId ? el.pin : undefined,
          name: el.name,
          icon: ELEMENT_INFO[el.type].icon,
          free: !flow && inFreeParent(page, el),
        };
      };
      const sel = s.selection.map(box).filter((b): b is ScreenBox => !!b);
      const hover = s.hoverId && !s.selection.includes(s.hoverId) ? box(s.hoverId) : null;
      let drop: View["drop"] = null;
      if (s.dropTargetId) {
        const b = box(s.dropTargetId);
        if (b) drop = { x: b.x, y: b.y, w: b.w, h: b.h, name: b.name };
      } else if (s.dropTargetId === null) drop = { x: fr.left - vr.left, y: fr.top - vr.top, w: fr.width, h: fr.height, name: "Page" };
      return { frame: { x: Math.round(fr.left - vr.left), y: Math.round(fr.top - vr.top), w: Math.round(fr.width), h: Math.round(fr.height) }, sel, hover, drop };
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [viewportRef, hostRef]);

  if (!view) return null;
  const { frame, sel, hover, drop } = view;
  const single = sel.length === 1 ? sel[0] : null;
  const toX = (fx: number) => frame.x + fx * zoom;
  const toY = (fy: number) => frame.y + fy * zoom;

  return (
    <div className="overlay" aria-hidden="true">
      <div className="frame-label" style={{ left: frame.x, top: frame.y - 26 }}>
        {pageName} · {phoneApp ? "Phone 390" : bp === "desktop" ? "Desktop 1280" : "Mobile 390"}
      </div>

      {bp === "mobile" && (
        <div className="mobile-banner" data-canvas-ui style={{ left: frame.x + frame.w / 2, top: Math.max(8, frame.y - 64) }}>
          <Smartphone size={14} />
          {flowMobile ? (
            <span>Auto-arranged for phones. Move or resize anything to fine-tune it.</span>
          ) : (
            <>
              <span>Custom phone layout.</span>
              <button onClick={() => resetMobile()}>
                <Undo2 size={13} /> Back to automatic
              </button>
            </>
          )}
        </div>
      )}

      {hover && !editing && (
        <div className="ov-hover" style={{ left: hover.x, top: hover.y, width: hover.w, height: hover.h, transform: hover.r ? `rotate(${hover.r}deg)` : undefined }} />
      )}

      {drop && (
        <div className="ov-drop" style={{ left: drop.x, top: drop.y, width: drop.w, height: drop.h }}>
          <span>Drop into {drop.name}</span>
        </div>
      )}

      {sel.length > 1 &&
        sel.map((b) => <div key={b.id} className="ov-sel-thin" style={{ left: b.x, top: b.y, width: b.w, height: b.h, transform: b.r ? `rotate(${b.r}deg)` : undefined }} />)}
      {sel.length > 1 && (() => {
        const x = Math.min(...sel.map((b) => b.x));
        const y = Math.min(...sel.map((b) => b.y));
        const w = Math.max(...sel.map((b) => b.x + b.w)) - x;
        const h = Math.max(...sel.map((b) => b.y + b.h)) - y;
        return (
          <div className="ov-multi" style={{ left: x, top: y, width: w, height: h }}>
            <span className="ov-size">{sel.length} selected</span>
          </div>
        );
      })()}

      {single && (
        <div
          className={`ov-sel ${single.locked ? "locked" : ""} ${editing ? "editing" : ""}`}
          style={{ left: single.x, top: single.y, width: single.w, height: single.h, transform: single.r ? `rotate(${single.r}deg)` : undefined }}
        >
          <span className="ov-name">
            {single.locked ? <Lock size={11} /> : <Icon name={single.icon} size={11} />} {single.name}
            {single.pin && (
              <span className="ov-pin" title={`Stays at the ${single.pin} of the screen`}>
                <Pin size={10} /> {single.pin === "top" ? "Top" : "Bottom"}
              </span>
            )}
          </span>
          {!single.locked && !editing && (
            <>
              {(single.free || flowMobile ? HANDLES : (["e", "s", "se"] as const)).map((h) => (
                <span key={h} className={`ov-handle h-${h}`} data-handle={h} style={{ cursor: handleCursor(h, single.r) }} />
              ))}
              {single.free && (
                <span className="ov-rotate" data-handle="rotate" title="Rotate (Shift snaps to 15°)">
                  <RotateCw size={11} />
                </span>
              )}
            </>
          )}
          <span className="ov-size" style={{ transform: single.r ? `rotate(${-single.r}deg)` : undefined }}>
            {single.fw} × {single.fh}
          </span>
        </div>
      )}

      {guides.map((g, i) =>
        g.axis === "x" ? (
          <div key={i} className="ov-guide v" style={{ left: toX(g.pos), top: toY(g.from), height: (g.to - g.from) * zoom }} />
        ) : (
          <div key={i} className="ov-guide h" style={{ top: toY(g.pos), left: toX(g.from), width: (g.to - g.from) * zoom }} />
        ),
      )}

      {insertLine && <div className="ov-insert" style={{ left: insertLine.x, top: insertLine.y, width: insertLine.w, height: insertLine.h }} />}
      {marquee && <div className="ov-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}

      {!flowMobile && (
        <div className="ov-height" data-handle="height" style={{ left: frame.x + frame.w / 2, top: frame.y + frame.h }} title="Drag to change the page height">
          <span />
        </div>
      )}
    </div>
  );
}
