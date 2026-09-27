import type { DataFilter } from "@/lib/shared/types";
import { runtimeContext } from "@/lib/server/runtime";
import { aggregateRecords, getCollection } from "@/lib/server/data";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const { viewer } = await runtimeContext(appId);
  if (!viewer.isAdmin) rateLimit(`read:${appId}:${clientIp(req)}`, 300, 60_000);
  const body = await readJson<{ collectionId?: string; aggregate?: string; field?: string; groupBy?: string; filters?: DataFilter[] }>(req);
  const col = await getCollection(appId, String(body.collectionId || ""));
  const agg = ["count", "sum", "avg", "min", "max"].includes(String(body.aggregate)) ? (body.aggregate as "count") : "count";
  return await aggregateRecords(
    col,
    {
      aggregate: agg,
      field: typeof body.field === "string" ? body.field.slice(0, 80) : undefined,
      groupBy: typeof body.groupBy === "string" && body.groupBy ? body.groupBy.slice(0, 80) : undefined,
      filters: Array.isArray(body.filters) ? body.filters.slice(0, 20) : [],
    },
    viewer,
  );
});
