import type { Action, AppDoc, AppKind, El, Fill, Page, Theme } from "./types";
import { DEFAULT_THEME } from "./theme";
import { isContainerType } from "./elements";
import { deepClone, isPlainObject, nextLayerName, slugify, uid } from "./util";

export function newPage(name: string, path: string, background: Fill = { type: "solid", color: "$background" }): Page {
  return {
    id: uid("pg"),
    name,
    path,
    access: "public",
    background,
    height: 900,
    elements: {},
    rootIds: [],
  };
}

/** Height of a new page: one phone screen for mobile apps. */
export const PHONE_PAGE_HEIGHT = 844;

export function newAppDoc(theme: Theme = DEFAULT_THEME, kind: AppKind = "website"): AppDoc {
  const home = newPage("Home", "");
  if (kind === "mobile") home.height = PHONE_PAGE_HEIGHT;
  return {
    schemaVersion: 1,
    pages: [home],
    homePageId: home.id,
    theme: deepClone(theme),
    variables: [],
    settings: kind === "mobile" ? { showBadge: true, kind } : { showBadge: true },
  };
}

export function pagePathFor(name: string, pages: Page[], exceptId?: string): string {
  const base = slugify(name) || "page";
  const taken = new Set(pages.filter((p) => p.id !== exceptId).map((p) => p.path));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/* ------------------------------------------------------------------ tree helpers */

export function childIdsOf(page: Page, parentId: string | null): string[] {
  if (!parentId) return page.rootIds;
  return page.elements[parentId]?.childIds || [];
}

export function descendantIds(page: Page, id: string): string[] {
  const out: string[] = [];
  const walk = (eid: string) => {
    const el = page.elements[eid];
    if (!el?.childIds) return;
    for (const c of el.childIds) {
      out.push(c);
      walk(c);
    }
  };
  walk(id);
  return out;
}

export function ancestorIds(page: Page, id: string): string[] {
  const out: string[] = [];
  let cur = page.elements[id]?.parentId ?? null;
  while (cur) {
    out.push(cur);
    cur = page.elements[cur]?.parentId ?? null;
  }
  return out;
}

export function isAncestor(page: Page, maybeAncestor: string, id: string): boolean {
  return ancestorIds(page, id).includes(maybeAncestor);
}

/** Elements in paint order (parents before children, siblings in z-order). */
export function walkElements(page: Page, fn: (el: El, depth: number) => void) {
  const visit = (ids: string[], depth: number) => {
    for (const id of ids) {
      const el = page.elements[id];
      if (!el) continue;
      fn(el, depth);
      if (el.childIds?.length) visit(el.childIds, depth + 1);
    }
  };
  visit(page.rootIds, 0);
}

export function layerNames(page: Page): Set<string> {
  return new Set(Object.values(page.elements).map((e) => e.name.toLowerCase()));
}

/** Remove elements (and their descendants) from a page, in place. */
export function removeElements(page: Page, ids: string[]) {
  const doomed = new Set<string>();
  for (const id of ids) {
    if (!page.elements[id]) continue;
    doomed.add(id);
    for (const d of descendantIds(page, id)) doomed.add(d);
  }
  for (const id of doomed) {
    const el = page.elements[id];
    if (!el) continue;
    if (el.parentId && !doomed.has(el.parentId)) {
      const parent = page.elements[el.parentId];
      if (parent?.childIds) parent.childIds = parent.childIds.filter((c) => c !== id);
    }
  }
  page.rootIds = page.rootIds.filter((id) => !doomed.has(id));
  for (const id of doomed) delete page.elements[id];
}

/**
 * Insert a flat list of elements (parent first; roots are the ones whose parentId is not
 * inside the list) under `parentId` at `index` (default: on top).
 */
export function insertElements(page: Page, els: El[], parentId: string | null, index?: number) {
  const ids = new Set(els.map((e) => e.id));
  const roots = els.filter((e) => !e.parentId || !ids.has(e.parentId));
  for (const el of els) page.elements[el.id] = el;
  const siblings = parentId ? (page.elements[parentId].childIds ||= []) : page.rootIds;
  const at = index === undefined ? siblings.length : Math.max(0, Math.min(siblings.length, index));
  for (const r of roots) {
    r.parentId = parentId;
    if (parentId) delete r.pin;
  }
  siblings.splice(at, 0, ...roots.map((r) => r.id));
}

/** Flat copy of subtrees (roots first, descendants follow) — used for clipboard + duplicate. */
export function extractSubtrees(page: Page, ids: string[]): El[] {
  const out: El[] = [];
  const seen = new Set<string>();
  // skip ids whose ancestor is also selected (they come along with it)
  const selected = new Set(ids);
  const roots = ids.filter((id) => page.elements[id] && !ancestorIds(page, id).some((a) => selected.has(a)));
  const add = (id: string) => {
    if (seen.has(id)) return;
    const el = page.elements[id];
    if (!el) return;
    seen.add(id);
    out.push(deepClone(el));
    el.childIds?.forEach(add);
  };
  roots.forEach(add);
  return out;
}

/**
 * Give a flat element list fresh ids and unique layer names. Parent links and action
 * targets inside the list are rewritten to the new ids.
 */
export function remapElements(els: El[], names: Set<string>): El[] {
  const idMap = new Map<string, string>();
  for (const el of els) idMap.set(el.id, uid("el"));
  const fix = (id: string | undefined) => (id && idMap.has(id) ? idMap.get(id) : id);
  return els.map((src) => {
    const el = deepClone(src);
    el.id = idMap.get(src.id)!;
    el.parentId = src.parentId && idMap.has(src.parentId) ? idMap.get(src.parentId)! : null;
    if (el.childIds) el.childIds = el.childIds.map((c) => idMap.get(c) || c).filter((c) => els.some((e) => idMap.get(e.id) === c));
    // keep a readable name; only renumber when it collides
    if (names.has(el.name.toLowerCase())) el.name = nextLayerName(el.name.replace(/\d+$/, ""), names);
    names.add(el.name.toLowerCase());
    if (el.events) {
      for (const key of Object.keys(el.events) as (keyof typeof el.events)[]) {
        el.events[key] = (el.events[key] || []).map((a: Action) => ({ ...a, id: uid("act"), targetId: fix(a.targetId), formId: fix(a.formId) }));
      }
    }
    return el;
  });
}

export function findPage(doc: AppDoc, pageId: string): Page | undefined {
  return doc.pages.find((p) => p.id === pageId);
}

/** Nearest form that contains the element (or the element itself). */
export function formOf(page: Page, id: string): El | null {
  let cur: El | undefined = page.elements[id];
  while (cur) {
    if (cur.type === "form") return cur;
    cur = cur.parentId ? page.elements[cur.parentId] : undefined;
  }
  return null;
}

/** Nearest list (repeater) ancestor. */
export function listOf(page: Page, id: string): El | null {
  let cur: El | undefined = page.elements[id]?.parentId ? page.elements[page.elements[id].parentId!] : undefined;
  while (cur) {
    if (cur.type === "list") return cur;
    cur = cur.parentId ? page.elements[cur.parentId] : undefined;
  }
  return null;
}

export function inputsOfForm(page: Page, formId: string): El[] {
  return descendantIds(page, formId)
    .map((id) => page.elements[id])
    .filter((e): e is El => !!e && e.type === "input");
}

/* ------------------------------------------------------------------ validation */

const MAX_PAGES = 60;
const MAX_ELEMENTS_PER_PAGE = 2500;

/**
 * Repair a document received from a client: drop dangling references, make sure the tree
 * is consistent and every required field exists. Throws on hopeless input.
 */
export function sanitizeDoc(input: unknown): AppDoc {
  if (!isPlainObject(input)) throw new Error("Invalid document");
  const raw = input as unknown as AppDoc;
  if (!Array.isArray(raw.pages) || raw.pages.length === 0) throw new Error("A document needs at least one page");
  if (raw.pages.length > MAX_PAGES) throw new Error(`Apps can have at most ${MAX_PAGES} pages`);
  const theme: Theme = {
    ...DEFAULT_THEME,
    ...(isPlainObject(raw.theme) ? raw.theme : {}),
    colors: { ...DEFAULT_THEME.colors, ...(isPlainObject(raw.theme?.colors) ? raw.theme.colors : {}) },
  };
  const pages: Page[] = raw.pages.map((p, i) => sanitizePage(p, i));
  const homePageId = pages.some((p) => p.id === raw.homePageId) ? raw.homePageId : pages[0].id;
  // exactly one page owns the empty path: the home page
  const seenPaths = new Set<string>();
  for (const p of pages) {
    if (p.id === homePageId) p.path = "";
    else {
      if (!p.path || seenPaths.has(p.path)) p.path = pagePathFor(p.name || "page", pages, p.id);
      if (!p.path) p.path = `page-${p.id.slice(-4)}`;
    }
    seenPaths.add(p.path);
  }
  return {
    schemaVersion: 1,
    pages,
    homePageId,
    theme,
    variables: Array.isArray(raw.variables)
      ? raw.variables
          .filter((v) => isPlainObject(v) && typeof v.name === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(v.name))
          .map((v) => ({ id: v.id || uid("var"), name: v.name, type: ["text", "number", "boolean"].includes(v.type) ? v.type : "text", initial: String(v.initial ?? ""), persist: !!v.persist }))
      : [],
    settings: sanitizeSettings(raw.settings),
  };
}

function sanitizeSettings(raw: unknown): AppDoc["settings"] {
  if (!isPlainObject(raw)) return {};
  const out: AppDoc["settings"] = {};
  if (typeof raw.showBadge === "boolean") out.showBadge = raw.showBadge;
  if (raw.kind === "mobile") out.kind = "mobile";
  return out;
}

function sanitizePage(p: Page, index: number): Page {
  if (!isPlainObject(p)) throw new Error("Invalid page");
  const elements: Record<string, El> = {};
  const src = isPlainObject(p.elements) ? p.elements : {};
  const ids = Object.keys(src);
  if (ids.length > MAX_ELEMENTS_PER_PAGE) throw new Error(`A page can hold at most ${MAX_ELEMENTS_PER_PAGE} elements`);
  for (const id of ids) {
    const e = src[id] as El;
    if (!isPlainObject(e) || typeof e.type !== "string" || !isPlainObject(e.box)) continue;
    elements[id] = {
      ...e,
      id,
      name: typeof e.name === "string" && e.name ? e.name.slice(0, 60) : id,
      style: isPlainObject(e.style) ? e.style : {},
      props: isPlainObject(e.props) ? e.props : {},
      box: {
        x: num(e.box.x),
        y: num(e.box.y),
        w: Math.max(1, num(e.box.w, 100)),
        h: Math.max(1, num(e.box.h, 40)),
        ...(e.box.r ? { r: num(e.box.r) } : {}),
      },
    };
    if (isContainerType(e.type)) elements[id].childIds = Array.isArray(e.childIds) ? e.childIds : [];
    else delete elements[id].childIds;
  }
  // parent / child consistency: children lists are the source of truth
  const claimed = new Set<string>();
  for (const el of Object.values(elements)) {
    if (!el.childIds) continue;
    el.childIds = el.childIds.filter((c) => elements[c] && c !== el.id && !claimed.has(c) && (claimed.add(c), true));
    for (const c of el.childIds) elements[c].parentId = el.id;
  }
  const roots = (Array.isArray(p.rootIds) ? p.rootIds : []).filter((id) => elements[id] && !claimed.has(id));
  const rootSet = new Set(roots);
  for (const el of Object.values(elements)) {
    if (!claimed.has(el.id)) {
      el.parentId = null;
      if (!rootSet.has(el.id)) {
        roots.push(el.id);
        rootSet.add(el.id);
      }
    }
  }
  // break cycles: anything unreachable from the roots is dropped
  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    elements[id]?.childIds?.forEach(visit);
  };
  roots.forEach(visit);
  for (const id of Object.keys(elements)) if (!reachable.has(id)) delete elements[id];
  // only top-level elements can stay on screen
  for (const el of Object.values(elements)) if (el.pin && (el.parentId || (el.pin !== "top" && el.pin !== "bottom"))) delete el.pin;

  return {
    id: typeof p.id === "string" && p.id ? p.id : uid("pg"),
    name: typeof p.name === "string" && p.name.trim() ? p.name.slice(0, 60) : `Page ${index + 1}`,
    path: typeof p.path === "string" ? slugify(p.path) : "",
    access: p.access === "users" || p.access === "admins" ? p.access : "public",
    background: isPlainObject(p.background) ? p.background : { type: "solid", color: "$background" },
    height: Math.max(200, Math.min(40000, num(p.height, 900))),
    heights: isPlainObject(p.heights) ? p.heights : undefined,
    mobileCustom: !!p.mobileCustom,
    elements,
    rootIds: roots,
    onLoad: Array.isArray(p.onLoad) ? p.onLoad : undefined,
    recordCollectionId: typeof p.recordCollectionId === "string" ? p.recordCollectionId : undefined,
    title: typeof p.title === "string" ? p.title.slice(0, 120) : undefined,
    icon: typeof p.icon === "string" && /^[A-Za-z0-9]{1,40}$/.test(p.icon) ? p.icon : undefined,
    hideInNav: p.hideInNav === true ? true : undefined,
    confirmationVariable: typeof p.confirmationVariable === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(p.confirmationVariable) ? p.confirmationVariable : undefined,
  };
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
