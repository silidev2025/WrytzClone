import type {
  Box,
  ContainerLayout,
  El,
  ElementProps,
  ElementType,
  EventName,
  Action,
  SizeMode,
  Style,
  Theme,
  InputType,
} from "./types";
import { fillBaseColor, readableOn, resolveColor } from "./theme";
import { nextLayerName, uid } from "./util";

export interface ElementInfo {
  label: string;
  icon: string;
  container: boolean;
  events: EventName[];
  /** layer name stem, e.g. Button -> Button1 */
  stem: string;
  defaultSize: { w: number; h: number };
  defaultSizing?: { w: SizeMode; h: SizeMode };
}

export const ELEMENT_INFO: Record<ElementType, ElementInfo> = {
  text: { label: "Text", icon: "Type", container: false, events: ["click"], stem: "Text", defaultSize: { w: 420, h: 40 }, defaultSizing: { w: "fixed", h: "hug" } },
  button: { label: "Button", icon: "RectangleHorizontal", container: false, events: ["click"], stem: "Button", defaultSize: { w: 170, h: 48 } },
  image: { label: "Image", icon: "Image", container: false, events: ["click"], stem: "Image", defaultSize: { w: 360, h: 240 } },
  icon: { label: "Icon", icon: "Smile", container: false, events: ["click"], stem: "Icon", defaultSize: { w: 48, h: 48 } },
  shape: { label: "Shape", icon: "Shapes", container: false, events: ["click"], stem: "Shape", defaultSize: { w: 160, h: 160 } },
  line: { label: "Line", icon: "Minus", container: false, events: [], stem: "Line", defaultSize: { w: 280, h: 16 } },
  video: { label: "Video", icon: "Youtube", container: false, events: [], stem: "Video", defaultSize: { w: 480, h: 270 } },
  map: { label: "Map", icon: "MapPin", container: false, events: [], stem: "Map", defaultSize: { w: 480, h: 300 } },
  embed: { label: "Website embed", icon: "Globe", container: false, events: [], stem: "Embed", defaultSize: { w: 480, h: 320 } },
  input: { label: "Input", icon: "TextCursorInput", container: false, events: ["change"], stem: "Input", defaultSize: { w: 340, h: 74 }, defaultSizing: { w: "fixed", h: "hug" } },
  box: { label: "Box", icon: "Square", container: true, events: ["click"], stem: "Box", defaultSize: { w: 320, h: 200 } },
  form: { label: "Form", icon: "ClipboardList", container: true, events: ["submit"], stem: "Form", defaultSize: { w: 420, h: 360 } },
  list: { label: "Repeating list", icon: "LayoutList", container: true, events: [], stem: "List", defaultSize: { w: 840, h: 420 }, defaultSizing: { w: "fixed", h: "hug" } },
  table: { label: "Table", icon: "Table", container: false, events: ["rowClick"], stem: "Table", defaultSize: { w: 760, h: 380 }, defaultSizing: { w: "fixed", h: "hug" } },
  menu: { label: "Menu", icon: "Menu", container: false, events: [], stem: "Menu", defaultSize: { w: 420, h: 44 } },
  tabs: { label: "Tabs", icon: "PanelTop", container: true, events: [], stem: "Tabs", defaultSize: { w: 600, h: 340 } },
  dialog: { label: "Pop-up", icon: "AppWindow", container: true, events: [], stem: "Dialog", defaultSize: { w: 460, h: 320 } },
  progress: { label: "Progress bar", icon: "Loader", container: false, events: [], stem: "Progress", defaultSize: { w: 320, h: 18 } },
  stat: { label: "Stat card", icon: "Gauge", container: false, events: ["click"], stem: "Stat", defaultSize: { w: 230, h: 116 } },
  chart: { label: "Chart", icon: "ChartColumn", container: false, events: [], stem: "Chart", defaultSize: { w: 520, h: 320 } },
  countdown: { label: "Countdown", icon: "Timer", container: false, events: [], stem: "Countdown", defaultSize: { w: 440, h: 104 } },
};

export function isContainerType(type: ElementType): boolean {
  return ELEMENT_INFO[type].container;
}

export const DEFAULT_LAYOUT: ContainerLayout = {
  mode: "free",
  gap: 16,
  padding: 20,
  align: "stretch",
  justify: "start",
  wrap: false,
  columns: 3,
};

export function layoutOf(el: El): ContainerLayout {
  return { ...DEFAULT_LAYOUT, ...(el.props.layout || {}) };
}

export function isAutoLayout(el: El | undefined | null): boolean {
  if (!el || !isContainerType(el.type)) return false;
  const mode = layoutOf(el).mode;
  return mode !== "free";
}

