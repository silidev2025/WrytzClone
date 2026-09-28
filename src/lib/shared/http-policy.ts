/** Shared by the request proxy and Node handlers; no Node-only imports. */
export const SESSION_COOKIE = "cb_session";

export function trustProxy(): boolean {
  return /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || "") || !!process.env.VERCEL;
}
