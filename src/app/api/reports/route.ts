import { createReport } from "@/lib/server/reports";
import { clientIp, rateLimit, readJson, route } from "@/lib/server/http";

/** Report an app. Anyone may; the operators review reports. */
export const POST = route(async (req) => {
  rateLimit(`report:${clientIp(req)}`, 5, 60 * 60_000);
  const body = await readJson<{ app?: string; reason?: string; details?: string; contact?: string }>(req, 20_000);
  const report = await createReport(body, clientIp(req));
  return { ok: true, id: report.id };
});
