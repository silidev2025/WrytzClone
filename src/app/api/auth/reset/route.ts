import { validateEmail } from "@/lib/server/auth";
import { requestReset, resetPassword } from "@/lib/server/reset";
import { contactLine } from "@/lib/shared/legal";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";

/** { email } asks for a reset link; { token, password } sets a new password. */
export const POST = route(async (req) => {
  const body = await readJson<{ email?: string; token?: string; password?: string }>(req);
  if (typeof body.token === "string") {
    rateLimit(`reset-confirm:${clientIp(req)}`, 10, 60_000);
    await resetPassword(body.token, body.password, clientIp(req));
    return { ok: true };
  }
  rateLimit(`reset-request:${clientIp(req)}`, 5, 60_000);
  const email = validateEmail(String(body.email || ""));
  const { emailed } = await requestReset(email, clientIp(req));
  return emailed
    ? { ok: true, message: "If that email has an account, we've sent a link to reset the password. Check your inbox (and spam) in a few minutes." }
    : { ok: true, message: `This site can't send emails yet. Contact ${contactLine()} to get a reset link.` };
});
