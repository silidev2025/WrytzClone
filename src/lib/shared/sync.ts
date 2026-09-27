import { produce } from "immer";
import type { AppDoc, El, Page } from "./types";

/*
 * Live collaboration works on small units of a design instead of the whole document, so two
 * people editing different things never overwrite each other (the approach Figma uses):
 *
 *   theme · variables · settings · home   top-level parts
 *   order                                 the order of the pages
 *   p:<pageId>                            a page's own settings (null: the page is deleted)
 *   r:<pageId>                            the page's top-level element order
 *   e:<pageId>:<elementId>                one element (null: deleted)
 *
 * The server applies changes in one order and the last change to a unit wins.
 * Diffs compare by reference, which is cheap because the editor never mutates in place.
 */

export interface Change {
  k: string;
  v: unknown;
}

const PAGE_PARTS = new Set(["elements", "rootIds"]);
const ID = "[A-Za-z0-9_-]{1,80}";
export const UNIT_KEY = new RegExp(`^(theme|variables|settings|home|order|p:${ID}|r:${ID}|e:${ID}:${ID})$`);

/** A page without its elements: what the `p:` unit holds. */
export function pageProps(page: Page): Partial<Page> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(page)) if (!PAGE_PARTS.has(k)) out[k] = v;
  return out as Partial<Page>;
}

function propsEqual(a: object, b: object): boolean {
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  for (const k of new Set([...Object.keys(ra), ...Object.keys(rb)])) if (!PAGE_PARTS.has(k) && ra[k] !== rb[k]) return false;
  return true;
}

/** The changes that turn `a` into `b`. */
export function diffDocs(a: AppDoc, b: AppDoc): Change[] {
  if (a === b) return [];
  const out: Change[] = [];
  if (a.theme !== b.theme) out.push({ k: "theme", v: b.theme });
  if (a.variables !== b.variables) out.push({ k: "variables", v: b.variables });
  if (a.settings !== b.settings) out.push({ k: "settings", v: b.settings });
  if (a.homePageId !== b.homePageId) out.push({ k: "home", v: b.homePageId });
  if (a.pages !== b.pages) {
    const before = new Map(a.pages.map((p) => [p.id, p]));
    for (const pb of b.pages) {
      const pa = before.get(pb.id);
      if (pa === pb) continue;
      if (!pa || !propsEqual(pa, pb)) out.push({ k: `p:${pb.id}`, v: pageProps(pb) });
      if (!pa || pa.rootIds !== pb.rootIds) out.push({ k: `r:${pb.id}`, v: pb.rootIds });
      if (!pa || pa.elements !== pb.elements) {
        const ea: Record<string, El> = pa?.elements ?? {};
        for (const id in pb.elements) if (ea[id] !== pb.elements[id]) out.push({ k: `e:${pb.id}:${id}`, v: pb.elements[id] });
        for (const id in ea) if (!(id in pb.elements)) out.push({ k: `e:${pb.id}:${id}`, v: null });
      }
    }
    const after = new Set(b.pages.map((p) => p.id));
    for (const pa of a.pages) if (!after.has(pa.id)) out.push({ k: `p:${pa.id}`, v: null });
    if (a.pages.length !== b.pages.length || a.pages.some((p, i) => p.id !== b.pages[i].id)) out.push({ k: "order", v: b.pages.map((p) => p.id) });
  }
  return out;
}

// pages must exist before their elements arrive; deletions and ordering come last
function rank(c: Change): number {
  if (c.k.startsWith("p:")) return c.v === null ? 4 : 1;
  if (c.k.startsWith("r:")) return 2;
  if (c.k.startsWith("e:")) return 3;
  if (c.k === "order") return 5;
  return 0;
}

