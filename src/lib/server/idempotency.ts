/*
 * Idempotency keys: a browser sends a random key with a form submission; if the same key
 * arrives again (double tap, flaky network retry) the first result is returned instead of
 * saving twice. Kept in memory for 10 minutes (per server process).
 */

const TTL = 10 * 60_000;
const g = globalThis as unknown as { __cbIdem?: Map<string, { at: number; promise: Promise<unknown> }> };

export async function idempotent<T>(scope: string, key: unknown, fn: () => Promise<T>): Promise<T> {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(key)) return fn();
  const map = (g.__cbIdem ??= new Map());
  const now = Date.now();
  if (map.size > 5000) for (const [k, v] of map) if (now - v.at > TTL) map.delete(k);
  const id = `${scope}:${key}`;
  const hit = map.get(id);
  if (hit && now - hit.at < TTL) return hit.promise as Promise<T>;
  const promise = fn();
  map.set(id, { at: now, promise });
  // a failed attempt may be tried again with the same key
  promise.catch(() => map.delete(id));
  return promise;
}
