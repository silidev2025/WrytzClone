import { requireUser } from "@/lib/server/auth";
import { deleteVersion, restoreVersion } from "@/lib/server/apps";
import { readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string; versionId: string }> };

/** Restore this version as the current draft. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { appId, versionId } = await params;
  const user = await requireUser();
  const body = await readJson<{ clientId?: unknown }>(req);
  const clientId = typeof body.clientId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.clientId) ? body.clientId : null;
  return await restoreVersion(user, appId, versionId, clientId);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { appId, versionId } = await params;
  const user = await requireUser();
  await deleteVersion(user, appId, versionId);
  return { ok: true };
});
