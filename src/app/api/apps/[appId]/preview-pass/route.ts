import { requireUser } from "@/lib/server/auth";
import { getEditableApp } from "@/lib/server/apps";
import { rateLimit, route } from "@/lib/server/http";
import { createPreviewPass } from "@/lib/server/previewPass";

type Ctx = { params: Promise<{ appId: string }> };

/** A one-hour pass for opening this app's preview on another device (the QR code in Preview). */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  await rateLimit(`preview-pass:${user.id}`, 30, 60_000);
  await getEditableApp(user, appId);
  return createPreviewPass(appId, user.id);
});
