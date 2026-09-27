import { requireUser } from "@/lib/server/auth";
import { acceptInvite } from "@/lib/server/admins";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`accept:${user.id}`, 10, 60_000);
  const body = await readJson<{ token?: string }>(req);
  const meta = await acceptInvite(user, String(body.token || ""), clientIp(req));
  return { app: { id: meta.id, name: meta.name, slug: meta.published?.slug ?? null } };
});
