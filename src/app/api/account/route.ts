import { destroySession, requireUser } from "@/lib/server/auth";
import { deleteAccount, resumeAccountDeletion, updateProfile } from "@/lib/server/account";
import { after } from "next/server";
import { audit } from "@/lib/server/audit";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";

export const PATCH = route(async (req) => {
  const user = await requireUser(true);
  const body = await readJson<{ name?: string; bio?: string }>(req);
  const updated = await updateProfile(user.id, body);
  await audit({ action: "account.updated", userId: user.id, ip: clientIp(req) });
  return { user: updated };
});

export const DELETE = route(async (req) => {
  const user = await requireUser(true);
  // the password check is throttled like sign-in
  await rateLimit(`password-check:${user.id}`, 5, 15 * 60_000);
  const body = await readJson<{ password?: string }>(req);
  await deleteAccount(user, body.password, clientIp(req));
  await destroySession();
  after(async () => {
    const deadline = Date.now() + 40_000;
    try { while (Date.now() < deadline && !(await resumeAccountDeletion(user.id))) { /* bounded durable batches */ } }
    catch (err) { console.error("[account] cleanup retained for scheduled retry", err); }
  });
  return { ok: true };
});
