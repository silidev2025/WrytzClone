import { runtimeContext } from "@/lib/server/runtime";
import { recordSubmission } from "@/lib/server/apps";
import { createRecord, deleteRecords, getCollection, recordForViewer, updateRecord } from "@/lib/server/data";
import { audit } from "@/lib/server/audit";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";
import { idempotent } from "@/lib/server/idempotency";
import { dataChanged, queueLiveEvent } from "@/lib/server/live";

type Ctx = { params: Promise<{ appId: string }> };

interface Body {
  collectionId?: string;
  recordId?: string;
  values?: Record<string, unknown>;
  /** the same key sent twice (a double tap, a retry) only saves once */
  idempotencyKey?: string;
}

export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const { viewer } = await runtimeContext(appId);
  if (!viewer.isAdmin) await rateLimit(`create:${appId}:${clientIp(req)}`, 60, 60_000);
  const body = await readJson<Body>(req, 2_000_000);
  const col = await getCollection(appId, String(body.collectionId || ""));
  const result = await idempotent(`create:${appId}:${viewer.user?.id ?? clientIp(req)}`, body.idempotencyKey, body, async (tx) => {
    const rec = await createRecord(col, body.values || {}, viewer, tx);
    await recordSubmission(appId, tx);
    await queueLiveEvent(tx, appId, { type: "data", kind: "records", collectionId: col.id });
    return { record: rec };
  });
  await dataChanged(appId, "records", col.id);
  return { record: await recordForViewer(await getCollection(appId, col.id), result.record, viewer) };
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const { viewer } = await runtimeContext(appId);
  if (!viewer.isAdmin) await rateLimit(`update:${appId}:${clientIp(req)}`, 60, 60_000);
  const body = await readJson<Body>(req, 2_000_000);
  const col = await getCollection(appId, String(body.collectionId || ""));
  const rec = await updateRecord(col, String(body.recordId || ""), body.values || {}, viewer);
  await dataChanged(appId, "records", col.id);
  return { record: await recordForViewer(col, rec, viewer) };
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const { viewer } = await runtimeContext(appId);
  if (!viewer.isAdmin) await rateLimit(`delete:${appId}:${clientIp(req)}`, 60, 60_000);
  const body = await readJson<Body>(req);
  const col = await getCollection(appId, String(body.collectionId || ""));
  await deleteRecords(col, [String(body.recordId || "")], viewer);
  await audit({ action: "record.deleted", userId: viewer.user?.id ?? null, appId, target: `${col.name}/${String(body.recordId || "")}`, ip: clientIp(req) });
  await dataChanged(appId, "records");
  return { ok: true };
});
