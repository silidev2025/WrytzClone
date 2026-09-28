import { badRequest, HttpError, json, readBody, readJson } from "@/lib/server/http";
import { claimMobileJob, completeMobileUpload, MAX_APK_BYTES, requireMobileWorker, updateMobileJob, uploadMobileApk, uploadMobilePart } from "@/lib/server/mobile";

export const runtime = "nodejs";

/** Bearer-authenticated machine API: never accepts a browser session as authorization. */
export async function POST(req: Request) {
  try {
    requireMobileWorker(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("job");
    if (!id) {
      const body = await readJson(req, 4096);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("Invalid worker request.");
      return json({ job: await claimMobileJob(body.workerId, body.targets, body.available) }, { headers: { "Cache-Control": "no-store" } });
    }
    const lease = req.headers.get("x-mobile-lease") || "";
    if (url.searchParams.has("part")) {
      await uploadMobilePart(id, lease, Number(url.searchParams.get("part")), Number(url.searchParams.get("bytes")), url.searchParams.get("sha256") || "", Buffer.from(await readBody(req, 1024 * 1024)));
      return json({ ok: true });
    }
    if (req.headers.get("content-type") === "application/vnd.android.package-archive") {
      await uploadMobileApk(id, lease, Buffer.from(await readBody(req, MAX_APK_BYTES)));
      return json({ ok: true });
    }
    const body = await readJson(req, 4096);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("Invalid worker request.");
    if (body.action === "complete-upload") { await completeMobileUpload(id, lease, String(body.sha256 || "")); return json({ ok: true }); }
    return json(await updateMobileJob(id, lease, body), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, { status: err.status, headers: { "Cache-Control": "no-store" } });
    console.error("[mobile-worker]", err);
    return json({ error: "Mobile worker request failed." }, { status: 500 });
  }
}
