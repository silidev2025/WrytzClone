/*
 * The app document model shared by the editor, the runtime renderer and the server.
 *
 * An app is a list of pages. Each page holds a flat map of elements (like Figma's node
 * map): top-level elements are listed in `rootIds`, containers list their children in
 * `childIds`. Positions are stored per breakpoint: the base box is the Desktop layout and
 * Tablet/Mobile keep optional overrides (see lib/shared/layout.ts for inheritance rules).
 */

/**
 * Layouts are designed for two breakpoints. Tablets get the desktop layout scaled to fit;
 * phones get the mobile layout (auto-arranged until it is edited by hand).
 */
export type Breakpoint = "desktop" | "mobile";
export const BREAKPOINTS: Breakpoint[] = ["desktop", "mobile"];
export const FRAME_WIDTH: Record<Breakpoint, number> = { desktop: 1280, mobile: 390 };

/** Device sizes offered in Preview. */
export type DeviceMode = "desktop" | "tablet" | "mobile";
export const DEVICE_WIDTH: Record<DeviceMode, number> = { desktop: 1280, tablet: 820, mobile: 390 };
/** Viewports narrower than this use the mobile layout. */
export const MOBILE_BREAKPOINT = 1100;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  /** rotation in degrees */
  r?: number;
}

/** Mobile position/size overrides (see layout.ts for how missing values are resolved). */
export interface BoxOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  fontSize?: number;
}

export type SizeMode = "fixed" | "hug" | "fill";

/* ------------------------------------------------------------------ styles */

export interface GradientStop {
  color: string;
  at: number; // 0-100
}

export type Fill =
  | { type: "none" }
  | { type: "solid"; color: string }
  | { type: "gradient"; kind: "linear" | "radial"; angle: number; stops: GradientStop[] }
  | {
      type: "image";
      src: string;
      fit: "cover" | "contain" | "tile";
      position?: string;
      /** optional colour laid over the image, e.g. rgba(0,0,0,.4) for readable text */
      overlay?: string;
    };

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset?: boolean;
}

export interface ImageFilters {
  brightness?: number; // 100 = unchanged
  contrast?: number;
  saturate?: number;
  grayscale?: number; // 0-100
  sepia?: number;
  hue?: number; // degrees
  blur?: number; // px
}

export interface HoverStyle {
  fill?: Fill;
  color?: string;
  borderColor?: string;
  scale?: number;
  lift?: boolean;
  opacity?: number;
}

export type AnimationName =
  | "none"
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "pop"
  | "bounce"
  | "rotate"
  | "blur-in";

export interface Animation {
  name: AnimationName;
  duration: number; // ms
  delay: number; // ms
  /** "load" plays when the page opens, "scroll" when the element scrolls into view */
  trigger: "load" | "scroll";
  loop?: boolean;
}

/**
 * Colours are CSS colours ("#7c5cff", "rgba(...)", "transparent") or theme tokens
 * ("$primary", "$text" ...) that follow the app theme. Missing values fall back to
 * sensible per-element defaults that also follow the theme.
 */
export interface Style {
  fill?: Fill;
  color?: string;
  fontFamily?: string; // font name or "$heading" / "$body"
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  textAlign?: "left" | "center" | "right" | "justify";
  verticalAlign?: "top" | "middle" | "bottom";
  lineHeight?: number; // multiplier
  letterSpacing?: number; // px
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textShadow?: Shadow | null;
  textStroke?: { width: number; color: string } | null;
  textHighlight?: string | null;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: "solid" | "dashed" | "dotted";
  radius?: number;
  /** per-corner radius: top-left, top-right, bottom-right, bottom-left */
  radii?: [number, number, number, number] | null;
  shadow?: Shadow | null;
  opacity?: number; // 0-1
  blur?: number; // layer blur px
  backdropBlur?: number; // frosted glass px
  filters?: ImageFilters;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  overflow?: "visible" | "hidden" | "scroll";
  hover?: HoverStyle | null;
  animation?: Animation | null;
  cursor?: "auto" | "pointer";
}

/* ------------------------------------------------------------------ actions */

export type ConditionOp =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "greater"
  | "less"
  | "greaterOrEqual"
  | "lessOrEqual"
  | "isEmpty"
  | "isNotEmpty"
  | "isTrue"
  | "isFalse";

export interface Condition {
  left: string;
  op: ConditionOp;
  right?: string;
}

/** Values are templates: plain text with {{bindings}}. */
export type FieldMapping = Record<string, string>; // field name -> template

