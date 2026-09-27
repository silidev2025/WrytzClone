import { requireUser } from "@/lib/server/auth";
import { checkSlug, getOwnedApp, publishApp, unpublishApp } from "@/lib/server/apps";
import { audit } from "@/lib/server/audit";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

/** Check whether a link name is free: GET ?slug=my-app */
export const GET = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  await getOwnedApp(user, appId);
  const slug = new URL(req.url).searchParams.get("slug") || "";
  return await checkSlug(appId, slug);
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  const body = await readJson<{ slug?: string; explore?: boolean; description?: string; expectedRevision?: number; mobileTarget?: string }>(req);
  if (body.mobileTarget !== undefined) rateLimit(`mobile-publish:${user.id}`, 12, 3600_000);
  const app = await publishApp(user, appId, body);
  await audit({ action: "app.published", userId: user.id, appId, detail: app.published?.slug, ip: clientIp(req) });
  return { app };
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  const app = await unpublishApp(user, appId);
  await audit({ action: "app.unpublished", userId: user.id, appId, ip: clientIp(req) });
  return { app };
});
