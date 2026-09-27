import type { AppMeta, Collection, MediaItem, RecordDoc, User } from "@/lib/shared/types";
import { nowIso, uid } from "@/lib/shared/util";
import { getStore, type StoreOps } from "./store";
import { badRequest, forbidden, HttpError, notFound } from "./http";

/*
 * Two kinds of files:
 *  - design files: images the maker uploads in the editor. Public (they appear on pages).
 *  - attachments: files visitors add through a form's File field. Private: readable by the
 *    app's admins, the person who uploaded them, and whoever may read the record they are
 *    attached to (following that collection's rules and private fields).
 * Files are type-checked by their first bytes, but not virus-scanned: attachments are always
 * downloaded (never opened inside the site) and people should treat them with care.
 */

export const EDITOR_LIMIT = 10 * 1024 * 1024;
export const VISITOR_LIMIT = 5 * 1024 * 1024;
/** storage caps, so one account or app can't fill the disk */
export const USER_QUOTA = 500 * 1024 * 1024;
export const APP_ATTACHMENT_QUOTA = 1024 * 1024 * 1024;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];
const OFFICE_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
/** what the maker may upload in the editor */
const EDITOR_TYPES = [...IMAGE_TYPES, "image/svg+xml", "application/pdf", "text/plain", "text/csv", "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg", ...OFFICE_TYPES];
/** what visitors may attach: pictures and everyday documents — no archives, programs or media */
const ATTACHMENT_TYPES = [...IMAGE_TYPES, "application/pdf", "text/plain", "text/csv", ...OFFICE_TYPES];

