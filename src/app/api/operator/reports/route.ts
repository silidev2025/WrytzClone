import { requireUser } from "@/lib/server/auth";
import { listReports, requireOperator, resolveReport } from "@/lib/server/reports";
import { badRequest, clientIp, readJson, route } from "@/lib/server/http";

export const GET = route(async () => {
  const user = await requireUser();
  requireOperator(user);
  return await listReports();
});

/** { id, action: "resolve" | "unpublish", note? } */
export const POST = route(async (req) => {
  const user = await requireUser();
  requireOperator(user);
  const body = await readJson<{ id?: string; action?: string; note?: string }>(req);
  if (typeof body.id !== "string" || (body.action !== "resolve" && body.action !== "unpublish")) throw badRequest("Say which report and what to do.");
  await resolveReport(user, body.id, body.action, typeof body.note === "string" ? body.note : "", clientIp(req));
  return { ok: true };
});