export const INPUT_TYPE_INFO: Record<InputType, { label: string; icon: string; stem: string }> = {
  text: { label: "Text field", icon: "TextCursorInput", stem: "Name" },
  email: { label: "Email field", icon: "Mail", stem: "Email" },
  number: { label: "Number field", icon: "Hash", stem: "Amount" },
  phone: { label: "Phone field", icon: "Phone", stem: "Phone" },
  password: { label: "Password field", icon: "KeyRound", stem: "Password" },
  url: { label: "Link field", icon: "Link", stem: "Website" },
  textarea: { label: "Text area", icon: "AlignLeft", stem: "Message" },
  select: { label: "Dropdown", icon: "ChevronsUpDown", stem: "Choice" },
  radio: { label: "Radio buttons", icon: "CircleDot", stem: "Option" },
  checkbox: { label: "Checkboxes", icon: "ListChecks", stem: "Options" },
  toggle: { label: "Toggle switch", icon: "ToggleRight", stem: "Toggle" },
  date: { label: "Date picker", icon: "Calendar", stem: "Date" },
  time: { label: "Time picker", icon: "Clock", stem: "Time" },
  datetime: { label: "Date & time", icon: "CalendarClock", stem: "When" },
  range: { label: "Slider", icon: "SlidersHorizontal", stem: "Slider" },
  file: { label: "File upload", icon: "Upload", stem: "Attachment" },
  rating: { label: "Star rating", icon: "Star", stem: "Rating" },
  color: { label: "Color picker", icon: "Palette", stem: "Color" },
};

/* ------------------------------------------------------------------ specs */

/** Declarative description of an element (and its children), used by the catalog, blocks and templates. */
export interface ElementSpec {
  type: ElementType;
  name?: string;
  box?: Partial<Box>;
  mobile?: { x?: number; y?: number; w?: number; h?: number; fontSize?: number };
  hideOn?: { desktop?: boolean; mobile?: boolean };
  sizing?: { w: SizeMode; h: SizeMode };
  style?: Style;
  props?: ElementProps;
  events?: Partial<Record<EventName, Omit<Action, "id">[]>>;
  children?: ElementSpec[];
  startHidden?: boolean;
  locked?: boolean;
  /** top-level only: stays on screen while scrolling */
  pin?: "top" | "bottom";
  /** local reference used by specs to point actions at each other (e.g. open this dialog) */
  ref?: string;
}

function defaultProps(type: ElementType): ElementProps {
  switch (type) {
    case "text":
      return { text: "Your text here", tag: "p" };
    case "button":
      return { label: "Click me", iconPos: "left" };
    case "image":
      return { src: "", alt: "", fit: "cover", focusX: 50, focusY: 50, mask: "none" };
    case "icon":
      return { icon: "Star", strokeWidth: 2 };
    case "shape":
      return { shape: "rect" };
    case "line":
      return { thickness: 2, dash: "solid" };
    case "video":
      return { url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", controls: true, muted: false, autoplay: false, loop: false };
    case "map":
      return { address: "Eiffel Tower, Paris", mapZoom: 14 };
    case "embed":
      return { url: "https://example.com" };
    case "input":
      return { inputType: "text", label: "Label", placeholder: "Type here…", showLabel: true, inputStyle: "box", required: false };
    case "box":
      return { layout: { ...DEFAULT_LAYOUT } };
    case "form":
      return { layout: { ...DEFAULT_LAYOUT, mode: "column", gap: 14, padding: 24 }, successMessage: "Thanks! Your response was saved." };
    case "list":
      return {
        layout: { ...DEFAULT_LAYOUT, mode: "grid", columns: 3, gap: 20, padding: 0 },
        query: { pageSize: 6, sortField: "createdAt", sortDir: "desc", search: false, filters: [] },
        emptyText: "Nothing here yet.",
      };
    case "table":
      return { query: { pageSize: 8, sortField: "createdAt", sortDir: "desc", search: true, filters: [] }, columns: [], striped: true, emptyText: "No records yet." };
    case "menu":
      return { items: [], orientation: "horizontal", variant: "links" };
    case "tabs":
      return { tabs: [{ id: uid(), label: "Tab 1" }, { id: uid(), label: "Tab 2" }], activeTab: 0, variant: "underline" };
    case "dialog":
      return { layout: { ...DEFAULT_LAYOUT, mode: "column", padding: 28, gap: 14 }, closeOnBackdrop: true, title: "" };
    case "progress":
      return { value: "65", maxValue: "100", showValue: false, variant: "bar" };
    case "stat":
      return { dataSource: "collection", aggregate: "count", label: "Total", prefix: "", suffix: "", decimals: 0, query: { filters: [] } };
    case "chart":
      return {
        dataSource: "manual",
        chartType: "bar",
        aggregate: "count",
        manualData: "Mon: 12\nTue: 19\nWed: 8\nThu: 15\nFri: 22",
        showLegend: true,
        query: { filters: [] },
      };
    case "countdown":
      return { target: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 16), doneText: "We're live!" };
  }
}

