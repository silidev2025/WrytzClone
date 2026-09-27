import type { ShapeKind } from "@/lib/shared/types";

/** Shape outlines in a 100×100 box, stretched to the element's size. */
export const SHAPE_PATHS: Partial<Record<ShapeKind, string>> = {
  triangle: "M50 0 L100 100 L0 100 Z",
  diamond: "M50 0 L100 50 L50 100 L0 50 Z",
  pentagon: "M50 0 L100 38 L81 100 L19 100 L0 38 Z",
  hexagon: "M25 0 L75 0 L100 50 L75 100 L25 100 L0 50 Z",
  star: "M50 0 L61.8 35.1 L98.1 35.1 L68.8 56.7 L79.4 91.9 L50 70.2 L20.6 91.9 L31.2 56.7 L1.9 35.1 L38.2 35.1 Z",
  heart: "M50 94 C22 74 0 56 0 31 C0 13 13 1 29 1 C39 1 46 7 50 15 C54 7 61 1 71 1 C87 1 100 13 100 31 C100 56 78 74 50 94 Z",
  arrow: "M0 30 L60 30 L60 4 L100 50 L60 96 L60 70 L0 70 Z",
  cross: "M34 0 L66 0 L66 34 L100 34 L100 66 L66 66 L66 100 L34 100 L34 66 L0 66 L0 34 L34 34 Z",
  blob: "M73 7 C89 16 99 34 97 54 C95 73 83 90 63 96 C43 102 20 95 9 79 C-2 63 0 40 10 25 C20 10 38 1 54 1 C61 1 67 3 73 7 Z",
  speech: "M12 0 H88 C95 0 100 5 100 12 V62 C100 69 95 74 88 74 H42 L20 98 L25 74 H12 C5 74 0 69 0 62 V12 C0 5 5 0 12 0 Z",
  wave: "M0 42 C16 12 34 12 50 42 S84 72 100 42 L100 100 L0 100 Z",
  arch: "M0 100 V50 C0 22 22 0 50 0 C78 0 100 22 100 50 V100 Z",
};

export const IMAGE_MASKS: Record<string, string | null> = {
  none: null,
  circle: null,
  rounded: null,
  arch: SHAPE_PATHS.arch!,
  blob: SHAPE_PATHS.blob!,
  hexagon: SHAPE_PATHS.hexagon!,
  star: SHAPE_PATHS.star!,
  diamond: SHAPE_PATHS.diamond!,
  heart: SHAPE_PATHS.heart!,
};

/** CSS mask for a path, scaled to the element box. */
export function maskCss(path: string): React.CSSProperties {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='${path}' fill='black'/></svg>`;
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  return {
    maskImage: url,
    WebkitMaskImage: url,
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };
}
