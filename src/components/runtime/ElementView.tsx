"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Box, ContainerLayout, El, Page } from "@/lib/shared/types";
import { childIdsOf } from "@/lib/shared/doc";
import { isContainerType, layoutOf } from "@/lib/shared/elements";
import {
  MOBILE_MARGIN,
  STRETCHABLE,
  computePushDown,
  freeChildBoxes,
  isHugHeight,
  sizeMode,
  type FlowBlock,
  type FlowEntry,
  type PushItem,
} from "@/lib/shared/layout";
import { currentPage, isStatic, useRT } from "./store";
import { FormContext, isShown } from "./context";
import { animationProps, hoverProps, surfaceStyle } from "./styles";
import { useActions } from "./hooks";
import { TextContent } from "./elements/TextEl";
import { ButtonEl } from "./elements/ButtonEl";
import { ImageContent } from "./elements/ImageEl";
import { IconContent, LineContent, ShapeEl } from "./elements/GraphicEls";
import { MediaContent } from "./elements/MediaEls";
import { InputContent } from "./elements/InputEl";
import { ListContent } from "./elements/ListEl";
import { TableContent } from "./elements/TableEl";
import { MenuContent } from "./elements/MenuEl";
import { TabsContent } from "./elements/TabsEl";
import { DialogEl } from "./elements/DialogEl";
import { ChartContent, CountdownContent, ProgressContent, StatContent } from "./elements/DataEls";

export type Placement =
  | { kind: "abs"; box: Box; dy?: number; dh?: number }
  | { kind: "auto"; layout: ContainerLayout }
  | { kind: "flow"; entry: FlowEntry }
  | { kind: "fill" };

const ALIGN: Record<string, CSSProperties["alignItems"]> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };
const JUSTIFY: Record<string, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};

function placementStyle(el: El, p: Placement, growth: number): CSSProperties {
  switch (p.kind) {
    case "abs": {
      const hug = isHugHeight(el);
      const css: CSSProperties = {
        position: "absolute",
        left: p.box.x,
        top: p.box.y + (p.dy || 0),
        width: p.box.w,
        height: hug ? "auto" : p.box.h + (p.dh || 0) + growth,
      };
      if (p.box.r) css.transform = `rotate(${p.box.r}deg)`;
      return css;
    }
    case "auto": {
      const L = p.layout;
      const w = sizeMode(el, "w");
      const h = sizeMode(el, "h");
      const css: CSSProperties = { position: "relative", flexShrink: 0, maxWidth: "100%" };
      if (L.mode === "grid") {
        if (w === "fixed") {
          css.width = el.box.w;
          css.justifySelf = "center";
        }
      } else if (w === "fill") {
        if (L.mode === "row") {
          css.flex = "1 1 0";
          css.minWidth = 0;
        } else css.alignSelf = "stretch";
      } else if (w === "hug") css.width = "fit-content";
      else css.width = el.box.w;
      if (h === "fill") {
        if (L.mode === "column") {
          css.flex = "1 1 0";
          css.minHeight = 0;
        } else css.alignSelf = "stretch";
      } else if (h === "hug") css.height = "auto";
      else css.height = el.box.h + growth;
      return css;
    }
    case "flow": {
      const e = p.entry;
      const css: CSSProperties = { position: "relative", width: e.width ?? "100%", maxWidth: "100%", flexShrink: 0 };
      if (e.aspect && !e.children) {
        css.aspectRatio = String(e.aspect);
        css.height = "auto";
      } else css.height = e.height ?? "auto";
      return css;
    }
    case "fill":
      return { position: "absolute", inset: 0 };
  }
}

function useScrollReveal(node: HTMLElement | null, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            node.classList.add("rt-in");
            io.disconnect();
          }
      },
      { threshold: 0.15 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, enabled]);
}