function defaultStyle(type: ElementType): Style {
  switch (type) {
    case "text":
      return {};
    case "shape":
      return { fill: { type: "solid", color: "$primary" } };
    case "box":
      return {};
    case "dialog":
      return { fill: { type: "solid", color: "$background" }, radius: 18, shadow: { x: 0, y: 24, blur: 60, spread: -12, color: "rgba(15, 12, 30, 0.35)" } };
    case "stat":
      return { fill: { type: "solid", color: "$surface" }, radius: 16, padding: 20 };
    case "image":
      return { radius: 12 };
    default:
      return {};
  }
}

/** A single element with defaults applied. */
export function makeElement(type: ElementType, opts: { name: string; parentId?: string | null; box?: Partial<Box> } & Partial<Omit<El, "box">>): El {
  const info = ELEMENT_INFO[type];
  const { name, parentId, box, ...rest } = opts;
  const el: El = {
    id: uid("el"),
    type,
    name,
    parentId: parentId ?? null,
    box: { x: 0, y: 0, w: info.defaultSize.w, h: info.defaultSize.h, ...(box || {}) },
    style: { ...defaultStyle(type), ...(rest.style || {}) },
    props: { ...defaultProps(type), ...(rest.props || {}) },
  };
  if (info.defaultSizing || rest.sizing) el.sizing = { ...(info.defaultSizing || { w: "fixed", h: "fixed" }), ...(rest.sizing || {}) };
  if (info.container) el.childIds = [];
  if (rest.events) el.events = rest.events;
  if (rest.locked) el.locked = true;
  if (rest.hidden) el.hidden = true;
  if (rest.startHidden) el.startHidden = true;
  if (rest.responsive) el.responsive = rest.responsive;
  return el;
}

/**
 * Create elements from a spec. Returns a flat list (parent first) ready to merge into a
 * page's element map. `names` is updated with every generated layer name.
 */
export function instantiateSpec(
  spec: ElementSpec,
  parentId: string | null,
  names: Set<string>,
  refs: Map<string, string> = new Map(),
): El[] {
  const out: El[] = [];
  const pendingActions: { el: El; event: EventName; actions: Omit<Action, "id">[] }[] = [];

  const build = (s: ElementSpec, parent: string | null): El => {
    const info = ELEMENT_INFO[s.type];
    const stem = s.type === "input" ? INPUT_TYPE_INFO[s.props?.inputType || "text"].stem : info.stem;
    const name = s.name && !names.has(s.name.toLowerCase()) ? s.name : nextLayerName(s.name || stem, names);
    names.add(name.toLowerCase());
    const props: ElementProps | undefined = s.props ? { ...s.props } : undefined;
    if (props?.layout) props.layout = { ...(defaultProps(s.type).layout || DEFAULT_LAYOUT), ...props.layout };
    const el = makeElement(s.type, {
      name,
      parentId: parent,
      box: s.box,
      sizing: s.sizing,
      style: s.style,
      props,
      startHidden: s.startHidden,
      locked: s.locked,
    });
    if (s.type === "input" && !s.props?.name) el.props.name = el.props.label || name;
    if (s.mobile) el.responsive = { mobile: { ...s.mobile } };
    if (s.hideOn) el.hideOn = { ...s.hideOn };
    if (s.pin && !parent) el.pin = s.pin;
    if (s.ref) refs.set(s.ref, el.id);
    if (s.events) for (const [ev, acts] of Object.entries(s.events)) pendingActions.push({ el, event: ev as EventName, actions: acts || [] });
    out.push(el);
    if (s.children?.length) {
      el.childIds = [];
      for (const child of s.children) {
        const c = build(child, el.id);
        el.childIds.push(c.id);
      }
    }
    return el;
  };

  build(spec, parentId);

  // resolve "@ref" targets now that every element exists
  const resolveRef = (v: string | undefined) => (v && v.startsWith("@") ? refs.get(v.slice(1)) || v : v);
  for (const { el, event, actions } of pendingActions) {
    el.events = el.events || {};
    el.events[event] = actions.map((a) => ({
      ...a,
      id: uid("act"),
      targetId: resolveRef(a.targetId),
      formId: resolveRef(a.formId),
    })) as Action[];
  }
  return out;
}

/* ------------------------------------------------------------------ effective styles */

export interface ResolvedTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  color: string;
}

const TAG_DEFAULTS: Record<string, { size: number; weight: number; lh: number; heading: boolean }> = {
  h1: { size: 52, weight: 700, lh: 1.1, heading: true },
  h2: { size: 36, weight: 700, lh: 1.15, heading: true },
  h3: { size: 24, weight: 600, lh: 1.25, heading: true },
  p: { size: 17, weight: 400, lh: 1.55, heading: false },
  small: { size: 13, weight: 500, lh: 1.45, heading: false },
};

