import { NextResponse, type NextRequest } from "next/server";
import { subdomainOf } from "@/lib/shared/urls";
import { contentSecurityPolicy } from "@/lib/shared/csp";

import { SESSION_COOKIE, trustProxy } from "@/lib/shared/http-policy";

/**
 * On an app's own subdomain only what the app needs is reachable: its runtime API, files and
 * sign-out. The platform's account and editor APIs answer on the main domain only.
 */
function allowedOnAppHost(pathname: string): boolean {
  return pathname.startsWith("/api/run/") || pathname.startsWith("/api/media/") || pathname === "/api/auth/logout";
}

/**
 * Pages without a signed-in visitor contain nothing personal, so the offline helper may keep
 * a copy; pages rendered for a signed-in person must never be cached (see pwa.ts).
 */
function markCacheable(res: NextResponse, req: NextRequest) {
  res.headers.set("x-cb-cacheable", req.cookies.has(SESSION_COOKIE) ? "0" : "1");
  return res;
}

/**
 * Published apps on their own subdomain: <name>.<NEXT_PUBLIC_ROOT_DOMAIN> is served from
 * /app/<name>/…  Does nothing special unless NEXT_PUBLIC_ROOT_DOMAIN is set.
 */
export function proxy(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV !== "production");
  const headers = new Headers(req.headers);
  headers.delete("x-cb-app-host");
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const secure = (res: NextResponse) => {
    if (!req.nextUrl.pathname.startsWith("/api/")) res.headers.set("Content-Security-Policy", policy);
    return res;
  };
  const host = (trustProxy() && req.headers.get("x-forwarded-host")) || req.headers.get("host");
  const slug = subdomainOf(host);
  const { pathname } = req.nextUrl;
  if (!slug) {
    const res = secure(NextResponse.next({ request: { headers } }));
    return pathname.startsWith("/app/") ? markCacheable(res, req) : res;
  }
  if (pathname.startsWith("/_next/")) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    if (allowedOnAppHost(pathname)) return NextResponse.next();
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const url = req.nextUrl.clone();
  url.pathname = `/app/${slug}${pathname === "/" ? "" : pathname}`;
  headers.set("x-cb-app-host", slug);
  return secure(markCacheable(NextResponse.rewrite(url, { request: { headers } }), req));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