export const ElementView = memo(function ElementView({
  id,
  placement,
  onMeasure,
}: {
  id: string;
  placement: Placement;
  onMeasure?: (id: string, h: number) => void;
}) {
  const el = useRT((s) => currentPage(s)?.elements[id]);
  const theme = useRT((s) => s.doc.theme);
  const bp = useRT((s) => s.bp);
  const mode = useRT((s) => s.mode);
  const shown = useRT((s) => (el ? isShown(s, el) : true));
  const { run, submit } = useActions();
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [growth, setGrowth] = useState(0);
  const editor = isStatic(mode);

  useLayoutEffect(() => {
    if (!onMeasure || !node) return;
    const report = () => onMeasure(id, node.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(node);
    return () => ro.disconnect();
  }, [onMeasure, id, node]);

  useScrollReveal(node, !editor && el?.style.animation?.trigger === "scroll" && el.style.animation.name !== "none");

  if (!el || el.hidden || el.hideOn?.[bp]) return null;
  if (mode !== "editor" && !shown) return null;
  if (el.type === "dialog") return editor ? <DialogEl el={el} placement={placement} /> : null;

  const pos = placementStyle(el, placement, growth);
  if (el.type === "button") return <ButtonEl el={el} style={pos} setNode={setNode} />;
  if (el.type === "shape") return <ShapeEl el={el} style={pos} setNode={setNode} onClick={!editor && el.events?.click?.length ? () => run(el.events!.click, el.id) : undefined} />;

  const hover = editor ? { className: "", style: {} } : hoverProps(el, theme);
  const anim = animationProps(el, !editor);
  // inputs paint their fill/border on the control itself
  const surface: CSSProperties =
    el.type === "input" ? (el.style.opacity !== undefined && el.style.opacity < 1 ? { opacity: el.style.opacity } : {}) : surfaceStyle(el, theme);
  const style: CSSProperties = { ...pos, ...surface, ...hover.style, ...anim.style };
  if (el.type === "image" || el.style.overflow === "hidden") style.overflow = "hidden";
  if (el.style.overflow === "scroll") style.overflow = "auto";
  const clickActions = el.events?.click;
  const hasClick = !editor && !!clickActions?.length;
  if (hasClick) style.cursor = "pointer";

  let content: ReactNode = null;
  const containerWidth = placement.kind === "abs" ? placement.box.w : el.box.w;
  switch (el.type) {
    case "text":
      content = <TextContent el={el} />;
      break;
    case "image":
      content = <ImageContent el={el} />;
      break;
    case "icon":
      content = <IconContent el={el} />;
      break;
    case "line":
      content = <LineContent el={el} />;
      break;
    case "video":
    case "map":
    case "embed":
      content = <MediaContent el={el} />;
      break;
    case "input":
      content = <InputContent el={el} />;
      break;
    case "box":
    case "form":
      content =
        placement.kind === "flow" && placement.entry.children ? (
          <div style={{ padding: 16 }}>
            <FlowBlocks blocks={placement.entry.children} />
          </div>
        ) : (
          <ContainerChildren el={el} width={containerWidth} onGrowth={setGrowth} />
        );
      break;
    case "list":
      content = <ListContent el={el} />;
      break;
    case "table":
      content = <TableContent el={el} />;
      break;
    case "menu":
      content = <MenuContent el={el} />;
      break;
    case "tabs":
      content = <TabsContent el={el} />;
      break;
    case "progress":
      content = <ProgressContent el={el} />;
      break;
    case "stat":
      content = <StatContent el={el} />;
      break;
    case "chart":
      content = <ChartContent el={el} />;
      break;
    case "countdown":
      content = <CountdownContent el={el} />;
      break;
  }

  const className = `rt-el rt-${el.type} ${hover.className} ${anim.className} ${el.startHidden && editor ? "rt-start-hidden" : ""}`;
  const onClick = hasClick
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        void run(clickActions, el.id);
      }
    : undefined;

  if (el.type === "form") {
    const inner = <FormContext.Provider value={el.id}>{content}</FormContext.Provider>;
    if (editor)
      return (
        <div ref={setNode} data-el-id={el.id} className={className} style={style}>
          {inner}
        </div>
      );
    return (
      <form
        ref={setNode}
        data-el-id={el.id}
        className={className}
        style={style}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit(el.id);
        }}
      >
        {inner}
      </form>
    );
  }

  return (
    <div ref={setNode} data-el-id={el.id} className={className} style={style} onClick={onClick}
      role={hasClick ? "button" : undefined} tabIndex={hasClick ? 0 : undefined}
      aria-label={hasClick && el.type === "icon" ? el.name : undefined}
      onKeyDown={hasClick ? (e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          e.stopPropagation();
          void run(clickActions, el.id);
        }
      } : undefined}>
      {content}
    </div>
  );
}, sameProps);

