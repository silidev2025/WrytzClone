import { currentSessionId, requireUser, validateEmail } from "@/lib/server/auth";
import { allowRepublish, liftSuspension, listModeration, requireOperator, signEveryoneOut, suspendAccount, takeDownApp } from "@/lib/server/reports";
import { badRequest, clientIp, readJson, route, str } from "@/lib/server/http";

/** Apps taken offline and suspended accounts. */
export const GET = route(async () => {
  const user = await requireUser();
  requireOperator(user);
  return await listModeration();
});

/**
 * { action: "takedown", app, reason } · { action: "allow", appId } · { action: "suspend", email, reason }
 * · { action: "unsuspend", email } · { action: "sign-out-everyone" }
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  requireOperator(user);
  const body = await readJson<Record<string, unknown>>(req);
  const ip = clientIp(req);
  switch (body.action) {
    case "takedown":
      return { app: await takeDownApp(user, str(body.app, "App address", { min: 2, max: 300 }), str(body.reason, "Reason", { min: 3, max: 300 }), ip) };
    case "allow":
      await allowRepublish(user, str(body.appId, "App", { min: 4, max: 60 }), ip);
      return { ok: true };
    case "suspend":
      return await suspendAccount(user, validateEmail(String(body.email || "")), str(body.reason, "Reason", { min: 3, max: 300 }), ip);
    case "unsuspend":
      return await liftSuspension(user, validateEmail(String(body.email || "")), ip);
    case "sign-out-everyone":
      return { signedOut: await signEveryoneOut(user, await currentSessionId(), ip) };
    default:
      throw badRequest("Unknown action.");
  }
});
