import { requireUser } from "@/lib/server/auth";
import { createApp, listMyApps } from "@/lib/server/apps";
import { readJson, route } from "@/lib/server/http";

export const GET = route(async () => {
  const user = await requireUser();
  return { apps: await listMyApps(user) };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ name?: string; templateId?: string }>(req);
  const app = await createApp(user, body);
  return { app };
});
