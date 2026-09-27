import { requireUser } from "@/lib/server/auth";
import { getEditableApp } from "@/lib/server/apps";
import { appAuditLog } from "@/lib/server/audit";
import { route } from "@/lib/server/http";

type Ctx = { params: Promise<{ appId: string }> };

/** Security activity of an app (publishing, admins, access rules, deletions). Owner only. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  await getEditableApp(user, appId);
  const events = await appAuditLog(appId, 200);
  return { events: events.map((e) => ({ at: e.at, action: e.action, target: e.target, detail: e.detail, byYou: e.userId === user.id })) };
});
