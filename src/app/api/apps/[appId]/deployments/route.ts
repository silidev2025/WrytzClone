import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { listMobileDeployments } from "@/lib/server/mobile";

export const GET = route(async (_req, { params }) => {
  const { appId } = await params;
  return json(await listMobileDeployments(await requireUser(), appId), { headers: { "Cache-Control": "no-store" } });
});
