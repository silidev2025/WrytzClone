import { findUserByEmail, requireUser, validateEmail } from "@/lib/server/auth";
import { requireOperator } from "@/lib/server/reports";
import { createResetPath } from "@/lib/server/reset";
import { audit } from "@/lib/server/audit";
import { clientIp, notFound, readJson, route } from "@/lib/server/http";

/** A one-hour password reset link for someone who lost access (check it's really them first). */
export const POST = route(async (req) => {
  const user = await requireUser();
  requireOperator(user);
  const body = await readJson<{ email?: string }>(req);
  const target = await findUserByEmail(validateEmail(String(body.email || "")));
  if (!target) throw notFound("No account uses that email.");
  const path = await createResetPath(target.id);
  await audit({ action: "password.reset.requested", userId: target.id, detail: `link created by operator ${user.id}`, ip: clientIp(req) });
  return { path };
});
