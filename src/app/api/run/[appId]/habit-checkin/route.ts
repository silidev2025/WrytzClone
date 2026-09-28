import { runtimeContext } from "@/lib/server/runtime";
import { checkInHabit } from "@/lib/server/data";
import { badRequest, clientIp, rateLimit, readJson, route } from "@/lib/server/http";
import { dataChanged } from "@/lib/server/live";

type Ctx = { params: Promise<{ appId: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const { viewer } = await runtimeContext(appId);
  await rateLimit(`habit:${appId}:${viewer.user?.id || clientIp(req)}`, 60, 60_000);
  const body = await readJson<{ collectionId?: unknown; habitId?: unknown; timeZone?: unknown }>(req, 4096);
  if (typeof body.collectionId !== "string" || typeof body.habitId !== "string" || body.collectionId.length > 100 || body.habitId.length > 100) throw badRequest("Choose a habit and check-ins collection.");
  const result = await checkInHabit(appId, body.collectionId, body.habitId, body.timeZone, viewer);
  await dataChanged(appId, "records");
  return result;
});
