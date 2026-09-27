import { currentUser, destroySession } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { clientIp, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const user = await currentUser();
  await destroySession();
  if (user) await audit({ action: "logout", userId: user.id, ip: clientIp(req) });
  return { ok: true };
});
