import { runtimeSession } from "@/lib/server/runtime";
import { route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

/** Collections + the signed-in visitor for a running app. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { appId } = await params;
  return await runtimeSession(appId);
});
