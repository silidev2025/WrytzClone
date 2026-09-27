import { findPublishedBySlug } from "@/lib/server/apps";
import { appBasePath, serviceWorkerSource } from "@/lib/server/pwa";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const found = await findPublishedBySlug(slug);
  if (!found) return new Response("// not found", { status: 404, headers: { "Content-Type": "text/javascript" } });
  const base = await appBasePath(slug);
  return new Response(serviceWorkerSource(base, found.meta.name), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      // the app's pages live at /app/<name> (no trailing slash), which is above this file
      "Service-Worker-Allowed": base || "/",
    },
  });
}
