import { isPlainObject } from "./util";
import { ELEMENT_INFO } from "./elements";

export class DocumentValidationError extends Error {}
type Obj = Record<string, any>;
function invalid(path: string): never { throw new DocumentValidationError(`Invalid design value: ${path}.`); }
function object(value: unknown, path: string): Obj {
  if (!isPlainObject(value)) invalid(path);
  return value as Obj;
}
function fields(value: unknown, path: string, strings = "", numbers = "", booleans = ""): Obj {
  const obj = object(value, path);
  for (const [keys, type] of [[strings, "string"], [numbers, "number"], [booleans, "boolean"]])
    for (const key of keys.split(" ").filter(Boolean)) if (obj[key] != null && typeof obj[key] !== type) invalid(`${path}.${key}`);
  return obj;
}
function array(value: unknown, path: string, check: (item: any, path: string) => void) {
  if (!Array.isArray(value)) invalid(path);
  value.forEach((item, i) => check(item, `${path}[${i}]`));
}
const strings = (value: unknown, path: string) => array(value, path, (v, p) => { if (typeof v !== "string") invalid(p); });

function fill(value: unknown, path: string) {
  const f = object(value, path);
  if (f.type === "none") return;
  if (f.type === "solid") { if (typeof f.color !== "string") invalid(path); return; }
  if (f.type === "image") { fields(f, path, "src fit position overlay"); if (typeof f.src !== "string") invalid(path); return; }
  if (f.type !== "gradient") invalid(path);
  fields(f, path, "kind", "angle");
  array(f.stops, `${path}.stops`, (s, p) => {
    fields(s, p, "color", "at");
    if (typeof s.color !== "string" || typeof s.at !== "number") invalid(p);
  });
}
function actions(value: unknown, path: string) {
  array(value, path, (a, p) => {
    fields(a, p, "id type pageId recordId url message tone targetId mode property value variable op formId collectionId saveIdTo fieldName amount min confirmText text", "tabIndex ms", "newTab resetAfter");
    if (typeof a.type !== "string") invalid(p);
    if (a.condition) fields(a.condition, p + ".condition", "left op right");
    if (a.mapping) for (const v of Object.values(object(a.mapping, p + ".mapping"))) if (typeof v !== "string") invalid(p + ".mapping");
    if (a.steps) array(a.steps, p + ".steps", (s, q) => {
      fields(s, q, "id kind collectionId recordId fieldName amount min");
      if (s.mapping) for (const v of Object.values(object(s.mapping, q + ".mapping"))) if (typeof v !== "string") invalid(q + ".mapping");
    });
  });
}
function style(value: unknown, path: string) {
  const s = fields(value, path, "color fontFamily textAlign verticalAlign textTransform borderColor borderStyle overflow cursor textHighlight",
    "fontSize fontWeight lineHeight letterSpacing borderWidth radius opacity blur backdropBlur padding paddingX paddingY", "italic underline strike");
  if (s.fill) fill(s.fill, path + ".fill");
  for (const key of ["shadow", "textShadow"]) if (s[key]) fields(s[key], path + "." + key, "color", "x y blur spread", "inset");
  if (s.textStroke) fields(s.textStroke, path + ".textStroke", "color", "width");
  if (s.radii) array(s.radii, path + ".radii", (v, p) => { if (typeof v !== "number") invalid(p); });
  if (s.filters) fields(s.filters, path + ".filters", "", "brightness contrast saturate grayscale sepia hue blur");
  if (s.hover) { fields(s.hover, path + ".hover", "color borderColor", "scale opacity", "lift"); if (s.hover.fill) fill(s.hover.fill, path + ".hover.fill"); }
  if (s.animation) fields(s.animation, path + ".animation", "name trigger", "duration delay", "loop");
}
function props(value: unknown, path: string) {
  const p = fields(value, path,
    "ariaLabel text tag label icon iconPos variant src alt fit mask shape dash url address inputType name placeholder defaultValue helpText inputStyle collectionId successMessage emptyText orientation title value maxValue aggregate field groupBy chartType dataSource manualData prefix suffix target doneText",
    "focusX focusY zoom strokeWidth thickness mapZoom min max step activeTab decimals", "submit arrowEnd autoplay loop muted controls showLabel required striped showIcons closeOnBackdrop showValue showLegend");
  if (p.options) strings(p.options, path + ".options");
  if (p.link) fields(p.link, path + ".link", "pageId url", "", "newTab");
  if (p.optionsFrom) fields(p.optionsFrom, path + ".optionsFrom", "collectionId field");
  if (p.layout) fields(p.layout, path + ".layout", "mode align justify", "gap padding columns mobileColumns", "wrap");
  for (const key of ["items", "tabs"]) if (p[key]) array(p[key], path + "." + key, (v, q) => fields(v, q, "id label pageId url icon"));
  if (p.columns) array(p.columns, path + ".columns", (v, q) => fields(v, q, "field label", "width"));
  if (p.query) {
    fields(p.query, path + ".query", "collectionId sortField sortDir searchPlaceholder", "pageSize", "search");
    if (p.query.filters) array(p.query.filters, path + ".filters", (v, q) => fields(v, q, "field op value"));
  }
}

