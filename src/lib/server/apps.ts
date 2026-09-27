import type { AppDoc, AppKind, AppMeta, AppVersion, Collection, Page, RecordDoc, RuntimeRecord, User } from "@/lib/shared/types";
import type { SchemaCollection } from "@/components/runtime/store";
import { newAppDoc, sanitizeDoc } from "@/lib/shared/doc";
import { nowIso, slugify, uid } from "@/lib/shared/util";
import { getTemplate } from "@/lib/templates";
import { RESERVED_SUBDOMAINS } from "@/lib/shared/urls";
import { getStore, type StoreOps } from "./store";
import { badRequest, conflict, forbidden, notFound } from "./http";
import { contactLine } from "@/lib/shared/legal";
import { createCollection, toRuntimeRecords, type Viewer } from "./data";
import { copyDesignFiles } from "./media";
import { repairTemplateDoc } from "@/lib/shared/templateRepairs";
import { queueMobileDeployment, stopAppDeployments, type DeploymentDoc } from "./mobile";
import { applyChanges, unitEntries, type Change } from "@/lib/shared/sync";
import { publish, withAppLock } from "./live";

interface DraftDoc {
  id: string; // app id
  doc: AppDoc;
  revision: number;
  updatedAt: string;
}

interface PublishedDoc {
  id: string; // app id
  doc: AppDoc;
  publishedAt: string;
}

