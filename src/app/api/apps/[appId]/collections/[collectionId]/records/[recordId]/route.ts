import { requireUser } from "@/lib/server/auth";
import { getOwnedApp } from "@/lib/server/apps";
import { getCollection, makerRecord, updateRecord } from "@/lib/server/data";
import { readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string; collectionId: string; recordId: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { appId, collectionId, recordId } = await params;
  const user = await requireUser();
  await getOwnedApp(user, appId);
  const col = await getCollection(appId, collectionId);
  const body = await readJson<{ values?: Record<string, unknown> }>(req);
  return { record: makerRecord(appId, await updateRecord(col, recordId, body.values || {}, { user, isAdmin: true })) };
});
