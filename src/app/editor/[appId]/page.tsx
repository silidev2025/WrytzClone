import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import "../editor.css";
import { currentUser, publicUser } from "@/lib/server/auth";
import { getAppMeta, getDraft } from "@/lib/server/apps";
import { listCollections } from "@/lib/server/data";
import { EditorClient } from "@/components/editor/EditorClient";

type Props = { params: Promise<{ appId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { appId } = await params;
  const meta = await getAppMeta(appId).catch(() => null);
  return { title: meta ? `${meta.name} · Editor` : "Editor", robots: { index: false } };
}

export default async function EditorPage({ params }: Props) {
  const { appId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/editor/${appId}`)}`);
  const meta = await getAppMeta(appId).catch(() => null);
  if (!meta || meta.ownerId !== user.id) notFound();
  const draft = await getDraft(appId);
  const collections = await listCollections(appId);
  return <EditorClient initial={{ app: meta, doc: draft.doc, revision: draft.revision, collections, user: publicUser(user) }} />;
}
