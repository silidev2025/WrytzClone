import { createSession, createUser, isSecureRequest, publicUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { clientIp, rateLimit, readJson, route, str } from "@/lib/server/http";

export const POST = route(async (req) => {
  await rateLimit(`signup:${clientIp(req)}`, 10, 60_000);
  const body = await readJson<{ name?: string; email?: string; password?: string; acceptTerms?: unknown; ageOk?: unknown }>(req);
  const user = await createUser({
    name: str(body.name, "Name", { max: 80, optional: true }),
    email: str(body.email, "Email", { min: 3, max: 200 }),
    password: typeof body.password === "string" ? body.password : "",
    acceptTerms: body.acceptTerms,
    ageOk: body.ageOk,
  });
  await createSession(user.id, isSecureRequest(req), req.headers.get("user-agent"), user.passwordHash);
  await audit({ action: "signup", userId: user.id, ip: clientIp(req) });
  return { user: publicUser(user) };
});
