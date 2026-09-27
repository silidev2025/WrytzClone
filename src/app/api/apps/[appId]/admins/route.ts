import { requireUser } from "@/lib/server/auth";
import { createInvite, listAdmins, removeAdmin, revokeInvite } from "@/lib/server/admins";
import { badRequest, clientIp, rateLimit, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

/** Admins (by account) and open invite links. Owner only. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  return await listAdmins(user, appId);
});

/** Make a new single-use invite link. The token is only ever shown here, once. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  rateLimit(`invite:${user.id}`, 20, 60 * 60_000);
  const { token, expiresAt } = await createInvite(user, appId, clientIp(req));
  return { path: `/invite/${token}`, expiresAt };
});

/** { inviteId } cancels a link; { userId } removes an admin. */
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
    return { ok: true };
  }
  throw badRequest("Say which invite or admin to remove.");
});
