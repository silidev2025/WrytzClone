import { NextResponse } from "next/server";
import { getAppMeta } from "@/lib/server/apps";
import { clientIp, rateLimit, route } from "@/lib/server/http";
import { previewCookieName, previewPassAllows, readPreviewPass } from "@/lib/server/previewPass";

type Ctx = { params: Promise<{ appId: string }> };

/**
 * Where the QR code points: checks the pass, keeps it in a cookie for this app (so moving
 * between pages, reloading and the app's own data requests keep working), then opens the
 * preview. An expired or revoked pass lands on a page that says so.
 */
export const GET = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const url = new URL(req.url);
  await rateLimit(`preview-open:${clientIp(req)}`, 60, 60_000);
  const base = `/preview/${encodeURIComponent(appId)}`;
  const rawPath = url.searchParams.get("path") || "";
  // page paths only: plain segments, no "." or ".." steps
  const path = /^(\/[A-Za-z0-9_.~-]+)*$/.test(rawPath) && !/(^|\/)\.+(\/|$)/.test(rawPath) && rawPath.length <= 200 ? rawPath : "";
  const passValue = url.searchParams.get("pass");
  const pass = readPreviewPass(passValue, appId);
  const meta = pass ? await getAppMeta(appId).catch(() => null) : null;
  if (!pass || !meta || !(await previewPassAllows(meta, pass))) {
    return NextResponse.redirect(new URL(`${base}${path}?pass=expired`, url), 303);
  }
  const res = NextResponse.redirect(new URL(`${base}${path}`, url), 303);
  res.cookies.set(previewCookieName(appId), passValue!, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    maxAge: Math.max(1, Math.floor((pass.expires - Date.now()) / 1000)),
  });
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
});
