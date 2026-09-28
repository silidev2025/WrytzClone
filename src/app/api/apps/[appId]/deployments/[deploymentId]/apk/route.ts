import { requireUser } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { mobileApkInfo } from "@/lib/server/mobile";
import { blobResponse } from "@/lib/server/blob-response";

export const GET = route(async (req, { params }) => {
  const { appId, deploymentId } = await params;
  const { artifactId, size, filename } = await mobileApkInfo(await requireUser(), appId, deploymentId);
  return blobResponse(req, artifactId, size, {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  });
});
