import { requireUser } from "@/lib/server/auth";
import { getOwnedApp } from "@/lib/server/apps";
import { deleteCollection, updateCollection } from "@/lib/server/data";
import { audit } from "@/lib/server/audit";
import { clientIp, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string; collectionId: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { appId, collectionId } = await params;
  const user = await requireUser();
  await getOwnedApp(user, appId);
  const body = await readJson<Record<string, unknown>>(req);
  const collection = await updateCollection(appId, collectionId, body);
  if (body.access !== undefined) await audit({ action: "collection.access", userId: user.id, appId, target: collection.name, detail: JSON.stringify(collection.access), ip: clientIp(req) });
  return { collection };
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { appId, collectionId } = await params;
  const user = await requireUser();
  await getOwnedApp(user, appId);
  await deleteCollection(appId, collectionId);
  await audit({ action: "collection.deleted", userId: user.id, appId, target: collectionId, ip: clientIp(req) });
  return { ok: true };
});
