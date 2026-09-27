import type { Fill, Shadow, Theme, ThemeColors } from "./types";
import { safeImageSrc } from "./util";

/* ------------------------------------------------------------------ fonts */

export type FontCategory = "Sans serif" | "Serif" | "Display" | "Handwriting" | "Monospace" | "System";

export interface FontDef {
  name: string;
  category: FontCategory;
  weights: number[];
  /** CSS fallback stack */
  fallback: string;
}

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const CURSIVE = "cursive";

const range = (from: number, to: number) => {
  const out: number[] = [];
  for (let w = from; w <= to; w += 100) out.push(w);
  return out;
};

export const FONTS: FontDef[] = [
  { name: "Inter", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Poppins", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Montserrat", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Roboto", category: "Sans serif", weights: [300, 400, 500, 700, 900], fallback: SANS },
  { name: "Open Sans", category: "Sans serif", weights: range(300, 800), fallback: SANS },
  { name: "Lato", category: "Sans serif", weights: [300, 400, 700, 900], fallback: SANS },
  { name: "Nunito", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "DM Sans", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Plus Jakarta Sans", category: "Sans serif", weights: range(300, 800), fallback: SANS },
  { name: "Outfit", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Manrope", category: "Sans serif", weights: range(300, 800), fallback: SANS },
  { name: "Rubik", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Work Sans", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Space Grotesk", category: "Sans serif", weights: range(300, 700), fallback: SANS },
  { name: "Raleway", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Josefin Sans", category: "Sans serif", weights: range(300, 700), fallback: SANS },
  { name: "Quicksand", category: "Sans serif", weights: range(300, 700), fallback: SANS },
  { name: "Source Sans 3", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Karla", category: "Sans serif", weights: range(300, 800), fallback: SANS },
  { name: "Mulish", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Figtree", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Lexend", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Urbanist", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Sora", category: "Sans serif", weights: range(300, 800), fallback: SANS },
  { name: "IBM Plex Sans", category: "Sans serif", weights: range(300, 700), fallback: SANS },
  { name: "Barlow", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Archivo", category: "Sans serif", weights: range(300, 900), fallback: SANS },
  { name: "Syne", category: "Sans serif", weights: range(400, 800), fallback: SANS },
  { name: "Bricolage Grotesque", category: "Sans serif", weights: range(300, 800), fallback: SANS },
  { name: "Comfortaa", category: "Sans serif", weights: range(300, 700), fallback: SANS },
  { name: "Fredoka", category: "Sans serif", weights: range(300, 700), fallback: SANS },
  { name: "Playfair Display", category: "Serif", weights: range(400, 900), fallback: SERIF },
  { name: "DM Serif Display", category: "Serif", weights: [400], fallback: SERIF },
  { name: "Merriweather", category: "Serif", weights: [300, 400, 700, 900], fallback: SERIF },
  { name: "Lora", category: "Serif", weights: range(400, 700), fallback: SERIF },
  { name: "Libre Baskerville", category: "Serif", weights: [400, 700], fallback: SERIF },
  { name: "Cormorant Garamond", category: "Serif", weights: range(300, 700), fallback: SERIF },
  { name: "PT Serif", category: "Serif", weights: [400, 700], fallback: SERIF },
  { name: "Crimson Text", category: "Serif", weights: [400, 600, 700], fallback: SERIF },
  { name: "Bitter", category: "Serif", weights: range(300, 900), fallback: SERIF },
  { name: "Zilla Slab", category: "Serif", weights: range(300, 700), fallback: SERIF },
  { name: "Arvo", category: "Serif", weights: [400, 700], fallback: SERIF },
  { name: "Instrument Serif", category: "Serif", weights: [400], fallback: SERIF },
  { name: "Young Serif", category: "Serif", weights: [400], fallback: SERIF },
  { name: "Bebas Neue", category: "Display", weights: [400], fallback: SANS },
  { name: "Oswald", category: "Display", weights: range(300, 700), fallback: SANS },
  { name: "Anton", category: "Display", weights: [400], fallback: SANS },
  { name: "Abril Fatface", category: "Display", weights: [400], fallback: SERIF },
  { name: "Archivo Black", category: "Display", weights: [400], fallback: SANS },
  { name: "Righteous", category: "Display", weights: [400], fallback: SANS },
  { name: "Lobster", category: "Display", weights: [400], fallback: CURSIVE },
  { name: "Unbounded", category: "Display", weights: range(300, 900), fallback: SANS },
  { name: "Titan One", category: "Display", weights: [400], fallback: SANS },
  { name: "Pacifico", category: "Handwriting", weights: [400], fallback: CURSIVE },
  { name: "Caveat", category: "Handwriting", weights: range(400, 700), fallback: CURSIVE },
  { name: "Dancing Script", category: "Handwriting", weights: range(400, 700), fallback: CURSIVE },
  { name: "Permanent Marker", category: "Handwriting", weights: [400], fallback: CURSIVE },
  { name: "Kalam", category: "Handwriting", weights: [300, 400, 700], fallback: CURSIVE },
  { name: "Shadows Into Light", category: "Handwriting", weights: [400], fallback: CURSIVE },
  { name: "Amatic SC", category: "Handwriting", weights: [400, 700], fallback: CURSIVE },
  { name: "Satisfy", category: "Handwriting", weights: [400], fallback: CURSIVE },
  { name: "Great Vibes", category: "Handwriting", weights: [400], fallback: CURSIVE },
  { name: "JetBrains Mono", category: "Monospace", weights: range(300, 800), fallback: MONO },
  { name: "IBM Plex Mono", category: "Monospace", weights: range(300, 700), fallback: MONO },
  { name: "Space Mono", category: "Monospace", weights: [400, 700], fallback: MONO },
  { name: "System UI", category: "System", weights: range(300, 900), fallback: SANS },
  { name: "Georgia", category: "System", weights: [400, 700], fallback: SERIF },
  { name: "Arial", category: "System", weights: [400, 700], fallback: SANS },
  { name: "Courier New", category: "System", weights: [400, 700], fallback: MONO },
];

const FONT_MAP = new Map(FONTS.map((f) => [f.name.toLowerCase(), f]));

export function findFont(name: string | undefined): FontDef | undefined {
  return name ? FONT_MAP.get(name.toLowerCase()) : undefined;
}

export function fontStack(name: string | undefined, theme: Theme): string {
  let font = name;
  if (!font || font === "$body") font = theme.bodyFont;
  else if (font === "$heading") font = theme.headingFont;
  const def = findFont(font);
  if (!def) return SANS;
  if (def.name === "System UI") return SANS;
  if (def.category === "System") return `'${def.name}', ${def.fallback}`;
  return `'${def.name}', ${def.fallback}`;
}

/** Google Fonts stylesheet URL for the given font names (system fonts are skipped). */
export function googleFontsHref(names: Iterable<string>): string | null {
  const families: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const def = findFont(n);
    if (!def || def.category === "System" || seen.has(def.name)) continue;
    seen.add(def.name);
    const fam = def.name.replace(/ /g, "+");
    families.push(def.weights.length > 1 ? `family=${fam}:wght@${def.weights.join(";")}` : `family=${fam}`);
  }
  if (!families.length) return null;
  return `https://fonts.googleapis.com/css2?${families.sort().join("&")}&display=swap`;
}

/* ------------------------------------------------------------------ theme presets */

export interface ThemePreset {
  id: string;
  name: string;
  colors: ThemeColors;
  headingFont: string;
  bodyFont: string;
  radius: number;
  buttonStyle: Theme["buttonStyle"];
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "violet",
    name: "Violet Pop",
    colors: { primary: "#6c47ff", secondary: "#ff6b9d", accent: "#ffc53d", background: "#ffffff", surface: "#f5f3ff", text: "#1d1b29", muted: "#6b6880", border: "#e6e3f0" },
    headingFont: "Poppins",
    bodyFont: "Inter",
    radius: 12,
    buttonStyle: "filled",
  },
  {
    id: "ocean",
    name: "Ocean Breeze",
    colors: { primary: "#0077b6", secondary: "#00b4d8", accent: "#90e0ef", background: "#f8fcff", surface: "#e9f5fb", text: "#0b2230", muted: "#5a7282", border: "#d3e6ef" },
    headingFont: "Montserrat",
    bodyFont: "Open Sans",
    radius: 10,
    buttonStyle: "filled",
  },
  {
    id: "forest",
    name: "Forest Walk",
    colors: { primary: "#2d6a4f", secondary: "#52b788", accent: "#e9c46a", background: "#fbfdf9", surface: "#eef6ee", text: "#1b2e24", muted: "#5f7466", border: "#dce8df" },
    headingFont: "DM Serif Display",
    bodyFont: "DM Sans",
    radius: 8,
    buttonStyle: "filled",
  },
  {
    id: "sunset",
    name: "Sunset Glow",
    colors: { primary: "#f3722c", secondary: "#f94144", accent: "#f9c74f", background: "#fffaf5", surface: "#fff0e3", text: "#2b1d14", muted: "#7a6556", border: "#f1e0d2" },
    headingFont: "Playfair Display",
    bodyFont: "Lato",
    radius: 999,
    buttonStyle: "pill",
  },
  {
    id: "midnight",
    name: "Midnight",
    colors: { primary: "#8b5cf6", secondary: "#22d3ee", accent: "#f472b6", background: "#0f0e17", surface: "#1a1926", text: "#f4f2ff", muted: "#a09cb8", border: "#2e2c40" },
    headingFont: "Space Grotesk",
    bodyFont: "Inter",
    radius: 14,
    buttonStyle: "filled",
  },
  {
    id: "mono",
    name: "Minimal Mono",
    colors: { primary: "#111111", secondary: "#555555", accent: "#d9d9d9", background: "#ffffff", surface: "#f5f5f5", text: "#111111", muted: "#6b6b6b", border: "#e5e5e5" },
    headingFont: "Inter",
    bodyFont: "Inter",
    radius: 6,
    buttonStyle: "outline",
  },
  {
    id: "candy",
    name: "Candy Shop",
    colors: { primary: "#ff4d8d", secondary: "#7c4dff", accent: "#ffd166", background: "#fff7fb", surface: "#ffe9f2", text: "#2a1530", muted: "#7d6484", border: "#f6d7e5" },
    headingFont: "Fredoka",
    bodyFont: "Nunito",
    radius: 20,
    buttonStyle: "pill",
  },
  {
    id: "earthy",
    name: "Earthy Clay",
    colors: { primary: "#9c6644", secondary: "#7f5539", accent: "#ddb892", background: "#fdf8f3", surface: "#f3e9dc", text: "#2f241d", muted: "#7b6a5d", border: "#e8dccd" },
    headingFont: "Lora",
    bodyFont: "Source Sans 3",
    radius: 6,
    buttonStyle: "filled",
  },
  {
    id: "tech",
    name: "Tech Blue",
    colors: { primary: "#2563eb", secondary: "#0ea5e9", accent: "#f59e0b", background: "#ffffff", surface: "#f1f5f9", text: "#0f172a", muted: "#64748b", border: "#e2e8f0" },
    headingFont: "Plus Jakarta Sans",
    bodyFont: "Inter",
    radius: 10,
    buttonStyle: "filled",
  },
  {
    id: "lime",
    name: "Fresh Lime",
    colors: { primary: "#4d7c0f", secondary: "#84cc16", accent: "#facc15", background: "#fcfff5", surface: "#f1f9e4", text: "#1a2e05", muted: "#5b6b47", border: "#e2edcf" },
    headingFont: "Outfit",
    bodyFont: "Manrope",
    radius: 16,
    buttonStyle: "soft",
  },
  {
    id: "royal",
    name: "Royal Velvet",
    colors: { primary: "#3a0ca3", secondary: "#7209b7", accent: "#f72585", background: "#fbf9ff", surface: "#f0ebfb", text: "#1a1033", muted: "#6d6485", border: "#e3dcf2" },
    headingFont: "Cormorant Garamond",
    bodyFont: "Karla",
    radius: 4,
    buttonStyle: "filled",
  },
  {
    id: "coral",
    name: "Coral Reef",
    colors: { primary: "#ff6f59", secondary: "#254441", accent: "#43aa8b", background: "#fffdfa", surface: "#fff1ec", text: "#1f2d2b", muted: "#6a7472", border: "#f2e2dc" },
    headingFont: "Rubik",
    bodyFont: "Rubik",
    radius: 12,
    buttonStyle: "filled",
  },
];

export const DEFAULT_THEME: Theme = {
  colors: { ...THEME_PRESETS[0].colors },
  headingFont: THEME_PRESETS[0].headingFont,
  bodyFont: THEME_PRESETS[0].bodyFont,
  radius: THEME_PRESETS[0].radius,
  buttonStyle: "filled",
};

export const THEME_COLOR_KEYS: (keyof ThemeColors)[] = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
  "muted",
  "border",
];

export const THEME_COLOR_LABELS: Record<keyof ThemeColors, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  surface: "Surface",
  text: "Text",
  muted: "Muted text",
  border: "Borders",
};

/* ------------------------------------------------------------------ colour helpers */

export function parseHex(hex: string): [number, number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return null;
  const n = parseInt(h.slice(0, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

export function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

export function withAlpha(color: string, alpha: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.max(0, Math.min(1, alpha * rgb[3]))})`;
}

export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return a;
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  const [r, g, b] = rgb.slice(0, 3).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDark(color: string): boolean {
  return luminance(color) < 0.4;
}

/** Black or white, whichever reads better on the given background. */
export function readableOn(bg: string): string {
  const rgb = parseHex(bg);
  if (!rgb) return "#ffffff";
  return luminance(bg) > 0.45 ? "#15131c" : "#ffffff";
}

/**
 * Resolve a stored colour to a CSS colour. Theme tokens look like "$primary" and may carry
 * an opacity suffix: "$primary/15" = primary at 15% opacity.
 */
export function resolveColor(value: string | undefined | null, theme: Theme, fallback = "transparent"): string {
  if (!value) return fallback;
  if (value[0] !== "$") {
    // "#16a34a/12" = that colour at 12% strength, like "$primary/12"
    const hexAlpha = value.match(/^(#[0-9a-f]{6})\/(\d{1,3})$/i);
    if (hexAlpha) return withAlpha(hexAlpha[1], Number(hexAlpha[2]) / 100);
    return sanitizeColor(value) ?? fallback;
  }
  const [token, alphaStr] = value.slice(1).split("/");
  const base = theme.colors[token as keyof ThemeColors];
  if (!base) return fallback;
  if (alphaStr !== undefined) return withAlpha(base, Number(alphaStr) / 100);
  return base;
}

/** Colours come from users: only allow things that are plainly colours (no url(), no ;). */
export function sanitizeColor(value: string): string | null {
  const v = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^(rgba?|hsla?)\([\d\s.,%/+-]+\)$/i.test(v)) return v;
  if (/^[a-z]{3,20}$/i.test(v)) return v; // named colours, transparent, currentColor
  return null;
}

export function gradientCss(fill: Extract<Fill, { type: "gradient" }>, theme: Theme): string {
  const stops = [...fill.stops]
    .sort((a, b) => a.at - b.at)
    .map((s) => `${resolveColor(s.color, theme)} ${Math.round(s.at)}%`)
    .join(", ");
  return fill.kind === "radial" ? `radial-gradient(circle at center, ${stops})` : `linear-gradient(${fill.angle}deg, ${stops})`;
}

export function cssUrl(src: string): string {
  return `url("${src.replace(/["\\\n\r]/g, (c) => encodeURIComponent(c))}")`;
}

/** CSS `background` value for a fill. */
export function fillToCss(fill: Fill | undefined, theme: Theme): string | undefined {
  if (!fill || fill.type === "none") return undefined;
  if (fill.type === "solid") return resolveColor(fill.color, theme);
  if (fill.type === "gradient") return gradientCss(fill, theme);
  const src = safeImageSrc(fill.src);
  if (!src) return undefined;
  const size = fill.fit === "tile" ? "auto" : fill.fit;
  const repeat = fill.fit === "tile" ? "repeat" : "no-repeat";
  const position = fill.position || "center";
  const layers = [`${cssUrl(src)} ${position} / ${size} ${repeat}`];
  if (fill.overlay) {
    const o = resolveColor(fill.overlay, theme);
    layers.unshift(`linear-gradient(${o}, ${o})`);
  }
  return layers.join(", ");
}

/** Representative solid colour of a fill (used for contrast decisions). */
export function fillBaseColor(fill: Fill | undefined, theme: Theme): string | null {
  if (!fill || fill.type === "none") return null;
  if (fill.type === "solid") {
    const c = resolveColor(fill.color, theme);
    return c.startsWith("#") ? c : null;
  }
  if (fill.type === "gradient") {
    const c = resolveColor(fill.stops[0]?.color, theme);
    return c.startsWith("#") ? c : null;
  }
  return null;
}

export function shadowCss(s: Shadow | null | undefined, theme: Theme): string | undefined {
  if (!s) return undefined;
  return `${s.inset ? "inset " : ""}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${resolveColor(s.color, theme, "rgba(0,0,0,.2)")}`;
}

export const SHADOW_PRESETS: { id: string; label: string; shadow: Shadow | null }[] = [
  { id: "none", label: "None", shadow: null },
  { id: "soft", label: "Soft", shadow: { x: 0, y: 4, blur: 14, spread: 0, color: "rgba(20, 16, 40, 0.08)" } },
  { id: "medium", label: "Medium", shadow: { x: 0, y: 10, blur: 30, spread: -6, color: "rgba(20, 16, 40, 0.18)" } },
  { id: "strong", label: "Strong", shadow: { x: 0, y: 24, blur: 48, spread: -12, color: "rgba(20, 16, 40, 0.3)" } },
  { id: "glow", label: "Glow", shadow: { x: 0, y: 0, blur: 28, spread: 2, color: "$primary/45" } },
  { id: "hard", label: "Retro", shadow: { x: 6, y: 6, blur: 0, spread: 0, color: "$text" } },
];

export const GRADIENT_PRESETS: Extract<Fill, { type: "gradient" }>[] = [
  { type: "gradient", kind: "linear", angle: 135, stops: [{ color: "#6c47ff", at: 0 }, { color: "#ff6b9d", at: 100 }] },
  { type: "gradient", kind: "linear", angle: 135, stops: [{ color: "#00c6ff", at: 0 }, { color: "#0072ff", at: 100 }] },
  { type: "gradient", kind: "linear", angle: 135, stops: [{ color: "#f7971e", at: 0 }, { color: "#ffd200", at: 100 }] },
  { type: "gradient", kind: "linear", angle: 135, stops: [{ color: "#11998e", at: 0 }, { color: "#38ef7d", at: 100 }] },
  { type: "gradient", kind: "linear", angle: 135, stops: [{ color: "#fc466b", at: 0 }, { color: "#3f5efb", at: 100 }] },
  { type: "gradient", kind: "linear", angle: 160, stops: [{ color: "#0f0c29", at: 0 }, { color: "#302b63", at: 55 }, { color: "#24243e", at: 100 }] },
  { type: "gradient", kind: "linear", angle: 120, stops: [{ color: "#fbc2eb", at: 0 }, { color: "#a6c1ee", at: 100 }] },
  { type: "gradient", kind: "linear", angle: 135, stops: [{ color: "#ff9a9e", at: 0 }, { color: "#fecfef", at: 100 }] },
  { type: "gradient", kind: "linear", angle: 180, stops: [{ color: "#e0eafc", at: 0 }, { color: "#cfdef3", at: 100 }] },
  { type: "gradient", kind: "linear", angle: 135, stops: [{ color: "#ee0979", at: 0 }, { color: "#ff6a00", at: 100 }] },
  { type: "gradient", kind: "radial", angle: 0, stops: [{ color: "#fdfbfb", at: 0 }, { color: "#ebedee", at: 100 }] },
  { type: "gradient", kind: "linear", angle: 135, stops: [{ color: "$primary", at: 0 }, { color: "$secondary", at: 100 }] },
];

/** Canva-style default swatches. */
export const SWATCHES: string[] = [
  "#000000", "#545454", "#737373", "#a6a6a6", "#d9d9d9", "#ffffff",
  "#ff3131", "#ff5757", "#ff66c4", "#cb6ce6", "#8c52ff", "#5e17eb",
  "#0097b2", "#0cc0df", "#5ce1e6", "#38b6ff", "#5170ff", "#004aad",
  "#00bf63", "#7ed957", "#c1ff72", "#ffde59", "#ffbd59", "#ff914d",
];
