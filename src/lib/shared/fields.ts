import type { CollectionAccess, Field, FieldType } from "./types";
import { formatCurrency, formatDate, formatNumber, formatTime, localDateKey, safeImageSrc, safeUrl } from "./util";

export interface FieldTypeInfo {
  type: FieldType;
  label: string;
  icon: string; // lucide icon name
  color: string;
  hint: string;
}

export const FIELD_TYPES: FieldTypeInfo[] = [
  { type: "text", label: "Text", icon: "Type", color: "#2f7d65", hint: "Short text such as a name or title" },
  { type: "longText", label: "Long text", icon: "AlignLeft", color: "#2f7d65", hint: "Paragraphs, notes, descriptions" },
  { type: "number", label: "Number", icon: "Hash", color: "#5f64b8", hint: "Quantities, scores, ages" },
  { type: "currency", label: "Money", icon: "DollarSign", color: "#5f64b8", hint: "Prices and amounts" },
  { type: "boolean", label: "Yes / No", icon: "ToggleRight", color: "#a5622d", hint: "A checkbox that is on or off" },
  { type: "date", label: "Date", icon: "Calendar", color: "#b14862", hint: "A calendar day" },
  { type: "datetime", label: "Date & time", icon: "CalendarClock", color: "#b14862", hint: "A day and a time" },
  { type: "time", label: "Time", icon: "Clock", color: "#b14862", hint: "A time of day" },
  { type: "email", label: "Email", icon: "AtSign", color: "#377da1", hint: "Validated email address" },
  { type: "phone", label: "Phone", icon: "Phone", color: "#377da1", hint: "Phone number" },
  { type: "url", label: "Link", icon: "Link", color: "#377da1", hint: "Website address" },
  { type: "select", label: "Single choice", icon: "CircleDot", color: "#8960a9", hint: "Pick one option from a list" },
  { type: "multiSelect", label: "Multiple choice", icon: "ListChecks", color: "#8960a9", hint: "Pick several options" },
  { type: "image", label: "Image", icon: "Image", color: "#8c6b27", hint: "Picture uploaded or linked" },
  { type: "file", label: "File", icon: "Paperclip", color: "#8c6b27", hint: "Document or attachment" },
  { type: "reference", label: "Link to record", icon: "Link2", color: "#3972a8", hint: "Connect to a record in another collection" },
  { type: "rating", label: "Rating", icon: "Star", color: "#a5622d", hint: "1 to 5 stars" },
];

export const FIELD_TYPE_MAP: Record<FieldType, FieldTypeInfo> = Object.fromEntries(
  FIELD_TYPES.map((f) => [f.type, f]),
) as Record<FieldType, FieldTypeInfo>;

/** New collections start private: nothing is public until the maker opens it up on purpose. */
export const PRIVATE_ACCESS: CollectionAccess = { read: "admins", create: "admins", update: "admins", delete: "admins" };
export const DEFAULT_ACCESS: CollectionAccess = PRIVATE_ACCESS;

export interface AccessPreset {
  id: string;
  label: string;
  description: string;
  access: CollectionAccess;
}

