import { requireUser } from "@/lib/server/auth";
import { getOwnedApp } from "@/lib/server/apps";
import { getCollection, importRecords } from "@/lib/server/data";
import { badRequest, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string; collectionId: string }> };

/** Bulk add rows: { rows: [{ "Field name": value, ... }] } */
export const POST = route<Ctx>(async (req, { params }) => {
  const { appId, collectionId } = await params;
  const user = await requireUser();
  await getOwnedApp(user, appId);
  const col = await getCollection(appId, collectionId);
  const body = await readJson<{ rows?: unknown }>(req, 20_000_000);
  if (!Array.isArray(body.rows)) throw badRequest("Send rows to import.");
  if (body.rows.length > 10000) throw badRequest("Import at most 10,000 rows at a time.");
  const rows = body.rows.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  return await importRecords(col, rows, { user, isAdmin: true });
});
