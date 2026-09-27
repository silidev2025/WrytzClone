"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { El, Page } from "@/lib/shared/types";
import { FRAME_WIDTH } from "@/lib/shared/types";
import { fillToCss } from "@/lib/shared/theme";
import { MOBILE_MARGIN, baseWidth, buildMobileFlow, frameWidthFor, freeChildBoxes, frameHeight, isHiddenAt, mobileOverrideBox } from "@/lib/shared/layout";
import { currentPage, isStatic, useRT } from "./store";
import { ElementView, FlowBlocks, FreeChildren } from "./ElementView";
import { usePinLayers } from "./pins";
import { DialogEl } from "./elements/DialogEl";
import { ancestorIds } from "@/lib/shared/doc";
import { isShown } from "./context";

/** Dialogs must mount independently of layout: auto flow deliberately omits them. */
function PageDialogs({ page }: { page: Page }) {
  const state = useRT((s) => s);
  if (isStatic(state.mode)) return null;
  return <>{Object.values(page.elements).filter((el) => el.type === "dialog" &&
    [el.id, ...ancestorIds(page, el.id)].every((id) => {
      const parent = page.elements[id];
      return parent && !isHiddenAt(parent, state.bp) && isShown(state, parent);
    })).map((el) => <DialogEl key={el.id} el={el} placement={{ kind: "abs", box: el.box }} />)}</>;
}

/** Pinned top-level elements drawn in the screen-fixed layers (runtime only). */
export function PinnedElements({ page, width }: { page: Page; width: number }) {
  const layers = usePinLayers();
  const bp = useRT((s) => s.bp);
  const mode = useRT((s) => s.mode);
  const settings = useRT((s) => s.doc.settings);
  if (isStatic(mode)) return null;
  const pinned = page.rootIds.map((id) => page.elements[id]).filter((el): el is El => !!el && !!el.pin && !isHiddenAt(el, bp));
  return (
    <>
      {pinned.map((el) => {
        const target = el.pin === "top" ? layers.top : layers.bottom;
        if (!target) return null;
        // on phones: the hand-made phone box, else full width for bars that span the desktop page
        const src = (bp === "mobile" && mobileOverrideBox(el)) || el.box;
        const spans = bp === "mobile" && src === el.box && el.box.w >= baseWidth({ settings }) * 0.8;
        const w = spans ? width : Math.min(src.w, width);
        const x = spans ? 0 : Math.max(0, Math.min(src.x, width - w));
        // bottom-pinned things sit on the bottom edge of the screen
        const box = { x, y: el.pin === "top" ? 0 : -src.h, w, h: src.h };
        return createPortal(<ElementView key={el.id} id={el.id} placement={{ kind: "abs", box }} />, target, el.id);
      })}
    </>
  );
}

/** One page at the current breakpoint: free layout, hand-made mobile layout or auto flow. */
export function PageFrame() {
  const page = useRT((s) => currentPage(s));
  const bp = useRT((s) => s.bp);
  const theme = useRT((s) => s.doc.theme);
  const settings = useRT((s) => s.doc.settings);
  const mode = useRT((s) => s.mode);
  const [growth, setGrowth] = useState(0);
  const runtimeWidth = useRT((s) => s.frameWidth);
  const doc = { settings };
  const flow = bp === "mobile" && !!page && !page.mobileCustom;
  const flowWidth = !isStatic(mode) && runtimeWidth ? runtimeWidth : FRAME_WIDTH.mobile;
  const blocks = useMemo(
    () => (flow && page ? buildMobileFlow(stripPinned(page, isStatic(mode)), null, baseWidth(doc), flowWidth - MOBILE_MARGIN * 2) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow, page, mode, settings.kind, flowWidth],
  );
  const w = frameWidthFor(doc, bp);
  const boxes = useMemo(() => (page && !flow ? freeChildBoxes(page, null, bp, w) : null), [page, flow, bp, w]);
  if (!page) return null;
  const background = fillToCss(page.background, theme) ?? theme.colors.background;

  if (flow) {
    // keep the last things on the page clear of a bar pinned to the bottom
    const bottomBar = isStatic(mode)
      ? 0
      : Math.max(0, ...page.rootIds.map((id) => page.elements[id]).filter((el): el is El => !!el && el.pin === "bottom" && !isHiddenAt(el, bp)).map((el) => (mobileOverrideBox(el) || el.box).h));
    return (
      <div
        className="rt-frame rt-flow"
        data-frame="mobile-auto"
        style={{
          position: "relative",
          width: flowWidth,
          minHeight: mode === "editor" ? 640 : undefined,
          padding: `0 ${MOBILE_MARGIN}px ${40 + bottomBar}px`,
          background,
          display: "flow-root",
        }}
      >
        <FlowBlocks blocks={blocks} />
        <PageDialogs page={page} />
        <PinnedElements page={page} width={flowWidth} />
      </div>
    );
  }

  const designH = frameHeight(page, bp, boxes || undefined);
  return (
    <div
      className="rt-frame"
      data-frame={bp}
      style={{ position: "relative", width: w, height: designH + (mode === "editor" ? 0 : growth), background }}
    >
      <FreeChildren parentId={null} width={w} onGrowth={setGrowth} />
      <PageDialogs page={page} />
      <PinnedElements page={page} width={w} />
    </div>
  );
}

/** Auto-arranged phone pages leave pinned elements out of the flow (they float instead). */
function stripPinned(page: Page, keep: boolean): Page {
  if (keep || !page.rootIds.some((id) => page.elements[id]?.pin)) return page;
  return { ...page, rootIds: page.rootIds.filter((id) => !page.elements[id]?.pin) };
}
