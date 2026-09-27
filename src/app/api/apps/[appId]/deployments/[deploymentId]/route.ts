import { requireUser } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { stopMobileDeployment } from "@/lib/server/mobile";

export const DELETE = route(async (_req, { params }) => {
  const { appId, deploymentId } = await params;
  await stopMobileDeployment(await requireUser(), appId, deploymentId);
  return { ok: true };
});
