import { JSON_BODY_BYTES } from "@/lib/shared/limits";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any,
  ) {
    super(message);
  }
}

/** fetch() + JSON + friendly errors. */
export async function api<T = any>(url: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const body = opts.body === undefined ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body);
  if (typeof body === "string" && new TextEncoder().encode(body).length > JSON_BODY_BYTES)
    throw new ApiError(413, "This request is too large. Split the import or reduce the size of this change before retrying.");
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
      body,
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 428 && data?.details?.termsRequired && typeof window !== "undefined") window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.details);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