export type ActionType =
  | "navigate"
  | "goBack"
  | "openUrl"
  | "notify"
  | "setVisibility"
  | "openDialog"
  | "closeDialog"
  | "setVariable"
  | "setProperty"
  | "validateForm"
  | "submitForm"
  | "resetForm"
  | "createRecord"
  | "updateRecord"
  | "deleteRecord"
  | "adjustNumber"
  | "habitCheckIn"
  | "transaction"
  | "refreshData"
  | "setTab"
  | "scrollTo"
  | "copyText"
  | "signIn"
  | "signOut"
  | "wait";

export interface TransactionStep {
  id: string;
  kind: "create" | "update" | "delete" | "adjust";
  collectionId: string;
  recordId?: string;
  mapping?: FieldMapping;
  fieldName?: string;
  amount?: string;
  min?: string;
}

export interface Action {
  id: string;
  type: ActionType;
  condition?: Condition | null;
  // navigation
  pageId?: string;
  recordId?: string; // template; for navigate = record to open on a detail page
  url?: string;
  newTab?: boolean;
  // feedback
  message?: string;
  tone?: "success" | "info" | "error";
  // visibility / dialogs / tabs / properties
  targetId?: string;
  mode?: "show" | "hide" | "toggle";
  property?: string;
  value?: string;
  tabIndex?: number;
  // variables
  variable?: string;
  op?: "set" | "add" | "subtract" | "multiply" | "divide" | "toggle" | "append";
  // forms + data
  formId?: string;
  collectionId?: string;
  mapping?: FieldMapping;
  resetAfter?: boolean;
  saveIdTo?: string;
  fieldName?: string;
  amount?: string;
  min?: string;
  confirmText?: string;
  steps?: TransactionStep[];
  // misc
  text?: string;
  ms?: number;
}

export type EventName = "click" | "change" | "submit" | "rowClick";

/* ------------------------------------------------------------------ elements */

export type ElementType =
  | "text"
  | "button"
  | "image"
  | "icon"
  | "shape"
  | "line"
  | "video"
  | "map"
  | "embed"
  | "input"
  | "box"
  | "form"
  | "list"
  | "table"
  | "menu"
  | "tabs"
  | "dialog"
  | "progress"
  | "stat"
  | "chart"
  | "countdown";

export const CONTAINER_TYPES: ElementType[] = ["box", "form", "list", "tabs", "dialog"];

export type LayoutMode = "free" | "row" | "column" | "grid";

export interface ContainerLayout {
  mode: LayoutMode;
  gap: number;
  padding: number;
  align: "start" | "center" | "end" | "stretch";
  justify: "start" | "center" | "end" | "between" | "around";
  wrap: boolean;
  columns: number; // grid only
  /** grid columns on phones (default 1) */
  mobileColumns?: number;
}

export type InputType =
  | "text"
  | "email"
  | "number"
  | "phone"
  | "password"
  | "url"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "toggle"
  | "date"
  | "time"
  | "datetime"
  | "range"
  | "file"
  | "rating"
  | "color";

export type FilterOp =
  | "equals"
  | "notEquals"
  | "contains"
  | "greater"
  | "less"
  | "isEmpty"
  | "isNotEmpty"
  | "isTrue"
  | "isFalse"
  | "mine";

export interface DataFilter {
  field: string; // field name, or "createdBy" for "mine"
  op: FilterOp;
  value?: string; // template
}

export interface DataQuery {
  collectionId?: string;
  filters?: DataFilter[];
  sortField?: string; // field name or "createdAt"
  sortDir?: "asc" | "desc";
  pageSize?: number;
  search?: boolean;
  searchPlaceholder?: string;
}

export interface MenuItem {
  id: string;
  label: string;
  pageId?: string;
  url?: string;
  icon?: string;
}

export interface TabItem {
  id: string;
  label: string;
}

export interface TableColumn {
  field: string;
  label?: string;
  width?: number;
}

