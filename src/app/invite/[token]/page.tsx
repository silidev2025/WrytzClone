import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { inviteInfo } from "@/lib/server/admins";
import { InviteAccept } from "@/components/workspace/InviteAccept";

export const metadata: Metadata = { title: "App invite", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await currentUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/invite/${token}`)}`);
  const info = await inviteInfo(token);
  return <InviteAccept token={token} info={info} userName={user.name} />;
}
