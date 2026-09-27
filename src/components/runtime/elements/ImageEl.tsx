"use client";

import type { CSSProperties } from "react";
import type { El } from "@/lib/shared/types";
import { evaluate, hasBindings } from "@/lib/shared/expressions";
import { safeImageSrc, safeUrl } from "@/lib/shared/util";
import { Icon } from "@/components/ui/Icon";
import { isStatic, useRT, useRTStore } from "../store";
import { useBindingContext } from "../hooks";
import { imageFilterCss } from "../styles";
import { IMAGE_MASKS, maskCss } from "../shapes";

export function ImageContent({ el }: { el: El }) {
  const store = useRTStore();
  const mode = useRT((s) => s.mode);
  const override = useRT((s) => s.overrides[el.id]?.source as string | undefined);
  const raw = override ?? el.props.src ?? "";
  const ctx = useBindingContext(hasBindings(raw));
  const value = ctx ? evaluate(raw, ctx) : raw;
  const src = safeImageSrc(typeof value === "string" ? value : "");
  const mask = el.props.mask || "none";

  const frame: CSSProperties = { position: "absolute", inset: 0, overflow: "hidden" };
  if (mask === "circle") frame.borderRadius = "50%";
  else if (mask === "rounded") frame.borderRadius = "22%";
  else if (IMAGE_MASKS[mask]) Object.assign(frame, maskCss(IMAGE_MASKS[mask]!));

  if (!src) {
    return (
      <div style={frame} className="rt-img-empty">
        {mode === "editor" && (
          <div className="rt-img-empty-inner">
            <Icon name="Image" size={26} />
            <span>{hasBindings(raw) ? "Image from data" : "Add an image"}</span>
          </div>
        )}
      </div>
    );
  }

  const fx = el.props.focusX ?? 50;
  const fy = el.props.focusY ?? 50;
  const zoom = el.props.zoom && el.props.zoom > 1 ? el.props.zoom : 1;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={el.props.alt || ""}
      draggable={false}
      loading={mode === "editor" ? "eager" : "lazy"}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: el.props.fit || "cover",
        objectPosition: `${fx}% ${fy}%`,
        filter: imageFilterCss(el),
        transform: zoom > 1 ? `scale(${zoom})` : undefined,
        transformOrigin: `${fx}% ${fy}%`,
      }}
    />
  );

  const link = el.props.link;
  if (!isStatic(mode) && link && (link.url || link.pageId)) {
    const href = link.url ? safeUrl(link.url) : null;
    return (
      <a
        href={href || "#"}
        target={link.newTab && href ? "_blank" : undefined}
        rel="noopener noreferrer"
        style={{ ...frame, display: "block" }}
        onClick={(e) => {
          if (link.pageId) {
            e.preventDefault();
            store.getState().navigate(link.pageId, null);
          }
        }}
      >
        {img}
      </a>
    );
  }
  return <div style={frame}>{img}</div>;
}
