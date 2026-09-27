import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { getAppMeta, getDraft } from "@/lib/server/apps";
import { runtimeSession } from "@/lib/server/runtime";
import { AppRuntime } from "@/components/runtime/AppRuntime";

export const metadata: Metadata = { title: "Preview", robots: { index: false } };

export default async function PreviewPage({ params }: { params: Promise<{ appId: string; path?: string[] }> }) {
  const { appId, path = [] } = await params;
  const user = await currentUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/preview/${appId}`)}`);
  const meta = await getAppMeta(appId).catch(() => null);
  if (!meta || meta.ownerId !== user.id) notFound();
  const draft = await getDraft(appId);
  const session = await runtimeSession(appId);
  return (
    <AppRuntime
      mode="preview"
      appId={appId}
      appName={meta.name}
      doc={draft.doc}
      basePath={`/preview/${appId}`}
      path={path.map((p) => decodeURIComponent(p))}
      session={session}
    />
  );
}
