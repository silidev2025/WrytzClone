import { requireUser } from "@/lib/server/auth";
import { listVersions, saveVersion } from "@/lib/server/apps";
import { readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  return { versions: await listVersions(user, appId) };
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  const body = await readJson<{ label?: string }>(req);
  return { version: await saveVersion(user, appId, body.label) };
});
