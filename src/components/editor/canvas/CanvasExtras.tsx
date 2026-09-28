"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { ed, getPage, peerPattern, useEditor } from "../store";
import { elFrameBox, frameNode } from "./Canvas";

/* ------------------------------------------------------------------ collaborators */

interface PeerView {
  clientId: string;
  name: string;
  pattern: number;
  boxes: { id: string; x: number; y: number; w: number; h: number }[];
  cursor: { x: number; y: number } | null;
}

/** Other people's selections (coloured outlines) and pointers on the page you're looking at. */
export function PeersOverlay({ viewportRef, hostRef }: { viewportRef: RefObject<HTMLDivElement | null>; hostRef: RefObject<HTMLDivElement | null> }) {
  const [views, setViews] = useState<PeerView[]>([]);
  const hasPeers = useEditor((s) => Object.keys(s.peers).length > 0);

  useEffect(() => {
    if (!hasPeers) {
      setViews([]);
      return;
    }
    let raf = 0;
    let last = "";
    const tick = () => {
      const vp = viewportRef.current;
      const f = frameNode(hostRef.current);
      const s = ed();
      const out: PeerView[] = [];
      if (vp && f && s.view === "design") {
        const page = getPage(s);
        const z = s.zoom;
        const vr = vp.getBoundingClientRect();
        const fr = f.getBoundingClientRect();
        const ox = fr.left - vr.left;
        const oy = fr.top - vr.top;
        for (const p of Object.values(s.peers)) {
          if (p.view !== "design" || p.pageId !== page.id || (s.doc.settings.kind !== "mobile" && p.bp !== s.bp)) continue;
          const boxes: PeerView["boxes"] = [];
          for (const id of p.selection) {
            const el = page.elements[id];
            const fb = el ? elFrameBox(page, el, f, z) : null;
            if (fb) boxes.push({ id, x: Math.round(ox + fb.x * z), y: Math.round(oy + fb.y * z), w: Math.round(fb.w * z), h: Math.round(fb.h * z) });
          }
          const cursor = p.cursor ? { x: Math.round(ox + p.cursor.x * z), y: Math.round(oy + p.cursor.y * z) } : null;
          if (boxes.length || cursor) out.push({ clientId: p.clientId, name: p.name, pattern: peerPattern(p.userId), boxes, cursor });
        }
      }
      const key = JSON.stringify(out);
      if (key !== last) {
        last = key;
        setViews(out);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasPeers, viewportRef, hostRef]);

  if (!views.length) return null;
  return (
    <div className="peers-layer" aria-hidden="true">
      {views.map((v) => (
        <div key={v.clientId}>
          {v.boxes.map((b, i) => (
            <div key={b.id} className={`peer-sel peer-line-${v.pattern}`} style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
              {i === 0 && (
                <span className="peer-tag">
                  {v.name}
                </span>
              )}
            </div>
          ))}
          {v.cursor && (
            <div className="peer-cursor" style={{ transform: `translate(${v.cursor.x}px, ${v.cursor.y}px)` }}>
              <svg width="18" height="20" viewBox="0 0 18 20">
                <path d="M1 1 L1 16 L5.5 12 L8.5 19 L11.5 17.6 L8.6 11 L14.5 11 Z" style={{ fill: "var(--ink)", stroke: "var(--paper)" }} strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              <span className="peer-tag">
                {v.name}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ scrollbars */

interface Bars {
  vw: number;
  vh: number;
  x: { size: number; pos: number; range: number; margin: number };
  y: { size: number; pos: number; range: number; margin: number };
}

/**
 * Scrollbars for the canvas: the page can always be reached by dragging them (handy on touch
 * screens, where dragging the canvas would move elements).
 */
export function CanvasScrollbars({ viewportRef, hostRef }: { viewportRef: RefObject<HTMLDivElement | null>; hostRef: RefObject<HTMLDivElement | null> }) {
  const [bars, setBars] = useState<Bars | null>(null);
  const drag = useRef<{ axis: "x" | "y"; start: number; pan: number; ratio: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      const vp = viewportRef.current;
      const f = frameNode(hostRef.current);
      if (vp && f) {
        const s = ed();
        const vw = vp.clientWidth;
        const vh = vp.clientHeight;
        const cw = f.offsetWidth * s.zoom;
        const ch = f.offsetHeight * s.zoom;
        // the page can be moved until only half a screen of empty space shows around it
        const axis = (view: number, content: number, pan: number) => {
          const margin = view / 2;
          const total = content + margin * 2;
          const range = Math.max(1, total - view);
          const scrolled = Math.max(0, Math.min(range, margin - pan));
          const size = Math.max(36, (view / total) * view);
          return { size, pos: (scrolled / range) * (view - size), range, margin };
        };
        const next: Bars = { vw, vh, x: axis(vw, cw, s.pan.x), y: axis(vh, ch, s.pan.y) };
        const key = JSON.stringify(next);
        if (key !== last) {
          last = key;
          setBars(next);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [viewportRef, hostRef]);

  if (!bars) return null;
  const start = (axis: "x" | "y") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const a = bars[axis];
    const view = axis === "x" ? bars.vw : bars.vh;
    drag.current = { axis, start: axis === "x" ? e.clientX : e.clientY, pan: ed().pan[axis], ratio: a.range / Math.max(1, view - a.size) };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const delta = ((d.axis === "x" ? e.clientX : e.clientY) - d.start) * d.ratio;
    const pan = ed().pan;
    useEditor.setState({ pan: d.axis === "x" ? { x: d.pan - delta, y: pan.y } : { x: pan.x, y: d.pan - delta } });
  };
  const end = () => (drag.current = null);
  // clicking the track jumps a screen towards the click, like a normal scrollbar
  const page = (axis: "x" | "y") => (e: React.PointerEvent) => {
    // only a press really on the track (browsers snap nearby touches onto it)
    if (e.target !== e.currentTarget || document.elementFromPoint(e.clientX, e.clientY) !== e.currentTarget) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const at = axis === "x" ? e.clientX - rect.left : e.clientY - rect.top;
    const a = bars[axis];
    const step = (axis === "x" ? bars.vw : bars.vh) * 0.8 * (at < a.pos ? 1 : -1);
    const pan = ed().pan;
    useEditor.setState({ pan: axis === "x" ? { x: pan.x + step, y: pan.y } : { x: pan.x, y: pan.y + step } });
  };
  return (
    <>
      <div className="canvas-scroll x" data-canvas-ui onPointerDown={page("x")}>
        <div className="canvas-thumb" style={{ width: bars.x.size, transform: `translateX(${bars.x.pos}px)` }} onPointerDown={start("x")} onPointerMove={move} onPointerUp={end} onPointerCancel={end} role="scrollbar" aria-orientation="horizontal" aria-label="Scroll the canvas sideways" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((bars.x.pos / Math.max(1, bars.vw - bars.x.size)) * 100)} />
      </div>
      <div className="canvas-scroll y" data-canvas-ui onPointerDown={page("y")}>
        <div className="canvas-thumb" style={{ height: bars.y.size, transform: `translateY(${bars.y.pos}px)` }} onPointerDown={start("y")} onPointerMove={move} onPointerUp={end} onPointerCancel={end} role="scrollbar" aria-orientation="vertical" aria-label="Scroll the canvas up and down" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((bars.y.pos / Math.max(1, bars.vh - bars.y.size)) * 100)} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ zoom buttons */

/**
 * A button that also acts on touch release: on a canvas that captures pointers, some browsers
 * drop the click after a drag, so touch taps are handled directly (and the click then ignored).
 */
function TapButton({ onTap, children, ...rest }: { onTap: () => void; children: React.ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  const tapped = useRef(0);
  return (
    <button
      {...rest}
      onPointerUp={(e) => {
        if (e.pointerType !== "touch") return;
        tapped.current = Date.now();
        onTap();
      }}
      onClick={() => {
        if (Date.now() - tapped.current < 600) return;
        onTap();
      }}
    >
      {children}
    </button>
  );
}

/** Zoom buttons on the canvas itself (touch screens: the top bar's are often hidden or small). */
export function CanvasZoomButtons() {
  const zoom = useEditor((s) => s.zoom);
  const zoomTo = (z: number) => window.dispatchEvent(new CustomEvent("cb:zoom", { detail: z }));
  return (
    <div className="canvas-zoom" data-canvas-ui role="group" aria-label="Zoom">
      <TapButton className="icon-btn" onTap={() => zoomTo(ed().zoom / 1.25)} aria-label="Zoom out">
        <Minus size={18} />
      </TapButton>
      <TapButton className="canvas-zoom-value" onTap={() => zoomTo(1)} title="Zoom to 100%">
        {Math.round(zoom * 100)}%
      </TapButton>
      <TapButton className="icon-btn" onTap={() => zoomTo(ed().zoom * 1.25)} aria-label="Zoom in">
        <Plus size={18} />
      </TapButton>
      <TapButton className="icon-btn" onTap={() => window.dispatchEvent(new Event("cb:fit"))} aria-label="Fit the page on screen" title="Fit">
        <Maximize size={16} />
      </TapButton>
    </div>
  );
}
