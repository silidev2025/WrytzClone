"use client";

import { useEffect } from "react";
import type { AppDoc } from "@/lib/shared/types";
import { googleFontsHref } from "@/lib/shared/theme";

export function docFonts(doc: AppDoc): string[] {
  const set = new Set<string>([doc.theme.headingFont, doc.theme.bodyFont]);
  for (const p of doc.pages)
    for (const el of Object.values(p.elements)) if (el.style.fontFamily && !el.style.fontFamily.startsWith("$")) set.add(el.style.fontFamily);
  return Array.from(set).sort();
}

const loaded = new Set<string>();

/** Load Google Fonts by family name — one stylesheet per family, each added once per page. */
export function loadFonts(names: Iterable<string>) {
  if (typeof document === "undefined") return;
  for (const name of names) {
    if (!name || loaded.has(name)) continue;
    const href = googleFontsHref([name]);
    loaded.add(name);
    if (!href) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.cbFont = name;
    document.head.appendChild(link);
  }
}

export function useGoogleFonts(names: string[]) {
  const key = names.join("|");
  useEffect(() => {
    loadFonts(key.split("|"));
  }, [key]);
}
