import { runtimeContext } from "@/lib/server/runtime";
import { canWrite, fieldByRef, getCollection } from "@/lib/server/data";
import { saveAttachment, VISITOR_LIMIT } from "@/lib/server/media";
import { badRequest, clientIp, forbidden, rateLimit, readForm, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

/**
 * A file a visitor attaches through a form's File field. Only for a file/image field of a
 * collection in this app that the visitor may add to (or change) — no free file hosting.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const { user, viewer } = await runtimeContext(appId);
  if (!viewer.isAdmin) {
    rateLimit(`upload:${appId}:${clientIp(req)}`, 20, 60_000);
    rateLimit(`upload-day:${appId}:${clientIp(req)}`, 200, 24 * 3600_000);
  }
  const form = await readForm(req, VISITOR_LIMIT + 64 * 1024);
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("No file was uploaded.");
  const collectionId = String(form.get("collectionId") || "");
  const fieldName = String(form.get("field") || "");
  if (!collectionId || !fieldName) throw badRequest("This file field isn't connected to a collection. Put it in a form that saves to one.");
  const col = await getCollection(appId, collectionId);
  const field = fieldByRef(col, fieldName);
  if (!field || (field.type !== "file" && field.type !== "image")) throw badRequest(`${col.name} has no file field called "${fieldName}".`);
  if (!viewer.isAdmin && !canWrite(col, viewer)) throw forbidden("You can't add files here.");
  const item = await saveAttachment(file, { uploader: user, appId, collectionId: col.id, fieldId: field.id });
  return { url: `/api/media/${item.id}`, name: item.name, mime: item.mime, size: item.size };
});
