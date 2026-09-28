import { requireUser } from "@/lib/server/auth";
import { createInvite, listAdmins, parseRole, removeAdmin, revokeInvite, setMemberRole } from "@/lib/server/admins";
import { recheckLiveAccess } from "@/lib/server/live";
import { badRequest, clientIp, rateLimit, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

/** People who joined (by account) and open invite links. Owner only. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  return await listAdmins(user, appId);
});

/** { role: "editor" | "admin" } makes a new single-use invite link. The token is only ever shown here, once. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  await rateLimit(`invite:${user.id}`, 20, 60 * 60_000);
  const body = await readJson<{ role?: unknown }>(req);
  const { token, expiresAt, role } = await createInvite(user, appId, parseRole(body.role ?? "admin"), clientIp(req));
  return { path: `/invite/${token}`, expiresAt, role };
});

/** { userId, role } changes what someone who joined can do. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  const body = await readJson<{ userId?: unknown; role?: unknown }>(req);
  if (typeof body.userId !== "string" || !body.userId) throw badRequest("Say whose access to change.");
  await setMemberRole(user, appId, body.userId, parseRole(body.role), clientIp(req));
  await recheckLiveAccess(appId);
  return { ok: true };
});

/** { inviteId } cancels a link; { userId } removes a person. */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  const body = await readJson<{ inviteId?: string; userId?: string }>(req);
  if (typeof body.inviteId === "string" && body.inviteId) {
    await revokeInvite(user, appId, body.inviteId, clientIp(req));
    return { ok: true };
  }
  if (typeof body.userId === "string" && body.userId) {
    await removeAdmin(user, appId, body.userId, clientIp(req));
    await recheckLiveAccess(appId);
    return { ok: true };
  }
  throw badRequest("Say which invite or person to remove.");
});
