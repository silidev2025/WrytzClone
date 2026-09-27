import { currentUser, publicUser } from "@/lib/server/auth";
import { appCounts } from "@/lib/server/apps";
import { TEMPLATES } from "@/lib/templates";
import { Shell } from "@/components/workspace/Shell";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const counts = user ? await appCounts(user) : null;
  return (
    <Shell user={user ? publicUser(user) : null} appCount={counts?.apps ?? 0} templateCount={TEMPLATES.length + 1}>
      {children}
    </Shell>
  );
}
