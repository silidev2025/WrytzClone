import type { TransactionStep } from "@/lib/shared/types";
import { runtimeContext } from "@/lib/server/runtime";
import { runTransaction } from "@/lib/server/data";
import { recordSubmission } from "@/lib/server/apps";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";
import { idempotent } from "@/lib/server/idempotency";
import { dataChanged, queueLiveEvent } from "@/lib/server/live";

type Ctx = { params: Promise<{ appId: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const { viewer } = await runtimeContext(appId);
  // same limit as adding records: a transaction can add several
  if (!viewer.isAdmin) await rateLimit(`create:${appId}:${clientIp(req)}`, 60, 60_000);
  const body = await readJson<{ steps?: TransactionStep[]; idempotencyKey?: string }>(req, 2_000_000);
  const result = await idempotent(`tx:${appId}:${viewer.user?.id ?? clientIp(req)}`, body.idempotencyKey, body, async (tx) => {
    const results = await runTransaction(appId, body.steps || [], viewer, tx);
    if ((body.steps || []).some((s) => s.kind === "create")) await recordSubmission(appId, tx);
    await queueLiveEvent(tx, appId, { type: "data", kind: "records", collectionId: null });
    return { steps: results };
  });
  await dataChanged(appId, "records");
  return result;
});
