import type { DataFilter } from "@/lib/shared/types";
import { runtimeContext } from "@/lib/server/runtime";
import { getCollection, queryRawRecords, toRuntimeRecords } from "@/lib/server/data";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const { viewer } = await runtimeContext(appId);
  if (!viewer.isAdmin) rateLimit(`read:${appId}:${clientIp(req)}`, 300, 60_000);
  const body = await readJson<{
    collectionId?: string;
    search?: string;
    filters?: DataFilter[];
    sortField?: string;
    sortDir?: "asc" | "desc";
    page?: number;
    pageSize?: number;
    ids?: string[];
    timeZone?: string;
  }>(req);
  const col = await getCollection(appId, String(body.collectionId || ""));
  const result = await queryRawRecords(
    col,
    {
      search: typeof body.search === "string" ? body.search.slice(0, 200) : undefined,
      filters: Array.isArray(body.filters) ? body.filters.slice(0, 20) : [],
      sortField: typeof body.sortField === "string" ? body.sortField.slice(0, 80) : undefined,
      sortDir: body.sortDir,
      page: body.page,
      pageSize: Math.min(200, Number(body.pageSize) || 20),
      ids: Array.isArray(body.ids) ? body.ids.map(String).slice(0, 500) : undefined,
    },
    viewer,
  );
  return { ...result, records: await toRuntimeRecords(col, result.records, { ...viewer, timeZone: body.timeZone }) };
});
