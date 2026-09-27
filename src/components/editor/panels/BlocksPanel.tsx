"use client";

import { useMemo } from "react";
import { BLOCKS, BLOCK_CATEGORIES } from "@/lib/blocks";
import { MOBILE_BLOCKS, MOBILE_BLOCK_CATEGORIES } from "@/lib/mobileBlocks";
import { buildPage } from "@/lib/build";
import { MiniPreview, type PreviewData } from "@/components/workspace/MiniPreview";
import { insertBlock, useEditor } from "../store";
import { startPanelDrag } from "../canvas/dragPayload";
import type { MenuItem } from "@/lib/shared/types";

const SAMPLE_TABS: MenuItem[] = [
  { id: "t1", label: "Home", icon: "House" },
  { id: "t2", label: "Explore", icon: "Compass" },
  { id: "t3", label: "Saved", icon: "Heart" },
  { id: "t4", label: "Profile", icon: "UserRound" },
];
const SAMPLE_LINKS: MenuItem[] = ["Home", "About", "Shop", "Contact"].map((label, i) => ({ id: `l${i}`, label }));

export function BlocksPanel() {
  const theme = useEditor((s) => s.doc.theme);
  const phoneApp = useEditor((s) => s.doc.settings.kind === "mobile");
  const blocks: { id: string; name: string; category: string; height: number; spec: () => import("@/lib/shared/elements").ElementSpec }[] = phoneApp ? MOBILE_BLOCKS : BLOCKS;
  const categories: string[] = phoneApp ? MOBILE_BLOCK_CATEGORIES : BLOCK_CATEGORIES;
  const width = phoneApp ? 390 : 1280;
  const previews = useMemo(
    () =>
      Object.fromEntries(
        blocks.map((b) => {
          const page = buildPage(b.name, "p", [b.spec()], { height: b.height });
          for (const el of Object.values(page.elements)) {
            // show pinned bars where they are in the thumbnail
            delete el.pin;
            // menus list the app's pages; thumbnails get sample ones
            if (el.type === "menu" && !el.props.items?.length)
              el.props.items = (el.props.variant === "tabbar" ? SAMPLE_TABS : SAMPLE_LINKS).map((it, i) => (i === 0 ? { ...it, pageId: page.id } : it));
          }
          return [b.id, { page, theme, kind: phoneApp ? "mobile" : "website" } satisfies PreviewData];
        }),
      ),
    [theme, blocks, phoneApp],
  );
  return (
    <>
      <div className="panel-head">
        <h2>Blocks</h2>
      </div>
      <div className="panel-scroll">
        <p className="panel-hint" style={{ marginBottom: 6 }}>
          {phoneApp
            ? "Ready-made pieces for phone screens. Bars stay on screen while people scroll. Click to add, or drag into place."
            : "Ready-made sections in your theme. Click to add one to the bottom of the page, or drag it to where it should go."}
        </p>
        {categories.map((cat) => (
          <div key={cat}>
            <div className="panel-section-title">{cat}</div>
            {blocks
              .filter((b) => b.category === cat)
              .map((b) => (
                <div
                  key={b.id}
                  className={`block-card ${phoneApp ? "phone" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Add ${b.name}`}
                  onPointerDown={(e) => startPanelDrag(e, { kind: "block", spec: b.spec(), label: b.name }, () => insertBlock(b.spec()))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      insertBlock(b.spec());
                    }
                  }}
                >
                  <div className="block-thumb" style={{ aspectRatio: `${width} / ${b.height}` }}>
                    <MiniPreview preview={previews[b.id]} frameWidth={width} />
                  </div>
                  <div className="block-name">
                    <span>{b.name}</span>
                    <span className="mini-note">+</span>
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}
