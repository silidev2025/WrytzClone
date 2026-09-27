/*
 * Where published apps live.
 *
 * Without configuration apps are served at  /app/<name>  on the platform's own domain.
 * Set NEXT_PUBLIC_ROOT_DOMAIN (e.g. "example.com") and every app is also served at
 *   https://<name>.example.com
 * (point a wildcard DNS record  *.example.com  at the server).
 */

function clean(v: string | undefined): string {
  return (v || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

/** e.g. "example.com" or "localhost:3000"; empty when subdomains aren't set up. */
export const ROOT_DOMAIN = clean(process.env.NEXT_PUBLIC_ROOT_DOMAIN);

const LOCAL = /^(localhost|127\.0\.0\.1|lvh\.me)(:\d+)?$|\.localhost(:\d+)?$/;

export const PROTOCOL = (process.env.NEXT_PUBLIC_APP_PROTOCOL || "").replace(/:?\/*$/, "") || (LOCAL.test(ROOT_DOMAIN) ? "http" : "https");

/** Host name without the port, used for cookie domains. */
export function rootHostname(): string {
  return ROOT_DOMAIN.replace(/:\d+$/, "");
}

/** Subdomains that can never be app names. */
export const RESERVED_SUBDOMAINS = new Set(["www", "app", "apps", "api", "admin", "mail", "email", "smtp", "ftp", "ns1", "ns2", "cdn", "static", "assets", "blog", "help", "support", "docs", "status", "dashboard", "auth", "login"]);

/** Link to a published app (absolute when subdomains are on, otherwise a path). */
export function appUrl(slug: string, path = ""): string {
  if (ROOT_DOMAIN) return `${PROTOCOL}://${slug}.${ROOT_DOMAIN}${path}`;
  return `/app/${slug}${path}`;
}

/** Link to a page of the platform itself (absolute when subdomains are on). */
export function platformUrl(path = "/"): string {
  return ROOT_DOMAIN ? `${PROTOCOL}://${ROOT_DOMAIN}${path}` : path;
}

/** Sign-in page link that returns to where the visitor is now (browser only). */
export function signInUrl(appId?: string): string {
  const here = ROOT_DOMAIN ? window.location.href : window.location.pathname + window.location.search;
  return platformUrl(`/auth?next=${encodeURIComponent(here)}${appId ? `&app=${encodeURIComponent(appId)}` : ""}`);
}

/** Absolute link to a published app, for copying and sharing (browser only). */
export function shareableAppUrl(slug: string): string {
  const u = appUrl(slug);
  return u.startsWith("/") ? `${window.location.origin}${u}` : u;
}

/** The app slug if `host` is one of our app subdomains. */
export function subdomainOf(host: string | null | undefined): string | null {
  if (!ROOT_DOMAIN || !host) return null;
  const h = host.toLowerCase();
  if (h === ROOT_DOMAIN || !h.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const sub = h.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!sub || sub.includes(".") || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

/** Is this an absolute URL on our root domain or one of its subdomains? (safe to redirect to) */
export function isOwnUrl(url: string): boolean {
  if (!ROOT_DOMAIN) return false;
  try {
    const u = new URL(url);
    const h = u.host.toLowerCase();
    return (u.protocol === "https:" || u.protocol === "http:") && (h === ROOT_DOMAIN || h.endsWith(`.${ROOT_DOMAIN}`));
  } catch {
    return false;
  }
}
