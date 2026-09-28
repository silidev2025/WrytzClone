import { requireUser } from "@/lib/server/auth";
import { saveDraft } from "@/lib/server/apps";
import { badRequest, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

export const PUT = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  const body = await readJson<{ doc?: unknown; baseRevision?: number }>(req, 12_000_000);
  if (!body.doc) throw badRequest("Nothing to save.");
  return saveDraft(user, appId, body.doc, body.baseRevision);
});
