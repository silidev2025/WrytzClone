import { requireUser } from "@/lib/server/auth";
import { giveConsent, listConsents, revokeConsent } from "@/lib/server/consent";
import { badRequest, clientIp, readJson, route } from "@/lib/server/http";

/** Apps this person chose to share their name and email with. */
export const GET = route(async () => {
  const user = await requireUser();
  return { apps: await listConsents(user) };
});

/** "Continue to <app>": let this app know who you are. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ appId?: string }>(req);
  if (typeof body.appId !== "string" || !body.appId) throw badRequest("Which app?");
  const meta = await giveConsent(user, body.appId, clientIp(req));
  return { ok: true, app: { id: meta.id, name: meta.name } };
});

/** Take it back: the app will treat you like any visitor again. */
export const DELETE = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ appId?: string }>(req);
  if (typeof body.appId !== "string" || !body.appId) throw badRequest("Which app?");
  await revokeConsent(user, body.appId, clientIp(req));
  return { ok: true };
});