/** Everything type specific lives in props. Unused keys are simply absent. */
export interface ElementProps {
  /** Accessible purpose for controls without a visible label. */
  ariaLabel?: string;
  // text-ish
  text?: string;
  tag?: "h1" | "h2" | "h3" | "p" | "small";
  link?: { pageId?: string; url?: string; newTab?: boolean } | null;
  // button
  label?: string;
  icon?: string;
  iconPos?: "left" | "right";
  variant?: string;
  /** inside a form: clicking submits the form */
  submit?: boolean;
  // image
  src?: string;
  alt?: string;
  fit?: "cover" | "contain";
  focusX?: number;
  focusY?: number;
  zoom?: number;
  mask?: "none" | "circle" | "rounded" | "blob" | "hexagon" | "star" | "arch" | "diamond" | "heart";
  // icon
  strokeWidth?: number;
  // shape
  shape?: ShapeKind;
  // line
  thickness?: number;
  dash?: "solid" | "dashed" | "dotted";
  arrowEnd?: boolean;
  // media
  url?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  address?: string;
  mapZoom?: number;
  // input
  inputType?: InputType;
  name?: string; // field name when saved to a collection
  placeholder?: string;
  showLabel?: boolean;
  required?: boolean;
  options?: string[];
  optionsFrom?: { collectionId: string; field: string } | null;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: string;
  helpText?: string;
  inputStyle?: "box" | "line" | "filled" | "none";
  // containers
  layout?: ContainerLayout;
  collectionId?: string; // form target / data components
  successMessage?: string;
  query?: DataQuery;
  emptyText?: string;
  // table
  columns?: TableColumn[];
  striped?: boolean;
  // menu / tabs
  items?: MenuItem[];
  tabs?: TabItem[];
  activeTab?: number;
  orientation?: "horizontal" | "vertical";
  /** menu: show an icon next to each label (tab bars always do) */
  showIcons?: boolean;
  // dialog
  title?: string;
  closeOnBackdrop?: boolean;
  // progress / stat / chart
  value?: string;
  maxValue?: string;
  showValue?: boolean;
  aggregate?: "count" | "sum" | "avg" | "min" | "max";
  field?: string; // value field for sum/avg/...
  groupBy?: string;
  chartType?: "bar" | "line" | "area" | "pie" | "donut";
  dataSource?: "collection" | "manual";
  manualData?: string; // "Label: value" lines
  prefix?: string;
  suffix?: string;
  decimals?: number;
  showLegend?: boolean;
  // countdown
  target?: string;
  doneText?: string;
}

export type ShapeKind =
  | "rect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star"
  | "heart"
  | "arrow"
  | "blob"
  | "speech"
  | "cross"
  | "wave"
  | "arch";

export interface El {
  id: string;
  type: ElementType;
  /** Layer name. Also the name used in bindings such as {{Email.value}}. */
  name: string;
  parentId: string | null;
  childIds?: string[];
  box: Box;
  responsive?: { mobile?: BoxOverride };
  sizing?: { w: SizeMode; h: SizeMode };
  style: Style;
  props: ElementProps;
  events?: Partial<Record<EventName, Action[]>>;
  locked?: boolean;
  /** Hidden layer (the eye icon in Layers): not shown anywhere. */
  hidden?: boolean;
  /** Show only on some devices. */
  hideOn?: { desktop?: boolean; mobile?: boolean };
  /** Stays on screen while the page scrolls (headers, tab bars). Top-level elements only. */
  pin?: "top" | "bottom";
  /** Hidden until an action shows it (runtime only). */
  startHidden?: boolean;
}

/* ------------------------------------------------------------------ pages & app */

export type PageAccess = "public" | "users" | "admins";

export interface Page {
  id: string;
  name: string;
  /** URL segment, "" for the home page */
  path: string;
  access: PageAccess;
  background: Fill;
  /** desktop frame height */
  height: number;
  heights?: { mobile?: number };
  /** true once the mobile layout was edited by hand; before that it is auto-arranged */
  mobileCustom?: boolean;
  elements: Record<string, El>;
  rootIds: string[];
  onLoad?: Action[];
  /** When set, this page shows a single record of that collection (id from the URL). */
  recordCollectionId?: string;
  title?: string;
  /** icon shown for this page in tab bars */
  icon?: string;
  /** leave this page out of automatic menus (thank-you pages, steps of a flow) */
  hideInNav?: boolean;
  /** A success page requires a reference created by this browser's submission. */
  confirmationVariable?: string;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}

export interface Theme {
  colors: ThemeColors;
  headingFont: string;
  bodyFont: string;
  radius: number;
  buttonStyle: "filled" | "soft" | "outline" | "pill";
}

export type VariableType = "text" | "number" | "boolean";

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  initial: string;
  /** keep the value in the visitor's browser between visits */
  persist?: boolean;
}

export interface AppDoc {
  schemaVersion: 1;
  pages: Page[];
  homePageId: string;
  theme: Theme;
  variables: Variable[];
  settings: {
    showBadge?: boolean;
    /** "mobile" apps are designed on one phone-sized canvas and install like a phone app */
    kind?: AppKind;
  };
}

