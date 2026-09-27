import type {
  AppMeta,
  Collection,
  CollectionAccess,
  DataFilter,
  Field,
  FieldType,
  RecordDoc,
  RuntimeRecord,
  StockRule,
  TransactionStep,
  User,
} from "@/lib/shared/types";
import { DEFAULT_ACCESS, FIELD_TYPE_MAP, PRIVATE_ACCESS, coerceFieldValue, collectionNameError, defaultFieldValue, fieldNameError, isEmptyValue } from "@/lib/shared/fields";
import { compareValues } from "@/lib/shared/expressions";
import crypto from "node:crypto";
import { nowIso, uid } from "@/lib/shared/util";
import { getStore, serverSecret, type StoreOps } from "./store";
import { badRequest, conflict, forbidden, HttpError, notFound } from "./http";
import { attachmentsOf, deleteBlobs, syncAttachments } from "./media";
import type { MediaItem } from "@/lib/shared/types";
import { dateInZone, habitStreak, validTimeZone } from "@/lib/shared/habits";

export interface Viewer {
  timeZone?: string;
  user: User | null;
  /** app owner or someone the owner made an admin */
  isAdmin: boolean;
  /** set when a running app asks: people's account ids are replaced by ids unique to this app */
  appId?: string;
}

/**
 * The same person gets a different, stable id in every app (a keyed hash), so independent
 * apps can't recognise a visitor across apps or learn their platform account id.
 */
export function appUserId(appId: string, userId: string): string {
  return "u_" + crypto.createHmac("sha256", serverSecret()).update(`${appId}:${userId}`).digest("base64url").slice(0, 18);
}

function publicCreator(createdBy: string | null | undefined, viewer: Viewer): string | null {
  if (!createdBy) return null;
  return viewer.appId ? appUserId(viewer.appId, createdBy) : createdBy;
}

/** Rows as the app's makers see them in the editor: creators appear as app-specific ids too. */
export function makerRecord(appId: string, r: RecordDoc): RecordDoc {
  return { ...r, createdBy: r.createdBy ? appUserId(appId, r.createdBy) : null };
}

export const MAX_RECORDS_PER_COLLECTION = 20000;
const LEVELS = ["anyone", "users", "owner", "admins"];

/* ------------------------------------------------------------------ collections */

