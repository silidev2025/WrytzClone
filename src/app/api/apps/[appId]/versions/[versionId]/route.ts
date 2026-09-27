import { requireUser } from "@/lib/server/auth";
import { deleteVersion, restoreVersion } from "@/lib/server/apps";
import { route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string; versionId: string }> };

/** Restore this version as the current draft. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { appId, versionId } = await params;
  const user = await requireUser();
  return await restoreVersion(user, appId, versionId);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { appId, versionId } = await params;
  const user = await requireUser();
  await deleteVersion(user, appId, versionId);
  return { ok: true };
});