export type AppKind = "website" | "mobile";

/* ------------------------------------------------------------------ data */

export type FieldType =
  | "text"
  | "longText"
  | "number"
  | "currency"
  | "boolean"
  | "date"
  | "datetime"
  | "time"
  | "email"
  | "phone"
  | "url"
  | "select"
  | "multiSelect"
  | "image"
  | "file"
  | "reference"
  | "rating";

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  defaultValue?: string;
  options?: string[];
  refCollectionId?: string;
  currency?: string;
  min?: number;
  max?: number;
  /** hidden from visitors unless they are admins or created the record */
  private?: boolean;
  /** only admins can set or change it (e.g. an order's status); visitors get the default */
  locked?: boolean;
  /** number fields: people with the collection's "+/−" permission may add or take away 1 */
  counter?: boolean;
  description?: string;
  width?: number;
}

/**
 * Server-side stock keeping for order-like collections: every new row takes its quantity
 * from a linked record's stock (refused when there isn't enough) and can copy the price.
 */
export interface StockRule {
  /** link-to-record field in this collection (e.g. "Product") */
  refField: string;
  /** number field in this collection (e.g. "Quantity") */
  qtyField: string;
  /** number field on the linked record (e.g. "Stock") */
  stockField: string;
  /** money field on the linked record to copy (e.g. "Price") */
  priceField?: string;
  /** where the copied price goes in this collection (e.g. "Unit price") */
  unitPriceField?: string;
  /** where price × quantity goes in this collection (e.g. "Total") */
  totalField?: string;
}

export type ReadLevel = "anyone" | "users" | "owner" | "admins";
export type WriteLevel = "anyone" | "users" | "owner" | "admins";

export interface CollectionAccess {
  read: ReadLevel;
  create: "anyone" | "users" | "admins";
  update: WriteLevel;
  delete: WriteLevel;
  /**
   * Who may add to / subtract from number fields (votes, likes, stock) without being able
   * to edit anything else. Defaults to the update rule.
   */
  adjust?: WriteLevel;
}

export interface Collection {
  id: string;
  appId: string;
  name: string;
  icon?: string;
  fields: Field[];
  access: CollectionAccess;
  stock?: StockRule;
  createdAt: string;
  updatedAt: string;
}

export interface RecordDoc {
  id: string;
  appId: string;
  collectionId: string;
  data: Record<string, unknown>; // keyed by field id
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

/** Records as the runtime sees them: keyed by field *name*. */
export interface RuntimeRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  [field: string]: unknown;
}

/* ------------------------------------------------------------------ server-side docs */

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  avatarColor: string;
  createdAt: string;
  bio?: string;
  /** which version of the terms and privacy notice they accepted, and when */
  termsVersion?: string;
  termsAcceptedAt?: string;
  /** bumped whenever the password changes, to tell apart old and new sessions */
  passwordChangedAt?: string;
  /** Fences writes while an idempotent account-deletion job completes. */
  deletingAt?: string;
  /** set by the site's operators: the account can't sign in until they lift it */
  suspended?: { at: string; reason: string };
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  bio?: string;
}

export interface AppMeta {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  templateId?: string;
  /** account ids of people who accepted an admin invite (never emails: an address proves nothing) */
  adminIds: string[];
  /** the subset of adminIds who may also edit the design and database in the builder */
  editorIds?: string[];
  published: null | {
    slug: string;
    at: string;
    explore: boolean;
    /** Explicit consent to sharing restricted page designs and collection schemas. */
    exploreConsentAt?: string;
    description: string;
    revision: number;
  };
  stats: { visits: number; submissions: number; daily?: Record<string, { v: number; s: number }> };
  remixedFrom?: string;
  kind?: AppKind;
  /** taken offline by the site's operators: can't be published again until they allow it */
  takenDown?: { at: string; reason: string; bySuspension?: boolean };
}

export interface AppVersion {
  id: string;
  appId: string;
  label: string;
  createdAt: string;
  doc: AppDoc;
}

export interface MediaItem {
  id: string;
  ownerId: string;
  appId: string | null;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  /** design images (made in the editor) are public; files visitors attach to records are not */
  public: boolean;
  /** attachments: the collection and field they were uploaded for, and the record once saved */
  collectionId?: string;
  fieldId?: string;
  recordId?: string;
  /** attachments: the account that uploaded it (null for someone not signed in) */
  uploaderId?: string | null;
  width?: number;
  height?: number;
  /** Reserved quota, but not yet safe to serve; expired reservations are cleaned up. */
  pending?: boolean;
}