const APP_COLORS = ["#6c47ff", "#ff6b9d", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#2563eb"];
const APP_EMOJIS = ["✨", "🚀", "🎨", "🌱", "📚", "🛍️", "💡", "🎯", "🧩", "📋", "🌈", "⚡"];
export const MAX_APPS_PER_USER = 200;
const RESERVED_SLUGS = new Set(["new", "edit", "signup", ...RESERVED_SUBDOMAINS]);

/* ------------------------------------------------------------------ lookups */

export async function getAppMeta(appId: string, ops?: StoreOps): Promise<AppMeta> {
  const store = ops ?? (await getStore());
  const meta = await store.get<AppMeta>("apps", appId);
  if (!meta) throw notFound("That app doesn't exist anymore.");
  return meta;
}

export async function getOwnedApp(user: User, appId: string, ops?: StoreOps): Promise<AppMeta> {
  const meta = await getAppMeta(appId, ops);
  if (meta.ownerId !== user.id) throw forbidden("Only the app's creator can do that.");
  return meta;
}

/**
 * Who someone is to an app. Editors change the design and the database in the builder (and are
 * admins of the live app); admins manage records in the live app only. Matched by account id.
 */
export type AppRole = "owner" | "editor" | "admin";

export function appRole(meta: AppMeta, user: User | null): AppRole | null {
  if (!user) return null;
  if (meta.ownerId === user.id) return "owner";
  if ((meta.editorIds || []).includes(user.id)) return "editor";
  if ((meta.adminIds || []).includes(user.id)) return "admin";
  return null;
}

export function canEditApp(meta: AppMeta, user: User | null): boolean {
  const role = appRole(meta, user);
  return role === "owner" || role === "editor";
}

/** The app, if this person may change it in the builder (its owner or an editor). */
export async function getEditableApp(user: User, appId: string, ops?: StoreOps): Promise<AppMeta> {
  const meta = await getAppMeta(appId, ops);
  if (!canEditApp(meta, user)) throw forbidden("You need edit access to this app. Ask its owner for an editor invite link.");
  return meta;
}

/** The owner, or someone who accepted an invite (matched by account id, never by email). */
export function isAppAdmin(meta: AppMeta, user: User | null): boolean {
  if (!user) return false;
  return user.id === meta.ownerId || (meta.adminIds || []).includes(user.id) || (meta.editorIds || []).includes(user.id);
}

export function viewerFor(meta: AppMeta, user: User | null): Viewer {
  return { user, isAdmin: isAppAdmin(meta, user) };
}

export async function getDraft(appId: string): Promise<DraftDoc> {
  const store = await getStore();
  const d = await store.get<DraftDoc>("drafts", appId);
  if (!d) throw notFound("That app's design is missing.");
  return { ...d, doc: repairTemplateDoc(d.doc, (await getAppMeta(appId)).templateId) };
}

export async function getPublished(appId: string): Promise<PublishedDoc | null> {
  const store = await getStore();
  const published = await store.get<PublishedDoc>("published", appId);
  return published ? { ...published, doc: repairTemplateDoc(published.doc, (await getAppMeta(appId)).templateId) } : null;
}

export async function findPublishedBySlug(slug: string): Promise<{ meta: AppMeta; doc: AppDoc } | null> {
  const store = await getStore();
  const [meta] = await store.find<AppMeta>("apps", "slug", slug.toLowerCase());
  if (!meta?.published) return null;
  const pub = await store.get<PublishedDoc>("published", meta.id);
  if (!pub) return null;
  return { meta, doc: repairTemplateDoc(pub.doc, meta.templateId) };
}

/** A small copy of the home page for thumbnails. */
export function previewOf(doc: AppDoc): { page: Page; theme: AppDoc["theme"]; kind: AppKind } | null {
  const page = doc.pages.find((p) => p.id === doc.homePageId) || doc.pages[0];
  if (!page) return null;
  const keep = new Set<string>();
  const walk = (ids: string[], depth: number) => {
    for (const id of ids) {
      if (keep.size > 140) return;
      const el = page.elements[id];
      if (!el || el.hidden) continue;
      keep.add(id);
      if (el.childIds && depth < 4) walk(el.childIds, depth + 1);
    }
  };
  const visibleRoots = page.rootIds.filter((id) => (page.elements[id]?.box.y ?? 0) < 1100);
  walk(visibleRoots, 0);
  const elements: Page["elements"] = {};
  for (const id of keep) {
    const el = page.elements[id];
    elements[id] = { ...el, childIds: el.childIds?.filter((c) => keep.has(c)), events: undefined };
  }
  return {
    page: { ...page, elements, rootIds: visibleRoots.filter((id) => keep.has(id)), onLoad: undefined },
    theme: doc.theme,
    kind: doc.settings.kind === "mobile" ? "mobile" : "website",
  };
}

/* ------------------------------------------------------------------ list / create */

export async function listMyApps(user: User) {
  const store = await getStore();
  const apps = await store.find<AppMeta>("apps", "ownerId", user.id);
  apps.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const out = [];
  for (const meta of apps) {
    const draft = await store.get<DraftDoc>("drafts", meta.id);
    const preview = draft ? previewOf(draft.doc) : null;
    out.push({
      ...meta,
      kind: (draft?.doc.settings.kind === "mobile" ? "mobile" : "website") as AppKind,
      // the owner's thumbnails show a few of their own rows
      preview: preview ? { ...preview, ...(await previewData(meta.id, preview.page, { user, isAdmin: true }, true)) } : null,
      pageCount: draft?.doc.pages.length ?? 0,
    });
  }
  return out;
}

/**
 * Fields (and optionally a few rows) of the collections a thumbnail page uses, so lists and
 * stats in the thumbnail look real. Rows are only included for the app's own admins.
 */
export async function previewData(appId: string, page: Page, viewer: Viewer, withRows: boolean) {
  const store = await getStore();
  const json = JSON.stringify(page);
  const cols = (await store.find<Collection>("collections", "appId", appId)).filter((c) => json.includes(`"${c.id}"`));
  if (!cols.length) return {};
  const schema: SchemaCollection[] = cols.map((c) => ({
    id: c.id,
    name: c.name,
    fields: c.fields.map((f) => ({ id: f.id, name: f.name, type: f.type, required: !!f.required, options: f.options, currency: f.currency, refCollectionId: f.refCollectionId, min: f.min, max: f.max })),
  }));
  if (!withRows) return { schema };
  const samples: Record<string, RuntimeRecord[]> = {};
  for (const c of cols) {
    const recs = (await store.find<RecordDoc>("records", "collectionId", c.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
    samples[c.id] = await toRuntimeRecords(c, recs, viewer);
  }
  return { schema, samples };
}

function newMeta(user: User, name: string, extra: Partial<AppMeta> = {}): AppMeta {
  return {
    id: uid("app"),
    ownerId: user.id,
    name,
    description: "",
    emoji: APP_EMOJIS[Math.floor(Math.random() * APP_EMOJIS.length)],
    color: APP_COLORS[Math.floor(Math.random() * APP_COLORS.length)],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    revision: 1,
    adminIds: [],
    published: null,
    stats: { visits: 0, submissions: 0 },
    ...extra,
  };
}

function cleanAppName(name: unknown): string {
  const n = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!n) throw badRequest("Give your app a name.");
  if (n.length > 60) throw badRequest("App names can be at most 60 characters.");
  return n;
}

/** Replace every occurrence of old ids with new ids inside a JSON-able value. */
function remapIds<T>(value: T, map: Map<string, string>): T {
  if (!map.size) return value;
  let text = JSON.stringify(value);
  for (const [from, to] of map) text = text.split(`"${from}"`).join(`"${to}"`);
  return JSON.parse(text) as T;
}

export async function createApp(user: User, input: { name?: unknown; templateId?: unknown; kind?: unknown }) {
  const store = await getStore();
  const name = cleanAppName(input.name);
  const mine = await store.find<AppMeta>("apps", "ownerId", user.id);
  if (mine.length >= MAX_APPS_PER_USER) throw badRequest(`You can have up to ${MAX_APPS_PER_USER} apps.`);
  const template = typeof input.templateId === "string" && input.templateId !== "blank" ? getTemplate(input.templateId) : undefined;
  if (typeof input.templateId === "string" && input.templateId !== "blank" && !template) throw badRequest("That template doesn't exist.");
  const kind: AppKind = template ? template.kind || "website" : input.kind === "mobile" ? "mobile" : "website";

  return store.transaction(async (tx) => {
    const meta = newMeta(user, name, template ? { templateId: template.id, emoji: template.emoji, color: template.color, description: template.tagline, kind } : { kind });
    let doc: AppDoc = template ? template.build() : newAppDoc(undefined, kind);
    if (template) {
      // collections: give every template collection a real id, then fix references
      const idMap = new Map<string, string>();
      for (const c of template.collections) idMap.set(`@col:${c.key}`, uid("col"));
      const seedIds = new Map<string, string>();
      for (const c of template.collections) {
        const fields = c.fields.map((f) => ({ ...f, refCollectionId: f.refCollectionId ? idMap.get(f.refCollectionId) : undefined }));
        const col = await createCollection(meta.id, { name: c.name, icon: c.icon, fields, access: c.access, stock: c.stock }, tx, {
          id: idMap.get(`@col:${c.key}`)!,
          pending: new Set(idMap.values()),
        });
        const byName = new Map(col.fields.map((f) => [f.name.toLowerCase(), f]));
        const now = Date.now();
        const seed = c.seed || [];
        for (let i = 0; i < seed.length; i++) {
          const rid = uid("rec", 12);
          seedIds.set(`@seed:${c.key}:${i}`, rid);
          const data: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(seed[i])) {
            const f = byName.get(k.toLowerCase());
            if (f) data[f.id] = v;
          }
          // spread creation times out so "newest first" lists look natural
          const stamp = new Date(now - (seed.length - i) * 3_600_000).toISOString();
          await tx.put("records", {
            id: rid,
            appId: meta.id,
            collectionId: col.id,
            data,
            createdAt: stamp,
            updatedAt: stamp,
            createdBy: user.id,
          } satisfies RecordDoc);
        }
      }
      // seed values that point at other seed rows
      if (seedIds.size) {
        for (const c of template.collections) {
          const recs = await tx.find<RecordDoc>("records", "collectionId", idMap.get(`@col:${c.key}`)!);
          for (const r of recs) {
            let changed = false;
            for (const [k, v] of Object.entries(r.data)) {
              if (typeof v === "string" && seedIds.has(v)) {
                r.data[k] = seedIds.get(v);
                changed = true;
              }
            }
            if (changed) await tx.put("records", r);
          }
        }
      }
      doc = remapIds(doc, idMap);
    }
    doc = sanitizeDoc(doc);
    await tx.put("apps", meta);
    await tx.put("drafts", { id: meta.id, doc, revision: 1, updatedAt: nowIso() } satisfies DraftDoc);
    return meta;
  });
}

/* ------------------------------------------------------------------ edit */

export async function saveDraft(user: User, appId: string, rawDoc: unknown, baseRevision?: number) {
  const doc = sanitizeDoc(rawDoc);
  const store = await getStore();
  const saved = await withAppLock(appId, () => store.transaction(async (tx) => {
    const meta = await getEditableApp(user, appId, tx);
    const draft = await tx.get<DraftDoc>("drafts", appId);
    const current = draft?.revision ?? 0;
    if (typeof baseRevision === "number" && baseRevision < current)
      throw conflict("This app was changed in another tab or window.", { revision: current });
    const revision = current + 1;
    const updatedAt = nowIso();
    await tx.put("drafts", { id: appId, doc, revision, updatedAt } satisfies DraftDoc);
    meta.updatedAt = updatedAt;
    meta.revision = revision;
    meta.kind = doc.settings.kind === "mobile" ? "mobile" : "website";
    await tx.put("apps", meta);
    return { revision, updatedAt };
  }));
  // a whole-document save: anyone else with the editor open reloads it
  await publish(appId, { type: "reload", rev: saved.revision, clientId: null });
  return saved;
}

/** Deterministic JSON (sorted keys) so equal values compare equal whatever their key order. */
function stableJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(",")}}`;
}

/**
 * Live collaboration: apply some units of the design (see lib/shared/sync.ts), repair the
 * result, save it as the next revision and tell everyone with the editor open. The event lists
 * what actually changed on the server, which submitted units were accepted, and which of those
 * the server had to adjust (so the sender adopts the server's version).
 */
export async function applyLiveChanges(user: User, appId: string, clientId: string, changes: Change[]) {
  const store = await getStore();
  return withAppLock(appId, async () => {
    const result = await store.transaction(async (tx) => {
      const meta = await getEditableApp(user, appId, tx);
      const draft = await tx.get<DraftDoc>("drafts", appId);
      if (!draft) throw notFound("That app's design is missing.");
      let clean: AppDoc;
      try {
        clean = sanitizeDoc(applyChanges(draft.doc, changes));
      } catch (err) {
        throw badRequest(err instanceof Error ? err.message : "That change isn't valid.");
      }
      const before = new Map(unitEntries(draft.doc).map(([k, v]) => [k, stableJson(v)]));
      const after = new Map<string, string>();
      const out: Change[] = [];
      for (const [k, v] of unitEntries(clean)) {
        const json = stableJson(v);
        after.set(k, json);
        if (before.get(k) !== json) out.push({ k, v });
      }
      for (const k of before.keys()) if (!after.has(k)) out.push({ k, v: null });
      const accepted = changes.map((c) => c.k);
      const adjusted = changes.filter((c) => (after.get(c.k) ?? "null") !== stableJson(c.v)).map((c) => c.k);
      if (!out.length) return { rev: draft.revision, accepted, adjusted, event: null };
      const revision = draft.revision + 1;
      const updatedAt = nowIso();
      await tx.put("drafts", { id: appId, doc: clean, revision, updatedAt } satisfies DraftDoc);
      const kind = clean.settings.kind === "mobile" ? "mobile" : "website";
      // the app list shows when an app was edited: no need to rewrite it on every keystroke
      if (Date.now() - Date.parse(meta.updatedAt) > 30_000 || meta.kind !== kind) {
        meta.updatedAt = updatedAt;
        meta.revision = revision;
        meta.kind = kind;
        await tx.put("apps", meta);
      }
      const event = { type: "change" as const, rev: revision, clientId, userId: user.id, changes: out, accepted, adjusted };
      return { rev: revision, accepted, adjusted, event };
    });
    if (result.event) await publish(appId, result.event);
    return result;
  });
}

export async function updateAppMeta(user: User, appId: string, patch: Record<string, unknown>) {
  const store = await getStore();
  return store.transaction(async (tx) => {
    const meta = await getEditableApp(user, appId, tx);
    if (patch.name !== undefined) meta.name = cleanAppName(patch.name);
    if (typeof patch.description === "string") meta.description = patch.description.trim().slice(0, 300);
    if (typeof patch.emoji === "string" && patch.emoji.trim()) meta.emoji = Array.from(patch.emoji.trim()).slice(0, 2).join("");
    if (typeof patch.color === "string" && /^#[0-9a-f]{6}$/i.test(patch.color)) meta.color = patch.color;
    meta.updatedAt = nowIso();
    await tx.put("apps", meta);
    return meta;
  });
}

export async function deleteApp(user: User, appId: string) {
  const store = await getStore();
  const mediaIds = await store.transaction(async (tx) => {
    await getOwnedApp(user, appId, tx);
    for (const col of await tx.find<Collection>("collections", "appId", appId)) {
      await tx.deleteWhere("records", "collectionId", col.id);
      await tx.delete("collections", col.id);
    }
    await tx.deleteWhere("versions", "appId", appId);
    const builds = await tx.find<DeploymentDoc>("mobileDeployments", "appId", appId);
    await tx.deleteWhere("mobileDeployments", "appId", appId);
    await tx.delete("drafts", appId);
    await tx.delete("published", appId);
    await tx.deleteWhere("memberships", "appId", appId);
    await tx.deleteWhere("invites", "appId", appId);
    await tx.deleteWhere("consents", "appId", appId);
    const media = await tx.find<{ id: string }>("media", "appId", appId);
    await tx.deleteWhere("media", "appId", appId);
    await tx.delete("apps", appId);
    return [...media.map((m) => m.id), ...builds.flatMap((b) => b.artifactId ? [b.artifactId] : [])];
  });
  for (const id of mediaIds) await store.deleteBlob(id);
}

/** Copy collections (and optionally records) of one app into another; returns the id map. */
async function copyData(tx: StoreOps, fromAppId: string, toAppId: string, withRecords: boolean, userId: string) {
  const cols = await tx.find<Collection>("collections", "appId", fromAppId);
  const idMap = new Map<string, string>();
  for (const c of cols) idMap.set(c.id, uid("col"));
  for (const c of cols) {
    const copy: Collection = {
      ...c,
      id: idMap.get(c.id)!,
      appId: toAppId,
      fields: c.fields.map((f) => ({ ...f, refCollectionId: f.refCollectionId ? idMap.get(f.refCollectionId) || f.refCollectionId : undefined })),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await tx.put("collections", copy);
  }
  if (withRecords) {
    const recMap = new Map<string, string>();
    const all: RecordDoc[] = [];
    for (const c of cols) all.push(...(await tx.find<RecordDoc>("records", "collectionId", c.id)));
    for (const r of all) recMap.set(r.id, uid("rec", 12));
    for (const r of all) {
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r.data)) data[k] = typeof v === "string" && recMap.has(v) ? recMap.get(v) : v;
      await tx.put("records", { ...r, id: recMap.get(r.id)!, appId: toAppId, collectionId: idMap.get(r.collectionId)!, data, createdBy: r.createdBy ? userId : null });
    }
  }
  return idMap;
}

/** The app limit applies however an app is made (new, duplicate, remix). */
async function checkAppLimit(ops: StoreOps, user: User) {
  const mine = await ops.find<AppMeta>("apps", "ownerId", user.id);
  if (mine.length >= MAX_APPS_PER_USER) throw badRequest(`You can have up to ${MAX_APPS_PER_USER} apps.`);
}

/** Point a design at copied files. */
function remapMedia<T>(doc: T, files: Map<string, string>): T {
  if (!files.size) return doc;
  let text = JSON.stringify(doc);
  for (const [from, to] of files) text = text.split(`/api/media/${from}`).join(`/api/media/${to}`);
  return JSON.parse(text) as T;
}

export async function duplicateApp(user: User, appId: string) {
  const store = await getStore();
  const src = await getOwnedApp(user, appId);
  const draft = await store.get<DraftDoc>("drafts", appId);
  if (!draft) throw notFound("That app's design is missing.");
  await checkAppLimit(store, user);
  const meta = newMeta(user, `${src.name} copy`.slice(0, 60), {
    emoji: src.emoji,
    color: src.color,
    description: src.description,
    templateId: src.templateId,
    kind: src.kind,
    // a copy of an app that was taken offline can't be published either
    ...(src.takenDown ? { takenDown: src.takenDown } : {}),
  });
  // the copy gets its own image files, so deleting the original can't break it
  const files = await copyDesignFiles(draft.doc, user, meta.id);
  return store.transaction(async (tx) => {
    await checkAppLimit(tx, user);
    const idMap = await copyData(tx, appId, meta.id, true, user.id);
    await tx.put("apps", meta);
    await tx.put("drafts", { id: meta.id, doc: remapMedia(remapIds(draft.doc, idMap), files), revision: 1, updatedAt: nowIso() } satisfies DraftDoc);
    return meta;
  });
}

/* ------------------------------------------------------------------ versions */

export async function listVersions(user: User, appId: string) {
  await getEditableApp(user, appId);
  const store = await getStore();
  const versions = await store.find<AppVersion>("versions", "appId", appId);
  return versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ doc: _doc, ...v }) => v);
}

export async function saveVersion(user: User, appId: string, label: unknown) {
  const store = await getStore();
  return store.transaction(async (tx) => {
    await getEditableApp(user, appId, tx);
    const draft = await tx.get<DraftDoc>("drafts", appId);
    if (!draft) throw notFound();
    const existing = await tx.find<AppVersion>("versions", "appId", appId);
    if (existing.length >= 50) {
      // keep the newest 49
      existing.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const old of existing.slice(0, existing.length - 49)) await tx.delete("versions", old.id);
    }
    const v: AppVersion = {
      id: uid("ver"),
      appId,
      label: (typeof label === "string" && label.trim().slice(0, 80)) || `Version ${existing.length + 1}`,
      createdAt: nowIso(),
      doc: draft.doc,
    };
    await tx.put("versions", v);
    const { doc: _d, ...rest } = v;
    return rest;
  });
}

export async function restoreVersion(user: User, appId: string, versionId: string, clientId: string | null = null) {
  const store = await getStore();
  const restored = await withAppLock(appId, () =>
    store.transaction(async (tx) => {
      const meta = await getEditableApp(user, appId, tx);
      const v = await tx.get<AppVersion>("versions", versionId);
      if (!v || v.appId !== appId) throw notFound("That version doesn't exist anymore.");
      const draft = await tx.get<DraftDoc>("drafts", appId);
      const revision = (draft?.revision ?? 0) + 1;
      await tx.put("drafts", { id: appId, doc: v.doc, revision, updatedAt: nowIso() } satisfies DraftDoc);
      meta.revision = revision;
      meta.updatedAt = nowIso();
      await tx.put("apps", meta);
      return { doc: v.doc, revision };
    }),
  );
  // everyone else with the editor open switches to the restored design
  await publish(appId, { type: "reload", rev: restored.revision, clientId });
  return restored;
}

export async function deleteVersion(user: User, appId: string, versionId: string) {
  const store = await getStore();
  await getEditableApp(user, appId);
  const v = await store.get<AppVersion>("versions", versionId);
  if (!v || v.appId !== appId) throw notFound();
  await store.delete("versions", versionId);
}

/* ------------------------------------------------------------------ publishing */

export function slugError(slug: string): string | null {
  if (!slug) return "Choose a link name.";
  if (slug.length < 3) return "Link names need at least 3 characters.";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "Use lowercase letters, numbers and dashes.";
  if (RESERVED_SLUGS.has(slug)) return "That link name is reserved.";
  return null;
}

export async function checkSlug(appId: string, raw: string) {
  const slug = slugify(raw);
  const err = slugError(slug);
  if (err) return { slug, available: false, error: err };
  const store = await getStore();
  const [other] = await store.find<AppMeta>("apps", "slug", slug);
  if (other && other.id !== appId) return { slug, available: false, error: "Another app already uses that link." };
  return { slug, available: true, error: null };
}

export async function publishApp(user: User, appId: string, input: { slug?: unknown; explore?: unknown; description?: unknown; expectedRevision?: unknown; mobileTarget?: unknown }) {
  const store = await getStore();
  return store.transaction(async (tx) => {
    const meta = await getEditableApp(user, appId, tx);
    // phone builds belong to the owner (they alone see and manage them)
    if (input.mobileTarget !== undefined && meta.ownerId !== user.id) throw forbidden("Only the app's owner can start phone builds.");
    if (meta.takenDown) throw forbidden(`The site's operators took this app offline (${meta.takenDown.reason}). To appeal, contact ${contactLine()}.`);
    const draft = await tx.get<DraftDoc>("drafts", appId);
    if (!draft) throw notFound();
    if (input.expectedRevision !== undefined && input.expectedRevision !== draft.revision) throw conflict("Your draft changed before publishing. Save the latest changes and try again.");
    if (input.mobileTarget !== undefined && draft.doc.settings.kind !== "mobile") throw badRequest("Phone builds are available for mobile apps only.");
    if (input.mobileTarget !== undefined && input.expectedRevision === undefined) throw badRequest("Save your draft before publishing a phone build.");
    const slug = slugify(typeof input.slug === "string" && input.slug ? input.slug : meta.published?.slug || meta.name);
    const err = slugError(slug);
    if (err) throw badRequest(err);
    const [other] = await tx.find<AppMeta>("apps", "slug", slug);
    if (other && other.id !== appId) throw conflict("Another app already uses that link. Try a different name.");
    if (meta.published && meta.published.slug !== slug) await stopAppDeployments(tx, appId, "The app's published address changed. Start a new phone test.");
    const at = nowIso();
    await tx.put("published", { id: appId, doc: draft.doc, publishedAt: at } satisfies PublishedDoc);
    meta.published = {
      slug,
      at,
      explore: input.explore === undefined ? (meta.published?.explore ?? false) : !!input.explore,
      description: typeof input.description === "string" ? input.description.trim().slice(0, 300) : meta.published?.description || meta.description,
      revision: draft.revision,
    };
    await tx.put("apps", meta);
    if (input.mobileTarget !== undefined) await queueMobileDeployment(tx, meta, input.mobileTarget);
    return meta;
  });
}