/** Apply changes (unknown keys and units of missing pages are ignored). */
export function applyChanges(doc: AppDoc, changes: Change[]): AppDoc {
  if (!changes.length) return doc;
  const sorted = [...changes].sort((x, y) => rank(x) - rank(y));
  return produce(doc, (d) => {
    const pageOf = (id: string) => d.pages.find((p) => p.id === id);
    for (const { k, v } of sorted) {
      if (k === "theme") d.theme = v as AppDoc["theme"];
      else if (k === "variables") d.variables = v as AppDoc["variables"];
      else if (k === "settings") d.settings = v as AppDoc["settings"];
      else if (k === "home") d.homePageId = v as string;
      else if (k === "order") {
        const ids = Array.isArray(v) ? (v as string[]) : [];
        const at = (id: string) => {
          const i = ids.indexOf(id);
          return i < 0 ? Number.MAX_SAFE_INTEGER : i;
        };
        const sortedPages = [...d.pages].sort((x, y) => at(x.id) - at(y.id));
        if (sortedPages.some((p, i) => p !== d.pages[i])) d.pages = sortedPages;
      } else if (k.startsWith("p:")) {
        const id = k.slice(2);
        const i = d.pages.findIndex((p) => p.id === id);
        if (v === null) {
          if (i >= 0) d.pages.splice(i, 1);
        } else if (v && typeof v === "object") {
          const props = v as Record<string, unknown>;
          if (i < 0) {
            d.pages.push({ ...props, id, elements: {}, rootIds: [] } as unknown as Page);
            continue;
          }
          const page = d.pages[i] as unknown as Record<string, unknown>;
          for (const key of Object.keys(page)) if (!PAGE_PARTS.has(key) && key !== "id" && !(key in props)) delete page[key];
          for (const [key, value] of Object.entries(props)) if (!PAGE_PARTS.has(key) && key !== "id" && page[key] !== value) page[key] = value;
        }
      } else if (k.startsWith("r:")) {
        const page = pageOf(k.slice(2));
        if (page && Array.isArray(v)) page.rootIds = v as string[];
      } else if (k.startsWith("e:")) {
        const [, pid, eid] = k.split(":");
        const page = pageOf(pid);
        if (!page) continue;
        if (v === null) delete page.elements[eid];
        else if (v && typeof v === "object") page.elements[eid] = v as El;
      }
    }
  });
}

/** Every unit of a document with its value (for comparing documents that share no references). */
export function unitEntries(doc: AppDoc): [string, unknown][] {
  const out: [string, unknown][] = [
    ["theme", doc.theme],
    ["variables", doc.variables],
    ["settings", doc.settings],
    ["home", doc.homePageId],
    ["order", doc.pages.map((p) => p.id)],
  ];
  for (const p of doc.pages) {
    out.push([`p:${p.id}`, pageProps(p)], [`r:${p.id}`, p.rootIds]);
    for (const [id, el] of Object.entries(p.elements)) out.push([`e:${p.id}:${id}`, el]);
  }
  return out;
}

/** Whether a unit of `doc` currently holds exactly `value` (same reference; page settings field by field). */
export function unitIs(doc: AppDoc, k: string, value: unknown): boolean {
  if (k === "theme") return doc.theme === value;
  if (k === "variables") return doc.variables === value;
  if (k === "settings") return doc.settings === value;
  if (k === "home") return doc.homePageId === value;
  if (k === "order") return Array.isArray(value) && value.length === doc.pages.length && doc.pages.every((p, i) => p.id === value[i]);
  if (k.startsWith("p:")) {
    const page = doc.pages.find((p) => p.id === k.slice(2));
    return value === null ? !page : !!page && !!value && typeof value === "object" && propsEqual(page, value);
  }
  if (k.startsWith("r:")) return doc.pages.find((p) => p.id === k.slice(2))?.rootIds === value;
  if (k.startsWith("e:")) {
    const [, pid, eid] = k.split(":");
    const el = doc.pages.find((p) => p.id === pid)?.elements[eid];
    return value === null ? !el : el === value;
  }
  return false;
}
