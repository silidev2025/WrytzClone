import { createHash } from "node:crypto";
import { getStore, type StoreOps } from "./store";
import { badRequest, conflict } from "./http";

interface SavedResult { id: string; hash: string; result: unknown; expiresAt: string }
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => JSON.stringify(k) + ":" + canonical(value)).join(",") + "}";
}

/** Result and database effects commit together, even across instances and lost responses. */
export async function idempotent<T>(scope: string, key: unknown, payload: unknown, fn: (tx: StoreOps) => Promise<T>): Promise<T> {
  const store = await getStore();
  if (key !== undefined && (typeof key !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(key))) throw badRequest("Invalid submission key.");
  const id = typeof key === "string" ? hash(scope + ":" + key) : null;
  const requestHash = hash(canonical(payload));
  return store.transaction(async (tx) => {
    const previous = id ? await tx.get<SavedResult>("idempotency", id) : null;
    if (previous && Date.parse(previous.expiresAt) > Date.now()) {
      if (previous.hash !== requestHash) throw conflict("This submission key was already used for different data.");
      return previous.result as T;
    }
    const result = await fn(tx);
    if (id) await tx.put("idempotency", { id, hash: requestHash, result, expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString() } satisfies SavedResult);
    return result;
  });
}
