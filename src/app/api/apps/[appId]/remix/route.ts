import { requireUser } from "@/lib/server/auth";
import { remixApp } from "@/lib/server/apps";
import { route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

export const POST = route<Ctx>(async (_req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  return { app: await remixApp(user, appId) };
});
