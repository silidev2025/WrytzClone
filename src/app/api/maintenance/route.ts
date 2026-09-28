import { timingSafeEqual } from "node:crypto";
import { getStore } from "@/lib/server/store";
import { runMaintenance } from "@/lib/server/maintenance";
import { json } from "@/lib/server/http";

export const maxDuration = 60;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || secret.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return json({ error: "Unauthorized" }, { status: 401 });
  try { return json({ removed: await runMaintenance(await getStore()) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (err) { console.error("[maintenance] scheduled run failed", err); return json({ error: "Maintenance failed; retry required." }, { status: 500 }); }
}
