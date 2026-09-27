import { createSession, findUserByEmail, isSecureRequest, publicUser, verifyPassword } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { clientIp, HttpError, rateLimit, readJson, route, str } from "@/lib/server/http";
import { contactLine } from "@/lib/shared/legal";

export const POST = route(async (req) => {
  const body = await readJson<{ email?: string; password?: string }>(req);
  const email = str(body.email, "Email", { min: 3, max: 200 }).toLowerCase();
  // per address and per caller: guessing one account's password stays slow even from many IPs
  rateLimit(`login:${clientIp(req)}:${email}`, 8, 60_000);
  rateLimit(`login-account:${email}`, 20, 15 * 60_000);
  rateLimit(`login-ip:${clientIp(req)}`, 60, 60_000);
  const user = await findUserByEmail(email);
  const ok = user && typeof body.password === "string" && (await verifyPassword(body.password, user.passwordHash));
  if (!user || !ok) {
    if (user) await audit({ action: "login.failed", userId: user.id, ip: clientIp(req) });
    throw new HttpError(401, "That email and password don't match. Check for typos and try again.");
  }
  if (user.suspended) {
    await audit({ action: "login.failed", userId: user.id, detail: "account suspended", ip: clientIp(req) });
    throw new HttpError(403, `This account is suspended (${user.suspended.reason}). If you think this is a mistake, contact ${contactLine()}.`);
  }
  await createSession(user.id, isSecureRequest(req), req.headers.get("user-agent"));
  await audit({ action: "login", userId: user.id, ip: clientIp(req) });
  return { user: publicUser(user) };
});