export function textDefaults(el: El) {
  const tag = el.props.tag || "p";
  return TAG_DEFAULTS[tag] || TAG_DEFAULTS.p;
}

/** Default font size of an element when its style doesn't set one. */
export function defaultFontSize(el: El): number {
  switch (el.type) {
    case "text":
      return textDefaults(el).size;
    case "button":
      return 16;
    case "input":
    case "table":
      return 15;
    case "menu":
      return 15;
    case "stat":
      return 34;
    case "countdown":
      return 40;
    default:
      return 16;
  }
}

export function isHeadingEl(el: El): boolean {
  return el.type === "text" && textDefaults(el).heading;
}

/** Button colours for the theme's button style unless the element overrides them. */
export function buttonColors(el: El, theme: Theme): { background: string | undefined; color: string; borderColor?: string; borderWidth?: number } {
  const style = theme.buttonStyle;
  const primary = theme.colors.primary;
  const explicitFill = el.style.fill;
  if (explicitFill) {
    const base = fillBaseColor(explicitFill, theme);
    // text on a see-through button uses the brand colour; on a fill, whatever reads best
    const fallback = explicitFill.type === "none" ? primary : base ? readableOn(base) : "#ffffff";
    return {
      background: undefined,
      color: el.style.color ? resolveColor(el.style.color, theme) : fallback,
    };
  }
  if (style === "outline")
    return { background: "transparent", color: el.style.color ? resolveColor(el.style.color, theme) : primary, borderColor: primary, borderWidth: 2 };
  if (style === "soft")
    return { background: resolveColor("$primary/14", theme), color: el.style.color ? resolveColor(el.style.color, theme) : primary };
  return { background: primary, color: el.style.color ? resolveColor(el.style.color, theme) : readableOn(primary) };
}

