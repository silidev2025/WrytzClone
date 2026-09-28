import { requireUser } from "@/lib/server/auth";
import { getEditableApp } from "@/lib/server/apps";
import { deleteCollection, updateCollection } from "@/lib/server/data";
import { audit } from "@/lib/server/audit";
import { clientIp, readJson, route } from "@/lib/server/http";
import { dataChanged } from "@/lib/server/live";

type Ctx = { params: Promise<{ appId: string; collectionId: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { appId, collectionId } = await params;
  const user = await requireUser();
  await getEditableApp(user, appId);
  const body = await readJson<Record<string, unknown>>(req);
  const collection = await updateCollection(appId, collectionId, body, user);
  if (body.access !== undefined) await audit({ action: "collection.access", userId: user.id, appId, target: collection.name, detail: JSON.stringify(collection.access), ip: clientIp(req) });
  await dataChanged(appId, "collections", collectionId);
  return { collection };
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { appId, collectionId } = await params;
  const user = await requireUser();
  await getEditableApp(user, appId);
  await deleteCollection(appId, collectionId, user);
  await audit({ action: "collection.deleted", userId: user.id, appId, target: collectionId, ip: clientIp(req) });
  await dataChanged(appId, "collections", collectionId);
  return { ok: true };
});
