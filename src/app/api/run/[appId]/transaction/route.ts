import type { TransactionStep } from "@/lib/shared/types";
import { runtimeContext } from "@/lib/server/runtime";
import { runTransaction } from "@/lib/server/data";
import { recordSubmission } from "@/lib/server/apps";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";
import { idempotent } from "@/lib/server/idempotency";

type Ctx = { params: Promise<{ appId: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const { viewer } = await runtimeContext(appId);
  // same limit as adding records: a transaction can add several
  if (!viewer.isAdmin) rateLimit(`create:${appId}:${clientIp(req)}`, 60, 60_000);
  const body = await readJson<{ steps?: TransactionStep[]; idempotencyKey?: string }>(req, 2_000_000);
  return idempotent(`tx:${appId}:${viewer.user?.id ?? clientIp(req)}`, body.idempotencyKey, async () => {
    const results = await runTransaction(appId, body.steps || [], viewer);
    if ((body.steps || []).some((s) => s.kind === "create")) await recordSubmission(appId);
    return { steps: results };
  });
});