/** Work out the real type from the first bytes, so a renamed file can't pretend to be something else. */
function sniff(buf: Buffer): string | null {
  const b = buf;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && b.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.length >= 12 && b.toString("ascii", 4, 8) === "ftyp" && /avif|avis/.test(b.toString("ascii", 8, 12))) return "image/avif";
  if (b.length >= 5 && b.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "zip";
  if (b.length >= 8 && b.readUInt32BE(0) === 0xd0cf11e0 && b.readUInt32BE(4) === 0xa1b11ae1) return "ole";
  const head = b.toString("utf8", 0, Math.min(b.length, 512)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

/** Decide the type we will store and serve, or refuse the file. */
function checkedType(buf: Buffer, declared: string, name: string, allowed: string[]): string {
  const sniffed = sniff(buf);
  const ext = (name.split(".").pop() || "").toLowerCase();
  let mime: string;
  if (sniffed === "zip") {
    // Word/Excel/PowerPoint files are zip files; a plain .zip is not accepted
    const byExt: Record<string, string> = { docx: OFFICE_TYPES[1], xlsx: OFFICE_TYPES[2], pptx: OFFICE_TYPES[3] };
    if (!byExt[ext] || declared === "application/zip") throw badRequest("That file type isn't supported.");
    mime = byExt[ext];
  } else if (sniffed === "ole") {
    if (ext !== "doc") throw badRequest("That file type isn't supported.");
    mime = OFFICE_TYPES[0];
  } else if (sniffed) {
    mime = sniffed;
  } else {
    mime = declared || "application/octet-stream";
    // anything claiming to be an image, a PDF or a document must look like one
    if (IMAGE_TYPES.includes(mime) || mime === "image/svg+xml" || mime === "application/pdf" || OFFICE_TYPES.includes(mime)) throw badRequest("That file doesn't match its type.");
    if (mime === "text/plain" || mime === "text/csv") {
      if (buf.subarray(0, 8192).includes(0)) throw badRequest("That doesn't look like a text file.");
    } else if (mime.startsWith("video/") || mime.startsWith("audio/")) {
      /* editor media: accepted as declared, always served with nosniff */
    }
  }
  if (!allowed.includes(mime)) throw badRequest("That file type isn't supported. Try an image, a PDF or an office document.");
  return mime;
}

async function usedBytes(filter: (m: MediaItem) => boolean, list: MediaItem[]): Promise<number> {
  return list.filter(filter).reduce((sum, m) => sum + (m.size || 0), 0);
}

/** A design file uploaded in the editor. */
export async function saveDesignUpload(file: File, owner: User, appId: string | null): Promise<MediaItem> {
  return save(file, { limit: EDITOR_LIMIT, allowed: EDITOR_TYPES, owner, appId, attachment: null });
}

/** A file a visitor attaches through a File field (see the upload route for the permission check). */
export async function saveAttachment(file: File, opts: { uploader: User | null; appId: string; collectionId: string; fieldId: string }): Promise<MediaItem> {
  return save(file, { limit: VISITOR_LIMIT, allowed: ATTACHMENT_TYPES, owner: opts.uploader, appId: opts.appId, attachment: { collectionId: opts.collectionId, fieldId: opts.fieldId } });
}

async function save(
  file: File,
  opts: { limit: number; allowed: string[]; owner: User | null; appId: string | null; attachment: { collectionId: string; fieldId: string } | null },
): Promise<MediaItem> {
  if (!(file instanceof File)) throw badRequest("No file was uploaded.");
  if (file.size === 0) throw badRequest("That file is empty.");
  if (file.size > opts.limit) throw new HttpError(413, `Files can be at most ${Math.round(opts.limit / 1024 / 1024)} MB.`);
  const name = (file.name || "upload").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120);
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = checkedType(buf, file.type, name, opts.allowed);

  const store = await getStore();
  if (opts.attachment && opts.appId) {
    const used = await usedBytes((m) => !m.public, await store.find<MediaItem>("media", "appId", opts.appId));
    if (used + file.size > APP_ATTACHMENT_QUOTA) throw new HttpError(413, "This app has no room for more files. Its owner can free space by deleting records with attachments.");
  } else if (opts.owner) {
    const used = await usedBytes((m) => m.public, await store.find<MediaItem>("media", "ownerId", opts.owner.id));
    if (used + file.size > USER_QUOTA) throw new HttpError(413, `You've used your ${Math.round(USER_QUOTA / 1024 / 1024)} MB of uploads. Delete some files first.`);
  }
  const item: MediaItem = {
    id: uid("med", 16),
    ownerId: opts.owner?.id || "visitor",
    appId: opts.appId,
    name,
    mime,
    size: file.size,
    createdAt: nowIso(),
    public: !opts.attachment,
  };
  if (opts.attachment) {
    item.collectionId = opts.attachment.collectionId;
    item.fieldId = opts.attachment.fieldId;
    item.uploaderId = opts.owner?.id ?? null;
  }
  await store.putBlob(item.id, buf);
  await store.put("media", item);
  return item;
}

export async function listMedia(user: User, appId?: string | null) {
  const store = await getStore();
  const mine = await store.find<MediaItem>("media", "ownerId", user.id);
  return mine
    .filter((m) => m.public && (!appId || m.appId === appId || m.appId === null))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The uploader, or the owner/admins of the app a file belongs to, may delete it. */
export async function deleteMedia(user: User, id: string, isAppAdmin: (meta: AppMeta) => boolean) {
  const store = await getStore();
  const item = await store.get<MediaItem>("media", id);
  if (!item) throw notFound("That file doesn't exist anymore.");
  let allowed = item.ownerId === user.id;
  if (!allowed && item.appId) {
    const meta = await store.get<AppMeta>("apps", item.appId);
    allowed = !!meta && isAppAdmin(meta);
  }
  if (!allowed) throw forbidden();
  await store.delete("media", id);
  await store.deleteBlob(id);
  return item;
}

export async function getMediaItem(id: string) {
  const store = await getStore();
  return store.get<MediaItem>("media", id);
}

export async function readBlob(id: string) {
  const store = await getStore();
  return store.getBlob(id);
}

const MEDIA_URL = /\/api\/media\/(med_[A-Za-z0-9]+)/;

/** Media ids referenced by a record's file and image fields. */
export function attachmentIds(col: Collection, data: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const f of col.fields) {
    if (f.type !== "file" && f.type !== "image") continue;
    const m = typeof data[f.id] === "string" ? MEDIA_URL.exec(data[f.id] as string) : null;
    if (m) out.push(m[1]);
  }
  return out;
}

/**
 * Link fresh attachments to the record that now uses them (their read access follows the
 * record from then on), and drop attachments the record no longer uses.
 */
export async function syncAttachments(tx: StoreOps, col: Collection, rec: RecordDoc, uploaderId: string | null, before?: Record<string, unknown>) {
  const now = attachmentIds(col, rec.data);
  for (const id of now) {
    const m = await tx.get<MediaItem>("media", id);
    if (!m || m.public || m.appId !== col.appId || m.collectionId !== col.id) continue;
    if (m.recordId && m.recordId !== rec.id) continue; // already belongs to another record
    if (!m.recordId && (m.uploaderId ?? null) !== (uploaderId ?? null)) continue; // someone else's upload
    if (m.recordId !== rec.id) await tx.put("media", { ...m, recordId: rec.id });
  }
  if (before) {
    const gone = attachmentIds(col, before).filter((id) => !now.includes(id));
    for (const id of gone) {
      const m = await tx.get<MediaItem>("media", id);
      if (m && !m.public && m.recordId === rec.id) await tx.delete("media", id);
    }
  }
}

/** Attachments of records being deleted (their blobs are removed after the transaction). */
export async function attachmentsOf(tx: StoreOps, recordId: string): Promise<MediaItem[]> {
  return (await tx.find<MediaItem>("media", "recordId", recordId)).filter((m) => !m.public);
}

export async function deleteBlobs(ids: string[]) {
  const store = await getStore();
  for (const id of ids) await store.deleteBlob(id);
}

/** Copy design files so a duplicated or remixed app doesn't depend on the original's. */
export async function copyDesignFiles(doc: unknown, toOwner: User, toAppId: string): Promise<Map<string, string>> {
  const store = await getStore();
  const text = JSON.stringify(doc);
  const ids = Array.from(new Set(Array.from(text.matchAll(/\/api\/media\/(med_[A-Za-z0-9]+)/g), (m) => m[1])));
  const map = new Map<string, string>();
  for (const id of ids.slice(0, 500)) {
    const m = await store.get<MediaItem>("media", id);
    if (!m || !m.public) continue;
    const data = await store.getBlob(id);
    if (!data) continue;
    const copy: MediaItem = { ...m, id: uid("med", 16), ownerId: toOwner.id, appId: toAppId, createdAt: nowIso() };
    await store.putBlob(copy.id, data);
    await store.put("media", copy);
    map.set(id, copy.id);
  }
  return map;
}