export const ACCESS_PRESETS: AccessPreset[] = [
  {
    id: "private",
    label: "Private",
    description: "Only you and your app admins can see, add or change rows. The safe starting point.",
    access: { ...PRIVATE_ACCESS },
  },
  {
    id: "public",
    label: "Public board",
    description: "Anyone can see and add rows, and use +1 on counter fields (votes). Only admins edit or delete.",
    access: { read: "anyone", create: "anyone", update: "admins", delete: "admins", adjust: "anyone" },
  },
  {
    id: "open",
    label: "Fully open",
    description: "Anyone can see, add, edit and delete. Great for quick prototypes.",
    access: { read: "anyone", create: "anyone", update: "anyone", delete: "anyone" },
  },
  {
    id: "inbox",
    label: "Private inbox",
    description: "Anyone can submit (like a contact form). Only admins can read.",
    access: { read: "admins", create: "anyone", update: "admins", delete: "admins" },
  },
  {
    id: "personal",
    label: "Personal data",
    description: "Signed-in users see and manage only their own rows.",
    access: { read: "owner", create: "users", update: "owner", delete: "owner" },
  },
  {
    id: "members",
    label: "Members community",
    description: "Signed-in users see everything and edit their own rows.",
    access: { read: "users", create: "users", update: "owner", delete: "owner" },
  },
  {
    id: "catalog",
    label: "Admin-managed content",
    description: "Everyone can view. Only admins add or change rows (products, posts). Anyone can use +1 on counter fields (likes).",
    access: { read: "anyone", create: "admins", update: "admins", delete: "admins", adjust: "anyone" },
  },
];

export const ACCESS_LABELS: Record<string, string> = {
  anyone: "Anyone",
  users: "Signed-in users",
  owner: "Only the person who added it",
  admins: "Admins only",
};

export function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type CoerceResult = { ok: true; value: unknown } | { ok: false; error: string };

/** Turn user input (from a form, the spreadsheet or CSV import) into a stored value. */
export function coerceFieldValue(field: Field, raw: unknown): CoerceResult {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  const str = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.join(", ") : String(raw);
  const trimmed = str.trim();
  switch (field.type) {
    case "text":
    case "phone":
      return { ok: true, value: trimmed.slice(0, 2000) || null };
    case "longText":
      return { ok: true, value: str.slice(0, 50000) || null };
    case "email":
      if (!trimmed) return { ok: true, value: null };
      if (!EMAIL_RE.test(trimmed)) return { ok: false, error: `${field.name} must be a valid email address` };
      return { ok: true, value: trimmed.toLowerCase() };
    case "url": {
      if (!trimmed) return { ok: true, value: null };
      const url = safeUrl(trimmed);
      if (!url) return { ok: false, error: `${field.name} must be a valid link` };
      return { ok: true, value: url };
    }
    case "number":
    case "currency":
    case "rating": {
      if (typeof raw === "number") return checkRange(field, raw);
      if (!trimmed) return { ok: true, value: null };
      const n = Number(trimmed.replace(/[,$€£¥\s]/g, ""));
      if (!Number.isFinite(n)) return { ok: false, error: `${field.name} must be a number` };
      return checkRange(field, n);
    }
    case "boolean": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      return { ok: true, value: /^(true|yes|y|1|on|checked|x)$/i.test(trimmed) };
    }
    case "date": {
      if (!trimmed) return { ok: true, value: null };
      const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return { ok: true, value: `${m[1]}-${m[2]}-${m[3]}` };
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) return { ok: false, error: `${field.name} must be a date` };
      return { ok: true, value: d.toISOString().slice(0, 10) };
    }
    case "datetime": {
      if (!trimmed) return { ok: true, value: null };
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) return { ok: false, error: `${field.name} must be a date and time` };
      return { ok: true, value: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed) ? trimmed : d.toISOString() };
    }
    case "time": {
      if (!trimmed) return { ok: true, value: null };
      const m = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
      if (!m) return { ok: false, error: `${field.name} must be a time like 14:30` };
      let h = Number(m[1]);
      if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0);
      if (h > 23 || Number(m[2]) > 59) return { ok: false, error: `${field.name} must be a valid time` };
      return { ok: true, value: `${String(h).padStart(2, "0")}:${m[2]}` };
    }
    case "select": {
      if (!trimmed) return { ok: true, value: null };
      if (field.options?.length) {
        const match = field.options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
        if (!match) return { ok: false, error: `${field.name} must be one of: ${field.options.join(", ")}` };
        return { ok: true, value: match };
      }
      return { ok: true, value: trimmed };
    }
    case "multiSelect": {
      const parts = (Array.isArray(raw) ? raw.map(String) : str.split(",")).map((s) => s.trim()).filter(Boolean);
      if (!field.options?.length) return { ok: true, value: parts };
      const valid = parts
        .map((p) => field.options!.find((o) => o.toLowerCase() === p.toLowerCase()))
        .filter((v): v is string => !!v);
      return { ok: true, value: Array.from(new Set(valid)) };
    }
    case "image": {
      if (!trimmed) return { ok: true, value: null };
      const src = safeImageSrc(trimmed);
      if (!src) return { ok: false, error: `${field.name} must be an image link or upload` };
      return { ok: true, value: src };
    }
    case "file": {
      if (!trimmed) return { ok: true, value: null };
      if (trimmed.startsWith("/api/media/")) return { ok: true, value: trimmed };
      const url = safeUrl(trimmed);
      if (!url) return { ok: false, error: `${field.name} must be a file link or upload` };
      return { ok: true, value: url };
    }
    case "reference":
      return { ok: true, value: trimmed || null };
    default:
      return { ok: true, value: trimmed };
  }
}

