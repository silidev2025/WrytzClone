/*
 * Building blocks shared by the templates. Everything is plain data (ElementSpec);
 * collections are referenced as "@col:<key>" and swapped for real ids on creation.
 */
import type { Action, AppDoc, AppKind, CollectionAccess, DataFilter, EventName, InputType, MenuItem, Page, TableColumn, Theme, ThemeColors, Variable } from "@/lib/shared/types";
import type { ElementSpec } from "@/lib/shared/elements";
import { THEME_PRESETS } from "@/lib/shared/theme";
import { deepClone } from "@/lib/shared/util";
import { box, button, fill, icon, input, solid, stack, text } from "@/lib/build";

export const W = 1280;
export const PW = 390;

export const col = (key: string) => `@col:${key}`;
export const seedRef = (key: string, i: number) => `@seed:${key}:${i}`;

/** Who can do what with a collection's rows. */
export const ACCESS = {
  /** anyone can send, only admins read (contact forms, sign-ups) */
  inbox: { read: "admins", create: "anyone", update: "admins", delete: "admins" },
  /** everyone reads, admins manage, anyone can +/- numbers (products, posts) */
  catalog: { read: "anyone", create: "admins", update: "admins", delete: "admins", adjust: "anyone" },
  /** anyone reads, adds and votes; admins edit */
  board: { read: "anyone", create: "anyone", update: "admins", delete: "admins", adjust: "anyone" },
  /** anyone adds, everyone reads (guest books, RSVPs with private fields) */
  guestbook: { read: "anyone", create: "anyone", update: "admins", delete: "admins" },
  /** signed-in people only see and change their own rows */
  personal: { read: "owner", create: "users", update: "owner", delete: "owner", adjust: "owner" },
} satisfies Record<string, CollectionAccess>;