/** Validate the types renderers rely on, before tree repair or persistence. */
export function validateDocumentShapes(input: unknown) {
  let nodes = 0;
  const bounded = (v: unknown, depth: number) => {
    if (++nodes > 500_000 || depth > 32) invalid("document complexity");
    if (typeof v === "number" && !Number.isFinite(v)) invalid("number");
    if (typeof v === "string" && v.length > 100_000) invalid("text length");
    if (v && typeof v === "object") {
      if (!Array.isArray(v) && !isPlainObject(v)) invalid("object");
      for (const [key, child] of Object.entries(v)) {
        if (["__proto__", "prototype", "constructor"].includes(key)) invalid("object key");
        bounded(child, depth + 1);
      }
    }
  };
  bounded(input, 0);
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 3_000_000)
    throw new DocumentValidationError("This design is too large to save. Keep it under 3 MB by removing unused elements or splitting it into separate apps.");
  const doc = object(input, "document");
  if (doc.theme) {
    const theme = fields(doc.theme, "theme", "headingFont bodyFont buttonStyle", "radius");
    if (theme.colors) for (const v of Object.values(object(theme.colors, "theme.colors"))) if (typeof v !== "string" || v.length > 256) invalid("theme.colors");
  }
  array(doc.pages, "pages", (page, path) => {
    fields(page, path, "id name path access recordCollectionId title icon confirmationVariable", "height", "mobileCustom hideInNav");
    if (page.background) fill(page.background, path + ".background");
    if (page.rootIds) strings(page.rootIds, path + ".rootIds");
    if (page.heights) fields(page.heights, path + ".heights", "", "mobile");
    if (page.onLoad) actions(page.onLoad, path + ".onLoad");
    for (const [id, el] of Object.entries(object(page.elements || {}, path + ".elements"))) {
      const p = path + "." + id;
      const e = fields(el, p, "id type name parentId pin", "", "locked hidden startHidden");
      if (!Object.hasOwn(ELEMENT_INFO, e.type)) invalid(p + ".type");
      fields(e.box, p + ".box", "", "x y w h r");
      if (e.childIds) strings(e.childIds, p + ".childIds");
      if (e.sizing) fields(e.sizing, p + ".sizing", "w h");
      if (e.hideOn) fields(e.hideOn, p + ".hideOn", "", "", "desktop mobile");
      if (e.responsive) { object(e.responsive, p + ".responsive"); if (e.responsive.mobile) fields(e.responsive.mobile, p + ".mobile", "", "x y w h r fontSize"); }
      if (e.style) style(e.style, p + ".style");
      if (e.props) props(e.props, p + ".props");
      if (e.events) for (const [event, list] of Object.entries(object(e.events, p + ".events"))) actions(list, p + "." + event);
    }
  });
}