export async function listCollections(appId: string): Promise<Collection[]> {
  const store = await getStore();
  const cols = await store.find<Collection>("collections", "appId", appId);
  return cols.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getCollection(appId: string, collectionId: string, ops?: StoreOps): Promise<Collection> {
  const store = ops ?? (await getStore());
  const col = await store.get<Collection>("collections", collectionId);
  if (!col || col.appId !== appId) throw notFound("That collection doesn't exist anymore.");
  return col;
}

function cleanFields(input: unknown, previous: Field[] = []): Field[] {
  if (!Array.isArray(input)) throw badRequest("Fields must be a list.");
  if (input.length > 80) throw badRequest("A collection can have at most 80 fields.");
  const out: Field[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Partial<Field>;
    const type = (f.type && FIELD_TYPE_MAP[f.type as FieldType] ? f.type : "text") as FieldType;
    const name = String(f.name ?? "").trim();
    const err = fieldNameError(name, out.map((o) => o.name));
    if (err) throw badRequest(err);
    const prev = previous.find((p) => p.id === f.id);
    // keep existing ids; new fields may bring their own well-formed id, but never a duplicate
    let id = prev?.id || (typeof f.id === "string" && /^[a-z0-9_]{3,40}$/i.test(f.id) ? f.id : uid("fld"));
    if (out.some((o) => o.id === id)) id = uid("fld");
    const field: Field = { id, name, type };
    if (f.required) field.required = true;
    if (f.unique) field.unique = true;
    if (f.private) field.private = true;
    if (f.locked) field.locked = true;
    if (f.counter && (type === "number" || type === "rating")) field.counter = true;
    if (typeof f.defaultValue === "string" && f.defaultValue !== "") field.defaultValue = f.defaultValue.slice(0, 500);
    if ((type === "select" || type === "multiSelect") && Array.isArray(f.options))
      field.options = Array.from(new Set(f.options.map((o) => String(o).trim()).filter(Boolean))).slice(0, 100);
    if (type === "reference" && typeof f.refCollectionId === "string") field.refCollectionId = f.refCollectionId;
    if (type === "currency") field.currency = typeof f.currency === "string" && /^[A-Z]{3}$/.test(f.currency) ? f.currency : "USD";
    if (typeof f.min === "number" && Number.isFinite(f.min)) field.min = f.min;
    if (typeof f.max === "number" && Number.isFinite(f.max)) field.max = f.max;
    if (typeof f.description === "string" && f.description) field.description = f.description.slice(0, 300);
    if (typeof f.width === "number") field.width = Math.max(60, Math.min(800, Math.round(f.width)));
    out.push(field);
  }
  return out;
}

function cleanAccess(input: unknown): CollectionAccess {
  const a = (input && typeof input === "object" ? input : {}) as Partial<CollectionAccess>;
  const pick = <T extends string>(v: unknown, allowed: string[], fallback: T): T => (typeof v === "string" && allowed.includes(v) ? (v as T) : fallback);
  const out: CollectionAccess = {
    read: pick(a.read, LEVELS, DEFAULT_ACCESS.read),
    create: pick(a.create, ["anyone", "users", "admins"], DEFAULT_ACCESS.create),
    update: pick(a.update, LEVELS, DEFAULT_ACCESS.update),
    delete: pick(a.delete, LEVELS, DEFAULT_ACCESS.delete),
  };
  if (typeof a.adjust === "string" && LEVELS.includes(a.adjust)) out.adjust = a.adjust as CollectionAccess["adjust"];
  return out;
}

/** Link-to-record fields may only point at collections of the same app. */
async function checkRefs(store: StoreOps, appId: string, fields: Field[], pending?: Set<string>) {
  for (const f of fields) {
    if (f.type !== "reference" || !f.refCollectionId) continue;
    if (pending?.has(f.refCollectionId)) continue;
    const target = await store.get<Collection>("collections", f.refCollectionId);
    if (!target || target.appId !== appId) throw badRequest(`"${f.name}" must link to a collection in this app.`);
  }
}

function cleanStockRuleSafe(input: unknown, fields: Field[]): StockRule | undefined {
  try {
    return cleanStockRule(input, fields);
  } catch {
    return undefined;
  }
}

function cleanStockRule(input: unknown, fields: Field[]): StockRule | undefined {
  if (!input || typeof input !== "object") return undefined;
  const r = input as Partial<StockRule>;
  const has = (name: unknown, types: FieldType[]) => typeof name === "string" && fields.some((f) => f.name === name && types.includes(f.type));
  if (!has(r.refField, ["reference"]) || !has(r.qtyField, ["number"]) || typeof r.stockField !== "string" || !r.stockField.trim())
    throw badRequest("The stock rule needs a link field, a quantity field and the stock field to take from.");
  const rule: StockRule = { refField: r.refField!, qtyField: r.qtyField!, stockField: r.stockField.trim().slice(0, 60) };
  if (typeof r.priceField === "string" && r.priceField.trim()) rule.priceField = r.priceField.trim().slice(0, 60);
  if (has(r.unitPriceField, ["currency", "number"])) rule.unitPriceField = r.unitPriceField;
  if (has(r.totalField, ["currency", "number"])) rule.totalField = r.totalField;
  return rule;
}

export async function createCollection(
  appId: string,
  input: { name?: unknown; fields?: unknown; access?: unknown; icon?: unknown; stock?: unknown },
  ops?: StoreOps,
  // trusted callers only (template setup): a server-made id, and ids created in the same step
  internal?: { id: string; pending?: Set<string> },
): Promise<Collection> {
  const store = ops ?? (await getStore());
  const existing = await store.find<Collection>("collections", "appId", appId);
  if (existing.length >= 50) throw badRequest("An app can have at most 50 collections.");
  const name = String(input.name ?? "").trim();
  const err = collectionNameError(name, existing.map((c) => c.name));
  if (err) throw badRequest(err);
  const fields = cleanFields(input.fields ?? [{ name: "Name", type: "text" }]);
  await checkRefs(store, appId, fields, internal?.pending);
  const id = internal?.id || uid("col");
  if (await store.get<Collection>("collections", id)) throw conflict("That collection already exists.");
  const col: Collection = {
    id,
    appId,
    name,
    icon: typeof input.icon === "string" ? input.icon.slice(0, 8) : undefined,
    fields,
    // new collections are private until the maker decides who may see or add rows
    access: input.access === undefined ? { ...PRIVATE_ACCESS } : cleanAccess(input.access),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const stock = cleanStockRule(input.stock, fields);
  if (stock) col.stock = stock;
  await store.put("collections", col);
  return col;
}

export async function updateCollection(
  appId: string,
  collectionId: string,
  patch: { name?: unknown; fields?: unknown; access?: unknown; icon?: unknown; stock?: unknown },
): Promise<Collection> {
  const store = await getStore();
  return store.transaction(async (tx) => {
    const col = await getCollection(appId, collectionId, tx);
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      const others = (await tx.find<Collection>("collections", "appId", appId)).filter((c) => c.id !== col.id);
      const err = collectionNameError(name, others.map((c) => c.name));
      if (err) throw badRequest(err);
      col.name = name;
    }
    if (patch.icon !== undefined) col.icon = typeof patch.icon === "string" ? patch.icon.slice(0, 8) : undefined;
    if (patch.access !== undefined) col.access = cleanAccess(patch.access);
    if (patch.fields !== undefined) {
      const before = col.fields;
      const after = cleanFields(patch.fields, before);
      const removed = before.filter((b) => !after.some((a) => a.id === b.id));
      const retyped = after.filter((a) => {
        const b = before.find((x) => x.id === a.id);
        return b && (b.type !== a.type || JSON.stringify(b.options) !== JSON.stringify(a.options));
      });
      await checkRefs(tx, appId, after);
      col.fields = after;
      if (removed.length || retyped.length) {
        const records = await tx.find<RecordDoc>("records", "collectionId", col.id);
        for (const r of records) {
          let changed = false;
          for (const f of removed) {
            if (f.id in r.data) {
              delete r.data[f.id];
              changed = true;
            }
          }
          for (const f of retyped) {
            if (!(f.id in r.data)) continue;
            const res = coerceFieldValue(f, r.data[f.id]);
            r.data[f.id] = res.ok ? res.value : null;
            changed = true;
          }
          if (changed) await tx.put("records", r);
        }
      }
    }
    if (patch.stock !== undefined) {
      const rule = patch.stock === null ? undefined : cleanStockRule(patch.stock, col.fields);
      if (rule) col.stock = rule;
      else delete col.stock;
    } else if (col.stock && !cleanStockRuleSafe(col.stock, col.fields)) delete col.stock; // its fields were removed
    col.updatedAt = nowIso();
    await tx.put("collections", col);
    return col;
  });
}

export async function deleteCollection(appId: string, collectionId: string) {
  const store = await getStore();
  const removed: string[] = [];
  await store.transaction(async (tx) => {
    const col = await getCollection(appId, collectionId, tx);
    for (const m of await tx.find<MediaItem>("media", "appId", appId)) {
      if (!m.public && m.collectionId === col.id) {
        await tx.delete("media", m.id);
        removed.push(m.id);
      }
    }
    await tx.deleteWhere("records", "collectionId", col.id);
    await tx.delete("collections", col.id);
    await tx.releaseUnique?.("", col.id);
  });
  await deleteBlobs(removed);
}

/* ------------------------------------------------------------------ access */

function levelAllows(level: string, viewer: Viewer, record?: RecordDoc | null): boolean {
  if (viewer.isAdmin) return true;
  switch (level) {
    case "anyone":
      return true;
    case "users":
      return !!viewer.user;
    case "owner":
      return !!viewer.user && (!record || record.createdBy === viewer.user.id);
    default:
      return false;
  }
}

function denyMessage(action: string, level: string, viewer: Viewer) {
  if (!viewer.user && level !== "admins") return `Please sign in to ${action}.`;
  if (level === "owner") return `You can only ${action} things you added yourself.`;
  return `You don't have permission to ${action}.`;
}

export function canRead(col: Collection, viewer: Viewer) {
  return levelAllows(col.access.read, viewer);
}

/** May this viewer add rows to, or change rows of, this collection at all? */
export function canWrite(col: Collection, viewer: Viewer) {
  return levelAllows(col.access.create, viewer) || levelAllows(col.access.update, viewer);
}

/** May this viewer read this field of this record? (collection rule + private fields) */
export function canReadField(col: Collection, rec: RecordDoc, fieldId: string | undefined, viewer: Viewer) {
  if (!levelAllows(col.access.read, viewer, rec)) return false;
  const f = col.fields.find((x) => x.id === fieldId);
  return fieldVisible(f, rec, viewer);
}

/* ------------------------------------------------------------------ helpers */

const META_FIELDS: Record<string, keyof RecordDoc> = {
  id: "id",
  createdat: "createdAt",
  updatedat: "updatedAt",
  createdby: "createdBy",
};

export function fieldByRef(col: Collection, ref: string): Field | undefined {
  const lower = ref.trim().toLowerCase();
  return col.fields.find((f) => f.id === ref) || col.fields.find((f) => f.name.toLowerCase() === lower);
}

function valueOf(col: Collection, r: RecordDoc, ref: string): unknown {
  const meta = META_FIELDS[ref.toLowerCase()];
  if (meta) return r[meta];
  const f = fieldByRef(col, ref);
  return f ? r.data[f.id] : undefined;
}

/** May this viewer see this field of this record? (private fields: admins and the record's creator) */
function fieldVisible(f: Field | undefined, r: RecordDoc, viewer: Viewer): boolean {
  if (!f?.private || viewer.isAdmin) return true;
  return !!viewer.user && r.createdBy === viewer.user.id;
}

/**
 * The value of a field as this viewer is allowed to know it. Filters, sorting, search, groups
 * and totals all go through here, so a private value can't leak through any of them.
 */
function visibleValue(col: Collection, r: RecordDoc, ref: string, viewer: Viewer): unknown {
  const meta = META_FIELDS[ref.toLowerCase()];
  if (meta === "createdBy") return publicCreator(r.createdBy, viewer);
  if (meta) return r[meta];
  const f = fieldByRef(col, ref);
  if (!f || !fieldVisible(f, r, viewer)) return undefined;
  return r.data[f.id];
}

export function primaryField(col: Collection): Field | undefined {
  return col.fields.find((f) => ["text", "email", "select", "phone", "url"].includes(f.type)) || col.fields[0];
}

/** A readable name for a record; a private first field only shows to those allowed to see it. */
export function recordLabel(col: Collection, r: RecordDoc, viewer?: Viewer): string {
  const pf = primaryField(col);
  const v = pf && (!viewer || fieldVisible(pf, r, viewer)) ? r.data[pf.id] : null;
  return isEmptyValue(v) ? `Record ${r.id.slice(-5)}` : String(v);
}

function compareForSort(a: unknown, b: unknown, type?: FieldType): number {
  const ea = isEmptyValue(a);
  const eb = isEmptyValue(b);
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  if (type === "number" || type === "currency" || type === "rating") return Number(a) - Number(b);
  if (type === "boolean") return Number(!!a) - Number(!!b);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(Array.isArray(a) ? a.join(",") : a).localeCompare(String(Array.isArray(b) ? b.join(",") : b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

const SEARCHABLE: FieldType[] = ["text", "longText", "email", "phone", "url", "select", "multiSelect"];

function matchesFilters(col: Collection, r: RecordDoc, filters: DataFilter[], viewer: Viewer): boolean {
  for (const f of filters) {
    if (!f || !f.field) continue;
    if (f.op === "mine") {
      if (!viewer.user || r.createdBy !== viewer.user.id) return false;
      continue;
    }
    // an empty comparison value means "no filter" (e.g. an empty search dropdown)
    const needsValue = !["isEmpty", "isNotEmpty", "isTrue", "isFalse"].includes(f.op);
    if (needsValue && (f.value === undefined || f.value === null || f.value === "")) continue;
    // a private value the viewer may not see never matches (not even "is empty")
    const field = META_FIELDS[f.field.toLowerCase()] ? undefined : fieldByRef(col, f.field);
    if (field && !fieldVisible(field, r, viewer)) return false;
    const left = visibleValue(col, r, f.field, viewer);
    if (!compareValues(left, f.op, f.value)) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ queries */

export interface RecordQuery {
  search?: string;
  filters?: DataFilter[];
  sortField?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  ids?: string[];
}

export interface QueryResult<T> {
  records: T[];
  total: number;
  page: number;
  pageSize: number;
}

async function readableRecords(col: Collection, viewer: Viewer, ops?: StoreOps): Promise<RecordDoc[]> {
  if (!levelAllows(col.access.read, viewer)) throw forbidden(denyMessage("see this data", col.access.read, viewer));
  const store = ops ?? (await getStore());
  let recs = await store.find<RecordDoc>("records", "collectionId", col.id);
  if (col.access.read === "owner" && !viewer.isAdmin) recs = recs.filter((r) => r.createdBy === viewer.user?.id);
  return recs;
}

export async function queryRawRecords(col: Collection, q: RecordQuery, viewer: Viewer): Promise<QueryResult<RecordDoc>> {
  let recs = await readableRecords(col, viewer);
  if (q.ids?.length) {
    const want = new Set(q.ids);
    recs = recs.filter((r) => want.has(r.id));
  }
  if (q.filters?.length) recs = recs.filter((r) => matchesFilters(col, r, q.filters!, viewer));
  const search = q.search?.trim().toLowerCase();
  if (search) {
    const fields = col.fields.filter((f) => SEARCHABLE.includes(f.type));
    recs = recs.filter((r) =>
      fields.some((f) => {
        if (!fieldVisible(f, r, viewer)) return false;
        const v = r.data[f.id];
        return !isEmptyValue(v) && (Array.isArray(v) ? v.join(" ") : String(v)).toLowerCase().includes(search);
      }),
    );
  }
  const sortField = q.sortField || "createdAt";
  const dir = q.sortDir === "asc" ? 1 : -1;
  const sortType = fieldByRef(col, sortField)?.type;
  recs.sort((a, b) => {
    // hidden private values sort like empty ones, so the order can't reveal them
    const c = compareForSort(visibleValue(col, a, sortField, viewer), visibleValue(col, b, sortField, viewer), sortType);
    return c !== 0 ? c * dir : b.createdAt.localeCompare(a.createdAt);
  });
  const total = recs.length;
  const pageSize = Math.max(1, Math.min(500, Math.floor(q.pageSize || 50)));
  const page = Math.max(1, Math.floor(q.page || 1));
  return { records: recs.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}

/** Records as the runtime sees them: keyed by field name, private fields removed, links expanded. */
export async function toRuntimeRecords(col: Collection, recs: RecordDoc[], viewer: Viewer): Promise<RuntimeRecord[]> {
  const store = await getStore();
  // Recalculate template streaks on reads too, so missing a day is reflected before
  // the next check-in. Only readable rows and fields contribute to this value.
  const streaks = new Map<string, number>();
  const streakField = fieldByRef(col, "Streak");
  const goalField = fieldByRef(col, "Goal");
  if (streakField?.type === "number" && goalField && (await store.get<AppMeta>("apps", col.appId))?.templateId === "habits") {
    const collections = await store.find<Collection>("collections", "appId", col.appId);
    const checkins = collections.find((c) => fieldByRef(c, "Habit")?.refCollectionId === col.id && fieldByRef(c, "Day")?.type === "date");
    if (checkins && levelAllows(checkins.access.read, viewer)) {
      const habitField = fieldByRef(checkins, "Habit")!;
      const dayField = fieldByRef(checkins, "Day")!;
      const dates = new Map<string, string[]>();
      for (const r of await readableRecords(checkins, viewer)) {
        if (!fieldVisible(habitField, r, viewer) || !fieldVisible(dayField, r, viewer)) continue;
        const id = String(r.data[habitField.id]);
        if (!dates.has(id)) dates.set(id, []);
        dates.get(id)!.push(String(r.data[dayField.id]));
      }
      for (const habit of recs) {
        if (!fieldVisible(goalField, habit, viewer)) continue;
        const zone = (habit as RecordDoc & { habitTimeZone?: string }).habitTimeZone || validTimeZone(viewer.timeZone);
        streaks.set(habit.id, habitStreak(dates.get(habit.id) || [], String(habit.data[goalField.id]), dateInZone(new Date(), zone)));
      }
    }
  }
  const refFields = col.fields.filter((f) => f.type === "reference" && f.refCollectionId);
  const refData = new Map<string, { col: Collection; map: Map<string, RecordDoc> }>();
  for (const f of refFields) {
    if (refData.has(f.refCollectionId!)) continue;
    const target = await store.get<Collection>("collections", f.refCollectionId!);
    if (!target || target.appId !== col.appId || !levelAllows(target.access.read, viewer)) continue;
    let all = await store.find<RecordDoc>("records", "collectionId", target.id);
    // "only the person who added it" applies to linked records too
    if (target.access.read === "owner" && !viewer.isAdmin) all = all.filter((t) => !!viewer.user && t.createdBy === viewer.user.id);
    refData.set(target.id, { col: target, map: new Map(all.map((t) => [t.id, t])) });
  }
  return recs.map((r) => {
    const out: RuntimeRecord = { id: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt, createdBy: publicCreator(r.createdBy, viewer) };
    for (const f of col.fields) {
      if (!fieldVisible(f, r, viewer)) continue;
      let v = f === streakField && streaks.has(r.id) ? streaks.get(r.id)! : r.data[f.id] ?? null;
      if (f.type === "reference" && v && f.refCollectionId) {
        const ref = refData.get(f.refCollectionId);
        const target = ref?.map.get(String(v));
        if (ref && target) {
          const nested: Record<string, unknown> = { id: target.id, _label: recordLabel(ref.col, target, viewer) };
          for (const tf of ref.col.fields) if (fieldVisible(tf, target, viewer)) nested[tf.name] = target.data[tf.id] ?? null;
          v = nested;
        }
      }
      out[f.name] = v;
    }
    return out;
  });
}

/**
 * A written record as the writer may see it. People who may change a record but not read it
 * (e.g. +1 on a hidden collection) only get its id back.
 */
export async function recordForViewer(col: Collection, rec: RecordDoc, viewer: Viewer): Promise<RuntimeRecord> {
  if (!levelAllows(col.access.read, viewer, rec)) return { id: rec.id, createdAt: rec.createdAt, updatedAt: rec.updatedAt, createdBy: null };
  const [out] = await toRuntimeRecords(col, [rec], viewer);
  return out;
}

/* ------------------------------------------------------------------ writes */

function pickValue(values: Record<string, unknown>, f: Field): unknown {
  if (f.id in values) return values[f.id];
  if (f.name in values) return values[f.name];
  const lower = f.name.toLowerCase();
  for (const k of Object.keys(values)) if (k.toLowerCase() === lower) return values[k];
  return undefined;
}

function coerceAll(col: Collection, values: Record<string, unknown>, partial: boolean) {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of col.fields) {
    let raw = pickValue(values, f);
    if (raw === undefined) {
      if (partial) continue;
      data[f.id] = defaultFieldValue(f);
      continue;
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw) && "id" in (raw as object)) raw = (raw as { id: unknown }).id;
    const res = coerceFieldValue(f, raw);
    if (!res.ok) errors[f.name] = res.error;
    else data[f.id] = res.value;
  }
  return { data, errors };
}

/**
 * Link-to-record values may arrive as a record id or as the linked record's label (e.g. a
 * dropdown showing product names). Turn labels into ids — but only among records of this app
 * that the person could read anyway, so a link can't be used to probe hidden data.
 */
async function resolveReferences(tx: StoreOps, col: Collection, data: Record<string, unknown>, errors: Record<string, string>, viewer: Viewer) {
  for (const f of col.fields) {
    if (f.type !== "reference" || !f.refCollectionId) continue;
    const v = data[f.id];
    if (isEmptyValue(v)) continue;
    const target = await tx.get<Collection>("collections", f.refCollectionId);
    if (!target || target.appId !== col.appId) {
      data[f.id] = null;
      continue;
    }
    const str = String(v);
    const readable = levelAllows(target.access.read, viewer);
    const canSee = (r: RecordDoc) => readable && levelAllows(target.access.read, viewer, r);
    const direct = await tx.get<RecordDoc>("records", str);
    if (direct && direct.collectionId === target.id && canSee(direct)) continue;
    const pf = primaryField(target);
    let match: RecordDoc | undefined;
    if (pf && readable) {
      const all = await tx.find<RecordDoc>("records", "collectionId", target.id);
      match = all.find((r) => canSee(r) && fieldVisible(pf, r, viewer) && String(r.data[pf.id] ?? "").toLowerCase() === str.toLowerCase());
    }
    if (match) data[f.id] = match.id;
    // same answer whether or not a hidden record exists
    else errors[f.name] = `Choose one of the ${target.name}.`;
  }
}

/** Values for admin-only fields are dropped for everyone else (they get the field's default). */
function withoutLocked(col: Collection, values: Record<string, unknown>): Record<string, unknown> {
  const locked = col.fields.filter((f) => f.locked);
  if (!locked.length) return values;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    const lower = k.toLowerCase();
    if (!locked.some((f) => f.id === k || f.name.toLowerCase() === lower)) out[k] = v;
  }
  return out;
}

/**
 * Stock keeping done by the server, not the browser: a new order takes its quantity from the
 * linked product's stock in the same step (or is refused), and copies the price at that moment.
 */
async function applyStockRule(tx: StoreOps, col: Collection, data: Record<string, unknown>, viewer: Viewer) {
  const rule = col.stock;
  if (!rule) return;
  const refF = col.fields.find((f) => f.name === rule.refField && f.type === "reference");
  const qtyF = col.fields.find((f) => f.name === rule.qtyField && f.type === "number");
  if (!refF?.refCollectionId || !qtyF) return;
  const targetId = data[refF.id];
  if (isEmptyValue(targetId)) throw badRequest(`Choose a ${refF.name}.`, { fields: { [refF.name]: "Required" } });
  const qty = isEmptyValue(data[qtyF.id]) ? 1 : Number(data[qtyF.id]);
  if (!Number.isInteger(qty) || qty < 1 || qty > 10000) throw badRequest(`${qtyF.name} must be a whole number, 1 or more.`, { fields: { [qtyF.name]: "Must be 1 or more" } });
  data[qtyF.id] = qty;
  const target = await getCollection(col.appId, refF.refCollectionId, tx);
  const item = await loadRecord(tx, target, String(targetId));
  const stockF = fieldByRef(target, rule.stockField);
  if (!stockF || stockF.type !== "number") throw badRequest(`${target.name} has no number field called "${rule.stockField}".`);
  const left = Number(item.data[stockF.id] || 0);
  const label = recordLabel(target, item, viewer);
  if (left < qty) throw conflict(left <= 0 ? `Sorry, ${label} is sold out.` : `Only ${left} of ${label} left.`);
  item.data[stockF.id] = left - qty;
  item.updatedAt = nowIso();
  await tx.put("records", item);
  if (rule.priceField) {
    const priceF = fieldByRef(target, rule.priceField);
    const price = priceF ? Number(item.data[priceF.id]) : NaN;
    if (Number.isFinite(price)) {
      const unitF = rule.unitPriceField ? fieldByRef(col, rule.unitPriceField) : undefined;
      const totalF = rule.totalField ? fieldByRef(col, rule.totalField) : undefined;
      if (unitF) data[unitF.id] = price;
      if (totalF) data[totalF.id] = Math.round(price * qty * 100) / 100;
    }
  }
}

function throwIfErrors(errors: Record<string, string>) {
  const keys = Object.keys(errors);
  if (keys.length) throw badRequest(errors[keys[0]], { fields: errors });
}

async function checkUnique(tx: StoreOps, col: Collection, data: Record<string, unknown>, docId: string) {
  const uniques = col.fields.filter((f) => f.unique && f.id in data);
  if (!uniques.length) return;
  const all = await tx.find<RecordDoc>("records", "collectionId", col.id);
  for (const f of uniques) {
    const scope = `${col.id}:${f.id}`;
    if (isEmptyValue(data[f.id])) {
      await tx.releaseUnique?.(scope, docId);
      continue;
    }
    const v = String(data[f.id]).toLowerCase();
    if (all.some((r) => r.id !== docId && !isEmptyValue(r.data[f.id]) && String(r.data[f.id]).toLowerCase() === v))
      throw conflict(`${f.name} "${data[f.id]}" is already taken.`, { fields: { [f.name]: "Already taken" } });
    // with Postgres the database also holds the value, so two racing requests can't both save it
    await tx.claimUnique?.(scope, v, docId);
  }
}

async function createInTx(tx: StoreOps, col: Collection, values: Record<string, unknown>, viewer: Viewer): Promise<RecordDoc> {
  if (!levelAllows(col.access.create, viewer)) throw forbidden(denyMessage("add to " + col.name, col.access.create, viewer));
  const { data, errors } = coerceAll(col, viewer.isAdmin ? values : withoutLocked(col, values), false);
  for (const f of col.fields) if (f.required && isEmptyValue(data[f.id]) && !errors[f.name]) errors[f.name] = `${f.name} is required`;
  await resolveReferences(tx, col, data, errors, viewer);
  throwIfErrors(errors);
  const count = (await tx.find<RecordDoc>("records", "collectionId", col.id)).length;
  if (count >= MAX_RECORDS_PER_COLLECTION) throw badRequest(`${col.name} is full (${MAX_RECORDS_PER_COLLECTION} records max).`);
  const id = uid("rec", 12);
  await checkUnique(tx, col, data, id);
  await applyStockRule(tx, col, data, viewer);
  const rec: RecordDoc = {
    id,
    appId: col.appId,
    collectionId: col.id,
    data,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: viewer.user?.id ?? null,
  };
  await tx.put("records", rec);
  await syncAttachments(tx, col, rec, viewer.user?.id ?? null);
  return rec;
}

async function loadRecord(tx: StoreOps, col: Collection, recordId: string): Promise<RecordDoc> {
  const rec = await tx.get<RecordDoc>("records", String(recordId || ""));
  if (!rec || rec.collectionId !== col.id) throw notFound(`That ${col.name} record doesn't exist anymore.`);
  return rec;
}

async function updateInTx(tx: StoreOps, col: Collection, recordId: string, values: Record<string, unknown>, viewer: Viewer) {
  const rec = await loadRecord(tx, col, recordId);
  if (!levelAllows(col.access.update, viewer, rec)) throw forbidden(denyMessage("change this", col.access.update, viewer));
  const { data, errors } = coerceAll(col, values, true);
  if (!viewer.isAdmin) {
    for (const f of col.fields) {
      if (!f.locked || !(f.id in data)) continue;
      // sending the unchanged value back (e.g. a whole form) is fine; changing it is not
      if (JSON.stringify(data[f.id] ?? null) !== JSON.stringify(rec.data[f.id] ?? null)) throw forbidden(`Only admins can change ${f.name}.`);
      delete data[f.id];
    }
  }
  for (const f of col.fields) if (f.required && f.id in data && isEmptyValue(data[f.id]) && !errors[f.name]) errors[f.name] = `${f.name} is required`;
  await resolveReferences(tx, col, data, errors, viewer);
  throwIfErrors(errors);
  await checkUnique(tx, col, data, rec.id);
  const before = { ...rec.data };
  rec.data = { ...rec.data, ...data };
  rec.updatedAt = nowIso();
  await tx.put("records", rec);
  await syncAttachments(tx, col, rec, viewer.user?.id ?? null, before);
  return rec;
}

async function deleteInTx(tx: StoreOps, col: Collection, recordId: string, viewer: Viewer, removedFiles: string[] = []) {
  const rec = await loadRecord(tx, col, recordId);
  if (!levelAllows(col.access.delete, viewer, rec)) throw forbidden(denyMessage("delete this", col.access.delete, viewer));
  await tx.delete("records", rec.id);
  await tx.releaseUnique?.("", rec.id);
  // files attached to the record go with it
  for (const m of await attachmentsOf(tx, rec.id)) {
    await tx.delete("media", m.id);
    removedFiles.push(m.id);
  }
  return rec;
}

async function adjustInTx(tx: StoreOps, col: Collection, recordId: string, fieldRef: string, amount: number, min: number | undefined, viewer: Viewer) {
  const rec = await loadRecord(tx, col, recordId);
  const level = col.access.adjust ?? col.access.update;
  if (!levelAllows(level, viewer, rec)) throw forbidden(denyMessage("change this", level, viewer));
  const f = fieldByRef(col, fieldRef);
  if (!f || !["number", "currency", "rating"].includes(f.type)) throw badRequest(`"${fieldRef}" isn't a number field in ${col.name}.`);
  if (!Number.isFinite(amount)) throw badRequest("The amount must be a number.");
  const canEdit = levelAllows(col.access.update, viewer, rec);
  if (!canEdit || (f.locked && !viewer.isAdmin)) {
    // people who may only use +/- can only touch counter fields (votes, likes), one step at a time
    if (!f.counter) throw forbidden(`You can't change ${f.name}.`);
    if (Math.abs(amount) > 1) throw forbidden("You can only add or take away 1 at a time.");
  }
  const next = Number(rec.data[f.id] || 0) + amount;
  if (min !== undefined && Number.isFinite(min) && next < min)
    throw conflict(min === 0 ? `Not enough ${f.name} left.` : `${f.name} can't go below ${min}.`);
  if (f.min !== undefined && next < f.min) throw conflict(f.min === 0 ? `Not enough ${f.name} left.` : `${f.name} can't go below ${f.min}.`);
  if (f.max !== undefined && next > f.max) throw conflict(`${f.name} can't go above ${f.max}.`);
  rec.data[f.id] = Math.round(next * 1e6) / 1e6;
  rec.updatedAt = nowIso();
  await tx.put("records", rec);
  return rec;
}

export async function createRecord(col: Collection, values: Record<string, unknown>, viewer: Viewer) {
  const store = await getStore();
  return store.transaction((tx) => createInTx(tx, col, values, viewer));
}

export async function updateRecord(col: Collection, recordId: string, values: Record<string, unknown>, viewer: Viewer) {
  const store = await getStore();
  return store.transaction((tx) => updateInTx(tx, col, recordId, values, viewer));
}

export async function deleteRecords(col: Collection, recordIds: string[], viewer: Viewer) {
  const store = await getStore();
  const removedFiles: string[] = [];
  const n = await store.transaction(async (tx) => {
    for (const id of recordIds) await deleteInTx(tx, col, id, viewer, removedFiles);
    return recordIds.length;
  });
  await deleteBlobs(removedFiles);
  return n;
}

export async function adjustNumber(col: Collection, recordId: string, field: string, amount: number, min: number | undefined, viewer: Viewer) {
  const store = await getStore();
  return store.transaction((tx) => adjustInTx(tx, col, recordId, field, amount, min, viewer));
}

/** Atomic habit operation. The habit row lock serializes concurrent requests on Postgres. */
export async function checkInHabit(appId: string, collectionId: string, habitId: string, timeZone: unknown, viewer: Viewer) {
  if (!viewer.user) throw forbidden("Sign in to check in a habit.");
  const store = await getStore();
  return store.transaction(async (tx) => {
    const checkins = await getCollection(appId, collectionId, tx);
    const habitField = fieldByRef(checkins, "Habit");
    const dayField = fieldByRef(checkins, "Day");
    if (habitField?.type !== "reference" || !habitField.refCollectionId || dayField?.type !== "date") throw badRequest("Check-ins need Habit (reference) and Day (date) fields.");
    const habits = await getCollection(appId, habitField.refCollectionId, tx);
    const streakField = fieldByRef(habits, "Streak");
    const goalField = fieldByRef(habits, "Goal");
    if (streakField?.type !== "number" || !goalField) throw badRequest("The habit needs Streak (number) and Goal fields.");
    const habit = await loadRecord(tx, habits, habitId);
    if (habit.createdBy !== viewer.user!.id || !levelAllows(habits.access.read, viewer, habit) || !levelAllows(habits.access.update, viewer, habit) || !levelAllows(checkins.access.create, viewer) || !levelAllows(checkins.access.read, viewer))
      throw forbidden("You can only check in your own habits.");
    if (streakField.locked && !streakField.counter && !viewer.isAdmin) throw forbidden("Only admins can change this streak field.");
    // Stored per habit: switching browser time zones cannot create a second local day.
    const metadata = habit as RecordDoc & { habitTimeZone?: string };
    metadata.habitTimeZone ||= validTimeZone(timeZone);
    const today = dateInZone(new Date(), metadata.habitTimeZone);
    const rows = (await tx.find<RecordDoc>("records", "collectionId", checkins.id)).filter((r) => r.createdBy === viewer.user!.id && r.data[habitField.id] === habit.id);
    const alreadyDone = rows.some((r) => r.data[dayField.id] === today);
    if (!alreadyDone) rows.push(await createInTx(tx, checkins, { [habitField.id]: habit.id, [dayField.id]: today }, viewer));
    const goal = String(habit.data[goalField.id] || "Every day");
    if (!["Every day", "Weekdays", "3 times a week"].includes(goal)) throw badRequest("Choose a supported habit goal before checking in.");
    const streak = habitStreak(rows.map((r) => String(r.data[dayField.id])), goal, today);
    const checkedStreak = coerceFieldValue(streakField, streak);
    if (!checkedStreak.ok) throw badRequest(checkedStreak.error);
    habit.data[streakField.id] = streak;
    habit.updatedAt = nowIso();
    await tx.put("records", habit);
    return { alreadyDone, streak, unit: goal === "3 times a week" ? "weeks" : "days" };
  });
}

/** Import many rows at once (editor only). Returns how many were added and any row errors. */
export async function importRecords(col: Collection, rows: Record<string, unknown>[], viewer: Viewer) {
  const store = await getStore();
  const errors: { row: number; error: string }[] = [];
  let added = 0;
  for (let i = 0; i < rows.length; i++) {
    try {
      await store.transaction((tx) => createInTx(tx, col, rows[i], viewer));
      added++;
    } catch (err) {
      errors.push({ row: i + 1, error: err instanceof HttpError ? err.message : "Could not import this row" });
      if (errors.length > 50) break;
    }
  }
  return { added, errors };
}

/**
 * Several record changes that succeed or fail together (e.g. place an order and reduce
 * stock). Later steps can use {{steps.0.id}} to point at a record created earlier.
 */
export async function runTransaction(appId: string, steps: TransactionStep[], viewer: Viewer) {
  if (!Array.isArray(steps) || !steps.length) throw badRequest("Add at least one step.");
  if (steps.length > 10) throw badRequest("A transaction can have at most 10 steps.");
  const store = await getStore();
  const removedFiles: string[] = [];
  const out = await store.transaction(async (tx) => {
    const results: { id: string }[] = [];
    const fill = (v: unknown) =>
      typeof v === "string"
        ? v.replace(/\{\{\s*steps\.(\d+)\.id\s*\}\}/g, (_, i: string) => {
            const r = results[Number(i)];
            if (!r) throw badRequest(`Step ${Number(i) + 1} hasn't run yet.`);
            return r.id;
          })
        : v;
    for (const step of steps) {
      const col = await getCollection(appId, step.collectionId, tx);
      const mapping: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(step.mapping || {})) mapping[k] = fill(v);
      const recordId = String(fill(step.recordId ?? "") ?? "");
      let rec: RecordDoc;
      if (step.kind === "create") rec = await createInTx(tx, col, mapping, viewer);
      else if (step.kind === "update") rec = await updateInTx(tx, col, recordId, mapping, viewer);
      else if (step.kind === "delete") rec = await deleteInTx(tx, col, recordId, viewer, removedFiles);
      else if (step.kind === "adjust")
        rec = await adjustInTx(
          tx,
          col,
          recordId,
          step.fieldName || "",
          Number(fill(step.amount)),
          step.min !== undefined && step.min !== "" ? Number(fill(step.min)) : undefined,
          viewer,
        );
      else throw badRequest("Unknown step.");
      results.push({ id: rec.id });
    }
    return results;
  });
  await deleteBlobs(removedFiles);
  return out;
}

/* ------------------------------------------------------------------ aggregates */

export interface AggregateRequest {
  aggregate: "count" | "sum" | "avg" | "min" | "max";
  field?: string;
  groupBy?: string;
  filters?: DataFilter[];
}

export async function aggregateRecords(col: Collection, req: AggregateRequest, viewer: Viewer) {
  let recs = await readableRecords(col, viewer);
  if (req.filters?.length) recs = recs.filter((r) => matchesFilters(col, r, req.filters!, viewer));
  // hidden private numbers are left out of totals (visibleValue gives undefined -> NaN)
  const numeric = (r: RecordDoc) => {
    const v = visibleValue(col, r, req.field || "", viewer);
    return v === undefined || v === null || v === "" ? NaN : Number(v);
  };
  const reduce = (list: RecordDoc[]): number => {
    if (req.aggregate === "count" || !req.field) return list.length;
    const nums = list.map(numeric).filter((n) => Number.isFinite(n));
    if (!nums.length) return 0;
    switch (req.aggregate) {
      case "sum":
        return nums.reduce((a, b) => a + b, 0);
      case "avg":
        return nums.reduce((a, b) => a + b, 0) / nums.length;
      case "min":
        return Math.min(...nums);
      case "max":
        return Math.max(...nums);
      default:
        return list.length;
    }
  };
  if (!req.groupBy) return { value: reduce(recs) };
  const groupField = fieldByRef(col, req.groupBy);
  const groups = new Map<string, RecordDoc[]>();
  // who created a record is never a chart label for visitors
  if (!viewer.isAdmin && /^createdby$/i.test(req.groupBy)) throw forbidden("Charts can't be grouped by who added a record.");
  for (const r of recs) {
    const hidden = groupField ? !fieldVisible(groupField, r, viewer) : false;
    let key = hidden ? null : visibleValue(col, r, req.groupBy, viewer);
    if (groupField?.type === "date" || groupField?.type === "datetime" || /^created|^updated/i.test(req.groupBy))
      key = typeof key === "string" ? key.slice(0, 10) : key;
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) {
      const label = hidden ? "(private)" : isEmptyValue(k) ? "(empty)" : typeof k === "boolean" ? (k ? "Yes" : "No") : String(k);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(r);
    }
  }
  let entries = Array.from(groups, ([label, list]) => ({ label, value: reduce(list) }));
  if (groupField?.options?.length) {
    const order = groupField.options;
    entries.sort((a, b) => (order.indexOf(a.label) + 1 || 999) - (order.indexOf(b.label) + 1 || 999));
  } else if (groupField?.type === "date" || groupField?.type === "datetime" || /^created|^updated/i.test(req.groupBy)) {
    entries.sort((a, b) => a.label.localeCompare(b.label));
  } else entries.sort((a, b) => b.value - a.value);
  entries = entries.slice(0, 24);
  return { groups: entries };
}
