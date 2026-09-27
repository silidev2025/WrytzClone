import { requireUser } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { downloadMobileApk } from "@/lib/server/mobile";

export const GET = route(async (_req, { params }) => {
  const { appId, deploymentId } = await params;
  const { data, filename } = await downloadMobileApk(await requireUser(), appId, deploymentId);
  return new Response(new Uint8Array(data), { headers: {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": String(data.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
});