export async function unpublishApp(user: User, appId: string) {
  const store = await getStore();
  return store.transaction(async (tx) => {
    const meta = await getEditableApp(user, appId, tx);
    meta.published = null;
    await stopAppDeployments(tx, appId, "The app was unpublished. Start a new phone test after publishing it again.");
    await tx.put("apps", meta);
    await tx.delete("published", appId);
    return meta;
  });
}

export async function listExplore(query: string, limit = 60) {
  const store = await getStore();
  const apps = await store.find<AppMeta>("apps", "explore", "1");
  const q = query.trim().toLowerCase();
  const matches = apps.filter(
    (a) => !q || a.name.toLowerCase().includes(q) || (a.published?.description || a.description).toLowerCase().includes(q),
  );
  matches.sort((a, b) => b.stats.visits - a.stats.visits || (b.published?.at || "").localeCompare(a.published?.at || ""));
  const out = [];
  for (const meta of matches.slice(0, limit)) {
    const pub = await store.get<PublishedDoc>("published", meta.id);
    const owner = await store.get<User>("users", meta.ownerId);
    if (!pub) continue;
    out.push({
      id: meta.id,
      name: meta.name,
      emoji: meta.emoji,
      color: meta.color,
      slug: meta.published!.slug,
      description: meta.published!.description || meta.description,
      visits: meta.stats.visits,
      author: owner?.name || "A maker",
      publishedAt: meta.published!.at,
      // public cards get field names only (placeholder rows), never real data
      preview: await (async () => {
        const p = previewOf(pub.doc);
        return p ? { ...p, ...(await previewData(meta.id, p.page, { user: null, isAdmin: false }, false)) } : null;
      })(),
    });
  }
  return out;
}

