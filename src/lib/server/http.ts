import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { trustProxy } from "@/lib/shared/http-policy";
import { DocumentValidationError } from "@/lib/shared/doc-validation";
import { JSON_BODY_BYTES } from "@/lib/shared/limits";
export { trustProxy } from "@/lib/shared/http-policy";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = "Please sign in to continue.") => new HttpError(401, msg);
export const forbidden = (msg = "You don't have access to that.") => new HttpError(403, msg);
export const notFound = (msg = "Not found.") => new HttpError(404, msg);
export const conflict = (msg: string, details?: unknown) => new HttpError(409, msg, details);

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/**
 * Forwarded headers (X-Forwarded-For/Host/Proto) are only believed behind a proxy we were
 * told about (TRUST_PROXY=1, or Vercel). Otherwise anyone could fake them.
 */
export function requestHost(req: Request): string | null {
  if (trustProxy()) {
    const fwd = req.headers.get("x-forwarded-host");
    if (fwd) return fwd.split(",")[0].trim();
  }
  return req.headers.get("host");
}

/**
 * Reject cross-site writes: every state-changing request must say where it came from
 * (Origin, or Referer as a fallback) and that must be the host we serve.
 */
function checkOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const source = req.headers.get("origin") || req.headers.get("referer");
  if (!source || source === "null") throw forbidden("Cross-site request blocked.");
  let host: string;
  try {
    host = new URL(source).host;
  } catch {
    throw forbidden("Cross-site request blocked.");
  }
  if (host !== requestHost(req)) throw forbidden("Cross-site request blocked.");
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response | unknown>;

/** Wrap a route handler: origin check, JSON responses and friendly errors. */
export function route<C = { params: Promise<Record<string, string>> }>(fn: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      checkOrigin(req);
      const result = await fn(req, ctx);
      if (result instanceof Response) return result;
      return json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof DocumentValidationError) return json({ error: err.message }, { status: 400 });
      if (err instanceof HttpError) return json({ error: err.message, details: err.details }, { status: err.status });
      console.error("[api]", req.method, new URL(req.url).pathname, err);
      return json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
    }
  };
}

/**
 * Read a request body, stopping as soon as it passes maxBytes (a missing or wrong
 * Content-Length can't make us buffer more than that).
 */
export async function readBody(req: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const tooLarge = () => new HttpError(413, "That request is too large.");
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) throw tooLarge();
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function readJson<T = any>(req: Request, maxBytes = 1_000_000): Promise<T> {
  maxBytes = Math.min(maxBytes, JSON_BODY_BYTES);
  const text = new TextDecoder().decode(await readBody(req, maxBytes));
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw badRequest("Invalid JSON body.");
  }
}

/** Parse multipart form data without ever holding more than maxBytes. */
export async function readForm(req: Request, maxBytes: number): Promise<FormData> {
  const type = req.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("multipart/form-data")) throw badRequest("Send the file as form data.");
  const body = await readBody(req, maxBytes);
  try {
    return await new Response(body, { headers: { "content-type": type } }).formData();
  } catch {
    throw badRequest("The upload was incomplete. Please try again.");
  }
}

export function str(v: unknown, field: string, { max = 200, min = 0, optional = false } = {}): string {
  if (v === undefined || v === null || v === "") {
    if (optional) return "";
    if (min > 0) throw badRequest(`${field} is required.`);
    return "";
  }
  if (typeof v !== "string") throw badRequest(`${field} must be text.`);
  const s = v.trim();
  if (s.length < min) throw badRequest(`${field} must be at least ${min} characters.`);
  if (s.length > max) throw badRequest(`${field} must be at most ${max} characters.`);
  return s;
}

/** Shared atomic buckets survive cold starts and never retain raw emails/IPs as keys. */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const { getStore } = await import("./store");
  const id = createHash("sha256").update(key).digest("hex");
  if (!(await (await getStore()).consumeRateLimit(id, limit, windowMs)))
    throw new HttpError(429, "Too many attempts. Please wait a minute and try again.");
}

/**
 * The caller's IP for rate limits. Behind a trusted proxy we use what it forwards; on a
 * bare server those headers are ignored (they could be faked), so everyone shares one
 * "direct" bucket — run production behind a proxy with TRUST_PROXY=1.
 */
export function clientIp(req: Request): string {
  if (!trustProxy()) return "direct";
  // Vercel overwrites X-Forwarded-For. Never prefer an unrelated Cloudflare header.
  // A self-hosted trusted proxy must overwrite the explicitly configured header.
  const header = process.env.VERCEL ? "x-forwarded-for" : (process.env.TRUSTED_IP_HEADER || "x-forwarded-for").toLowerCase();
  const value = (req.headers.get(header) || "").split(",")[0].trim();
  return value.length <= 45 && isIP(value) ? value : "unknown";
}
