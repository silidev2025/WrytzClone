import { listSessions, requireUser, signOutOthers } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { clientIp, route } from "@/lib/server/http";

/** Devices signed in to this account. */
export const GET = route(async () => {
  const user = await requireUser(true);
  return { sessions: await listSessions(user.id) };
});

/** Sign out everywhere else. */
export const DELETE = route(async (req) => {
  const user = await requireUser(true);
  const ended = await signOutOthers(user.id);
  await audit({ action: "sessions.revoked", userId: user.id, detail: `${ended} other sessions`, ip: clientIp(req) });
  return { ok: true, ended };
});