function samePlacement(a: Placement, b: Placement): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "abs": {
      const o = b as typeof a;
      return (a.box === o.box || (a.box.x === o.box.x && a.box.y === o.box.y && a.box.w === o.box.w && a.box.h === o.box.h && a.box.r === o.box.r)) && a.dy === o.dy && a.dh === o.dh;
    }
    case "auto":
      return a.layout === (b as typeof a).layout || JSON.stringify(a.layout) === JSON.stringify((b as typeof a).layout);
    case "flow":
      return a.entry === (b as typeof a).entry;
    default:
      return true;
  }
}

function sameProps(
  a: { id: string; placement: Placement; onMeasure?: unknown },
  b: { id: string; placement: Placement; onMeasure?: unknown },
): boolean {
  return a.id === b.id && a.onMeasure === b.onMeasure && samePlacement(a.placement, b.placement);
}

/* ------------------------------------------------------------------ containers */

export function ContainerChildren({ el, width, onGrowth }: { el: El; width: number; onGrowth?: (g: number) => void }) {
  const bp = useRT((s) => s.bp);
  if (!el.childIds?.length) return null;
  const L = layoutOf(el);
  if (L.mode === "free") {
    return <FreeChildren parentId={el.id} width={width} onGrowth={onGrowth} />;
  }
  return <AutoChildren el={el} layout={L} bp={bp} />;
}

export function autoLayoutStyle(L: ContainerLayout, bp: "desktop" | "mobile"): CSSProperties {
  if (L.mode === "grid") {
    const cols = bp === "mobile" ? (L.mobileColumns ?? 1) : L.columns;
    return {
      display: "grid",
      gridTemplateColumns: `repeat(${Math.max(1, cols)}, minmax(0, 1fr))`,
      gap: L.gap,
      padding: L.padding,
      alignItems: L.align === "stretch" ? "stretch" : ALIGN[L.align],
      alignContent: "start",
    };
  }
  return {
    display: "flex",
    flexDirection: L.mode === "row" ? "row" : "column",
    gap: L.gap,
    padding: L.padding,
    alignItems: ALIGN[L.align],
    justifyContent: JUSTIFY[L.justify],
    flexWrap: L.mode === "row" && (L.wrap || bp === "mobile") ? "wrap" : "nowrap",
  };
}

function AutoChildren({ el, layout, bp }: { el: El; layout: ContainerLayout; bp: "desktop" | "mobile" }) {
  return (
    <div className="rt-auto" style={{ ...autoLayoutStyle(layout, bp), width: "100%", minHeight: "100%", height: sizeMode(el, "h") === "hug" ? "auto" : "100%" }}>
      {el.childIds!.map((cid) => (
        <ElementView key={cid} id={cid} placement={{ kind: "auto", layout }} />
      ))}
    </div>
  );
}

/**
 * Children of a free-layout parent. At runtime, elements whose content grows push the
 * ones below them down (see computePushDown).
 */
