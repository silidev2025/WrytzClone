import { findPublishedBySlug } from "@/lib/server/apps";
import { appBasePath } from "@/lib/server/pwa";

type Ctx = { params: Promise<{ slug: string }> };

/** Web app manifest: lets phones install the published app with its own icon. */
export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const found = await findPublishedBySlug(slug);
  if (!found) return new Response("Not found", { status: 404 });
  const base = await appBasePath(slug);
  const { meta, doc } = found;
  const phone = doc.settings.kind === "mobile";
  const manifest = {
    id: base || "/",
    name: meta.name,
    short_name: meta.name.length > 14 ? meta.name.slice(0, 13).trim() + "…" : meta.name,
    description: meta.published?.description || meta.description || undefined,
    start_url: base || "/",
    scope: base || "/",
    display: "standalone",
    orientation: phone ? "portrait" : "any",
    background_color: doc.theme.colors.background,
    theme_color: doc.theme.colors.primary,
    icons: [
      { src: `${base}/pwa-icon/192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/pwa-icon/512`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/pwa-icon/512`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
