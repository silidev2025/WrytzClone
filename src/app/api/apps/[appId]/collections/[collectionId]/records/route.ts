import type { DataFilter } from "@/lib/shared/types";
import { requireUser } from "@/lib/server/auth";
import { getOwnedApp } from "@/lib/server/apps";
import { createRecord, deleteRecords, getCollection, makerRecord, queryRawRecords } from "@/lib/server/data";
import { audit } from "@/lib/server/audit";
import { badRequest, clientIp, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string; collectionId: string }> };

async function setup(params: Ctx["params"]) {
  const { appId, collectionId } = await params;
  const user = await requireUser();
  await getOwnedApp(user, appId);
  const col = await getCollection(appId, collectionId);
  return { appId, user, col, viewer: { user, isAdmin: true } };
}

export const GET = route<Ctx>(async (req, { params }) => {
  const { appId, col, viewer } = await setup(params);
  const sp = new URL(req.url).searchParams;
  let filters: DataFilter[] = [];
  try {
    filters = sp.get("filters") ? JSON.parse(sp.get("filters")!) : [];
  } catch {
    throw badRequest("Invalid filters.");
  }
  const result = await queryRawRecords(
    col,
    {
      search: sp.get("search") || undefined,
      sortField: sp.get("sort") || undefined,
      sortDir: sp.get("dir") === "asc" ? "asc" : "desc",
      page: Number(sp.get("page") || 1),
      pageSize: Number(sp.get("pageSize") || 100),
      filters: Array.isArray(filters) ? filters.slice(0, 20) : [],
    },
    viewer,
  );
  return { ...result, records: result.records.map((r) => makerRecord(appId, r)) };
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { appId, col, viewer } = await setup(params);
  const body = await readJson<{ values?: Record<string, unknown> }>(req);
  return { record: makerRecord(appId, await createRecord(col, body.values || {}, viewer)) };
});

/** Bulk delete: { ids: [...] } */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const { col, viewer } = await setup(params);
  const body = await readJson<{ ids?: unknown }>(req);
  if (!Array.isArray(body.ids) || !body.ids.length) throw badRequest("Choose rows to delete.");
  const deleted = await deleteRecords(col, body.ids.map(String).slice(0, 5000), viewer);
  await audit({ action: "records.deleted", userId: viewer.user.id, appId: col.appId, target: col.name, detail: `${deleted} rows`, ip: clientIp(req) });
  return { deleted };
});
