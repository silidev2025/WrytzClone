import type { Condition, ConditionOp } from "./types";
import { isEmptyValue } from "./fields";
import { formatCurrency, formatDate, formatNumber, formatTime, localDateKey } from "./util";

/*
 * Bindings are written as {{path}} inside any text. Paths start with a root:
 *   vars.counter           app variables
 *   form.email             the value of the input named "email" in the current form
 *   record.title           the current record (inside a list, table row or detail page)
 *   user.name / user.email / user.signedIn / user.isAdmin
 *   page.params.id / page.name
 *   app.name
 *   now.date / now.time / now.year
 *   Email.value            any component by its layer name (.value .checked .text .visible ...)
 * Optional formatters follow a pipe: {{record.price | currency}}, {{record.date | date}}.
 * Nothing here ever executes user code — it's a plain lookup.
 */

export interface EvalUser {
  id: string;
  name: string;
  email: string;
  signedIn: boolean;
  isAdmin: boolean;
}

export interface EvalContext {
  vars?: Record<string, unknown>;
  form?: Record<string, unknown>;
  record?: Record<string, unknown> | null;
  user?: EvalUser | null;
  page?: { name: string; path: string; params: Record<string, string> };
  app?: { name: string };
  components?: Record<string, Record<string, unknown>>;
  steps?: Record<string, unknown>[];
  /** last action result, e.g. the id of a newly created record */
  result?: unknown;
  /** Optional display formatter for record fields (dates, money ...). */
  formatRecordField?: (field: string, value: unknown) => string | undefined;
}

const BINDING_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;
const SINGLE_BINDING_RE = /^\{\{\s*([^{}]+?)\s*\}\}$/;

export function hasBindings(text: string | undefined | null): boolean {
  if (!text) return false;
  BINDING_RE.lastIndex = 0;
  return BINDING_RE.test(text);
}

function lookupCaseInsensitive(obj: Record<string, unknown> | undefined | null, key: string): unknown {
  if (!obj) return undefined;
  if (key in obj) return obj[key];
  const lower = key.toLowerCase();
  for (const k of Object.keys(obj)) if (k.toLowerCase() === lower) return obj[k];
  return undefined;
}

function dig(value: unknown, parts: string[]): unknown {
  let cur = value;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      if (p === "length" || p === "count") return cur.length;
      const idx = Number(p);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
      continue;
    }
    if (typeof cur === "object") cur = lookupCaseInsensitive(cur as Record<string, unknown>, p);
    else if (typeof cur === "string" && (p === "length" || p === "count")) return cur.length;
    else return undefined;
  }
  return cur;
}

function nowValue(key: string | undefined): unknown {
  const d = new Date();
  switch ((key || "").toLowerCase()) {
    case "time":
      return formatTime(d.toTimeString().slice(0, 5));
    case "year":
      return d.getFullYear();
    case "iso":
      return d.toISOString();
    case "today":
      return localDateKey(d);
    case "day":
      return d.toLocaleDateString(undefined, { weekday: "long" });
    case "month":
      return d.toLocaleDateString(undefined, { month: "long" });
    default:
      return formatDate(localDateKey(d));
  }
}

/** Resolve a dotted path (without braces / formatters) to a raw value. */
export function resolvePath(path: string, ctx: EvalContext): unknown {
  const parts = path
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return undefined;
  const [root, ...rest] = parts;
  switch (root.toLowerCase()) {
    case "vars":
    case "var":
    case "variables":
      return dig(ctx.vars, rest);
    case "form":
      return dig(ctx.form, rest);
    case "record":
    case "item":
      return dig(ctx.record, rest);
    case "user":
      if (!ctx.user) return rest[0]?.toLowerCase() === "signedin" ? false : undefined;
      return dig(ctx.user, rest);
    case "page":
      return dig(ctx.page, rest);
    case "app":
      return dig(ctx.app, rest);
    case "now":
    case "today":
      return nowValue(rest[0]);
    case "steps":
      return dig(ctx.steps, rest);
    case "result":
      return rest.length ? dig(ctx.result, rest) : ctx.result;
    default: {
      const comp = lookupCaseInsensitive(ctx.components, root) as Record<string, unknown> | undefined;
      if (comp === undefined) return undefined;
      if (!rest.length) return comp.value ?? comp.text;
      return dig(comp, rest);
    }
  }
}

