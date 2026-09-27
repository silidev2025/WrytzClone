import { requireUser } from "@/lib/server/auth";
import { getEditableApp } from "@/lib/server/apps";
import { peerFor, publish } from "@/lib/server/live";
import { badRequest, rateLimit, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

/** { clientId, pageId, view, bp, selection, cursor } — where this editor tab is and what it has selected. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  rateLimit(`presence:${user.id}`, 80, 5_000);
  await getEditableApp(user, appId);
  const body = await readJson<Record<string, unknown>>(req, 8_000);
  if (typeof body.clientId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(body.clientId)) throw badRequest("Missing editor id.");
  await publish(appId, { type: "presence", peer: peerFor(user, body.clientId, body) });
  return { ok: true };
});
