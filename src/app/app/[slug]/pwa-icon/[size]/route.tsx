import { ImageResponse } from "next/og";
import { findPublishedBySlug } from "@/lib/server/apps";
import { mix } from "@/lib/shared/theme";

type Ctx = { params: Promise<{ slug: string; size: string }> };

/** Home-screen icon: the app's first letter on its brand colour (no outside services needed). */
export async function GET(_req: Request, { params }: Ctx) {
  const { slug, size } = await params;
  const found = await findPublishedBySlug(slug);
  if (!found) return new Response("Not found", { status: 404 });
  const n = size === "512" ? 512 : size === "180" ? 180 : 192;
  const primary = found.doc.theme.colors.primary.startsWith("#") ? found.doc.theme.colors.primary : "#6c47ff";
  const secondary = found.doc.theme.colors.secondary.startsWith("#") ? found.doc.theme.colors.secondary : mix(primary, "#000000", 0.25);
  const letter = (Array.from(found.meta.name.trim())[0] || "A").toUpperCase();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${primary}, ${secondary})`,
          color: "#ffffff",
          fontSize: Math.round(n * 0.52),
          fontWeight: 700,
        }}
      >
        {letter}
      </div>
    ),
    { width: n, height: n, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
