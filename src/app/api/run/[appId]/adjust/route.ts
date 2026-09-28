import { runtimeContext } from "@/lib/server/runtime";
import { adjustNumber, getCollection, recordForViewer } from "@/lib/server/data";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";
import { dataChanged } from "@/lib/server/live";

type Ctx = { params: Promise<{ appId: string }> };

/** Add to (or subtract from) a number field, optionally never going below a minimum. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const { viewer } = await runtimeContext(appId);
  const body = await readJson<{ collectionId?: string; recordId?: string; field?: string; amount?: unknown; min?: unknown }>(req);
  if (!viewer.isAdmin) {
    // votes and likes: a handful per minute per record, and a ceiling per visitor
    await rateLimit(`adjust:${appId}:${clientIp(req)}:${String(body.recordId || "")}`, 10, 60_000);
    await rateLimit(`adjust:${appId}:${clientIp(req)}`, 120, 60_000);
  }
  const col = await getCollection(appId, String(body.collectionId || ""));
  const min = body.min === undefined || body.min === null || body.min === "" ? undefined : Number(body.min);
  const rec = await adjustNumber(col, String(body.recordId || ""), String(body.field || ""), Number(body.amount), min, viewer);
  await dataChanged(appId, "records", col.id);
  return { record: await recordForViewer(col, rec, viewer) };
});