export async function remixApp(user: User, appId: string) {
  const store = await getStore();
  const src = await getAppMeta(appId);
  if (!src.published?.explore && src.ownerId !== user.id) throw forbidden("That app can't be remixed.");
  const pub = await store.get<PublishedDoc>("published", appId);
  if (!pub) throw notFound("That app isn't published anymore.");
  await checkAppLimit(store, user);
  const meta = newMeta(user, `${src.name} remix`.slice(0, 60), { emoji: src.emoji, color: src.color, description: src.description, remixedFrom: src.id, kind: pub.doc.settings.kind === "mobile" ? "mobile" : "website" });
  const files = await copyDesignFiles(pub.doc, user, meta.id);
  return store.transaction(async (tx) => {
    await checkAppLimit(tx, user);
    const idMap = await copyData(tx, appId, meta.id, false, user.id);
    await tx.put("apps", meta);
    await tx.put("drafts", { id: meta.id, doc: remapMedia(remapIds(pub.doc, idMap), files), revision: 1, updatedAt: nowIso() } satisfies DraftDoc);
    return meta;
  });
}

/* ------------------------------------------------------------------ stats + admins */

function bumpDaily(meta: AppMeta, key: "v" | "s") {
  const day = nowIso().slice(0, 10);
  const daily = { ...(meta.stats.daily || {}) };
  daily[day] = { v: daily[day]?.v || 0, s: daily[day]?.s || 0 };
  daily[day][key]++;
  const days = Object.keys(daily).sort();
  for (const d of days.slice(0, Math.max(0, days.length - 30))) delete daily[d];
  meta.stats.daily = daily;
}

export async function recordVisit(appId: string) {
  const store = await getStore();
  await store.transaction(async (tx) => {
    const meta = await tx.get<AppMeta>("apps", appId);
    if (!meta) return;
    meta.stats.visits++;
    bumpDaily(meta, "v");
    await tx.put("apps", meta);
  });
}

export async function recordSubmission(appId: string) {
  const store = await getStore();
  await store.transaction(async (tx) => {
    const meta = await tx.get<AppMeta>("apps", appId);
    if (!meta) return;
    meta.stats.submissions++;
    bumpDaily(meta, "s");
    await tx.put("apps", meta);
  });
}


export async function appCounts(user: User) {
  const store = await getStore();
  const apps = await store.find<AppMeta>("apps", "ownerId", user.id);
  return { apps: apps.length, published: apps.filter((a) => a.published).length };
}
