import { PROTOCOL, ROOT_DOMAIN } from "@/lib/shared/urls";

/** Canonical origin for emails/phones; never derive trusted links from a request Host header. */
export function publicOrigin(): string | null {
  const deployment = process.env.VERCEL_ENV === "preview" ? process.env.VERCEL_URL : process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const value = process.env.CRAFTBASE_PUBLIC_URL || (deployment ? `https://${deployment}` : ROOT_DOMAIN ? `${PROTOCOL}://${ROOT_DOMAIN}` : "");
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}
