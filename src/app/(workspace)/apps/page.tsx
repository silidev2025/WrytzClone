import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { listMyApps } from "@/lib/server/apps";
import { templateCards } from "@/lib/server/templateCards";
import { MyApps, type AppListItem } from "@/components/workspace/MyApps";

export const metadata: Metadata = { title: "My apps" };

export default async function AppsPage() {
  const user = await currentUser();
  if (!user) redirect("/auth?next=/apps");
  const apps = (await listMyApps(user)) as AppListItem[];
  return <MyApps initialApps={apps} userName={user.name} templates={templateCards()} />;
}
