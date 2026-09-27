import { NextResponse } from "next/server";

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
export function trustProxy(): boolean {
  const v = (process.env.TRUST_PROXY || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes" || !!process.env.VERCEL;
}

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

/** Tiny in-memory rate limiter (per process), good enough to slow down guessing. */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return;
  }
  b.count++;
  if (b.count > limit) throw new HttpError(429, "Too many attempts. Please wait a minute and try again.");
}

/**
 * The caller's IP for rate limits. Behind a trusted proxy we use what it forwards; on a
 * bare server those headers are ignored (they could be faked), so everyone shares one
 * "direct" bucket — run production behind a proxy with TRUST_PROXY=1.
 */
export function clientIp(req: Request): string {
  if (!trustProxy()) return "direct";
  return (
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