function applyFormatter(value: unknown, formatter: string, ctx: EvalContext): unknown {
  const [nameRaw, ...argParts] = formatter.split(":");
  const name = nameRaw.trim().toLowerCase();
  const arg = argParts.join(":").trim().replace(/^['"]|['"]$/g, "");
  const str = value === null || value === undefined ? "" : Array.isArray(value) ? value.join(", ") : String(value);
  switch (name) {
    case "upper":
    case "uppercase":
      return str.toUpperCase();
    case "lower":
    case "lowercase":
      return str.toLowerCase();
    case "capitalize":
    case "title":
      return str.replace(/\b\w/g, (c) => c.toUpperCase());
    case "date":
      return formatDate(str);
    case "datetime":
      return formatDate(str, true);
    case "time":
      return formatTime(str);
    case "currency":
    case "money":
      if (str === "" || !Number.isFinite(Number(str))) return "";
      if (arg.startsWith("record.")) return ctx.formatRecordField?.(arg.slice(7), Number(str)) ?? formatCurrency(Number(str));
      return formatCurrency(Number(str), arg || "USD");
    case "multiply": {
      const factor = /^-?\d+(\.\d+)?$/.test(arg) ? Number(arg) : resolvePath(arg, ctx);
      return str !== "" && factor !== undefined && factor !== null && factor !== "" && Number.isFinite(Number(value)) && Number.isFinite(Number(factor)) ? Number(value) * Number(factor) : "";
    }
    case "number":
      return str === "" ? "" : formatNumber(Number(str), arg ? Number(arg) : undefined);
    case "round":
      return str === "" ? "" : String(Math.round(Number(str)));
    case "length":
    case "count":
      return Array.isArray(value) ? value.length : str.length;
    case "default":
      return isEmptyValue(value) ? arg : value;
    case "truncate": {
      const n = Number(arg) || 60;
      return str.length > n ? str.slice(0, n).trimEnd() + "…" : str;
    }
    case "yesno":
      return truthy(value) ? "Yes" : "No";
    default:
      return value;
  }
}

function evaluateExpression(expr: string, ctx: EvalContext): unknown {
  const [path, ...formatters] = expr.split("|");
  const trimmed = path.trim();
  let value: unknown;
  // literals are handy in conditions and defaults
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) value = Number(trimmed);
  else if (/^(true|false)$/i.test(trimmed)) value = trimmed.toLowerCase() === "true";
  else if (/^(["']).*\1$/.test(trimmed)) value = trimmed.slice(1, -1);
  else value = resolvePath(trimmed, ctx);
  for (const f of formatters) value = applyFormatter(value, f, ctx);
  return value;
}

function toDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(toDisplay).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  if (typeof value === "object") return "";
  return String(value);
}

/** Replace every {{binding}} in a text with its display value. */
export function interpolate(template: string | undefined | null, ctx: EvalContext): string {
  if (!template) return "";
  if (template.indexOf("{{") === -1) return template;
  return template.replace(BINDING_RE, (_, expr: string) => {
    const [path, ...formatters] = expr.split("|");
    const p = path.trim();
    const raw = evaluateExpression(expr, ctx);
    if (!formatters.length && /^(record|item)\./i.test(p) && ctx.formatRecordField) {
      const field = p.split(".").slice(1).join(".");
      const formatted = ctx.formatRecordField(field, raw);
      if (formatted !== undefined) return formatted;
    }
    return toDisplay(raw);
  });
}

/**
 * Like interpolate, but when the whole template is one binding the raw value is returned
 * (so numbers stay numbers and booleans stay booleans).
 */
export function evaluate(template: string | undefined | null, ctx: EvalContext): unknown {
  if (template === undefined || template === null) return undefined;
  const single = template.trim().match(SINGLE_BINDING_RE);
  if (single) return evaluateExpression(single[1], ctx);
  return interpolate(template, ctx);
}

export function truthy(v: unknown): boolean {
  if (typeof v === "string") return /^(true|yes|y|1|on|checked)$/i.test(v.trim());
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asTime(v: unknown): number | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

export function compareValues(left: unknown, op: ConditionOp, right: unknown): boolean {
  switch (op) {
    case "isEmpty":
      return isEmptyValue(left);
    case "isNotEmpty":
      return !isEmptyValue(left);
    case "isTrue":
      return truthy(left);
    case "isFalse":
      return !truthy(left);
    case "contains":
    case "notContains": {
      const needle = toDisplay(right).toLowerCase();
      const has = Array.isArray(left)
        ? left.some((x) => toDisplay(x).toLowerCase() === needle)
        : toDisplay(left).toLowerCase().includes(needle);
      return op === "contains" ? has : !has;
    }
    case "equals":
    case "notEquals": {
      let eq: boolean;
      const ln = asNumber(left);
      const rn = asNumber(right);
      if (typeof left === "boolean" || typeof right === "boolean") eq = truthy(left) === truthy(right);
      else if (ln !== null && rn !== null) eq = ln === rn;
      else eq = toDisplay(left).trim().toLowerCase() === toDisplay(right).trim().toLowerCase();
      return op === "equals" ? eq : !eq;
    }
    default: {
      const lt = asTime(left);
      const rt = asTime(right);
      const ln = lt ?? asNumber(left);
      const rn = rt ?? asNumber(right);
      if (ln === null || rn === null) {
        const ls = toDisplay(left);
        const rs = toDisplay(right);
        const c = ls.localeCompare(rs);
        if (op === "greater") return c > 0;
        if (op === "less") return c < 0;
        if (op === "greaterOrEqual") return c >= 0;
        return c <= 0;
      }
      if (op === "greater") return ln > rn;
      if (op === "less") return ln < rn;
      if (op === "greaterOrEqual") return ln >= rn;
      return ln <= rn;
    }
  }
}

export function evalCondition(cond: Condition | null | undefined, ctx: EvalContext): boolean {
  if (!cond) return true;
  const left = evaluate(cond.left, ctx);
  const right = cond.right !== undefined ? evaluate(cond.right, ctx) : undefined;
  return compareValues(left, cond.op, right);
}

export const CONDITION_OPS: { op: ConditionOp; label: string; needsRight: boolean }[] = [
  { op: "equals", label: "is", needsRight: true },
  { op: "notEquals", label: "is not", needsRight: true },
  { op: "contains", label: "contains", needsRight: true },
  { op: "notContains", label: "doesn't contain", needsRight: true },
  { op: "greater", label: "is greater than", needsRight: true },
  { op: "less", label: "is less than", needsRight: true },
  { op: "greaterOrEqual", label: "is at least", needsRight: true },
  { op: "lessOrEqual", label: "is at most", needsRight: true },
  { op: "isEmpty", label: "is empty", needsRight: false },
  { op: "isNotEmpty", label: "is not empty", needsRight: false },
  { op: "isTrue", label: "is true / checked", needsRight: false },
  { op: "isFalse", label: "is false / unchecked", needsRight: false },
];

export const FORMATTERS: { id: string; label: string }[] = [
  { id: "upper", label: "UPPERCASE" },
  { id: "lower", label: "lowercase" },
  { id: "capitalize", label: "Capitalize" },
  { id: "date", label: "Date" },
  { id: "datetime", label: "Date & time" },
  { id: "time", label: "Time" },
  { id: "currency", label: "Money" },
  { id: "number", label: "Number" },
  { id: "round", label: "Round" },
  { id: "count", label: "Count / length" },
  { id: "truncate:60", label: "Shorten" },
  { id: "yesno", label: "Yes / No" },
];