export function defaultRadius(el: El, theme: Theme): number {
  switch (el.type) {
    case "button":
      return theme.buttonStyle === "pill" ? 999 : theme.radius;
    case "input":
      return Math.min(theme.radius, 14);
    case "table":
    case "dialog":
    case "stat":
      return Math.min(theme.radius + 4, 24);
    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ catalog */

export type CatalogCategory = "Text" | "Basics" | "Shapes" | "Layout" | "Forms" | "Data" | "Media";

export interface CatalogItem {
  id: string;
  label: string;
  icon: string;
  category: CatalogCategory;
  keywords?: string;
  hint?: string;
  spec: () => ElementSpec;
}

const input = (inputType: InputType, extra: Partial<ElementProps> = {}, h = 74): ElementSpec => ({
  type: "input",
  box: { w: 340, h },
  props: {
    inputType,
    label: INPUT_TYPE_INFO[inputType].stem === "Name" ? "Your name" : INPUT_TYPE_INFO[inputType].stem,
    name: INPUT_TYPE_INFO[inputType].stem === "Name" ? "Name" : INPUT_TYPE_INFO[inputType].stem,
    placeholder: "",
    showLabel: true,
    inputStyle: "box",
    required: false,
    ...extra,
  },
});

export const CATALOG: CatalogItem[] = [
  // Text
  { id: "heading", label: "Heading", icon: "Heading1", category: "Text", keywords: "title h1 big text", spec: () => ({ type: "text", name: "Heading", box: { w: 560, h: 64 }, props: { text: "Add a heading", tag: "h1" } }) },
  { id: "subheading", label: "Subheading", icon: "Heading2", category: "Text", keywords: "title h2", spec: () => ({ type: "text", name: "Subheading", box: { w: 480, h: 44 }, props: { text: "Add a subheading", tag: "h2" } }) },
  { id: "paragraph", label: "Paragraph", icon: "Pilcrow", category: "Text", keywords: "body text copy", spec: () => ({ type: "text", name: "Paragraph", box: { w: 440, h: 54 }, props: { text: "Add a little bit of body text. Double-click to edit it.", tag: "p" } }) },
  { id: "caption", label: "Small text", icon: "CaseLower", category: "Text", keywords: "caption label", spec: () => ({ type: "text", name: "Caption", box: { w: 260, h: 20 }, style: { color: "$muted" }, props: { text: "A small caption", tag: "small" } }) },
  { id: "link", label: "Text link", icon: "Link", category: "Text", keywords: "hyperlink url anchor", spec: () => ({ type: "text", name: "Link", box: { w: 160, h: 26 }, style: { color: "$primary", underline: true, cursor: "pointer" }, props: { text: "Learn more →", tag: "p", link: { url: "https://example.com", newTab: true } } }) },
  { id: "badge", label: "Badge", icon: "Tag", category: "Text", keywords: "pill label chip tag", spec: () => ({ type: "text", name: "Badge", box: { w: 120, h: 30 }, sizing: { w: "fixed", h: "fixed" }, style: { fill: { type: "solid", color: "$primary/14" }, color: "$primary", radius: 999, fontSize: 13, fontWeight: 600, textAlign: "center", verticalAlign: "middle", paddingX: 12 }, props: { text: "New", tag: "small" } }) },
  { id: "quote", label: "Quote", icon: "Quote", category: "Text", keywords: "testimonial blockquote", spec: () => ({ type: "text", name: "Quote", box: { w: 460, h: 90 }, style: { italic: true, fontSize: 22, fontFamily: "$heading", borderColor: "$primary" }, props: { text: "“This is the easiest way I've ever built an app.”", tag: "p" } }) },
  // Basics
  { id: "button", label: "Button", icon: "RectangleHorizontal", category: "Basics", keywords: "cta action click", spec: () => ({ type: "button", box: { w: 170, h: 48 }, props: { label: "Get started" } }) },
  { id: "button-outline", label: "Outline button", icon: "SquareDashed", category: "Basics", keywords: "secondary", spec: () => ({ type: "button", box: { w: 170, h: 48 }, style: { fill: { type: "none" }, borderWidth: 2, borderColor: "$primary", color: "$primary" }, props: { label: "Learn more" } }) },
  { id: "button-icon", label: "Icon button", icon: "CirclePlus", category: "Basics", keywords: "round", spec: () => ({ type: "button", box: { w: 52, h: 52 }, style: { radius: 999 }, props: { label: "", icon: "Plus" } }) },
  { id: "image", label: "Image", icon: "Image", category: "Basics", keywords: "picture photo", spec: () => ({ type: "image", box: { w: 360, h: 240 }, props: { src: "https://picsum.photos/seed/craftbase/900/600", alt: "Photo" } }) },
  { id: "avatar", label: "Avatar", icon: "CircleUserRound", category: "Basics", keywords: "profile picture round", spec: () => ({ type: "image", name: "Avatar", box: { w: 96, h: 96 }, props: { src: "https://picsum.photos/seed/avatar7/300/300", alt: "Profile photo", mask: "circle" } }) },
  { id: "icon", label: "Icon", icon: "Smile", category: "Basics", keywords: "symbol glyph", spec: () => ({ type: "icon", box: { w: 48, h: 48 }, props: { icon: "Sparkles", strokeWidth: 2 } }) },
  { id: "divider", label: "Divider", icon: "Minus", category: "Basics", keywords: "line separator hr", spec: () => ({ type: "line", box: { w: 420, h: 16 }, props: { thickness: 1, dash: "solid" } }) },
  { id: "progress", label: "Progress bar", icon: "Loader", category: "Basics", keywords: "meter percent", spec: () => ({ type: "progress", box: { w: 320, h: 14 } }) },
  { id: "countdown", label: "Countdown", icon: "Timer", category: "Basics", keywords: "timer launch clock", spec: () => ({ type: "countdown", box: { w: 440, h: 104 } }) },
  // Shapes
  { id: "rect", label: "Rectangle", icon: "Square", category: "Shapes", spec: () => ({ type: "shape", box: { w: 200, h: 140 }, props: { shape: "rect" } }) },
  { id: "rounded", label: "Rounded", icon: "SquareRoundCorner", category: "Shapes", spec: () => ({ type: "shape", box: { w: 200, h: 140 }, style: { fill: { type: "solid", color: "$primary" }, radius: 28 }, props: { shape: "rect" } }) },
  { id: "circle", label: "Circle", icon: "Circle", category: "Shapes", spec: () => ({ type: "shape", box: { w: 160, h: 160 }, props: { shape: "ellipse" } }) },
  { id: "triangle", label: "Triangle", icon: "Triangle", category: "Shapes", spec: () => ({ type: "shape", box: { w: 160, h: 140 }, props: { shape: "triangle" } }) },
  { id: "star", label: "Star", icon: "Star", category: "Shapes", spec: () => ({ type: "shape", box: { w: 160, h: 160 }, style: { fill: { type: "solid", color: "$accent" } }, props: { shape: "star" } }) },
  { id: "heart", label: "Heart", icon: "Heart", category: "Shapes", spec: () => ({ type: "shape", box: { w: 160, h: 145 }, style: { fill: { type: "solid", color: "$secondary" } }, props: { shape: "heart" } }) },
  { id: "hexagon", label: "Hexagon", icon: "Hexagon", category: "Shapes", spec: () => ({ type: "shape", box: { w: 160, h: 160 }, props: { shape: "hexagon" } }) },
  { id: "diamond", label: "Diamond", icon: "Diamond", category: "Shapes", spec: () => ({ type: "shape", box: { w: 150, h: 150 }, props: { shape: "diamond" } }) },
  { id: "pentagon", label: "Pentagon", icon: "Pentagon", category: "Shapes", spec: () => ({ type: "shape", box: { w: 160, h: 160 }, props: { shape: "pentagon" } }) },
  { id: "arrow", label: "Arrow", icon: "ArrowBigRight", category: "Shapes", spec: () => ({ type: "shape", box: { w: 200, h: 110 }, props: { shape: "arrow" } }) },
  { id: "blob", label: "Blob", icon: "Cloud", category: "Shapes", spec: () => ({ type: "shape", box: { w: 240, h: 220 }, style: { fill: { type: "gradient", kind: "linear", angle: 135, stops: [{ color: "$primary", at: 0 }, { color: "$secondary", at: 100 }] } }, props: { shape: "blob" } }) },
  { id: "speech", label: "Speech bubble", icon: "MessageSquare", category: "Shapes", spec: () => ({ type: "shape", box: { w: 220, h: 160 }, style: { fill: { type: "solid", color: "$surface" } }, props: { shape: "speech" } }) },
  { id: "cross", label: "Plus", icon: "Plus", category: "Shapes", spec: () => ({ type: "shape", box: { w: 120, h: 120 }, props: { shape: "cross" } }) },
  { id: "arch", label: "Arch", icon: "DoorOpen", category: "Shapes", spec: () => ({ type: "shape", box: { w: 180, h: 240 }, props: { shape: "arch" } }) },
  { id: "wave", label: "Wave", icon: "Waves", category: "Shapes", spec: () => ({ type: "shape", box: { w: 1280, h: 120 }, style: { fill: { type: "solid", color: "$primary" } }, props: { shape: "wave" } }) },
  { id: "line", label: "Line", icon: "Slash", category: "Shapes", spec: () => ({ type: "line", box: { w: 280, h: 16 }, style: { color: "$text" }, props: { thickness: 3, dash: "solid" } }) },
  { id: "arrow-line", label: "Arrow line", icon: "MoveRight", category: "Shapes", spec: () => ({ type: "line", box: { w: 280, h: 24 }, style: { color: "$text" }, props: { thickness: 3, dash: "solid", arrowEnd: true } }) },
  { id: "dashed", label: "Dashed line", icon: "Ellipsis", category: "Shapes", spec: () => ({ type: "line", box: { w: 280, h: 16 }, style: { color: "$text" }, props: { thickness: 3, dash: "dashed" } }) },
  // Layout
  {
    id: "card",
    label: "Card",
    icon: "PanelsTopLeft",
    category: "Layout",
    keywords: "box panel container",
    spec: () => ({
      type: "box",
      name: "Card",
      box: { w: 300, h: 380 },
      style: { fill: { type: "solid", color: "$background" }, radius: 18, borderWidth: 1, borderColor: "$border", shadow: { x: 0, y: 8, blur: 24, spread: -8, color: "rgba(20, 16, 40, 0.12)" }, overflow: "hidden" },
      props: { layout: { ...DEFAULT_LAYOUT, mode: "column", gap: 10, padding: 0, align: "stretch" } },
      children: [
        { type: "image", box: { w: 300, h: 180 }, sizing: { w: "fill", h: "fixed" }, style: { radius: 0 }, props: { src: "https://picsum.photos/seed/card1/600/360", alt: "" } },
        { type: "text", box: { w: 260, h: 30 }, sizing: { w: "fill", h: "hug" }, style: { paddingX: 20 }, props: { text: "Card title", tag: "h3" } },
        { type: "text", box: { w: 260, h: 50 }, sizing: { w: "fill", h: "hug" }, style: { paddingX: 20, color: "$muted", fontSize: 15 }, props: { text: "A short description that explains what this card is about.", tag: "p" } },
      ],
    }),
  },
  { id: "box", label: "Box", icon: "Square", category: "Layout", keywords: "container group frame free", hint: "Place anything inside, anywhere", spec: () => ({ type: "box", box: { w: 360, h: 220 }, style: { fill: { type: "solid", color: "$surface" }, radius: 16 } }) },
  { id: "row", label: "Row", icon: "Columns3", category: "Layout", keywords: "horizontal stack auto layout flex", hint: "Lines items up left to right", spec: () => ({ type: "box", name: "Row", box: { w: 560, h: 120 }, style: { fill: { type: "solid", color: "$surface" }, radius: 14 }, props: { layout: { ...DEFAULT_LAYOUT, mode: "row", gap: 16, padding: 16, align: "center", wrap: true } } }) },
  { id: "column", label: "Column", icon: "Rows3", category: "Layout", keywords: "vertical stack auto layout", hint: "Stacks items top to bottom", spec: () => ({ type: "box", name: "Column", box: { w: 320, h: 320 }, style: { fill: { type: "solid", color: "$surface" }, radius: 14 }, props: { layout: { ...DEFAULT_LAYOUT, mode: "column", gap: 12, padding: 16 } } }) },
  { id: "grid", label: "Grid", icon: "LayoutGrid", category: "Layout", keywords: "gallery cells columns", hint: "Equal cells in rows", spec: () => ({ type: "box", name: "Grid", box: { w: 600, h: 320 }, style: { fill: { type: "solid", color: "$surface" }, radius: 14 }, props: { layout: { ...DEFAULT_LAYOUT, mode: "grid", columns: 3, gap: 14, padding: 16 } } }) },
  { id: "scroll", label: "Scroll area", icon: "ScrollText", category: "Layout", keywords: "overflow scrolling", hint: "Content scrolls inside a fixed frame", spec: () => ({ type: "box", name: "ScrollArea", box: { w: 380, h: 260 }, style: { fill: { type: "solid", color: "$surface" }, radius: 14, overflow: "scroll" }, props: { layout: { ...DEFAULT_LAYOUT, mode: "column", gap: 12, padding: 16 } } }) },
  { id: "tabs", label: "Tabs", icon: "PanelTop", category: "Layout", keywords: "switch panels", spec: () => ({ type: "tabs", box: { w: 600, h: 340 }, children: [
    { type: "box", name: "Panel", box: { w: 600, h: 290 }, children: [{ type: "text", box: { x: 24, y: 24, w: 400, h: 30 }, props: { text: "Content of the first tab", tag: "p" } }] },
    { type: "box", name: "Panel", box: { w: 600, h: 290 }, children: [{ type: "text", box: { x: 24, y: 24, w: 400, h: 30 }, props: { text: "Content of the second tab", tag: "p" } }] },
  ] }) },
  {
    id: "dialog",
    label: "Pop-up",
    icon: "AppWindow",
    category: "Layout",
    keywords: "modal dialog overlay popup",
    hint: "Hidden until a button opens it",
    spec: () => ({
      type: "dialog",
      box: { w: 460, h: 280 },
      children: [
        { type: "text", box: { w: 400, h: 36 }, sizing: { w: "fill", h: "hug" }, props: { text: "Hello there 👋", tag: "h3" } },
        { type: "text", box: { w: 400, h: 50 }, sizing: { w: "fill", h: "hug" }, style: { color: "$muted" }, props: { text: "Pop-ups are great for extra details, confirmations and sign-up forms.", tag: "p" } },
        { type: "button", box: { w: 140, h: 44 }, props: { label: "Close" }, events: { click: [{ type: "closeDialog" }] } },
      ],
    }),
  },
  {
    id: "menu",
    label: "Navigation menu",
    icon: "Menu",
    category: "Layout",
    keywords: "navbar links pages header",
    hint: "Links to your pages",
    spec: () => ({ type: "menu", box: { w: 420, h: 44 } }),
  },
  // Forms
  {
    id: "form",
    label: "Form",
    icon: "ClipboardList",
    category: "Forms",
    keywords: "contact signup survey submit",
    hint: "Collects answers and saves them",
    spec: () => ({
      type: "form",
      box: { w: 420, h: 330 },
      style: { fill: { type: "solid", color: "$surface" }, radius: 18 },
      children: [
        input("text", { label: "Your name", name: "Name", placeholder: "Jane Doe" }),
        input("email", { label: "Email", name: "Email", placeholder: "jane@example.com", required: true }),
        { type: "button", box: { w: 372, h: 48 }, sizing: { w: "fill", h: "fixed" }, props: { label: "Submit", submit: true } as ElementProps },
      ],
    }),
  },
  { id: "input-text", label: "Text field", icon: "TextCursorInput", category: "Forms", keywords: "input name", spec: () => input("text", { label: "Your name", name: "Name", placeholder: "Jane Doe" }) },
  { id: "input-email", label: "Email field", icon: "Mail", category: "Forms", spec: () => input("email", { label: "Email", name: "Email", placeholder: "you@example.com" }) },
  { id: "input-textarea", label: "Text area", icon: "AlignLeft", category: "Forms", keywords: "message long", spec: () => input("textarea", { label: "Message", name: "Message", placeholder: "Write something…" }, 150) },
  { id: "input-number", label: "Number field", icon: "Hash", category: "Forms", spec: () => input("number", { label: "Quantity", name: "Quantity", placeholder: "0" }) },
  { id: "input-phone", label: "Phone field", icon: "Phone", category: "Forms", spec: () => input("phone", { label: "Phone", name: "Phone", placeholder: "+1 555 000 0000" }) },
  { id: "input-password", label: "Password", icon: "KeyRound", category: "Forms", spec: () => input("password", { label: "Password", name: "Password", placeholder: "••••••••" }) },
  { id: "input-select", label: "Dropdown", icon: "ChevronsUpDown", category: "Forms", keywords: "select options", spec: () => input("select", { label: "Choose one", name: "Choice", options: ["Option 1", "Option 2", "Option 3"], placeholder: "Select…" }) },
  { id: "input-radio", label: "Radio buttons", icon: "CircleDot", category: "Forms", keywords: "single choice", spec: () => input("radio", { label: "Pick one", name: "Pick", options: ["Yes", "No", "Maybe"] }, 124) },
  { id: "input-checkbox", label: "Checkboxes", icon: "ListChecks", category: "Forms", keywords: "multiple choice", spec: () => input("checkbox", { label: "Interests", name: "Interests", options: ["Design", "Code", "Marketing"] }, 124) },
  { id: "input-toggle", label: "Toggle switch", icon: "ToggleRight", category: "Forms", keywords: "switch boolean yes no", spec: () => input("toggle", { label: "Subscribe to updates", name: "Subscribe" }, 40) },
  { id: "input-date", label: "Date picker", icon: "Calendar", category: "Forms", keywords: "calendar day booking", spec: () => input("date", { label: "Date", name: "Date" }) },
  { id: "input-time", label: "Time picker", icon: "Clock", category: "Forms", keywords: "hour booking", spec: () => input("time", { label: "Time", name: "Time" }) },
  { id: "input-range", label: "Slider", icon: "SlidersHorizontal", category: "Forms", keywords: "range", spec: () => input("range", { label: "Budget", name: "Budget", min: 0, max: 100, step: 1, defaultValue: "50" }, 64) },
  { id: "input-rating", label: "Star rating", icon: "Star", category: "Forms", keywords: "review score", spec: () => input("rating", { label: "Your rating", name: "Rating" }, 70) },
  { id: "input-file", label: "File upload", icon: "Upload", category: "Forms", keywords: "attachment image upload", spec: () => input("file", { label: "Upload a file", name: "Attachment" }, 96) },
  { id: "submit", label: "Submit button", icon: "Send", category: "Forms", keywords: "send save", spec: () => ({ type: "button", box: { w: 200, h: 48 }, props: { label: "Submit", icon: "Send", iconPos: "right", submit: true } as ElementProps }) },
  // Data
  {
    id: "list",
    label: "Repeating list",
    icon: "LayoutList",
    category: "Data",
    keywords: "collection cards records gallery repeat",
    hint: "Shows a card for every record",
    spec: () => ({
      type: "list",
      box: { w: 840, h: 420 },
      children: [
        {
          type: "box",
          name: "ItemCard",
          box: { w: 260, h: 150 },
          style: { fill: { type: "solid", color: "$surface" }, radius: 16, borderWidth: 1, borderColor: "$border" },
          props: { layout: { ...DEFAULT_LAYOUT, mode: "column", gap: 8, padding: 18 } },
          children: [
            { type: "text", box: { w: 220, h: 28 }, sizing: { w: "fill", h: "hug" }, props: { text: "{{record.id}}", tag: "h3" } },
            { type: "text", box: { w: 220, h: 20 }, sizing: { w: "fill", h: "hug" }, style: { color: "$muted" }, props: { text: "Added {{record.createdAt | date}}", tag: "small" } },
          ],
        },
      ],
    }),
  },
  { id: "table", label: "Table", icon: "Table", category: "Data", keywords: "spreadsheet grid records rows", hint: "Rows and columns from a collection", spec: () => ({ type: "table", box: { w: 760, h: 380 } }) },
  { id: "stat", label: "Stat card", icon: "Gauge", category: "Data", keywords: "metric count total kpi number", hint: "Counts or sums records", spec: () => ({ type: "stat", box: { w: 230, h: 116 } }) },
  { id: "chart-bar", label: "Bar chart", icon: "ChartColumn", category: "Data", keywords: "graph", spec: () => ({ type: "chart", box: { w: 520, h: 320 }, props: { chartType: "bar" } }) },
  { id: "chart-line", label: "Line chart", icon: "ChartLine", category: "Data", keywords: "graph trend", spec: () => ({ type: "chart", box: { w: 520, h: 320 }, props: { chartType: "line" } }) },
  { id: "chart-pie", label: "Pie chart", icon: "ChartPie", category: "Data", keywords: "graph donut", spec: () => ({ type: "chart", box: { w: 360, h: 320 }, props: { chartType: "donut" } }) },
  // Media
  { id: "video", label: "Video", icon: "Youtube", category: "Media", keywords: "youtube vimeo mp4", spec: () => ({ type: "video", box: { w: 480, h: 270 } }) },
  { id: "map", label: "Map", icon: "MapPin", category: "Media", keywords: "location address google", spec: () => ({ type: "map", box: { w: 480, h: 300 } }) },
  { id: "embed", label: "Website embed", icon: "Globe", category: "Media", keywords: "iframe embed", spec: () => ({ type: "embed", box: { w: 480, h: 320 } }) },
];

export const CATALOG_CATEGORIES: CatalogCategory[] = ["Text", "Basics", "Layout", "Forms", "Data", "Shapes", "Media"];
