/*
 * Small helpers for writing blocks and templates as data. Boxes are [x, y, w, h].
 */
import type { Action, ContainerLayout, El, ElementProps, EventName, Fill, InputType, Page, Style } from "./shared/types";
import { DEFAULT_LAYOUT, instantiateSpec, type ElementSpec } from "./shared/elements";
import { newPage } from "./shared/doc";

type B = [number, number, number, number?];
type Tag = NonNullable<ElementProps["tag"]>;
type Events = Partial<Record<EventName, Omit<Action, "id">[]>>;

const bx = (b: B) => ({ x: b[0], y: b[1], w: b[2], h: b[3] ?? 40 });

export const solid = (color: string): Fill => ({ type: "solid", color });
export const grad = (angle: number, ...colors: string[]): Fill => ({
  type: "gradient",
  kind: "linear",
  angle,
  stops: colors.map((c, i) => ({ color: c, at: Math.round((i / Math.max(1, colors.length - 1)) * 100) })),
});
export const photo = (id: number, w = 1200, h = 800) => `https://picsum.photos/id/${id}/${w}/${h}`;

export function text(value: string, b: B, style: Style = {}, tag: Tag = "p", extra: Partial<ElementSpec> = {}): ElementSpec {
  const size = style.fontSize ?? (tag === "h1" ? 52 : tag === "h2" ? 36 : tag === "h3" ? 24 : tag === "small" ? 13 : 17);
  const h = b[3] ?? Math.round(size * (tag === "p" || tag === "small" ? 1.55 : 1.2));
  return { type: "text", box: { ...bx(b), h }, style, props: { text: value, tag }, ...extra };
}

export function button(label: string, b: B, style: Style = {}, props: ElementProps = {}, events?: Events, extra: Partial<ElementSpec> = {}): ElementSpec {
  return { type: "button", box: { ...bx(b), h: b[3] ?? 48 }, style, props: { label, ...props }, events, ...extra };
}

export function image(src: string, b: B, props: ElementProps = {}, style: Style = {}, extra: Partial<ElementSpec> = {}): ElementSpec {
  return { type: "image", box: bx(b), style: { radius: 16, ...style }, props: { src, alt: "", fit: "cover", ...props }, ...extra };
}

export function icon(name: string, b: [number, number, number], style: Style = {}, extra: Partial<ElementSpec> = {}): ElementSpec {
  return { type: "icon", box: { x: b[0], y: b[1], w: b[2], h: b[2] }, style, props: { icon: name, strokeWidth: 2 }, ...extra };
}

export function shape(kind: NonNullable<ElementProps["shape"]>, b: B, style: Style = {}, extra: Partial<ElementSpec> = {}): ElementSpec {
  return { type: "shape", box: bx(b), style: { fill: solid("$primary"), ...style }, props: { shape: kind }, ...extra };
}

export function line(b: B, style: Style = {}, props: ElementProps = {}): ElementSpec {
  return { type: "line", box: { ...bx(b), h: b[3] ?? 16 }, style, props: { thickness: 1, dash: "solid", ...props } };
}

export function box(b: B, style: Style, children: ElementSpec[] = [], layout: Partial<ContainerLayout> = {}, extra: Partial<ElementSpec> = {}): ElementSpec {
  return { type: "box", box: bx(b), style, props: { layout: { ...DEFAULT_LAYOUT, ...layout } }, children, ...extra };
}

/** Auto-layout container: children are arranged for you. */
export function stack(mode: "row" | "column" | "grid", b: B, children: ElementSpec[], layout: Partial<ContainerLayout> = {}, style: Style = {}, extra: Partial<ElementSpec> = {}): ElementSpec {
  return box(b, style, children, { mode, padding: 0, gap: 16, align: mode === "column" ? "stretch" : "center", ...layout }, extra);
}

export function input(inputType: InputType, label: string, name: string, b: B, props: ElementProps = {}, extra: Partial<ElementSpec> = {}): ElementSpec {
  return {
    type: "input",
    name: name.replace(/[^A-Za-z0-9_]/g, "") || undefined,
    box: { ...bx(b), h: b[3] ?? 74 },
    props: { inputType, label, name, showLabel: true, inputStyle: "box", placeholder: "", ...props },
    ...extra,
  };
}

/** Auto-layout children usually fill the width and hug their height. */
export const fill = <T extends ElementSpec>(s: T): T => ({ ...s, sizing: { w: "fill", h: s.type === "text" || s.type === "input" || s.type === "list" || s.type === "table" ? "hug" : "fixed" } });

/**
 * Build a page from top-level specs. Specs can point at each other with `ref` and "@ref"
 * targets in actions (e.g. a button opening a pop-up defined later on the page).
 */
export function buildPage(
  name: string,
  path: string,
  specs: ElementSpec[],
  opts: { id?: string; height?: number; background?: Fill; access?: Page["access"]; recordCollectionId?: string; onLoad?: Omit<Action, "id">[]; title?: string } = {},
): Page {
  const page = newPage(name, path, opts.background || solid("$background"));
  if (opts.id) page.id = opts.id;
  page.height = opts.height ?? 900;
  if (opts.access) page.access = opts.access;
  if (opts.recordCollectionId) page.recordCollectionId = opts.recordCollectionId;
  if (opts.title) page.title = opts.title;
  const names = new Set<string>();
  const refs = new Map<string, string>();
  const all: El[] = [];
  for (const spec of specs) {
    const els = instantiateSpec(spec, null, names, refs);
    all.push(...els);
    page.rootIds.push(els[0].id);
  }
  for (const el of all) page.elements[el.id] = el;
  const fix = (v?: string) => (v && v.startsWith("@") && !v.startsWith("@col:") && refs.has(v.slice(1)) ? refs.get(v.slice(1)) : v);
  for (const el of all) {
    if (!el.events) continue;
    for (const key of Object.keys(el.events) as EventName[]) {
      el.events[key] = el.events[key]!.map((a) => ({ ...a, targetId: fix(a.targetId), formId: fix(a.formId) }));
    }
  }
  if (opts.onLoad) page.onLoad = opts.onLoad.map((a, i) => ({ ...a, id: `act_load${i}`, targetId: fix(a.targetId) }));
  // tall enough for everything on it
  const bottom = Math.max(0, ...page.rootIds.map((id) => page.elements[id].box.y + page.elements[id].box.h));
  page.height = Math.max(page.height, bottom + 40);
  return page;
}
