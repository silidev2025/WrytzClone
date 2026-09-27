import { requireUser } from "@/lib/server/auth";
import { getEditableApp } from "@/lib/server/apps";
import { getCollection, makerRecord, updateRecord } from "@/lib/server/data";
import { readJson, route } from "@/lib/server/http";
import { dataChanged } from "@/lib/server/live";

type Ctx = { params: Promise<{ appId: string; collectionId: string; recordId: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { appId, collectionId, recordId } = await params;
  const user = await requireUser();
  await getEditableApp(user, appId);
  const col = await getCollection(appId, collectionId);
  const body = await readJson<{ values?: Record<string, unknown> }>(req);
  const record = makerRecord(appId, await updateRecord(col, recordId, body.values || {}, { user, isAdmin: true }));
  dataChanged(appId, "records", col.id);
  return { record };
});