export function FreeChildren({ parentId, width, onGrowth }: { parentId: string | null; width: number; onGrowth?: (g: number) => void }) {
  const page = useRT((s) => currentPage(s)) as Page;
  const bp = useRT((s) => s.bp);
  const mode = useRT((s) => s.mode);
  const shownMap = useRT((s) => s.shown);
  const bleed = useRT((s) => (parentId === null ? s.bleed : 0));
  const ids = childIdsOf(page, parentId);
  const boxes = useMemo(() => freeChildBoxes(page, parentId, bp, width), [page, parentId, bp, width]);
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const measure = useCallback((id: string, h: number) => setMeasured((m) => (m[id] === h ? m : { ...m, [id]: h })), []);
  const runtime = !isStatic(mode);

  const push = useMemo(() => {
    if (!runtime) return null;
    const items: PushItem[] = [];
    for (const id of ids) {
      const el = page.elements[id];
      const b = boxes.get(id);
      if (!el || !b) continue;
      const measurable = isHugHeight(el) || (isContainerType(el.type) && !!el.childIds?.length);
      const pinned = parentId === null && !!el.pin;
      const hidden = pinned || el.hidden || el.hideOn?.[bp] || el.type === "dialog" || (id in shownMap ? !shownMap[id] : !!el.startHidden);
      items.push({
        id,
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
        actualH: measurable ? measured[id] : undefined,
        canStretch: STRETCHABLE.includes(el.type) && !measurable,
        ignore: !!hidden,
      });
    }
    return computePushDown(items);
  }, [runtime, ids, page, boxes, measured, bp, shownMap]);

  const growth = push?.growth ?? 0;
  const onGrowthRef = useRef(onGrowth);
  onGrowthRef.current = onGrowth;
  useEffect(() => {
    onGrowthRef.current?.(growth);
  }, [growth]);

  return (
    <>
      {ids.map((cid) => {
        let box = boxes.get(cid);
        const el = page.elements[cid];
        if (!box || !el) return null;
        // pinned elements are drawn in the screen-fixed layers instead (see PinnedElements)
        if (runtime && parentId === null && el.pin) return null;
        // full-width backgrounds reach the screen edges when the page is centred on wide screens
        if (bleed > 0 && box.x <= 2 && box.x + box.w >= width - 2 && STRETCHABLE.includes(el.type) && !el.childIds?.length && !box.r)
          box = { ...box, x: box.x - bleed, w: box.w + bleed * 2 };
        const measurable = runtime && (isHugHeight(el) || (isContainerType(el.type) && !!el.childIds?.length));
        return (
          <ElementView
            key={cid}
            id={cid}
            placement={{ kind: "abs", box, dy: push?.dy.get(cid), dh: push?.dh.get(cid) }}
            onMeasure={measurable ? measure : undefined}
          />
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ mobile auto flow */

export function FlowBlocks({ blocks }: { blocks: FlowBlock[] }) {
  return (
    <>
      {blocks.map((b) =>
        b.kind === "row" ? (
          <div
            key={b.key}
            className="rt-flow-row"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "flex-start",
              justifyContent: b.justify === "center" ? "center" : b.justify === "end" ? "flex-end" : "flex-start",
              marginTop: b.marginTop,
            }}
          >
            {b.entries.map((e) => (
              <ElementView key={e.id} id={e.id} placement={{ kind: "flow", entry: e }} />
            ))}
          </div>
        ) : (
          <div
            key={b.key}
            className="rt-flow-band"
            style={{
              position: "relative",
              marginTop: b.marginTop,
              marginLeft: b.bleed ? -MOBILE_MARGIN : 0,
              marginRight: b.bleed ? -MOBILE_MARGIN : 0,
              paddingTop: b.paddingTop,
              paddingBottom: b.paddingBottom,
              paddingLeft: b.bleed ? MOBILE_MARGIN : 14,
              paddingRight: b.bleed ? MOBILE_MARGIN : 14,
            }}
          >
            <ElementView id={b.bgId} placement={{ kind: "fill" }} />
            <div style={{ position: "relative" }}>
              <FlowBlocks blocks={b.blocks} />
            </div>
          </div>
        ),
      )}
    </>
  );
}
