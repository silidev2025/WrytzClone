import { listExplore } from "@/lib/server/apps";
import { route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const q = new URL(req.url).searchParams.get("q") || "";
  return { apps: await listExplore(q.slice(0, 100)) };
});