function checkRange(field: Field, n: number): CoerceResult {
  if (field.type === "rating") n = Math.max(0, Math.min(5, Math.round(n)));
  if (field.min !== undefined && field.min !== null && n < field.min)
    return { ok: false, error: `${field.name} must be at least ${field.min}` };
  if (field.max !== undefined && field.max !== null && n > field.max)
    return { ok: false, error: `${field.name} must be at most ${field.max}` };
  return { ok: true, value: n };
}

/** Human friendly text for a stored value. */
export function formatFieldValue(field: Pick<Field, "type" | "currency"> | undefined, value: unknown): string {
  if (isEmptyValue(value)) return "";
  if (!field) return Array.isArray(value) ? value.join(", ") : String(value);
  switch (field.type) {
    case "currency":
      return formatCurrency(Number(value), field.currency || "USD");
    case "number":
      return formatNumber(Number(value));
    case "boolean":
      return value ? "Yes" : "No";
    case "date":
      return formatDate(value);
    case "datetime":
      return formatDate(value, true);
    case "time":
      return formatTime(value);
    case "rating": {
      const n = Math.max(0, Math.min(5, Math.round(Number(value))));
      return "★".repeat(n) + "☆".repeat(5 - n);
    }
    case "multiSelect":
      return Array.isArray(value) ? value.join(", ") : String(value);
    default:
      return String(value);
  }
}

/** A default value for new records, from the field's defaultValue template. */
export function defaultFieldValue(field: Field): unknown {
  const d = field.defaultValue;
  if (d === undefined || d === null || d === "") return field.type === "boolean" ? false : null;
  if (d === "{{now}}" || d === "now") {
    const now = new Date();
    if (field.type === "date") return localDateKey(now);
    if (field.type === "time") return now.toTimeString().slice(0, 5);
    return now.toISOString();
  }
  const r = coerceFieldValue(field, d);
  return r.ok ? r.value : null;
}

/** Validate a candidate field name. */
export function fieldNameError(name: string, others: string[]): string | null {
  const n = name.trim();
  if (!n) return "Give the field a name";
  if (n.length > 40) return "Keep names under 40 characters";
  if (/[{}.|]/.test(n)) return "Names can't contain { } . or |";
  if (["id", "createdat", "updatedat", "createdby"].includes(n.toLowerCase())) return `"${n}" is reserved`;
  if (others.some((o) => o.toLowerCase() === n.toLowerCase())) return "Another field already uses that name";
  return null;
}

export function collectionNameError(name: string, others: string[]): string | null {
  const n = name.trim();
  if (!n) return "Give the collection a name";
  if (n.length > 40) return "Keep names under 40 characters";
  if (/[{}.|]/.test(n)) return "Names can't contain { } . or |";
  if (others.some((o) => o.toLowerCase() === n.toLowerCase())) return "Another collection already uses that name";
  return null;
}