/** A date-time `days` from now, as the countdown element expects ("YYYY-MM-DDTHH:mm"). */
export function inDays(days: number, hour = 10): string {
  const d = new Date(Date.now() + days * 864e5);
  d.setHours(hour, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

type Act = Omit<Action, "id">;
type Events = Partial<Record<EventName, Act[]>>;

export function makeTheme(presetId: string, patch: { colors?: Partial<ThemeColors>; headingFont?: string; bodyFont?: string; radius?: number; buttonStyle?: Theme["buttonStyle"] } = {}): Theme {
  const p = THEME_PRESETS.find((t) => t.id === presetId) || THEME_PRESETS[0];
  return {
    colors: { ...deepClone(p.colors), ...(patch.colors || {}) },
    headingFont: patch.headingFont || p.headingFont,
    bodyFont: patch.bodyFont || p.bodyFont,
    radius: patch.radius ?? p.radius,
    buttonStyle: patch.buttonStyle || "filled",
  };
}

export function makeDoc(pages: Page[], theme: Theme, opts: { kind?: AppKind; variables?: Variable[] } = {}): AppDoc {
  return {
    schemaVersion: 1,
    pages,
    homePageId: pages[0].id,
    theme,
    variables: opts.variables || [],
    settings: opts.kind === "mobile" ? { showBadge: true, kind: "mobile" } : { showBadge: true },
  };
}

export const go = (pageId: string, recordId?: string): Act => ({ type: "navigate", pageId, ...(recordId ? { recordId } : {}) });
export const notify = (message: string, tone: Action["tone"] = "success"): Act => ({ type: "notify", message, tone });

/* ------------------------------------------------------------------ website pieces */

/** Top bar: logo, links and an optional call-to-action button. 84px tall. */
export function navBar(brand: string, opts: { logo?: string; items?: MenuItem[]; cta?: { label: string; pageId?: string; events?: Events }; bg?: string; color?: string } = {}): ElementSpec {
  const color = opts.color || "$text";
  const cta = opts.cta;
  return {
    ...box([0, 0, W, 84], { fill: solid(opts.bg || "$background"), shadow: { x: 0, y: 1, blur: 0, spread: 0, color: "rgba(0,0,0,0.06)" } }, [
      box([48, 22, 40, 40], { fill: solid("$primary"), radius: 12 }, [icon(opts.logo || "Sparkles", [9, 9, 22], { color: "#ffffff" })], {}, { name: "Logo" }),
      text(brand, [100, 25, 300, 34], { fontSize: 22, fontWeight: 800, fontFamily: "$heading", color }, "h3", { name: "Brand" }),
      {
        type: "menu",
        name: "Menu",
        box: { x: cta ? 470 : 640, y: 20, w: cta ? 560 : 592, h: 44 },
        style: { textAlign: "right", color, fontSize: 16 },
        props: { items: opts.items || [], orientation: "horizontal", variant: "links" },
      },
      ...(cta ? [button(cta.label, [1060, 18, 172, 48], {}, {}, cta.events || (cta.pageId ? { click: [go(cta.pageId)] } : undefined), { name: "NavButton" })] : []),
    ]),
    name: "Navbar",
  };
}

export function footerBar(brand: string, y: number, note = "Made with care. All rights reserved."): ElementSpec {
  return {
    ...box([0, y, W, 120], { fill: solid("$surface") }, [
      text(brand, [80, 36, 400, 30], { fontSize: 20, fontWeight: 800, fontFamily: "$heading" }, "h3"),
      text(`© {{now.year}} ${brand}${brand.endsWith(".") ? "" : "."} ${note}`, [80, 70, 700, 22], { fontSize: 14, color: "$muted" }, "small"),
      text("Built without code", [900, 50, 300, 22], { fontSize: 14, color: "$muted", textAlign: "right" }, "small"),
    ]),
    name: "Footer",
  };
}

/** Eyebrow + big heading + sub text, centred on the page. Returns the specs and the bottom y. */
export function titleBlock(y: number, title: string, sub?: string, opts: { eyebrow?: string; align?: "center" | "left"; x?: number; w?: number; size?: number; color?: string; subColor?: string } = {}): { specs: ElementSpec[]; bottom: number } {
  const w = opts.w ?? 860;
  const x = opts.x ?? (opts.align === "left" ? 80 : (W - w) / 2);
  const align = opts.align === "left" ? "left" : "center";
  const specs: ElementSpec[] = [];
  let cy = y;
  if (opts.eyebrow) {
    specs.push(text(opts.eyebrow, [x, cy, w, 22], { fontSize: 14, fontWeight: 800, letterSpacing: 3, color: "$primary", textAlign: align, textTransform: "uppercase" }, "small"));
    cy += 34;
  }
  const size = opts.size ?? 44;
  const lines = Math.ceil((title.length * size * 0.52) / w);
  const th = Math.round(size * 1.2 * Math.max(1, lines));
  specs.push(text(title, [x, cy, w, th], { fontSize: size, fontWeight: 800, textAlign: align, letterSpacing: size > 40 ? -1 : 0, color: opts.color }, size >= 44 ? "h1" : "h2"));
  cy += th + 14;
  if (sub) {
    const sh = Math.round(19 * 1.55 * Math.max(1, Math.ceil((sub.length * 19 * 0.5) / w)));
    specs.push(text(sub, [x, cy, w, sh], { fontSize: 19, color: opts.subColor || "$muted", textAlign: align }, "p"));
    cy += sh;
  }
  return { specs, bottom: cy };
}

/** A form input that fills the width of an auto-layout form. */
export function formField(type: InputType, label: string, name: string, props: Parameters<typeof input>[4] = {}, h?: number): ElementSpec {
  return fill(input(type, label, name, [0, 0, 400, h ?? (type === "textarea" ? 150 : type === "rating" ? 70 : 74)], { inputStyle: "box", ...props }));
}

export function submitButton(label: string, style: Parameters<typeof button>[2] = {}, extra: { icon?: string } = {}): ElementSpec {
  return { ...button(label, [0, 0, 400, 52], { fontSize: 16, ...style }, { submit: true, icon: extra.icon, iconPos: "right" }), sizing: { w: "fill", h: "fixed" } };
}

/** A form that saves to a collection. Children stack in a column. */
export function formBox(name: string, colKey: string | null, b: [number, number, number, number], children: ElementSpec[], opts: { success?: string; events?: Events; style?: ElementSpec["style"]; padding?: number; gap?: number; ref?: string } = {}): ElementSpec {
  return {
    type: "form",
    name,
    ref: opts.ref,
    box: { x: b[0], y: b[1], w: b[2], h: b[3] },
    // as tall as its fields
    sizing: { w: "fixed", h: "hug" },
    style: { fill: solid("$background"), radius: 22, borderWidth: 1, borderColor: "$border", shadow: { x: 0, y: 24, blur: 60, spread: -24, color: "rgba(20,16,40,0.22)" }, ...(opts.style || {}) },
    props: {
      ...(colKey ? { collectionId: col(colKey) } : {}),
      successMessage: opts.success ?? "Thanks! We got it.",
      layout: { mode: "column", gap: opts.gap ?? 14, padding: opts.padding ?? 28, align: "stretch", justify: "start", wrap: false, columns: 1 },
    },
    events: opts.events,
    children,
  };
}

/** A list of records; `card` is the design repeated for every record. */
export function recordList(
  name: string,
  colKey: string,
  b: [number, number, number, number],
  card: ElementSpec,
  opts: { columns?: number; mobileColumns?: number; gap?: number; pageSize?: number; sortField?: string; sortDir?: "asc" | "desc"; filters?: DataFilter[]; search?: boolean; searchPlaceholder?: string; empty?: string } = {},
): ElementSpec {
  const columns = opts.columns ?? 3;
  return {
    type: "list",
    name,
    box: { x: b[0], y: b[1], w: b[2], h: b[3] },
    props: {
      collectionId: col(colKey),
      emptyText: opts.empty || "Nothing here yet.",
      layout: { mode: columns === 1 ? "column" : "grid", columns, mobileColumns: opts.mobileColumns ?? 1, gap: opts.gap ?? 24, padding: 0, align: "stretch", justify: "start", wrap: false },
      query: {
        pageSize: opts.pageSize ?? 9,
        sortField: opts.sortField ?? "createdAt",
        sortDir: opts.sortDir ?? "desc",
        search: !!opts.search,
        searchPlaceholder: opts.searchPlaceholder,
        filters: opts.filters || [],
      },
    },
    children: [card],
  };
}

export function recordTable(name: string, colKey: string, b: [number, number, number, number], columns: TableColumn[], opts: { pageSize?: number; sortField?: string; sortDir?: "asc" | "desc"; search?: boolean; filters?: DataFilter[]; events?: Events } = {}): ElementSpec {
  return {
    type: "table",
    name,
    box: { x: b[0], y: b[1], w: b[2], h: b[3] },
    props: {
      collectionId: col(colKey),
      columns,
      striped: true,
      emptyText: "Nothing here yet.",
      query: { pageSize: opts.pageSize ?? 10, sortField: opts.sortField ?? "createdAt", sortDir: opts.sortDir ?? "desc", search: opts.search ?? true, filters: opts.filters || [] },
    },
    events: opts.events,
  };
}

export function statCard(name: string, colKey: string, b: [number, number, number, number], label: string, opts: { aggregate?: "count" | "sum" | "avg" | "min" | "max"; field?: string; prefix?: string; suffix?: string; decimals?: number; filters?: DataFilter[]; style?: ElementSpec["style"] } = {}): ElementSpec {
  return {
    type: "stat",
    name,
    box: { x: b[0], y: b[1], w: b[2], h: b[3] },
    style: { fill: solid("$surface"), radius: 18, padding: 22, ...(opts.style || {}) },
    props: {
      dataSource: "collection",
      collectionId: col(colKey),
      aggregate: opts.aggregate || "count",
      field: opts.field,
      label,
      prefix: opts.prefix || "",
      suffix: opts.suffix || "",
      decimals: opts.decimals ?? 0,
      query: { filters: opts.filters || [] },
    },
  };
}

export function chartOf(name: string, colKey: string, b: [number, number, number, number], chartType: "bar" | "line" | "area" | "pie" | "donut", groupBy: string, opts: { aggregate?: "count" | "sum" | "avg"; field?: string } = {}): ElementSpec {
  return {
    type: "chart",
    name,
    box: { x: b[0], y: b[1], w: b[2], h: b[3] },
    style: { fill: solid("$background"), radius: 18, borderWidth: 1, borderColor: "$border", padding: 20 },
    props: { dataSource: "collection", collectionId: col(colKey), chartType, groupBy, aggregate: opts.aggregate || "count", field: opts.field, showLegend: chartType === "pie" || chartType === "donut", query: { filters: [] } },
  };
}

/** A pill-shaped label, e.g. a category tag on a card. */
export function tag(value: string, b: [number, number, number, number?], tone = "$primary"): ElementSpec {
  return text(value, [b[0], b[1], b[2], b[3] ?? 28], { fill: solid(`${tone}/12`), color: tone, radius: 999, fontSize: 13, fontWeight: 700, textAlign: "center", verticalAlign: "middle" }, "small", { sizing: { w: "fixed", h: "fixed" } });
}

/** Round icon tile used in feature rows. */
export function iconTile(name: string, x: number, y: number, size = 52, tone = "$primary"): ElementSpec {
  const inner = Math.round(size * 0.5);
  return box([x, y, size, size], { fill: solid(`${tone}/12`), radius: Math.round(size * 0.28) }, [icon(name, [(size - inner) / 2, (size - inner) / 2, inner], { color: tone })], {}, { sizing: { w: "fixed", h: "fixed" } });
}

/** Three feature columns with an icon, a title and a sentence. */
export function featureRow(y: number, items: [string, string, string][], opts: { bg?: string } = {}): ElementSpec {
  return stack(
    "grid",
    [80, y, 1120, 200],
    items.map(([ic, title, body]) =>
      fill(
        stack(
          "column",
          [0, 0, 350, 200],
          [iconTile(ic, 0, 0), fill(text(title, [0, 0, 300], { fontSize: 21, fontWeight: 700 }, "h3")), fill(text(body, [0, 0, 300], { color: "$muted", fontSize: 16 }, "p"))],
          { gap: 12, padding: 26, align: "start" },
          { fill: solid(opts.bg || "$background"), radius: 20, borderWidth: 1, borderColor: "$border" },
        ),
      ),
    ),
    { columns: items.length, mobileColumns: 1, gap: 22, align: "stretch" },
  );
}

/* ------------------------------------------------------------------ phone pieces */

export function phoneHeader(title: string, opts: { icon?: string; iconEvents?: Events; back?: boolean } = {}): ElementSpec {
  return {
    ...box([0, 0, PW, 64], { fill: solid("$background"), shadow: { x: 0, y: 1, blur: 0, spread: 0, color: "rgba(0,0,0,0.07)" } }, [
      ...(opts.back ? [button("", [6, 12, 40, 40], { fill: { type: "none" }, color: "$text" }, { icon: "ChevronLeft" }, { click: [{ type: "goBack" }] }, { name: "BackButton" })] : []),
      text(title, [opts.back ? 50 : 20, 17, 260, 30], { fontSize: 21, fontWeight: 800, fontFamily: "$heading" }, "h2", { name: "ScreenTitle" }),
      ...(opts.icon ? [button("", [PW - 56, 12, 40, 40], { fill: solid("$surface"), color: "$text", radius: 999 }, { icon: opts.icon }, opts.iconEvents, { name: "HeaderButton" })] : []),
    ]),
    name: "Header",
    pin: "top",
  };
}

export function phoneTabBar(items: MenuItem[] = []): ElementSpec {
  return {
    ...box([0, 776, PW, 68], { fill: solid("$background"), shadow: { x: 0, y: -1, blur: 0, spread: 0, color: "rgba(0,0,0,0.08)" } }, [
      { type: "menu", name: "Tabs", box: { x: 0, y: 4, w: PW, h: 60 }, style: { fontSize: 15 }, props: { items, orientation: "horizontal", variant: "tabbar" } },
    ]),
    name: "TabBar",
    pin: "bottom",
  };
}
