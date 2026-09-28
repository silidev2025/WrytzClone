import { requireUser } from "@/lib/server/auth";
import { getEditableApp } from "@/lib/server/apps";
import { createCollection, listCollections } from "@/lib/server/data";
import { readJson, route } from "@/lib/server/http";
import { dataChanged } from "@/lib/server/live";

type Ctx = { params: Promise<{ appId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  await getEditableApp(user, appId);
  return { collections: await listCollections(appId) };
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  await getEditableApp(user, appId);
  const body = await readJson<Record<string, unknown>>(req);
  // only these are taken from the request; the id is always made by the server
  const { name, fields, access, icon, stock } = body;
  const collection = await createCollection(appId, { name, fields, access, icon, stock }, undefined, undefined, user);
  await dataChanged(appId, "collections", collection.id);
  return { collection };
});
