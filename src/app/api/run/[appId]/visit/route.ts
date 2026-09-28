import { getAppMeta, recordVisit } from "@/lib/server/apps";
import { clientIp, rateLimit, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const meta = await getAppMeta(appId);
  if (!meta.published) return { ok: true };
  try {
    await rateLimit(`visit:${appId}:${clientIp(req)}`, 30, 60_000);
  } catch {
    return { ok: true };
  }
  await recordVisit(appId);
  return { ok: true };
});
