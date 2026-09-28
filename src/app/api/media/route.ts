import { requireUser } from "@/lib/server/auth";
import { getEditableApp } from "@/lib/server/apps";
import { EDITOR_LIMIT, listMedia, saveDesignUpload } from "@/lib/server/media";
import { badRequest, rateLimit, readForm, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const user = await requireUser();
  const appId = new URL(req.url).searchParams.get("appId");
  const items = await listMedia(user, appId);
  return { media: items.map((m) => ({ ...m, url: `/api/media/${m.id}` })) };
});

/** Design files (images for pages) uploaded in the editor. */
export const POST = route(async (req) => {
  const user = await requireUser();
  await rateLimit(`design-upload:${user.id}`, 60, 60_000);
  const form = await readForm(req, EDITOR_LIMIT + 64 * 1024);
  const file = form.get("file");
  const appId = form.get("appId");
  if (typeof appId === "string" && appId) await getEditableApp(user, appId);
  if (!(file instanceof File)) throw badRequest("No file was uploaded.");
  const item = await saveDesignUpload(file, user, typeof appId === "string" && appId ? appId : null);
  return { media: { ...item, url: `/api/media/${item.id}` } };
});
