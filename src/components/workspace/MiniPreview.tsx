"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AppDoc, AppKind, Page, RuntimeRecord, Theme } from "@/lib/shared/types";
import { FRAME_WIDTH } from "@/lib/shared/types";
import { fillToCss, mix } from "@/lib/shared/theme";
import { RuntimeContext, createRuntimeStore, type SchemaCollection } from "@/components/runtime/store";
import { PageFrame } from "@/components/runtime/PageView";
import { docFonts, useGoogleFonts } from "@/components/runtime/fonts";

export interface PreviewData {
  page: Page;
  theme: Theme;
  kind?: AppKind;
  /** collections (fields only) so lists can show believable placeholders */
  schema?: SchemaCollection[];
  /** a few example rows per collection id, drawn into lists, tables, stats and charts */
  samples?: Record<string, RuntimeRecord[]>;
}

/** How much of a phone screen a thumbnail shows (top part, in design pixels). */
const PHONE_VISIBLE_H = 700;

/**
 * A live, scaled-down render of an app's home page (no data loading, no interaction).
 * Phone apps show as a phone-width column in the middle unless `frameWidth` is given
 * (then the design is scaled to fill the width, e.g. block thumbnails).
 */
export function MiniPreview({ preview, frameWidth }: { preview: PreviewData; frameWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const phoneDoc = preview.kind === "mobile";
  const phone = phoneDoc && frameWidth === undefined;
  const doc = useMemo<AppDoc>(
    () => ({ schemaVersion: 1, pages: [preview.page], homePageId: preview.page.id, theme: preview.theme, variables: [], settings: phoneDoc ? { kind: "mobile" } : {} }),
    [preview, phoneDoc],
  );
  const store = useMemo(
    () => createRuntimeStore({ mode: "thumb", appId: "thumb", appName: "", doc, schema: preview.schema, samples: preview.samples }),
    [doc, preview.schema, preview.samples],
  );
  useGoogleFonts(docFonts(doc));

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const bg = fillToCss(preview.page.background, preview.theme) ?? preview.theme.colors.background;
  const fw = frameWidth ?? (phoneDoc ? FRAME_WIDTH.mobile : FRAME_WIDTH.desktop);
  // phone apps: a phone-width column showing the top of the screen, centred
  const scale = phone ? Math.min((size.h || size.w * 0.625) / PHONE_VISIBLE_H, size.w / fw) : size.w / fw;
  const left = phone ? Math.round((size.w - fw * scale) / 2) : 0;
  const surface = preview.theme.colors.surface.startsWith("#") ? preview.theme.colors.surface : "#f3f3f7";
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, overflow: "hidden", background: phone ? mix(surface, "#000000", 0.05) : bg }} aria-hidden="true">
      {size.w > 0 && (
        <RuntimeContext.Provider value={store}>
          {phone && <div style={{ position: "absolute", top: 0, bottom: 0, left, width: fw * scale, background: bg, boxShadow: "0 0 0 1px #000" }} />}
          <div className="mini-preview" style={{ width: fw, position: "absolute", top: 0, left, transform: `scale(${scale})` }}>
            <PageFrame />
          </div>
        </RuntimeContext.Provider>
      )}
    </div>
  );
}
