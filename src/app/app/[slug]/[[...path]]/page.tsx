import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { findPublishedBySlug } from "@/lib/server/apps";
import { appBasePath } from "@/lib/server/pwa";
import { docForViewer, runtimeContext, runtimeSession } from "@/lib/server/runtime";
import { AppRuntime } from "@/components/runtime/AppRuntime";

type Props = { params: Promise<{ slug: string; path?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await findPublishedBySlug(slug);
  if (!found) return { title: "Not found" };
  // on <name>.<domain> the app lives at the root; otherwise under /app/<name>
  const base = await appBasePath(slug);
  return {
    title: { absolute: found.meta.name },
    description: found.meta.published?.description || found.meta.description || undefined,
    manifest: `${base}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: found.meta.name, statusBarStyle: "default" },
    icons: { icon: `${base}/pwa-icon/192`, apple: `${base}/pwa-icon/180` },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { slug } = await params;
  const found = await findPublishedBySlug(slug);
  return { themeColor: found?.doc.theme.colors.primary };
}

export default async function LiveAppPage({ params }: Props) {
  const { slug, path = [] } = await params;
  const found = await findPublishedBySlug(slug);
  if (!found) notFound();
  const { viewer } = await runtimeContext(found.meta.id);
  const session = await runtimeSession(found.meta.id);
  return (
    <AppRuntime
      mode="live"
      appId={found.meta.id}
      appName={found.meta.name}
      // pages this visitor can't open arrive as empty shells
      doc={docForViewer(found.doc, viewer)}
      basePath={await appBasePath(found.meta.published!.slug)}
      path={path.map((p) => decodeURIComponent(p))}
      session={session}
    />
  );
}
