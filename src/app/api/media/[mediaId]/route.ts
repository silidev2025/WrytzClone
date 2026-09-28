import type { AppMeta, Collection, RecordDoc, User } from "@/lib/shared/types";
import { currentUser, requireUser } from "@/lib/server/auth";
import { isAppAdmin } from "@/lib/server/apps";
import { audit } from "@/lib/server/audit";
import { canReadField } from "@/lib/server/data";
import { deleteMedia, getMediaItem } from "@/lib/server/media";
import { blobResponse } from "@/lib/server/blob-response";
import { viewerForApp } from "@/lib/server/runtime";
import { getStore } from "@/lib/server/store";
import { clientIp, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ mediaId: string }> };

/**
 * Design files are public. Attachments are served only to the app's admins, the person who
 * uploaded them, or someone allowed to read that field of the record they belong to.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { mediaId } = await params;
  const item = await getMediaItem(mediaId);
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!item || item.pending) return notFound();
  const store = await getStore();
  const owner = await store.get<User>("users", item.ownerId);
  if (!owner || owner.suspended || owner.deletingAt) return notFound();
  if (!item.public) {
    const meta = item.appId ? await store.get<AppMeta>("apps", item.appId) : null;
    if (!meta) return notFound();
    const account = await currentUser();
    const viewer = await viewerForApp(meta, account);
    let allowed = viewer.isAdmin || (!!account && item.uploaderId === account.id);
    if (!allowed && item.recordId && item.collectionId) {
      const col = await store.get<Collection>("collections", item.collectionId);
      const rec = await store.get<RecordDoc>("records", item.recordId);
      const field = col?.fields.find((f) => f.id === item.fieldId && (f.type === "file" || f.type === "image"));
      allowed = !!col && !!rec && !!field && col.appId === meta.id && rec.appId === meta.id && rec.collectionId === col.id &&
        rec.data[field.id] === `/api/media/${item.id}` && (meta.published !== null || viewer.isAdmin) && canReadField(col, rec, item.fieldId, viewer);
    }
    // same answer as a missing file, so ids can't be probed
    if (!allowed) return notFound();
  }
  const image = item.mime.startsWith("image/") && item.mime !== "image/svg+xml";
  // design media may play in the page; attachments (and anything not an image) always download
  const inline = image || (item.public && (item.mime === "application/pdf" || item.mime.startsWith("video/") || item.mime.startsWith("audio/")));
  const headers: Record<string, string> = {
    "Content-Type": item.mime,
    "Cache-Control": item.public ? "public, max-age=86400" : "private, no-store",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(item.name)}"`,
    "X-Content-Type-Options": "nosniff",
    // nothing served from here may run scripts on our origin
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    "Cross-Origin-Resource-Policy": "same-site",
  };
  return blobResponse(req, item.id, item.size, headers);
}

/** The uploader, or the app's owner/admins, may delete a file. */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const { mediaId } = await params;
  const user = await requireUser();
  const item = await deleteMedia(user, mediaId, (meta) => isAppAdmin(meta, user));
  await audit({ action: "media.deleted", userId: user.id, appId: item.appId, target: item.id, ip: clientIp(req) });
  return { ok: true };
});
