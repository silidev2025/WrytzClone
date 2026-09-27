import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, publicUser } from "@/lib/server/auth";
import { SettingsForm } from "@/components/workspace/SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/auth?next=/settings");
  return <SettingsForm user={publicUser(user)} />;
}
