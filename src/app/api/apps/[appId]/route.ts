import { requireUser } from "@/lib/server/auth";
import { appRole, deleteApp, getDraft, getEditableApp, updateAppMeta } from "@/lib/server/apps";
import { listCollections } from "@/lib/server/data";
import { audit } from "@/lib/server/audit";
import { clientIp, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  const meta = await getEditableApp(user, appId);
  const draft = await getDraft(appId);
  return { app: meta, role: appRole(meta, user), doc: draft.doc, revision: draft.revision, collections: await listCollections(appId) };
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  return { app: await updateAppMeta(user, appId, body) };
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  await deleteApp(user, appId);
  await audit({ action: "app.deleted", userId: user.id, appId, ip: clientIp(req) });
  return { ok: true };
});
