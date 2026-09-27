import { createSession, isSecureRequest, requireUser } from "@/lib/server/auth";
import { changePassword } from "@/lib/server/account";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`password-check:${user.id}`, 5, 15 * 60_000);
  const body = await readJson<{ current?: string; next?: string }>(req);
  await changePassword(user.id, body.current, body.next, clientIp(req));
  // other devices are signed out by the change; keep this one signed in with a new session
  await createSession(user.id, isSecureRequest(req), req.headers.get("user-agent"));
  return { ok: true };
});
