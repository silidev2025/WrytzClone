"use client";

import { useEffect, useRef, useState } from "react";
import type { DataFilter, RuntimeRecord, TransactionStep } from "@/lib/shared/types";
import { api, ApiError } from "@/lib/client/api";
import { useRT } from "./store";

export interface QueryBody {
  collectionId: string;
  search?: string;
  filters?: DataFilter[];
  sortField?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  ids?: string[];
}

export interface QueryResult {
  records: RuntimeRecord[];
  total: number;
  page: number;
  pageSize: number;
}

/** A random key per submission, so a repeated request can't save twice. */
function newKey(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/** Calls a running app makes; the server applies the app's access rules. */
const pendingWrites = new Map<string, { key: string; at: number }>();

async function writeOnce<T>(url: string, body: object, viewer: string): Promise<T> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([url, viewer, body])));
  const identity = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const storageKey = `cb-pending:${identity}`;
  let pending = pendingWrites.get(identity);
  if (!pending) {
    try { const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null"); if (typeof saved?.key === "string" && typeof saved?.at === "number") pending = saved; } catch { /* Browser storage may be disabled. */ }
  }
  if (!pending || Date.now() - pending.at > 23 * 3600_000) {
    pending = { key: newKey(), at: Date.now() };
    if (pendingWrites.size >= 200) throw new Error("Too many unresolved submissions. Reload after checking which submissions were saved.");
    pendingWrites.set(identity, pending);
  }
  try { sessionStorage.setItem(storageKey, JSON.stringify(pending)); } catch { /* In-memory retry protection remains. */ }
  const clear = () => { pendingWrites.delete(identity); try { sessionStorage.removeItem(storageKey); } catch { /* unavailable */ } };
  try {
    const result = await api<T>(url, { body: { ...body, idempotencyKey: pending.key } });
    clear();
    invalidateAll();
    return result;
  } catch (err) {
    // Keep the same key after timeouts or server failures: the write may have committed.
    if (err instanceof ApiError && err.status >= 400 && err.status < 500 && ![408, 429].includes(err.status)) clear();
    throw err;
  }
}

export function runtimeApi(appId: string, viewer = "anonymous") {
  const base = `/api/run/${appId}`;
  return {
    query: (q: QueryBody) => api<QueryResult>(`${base}/query`, { body: { ...q, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
    create: (collectionId: string, values: Record<string, unknown>) =>
      writeOnce<{ record: RuntimeRecord }>(`${base}/records`, { collectionId, values }, viewer),
    update: (collectionId: string, recordId: string, values: Record<string, unknown>) =>
      api<{ record: RuntimeRecord }>(`${base}/records`, { method: "PATCH", body: { collectionId, recordId, values } }),
    remove: (collectionId: string, recordId: string) => api(`${base}/records`, { method: "DELETE", body: { collectionId, recordId } }),
    adjust: (collectionId: string, recordId: string, field: string, amount: number, min?: number) =>
      api<{ record: RuntimeRecord }>(`${base}/adjust`, { body: { collectionId, recordId, field, amount, min } }),
    transaction: (steps: TransactionStep[]) => writeOnce<{ steps: { id: string }[] }>(`${base}/transaction`, { steps }, viewer),
    habitCheckIn: (collectionId: string, habitId: string) => api<{ alreadyDone: boolean; streak: number; unit: string }>(`${base}/habit-checkin`, { body: { collectionId, habitId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
    aggregate: (body: { collectionId: string; aggregate: string; field?: string; groupBy?: string; filters?: DataFilter[] }) =>
      api<{ value?: number; groups?: { label: string; value: number }[] }>(`${base}/aggregate`, { body }),
    upload: (file: File, target: { collectionId: string; field: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("collectionId", target.collectionId);
      fd.append("field", target.field);
      return api<{ url: string; name: string; mime: string; size: number }>(`${base}/upload`, { body: fd });
    },
    session: () => api(`${base}/schema`),
    visit: () => api(`${base}/visit`, { method: "POST", body: {} }),
  };
}

export type RuntimeApi = ReturnType<typeof runtimeApi>;

const cache = new Map<string, { at: number; data?: unknown; promise?: Promise<unknown>; error?: string }>();
const cacheListeners = new Set<() => void>();
const TTL = 30_000;

export function invalidateAll() {
  cache.clear();
  for (const listener of cacheListeners) listener();
}

/** Tiny stale-while-revalidate hook keyed by a string. `key = null` skips fetching. */
export function useCached<T>(key: string | null, fetcher: () => Promise<T>): { data: T | undefined; loading: boolean; error: string | null } {
  const namespace = useRT((s) => `${s.appId}:${s.user?.id || "anonymous"}:${s.mode}`);
  key = key ? `${namespace}:${key}` : null;
  const [tick, force] = useState(0);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    cacheListeners.add(update);
    const timer = setInterval(update, 5000);
    return () => { clearInterval(timer); cacheListeners.delete(update); };
  }, []);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const entry = key ? cache.get(key) : undefined;

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const existing = cache.get(key);
    if (existing && !existing.promise && Date.now() - existing.at < (existing.error ? 5000 : TTL)) return;
    const promise =
      existing?.promise ||
      fetcherRef.current().then(
        (data) => {
          if (cache.get(key)?.promise === promise) cache.set(key, { data, at: Date.now() });
          if (cache.size > 400) cache.delete(cache.keys().next().value as string);
          return data;
        },
        (err: Error) => {
          if (cache.get(key)?.promise === promise) cache.set(key, { data: existing?.data, error: err.message || "Couldn't load data", at: Date.now() });
          throw err;
        },
      );
    if (!existing?.promise) cache.set(key, { data: existing?.data, promise, at: Date.now() });
    promise.then(
      () => alive && force((n) => n + 1),
      () => alive && force((n) => n + 1),
    );
    return () => {
      alive = false;
    };
  }, [key, tick]);

  // keep showing the previous data for this "family" while the new key loads
  const last = useRef<{ namespace: string; data?: T }>({ namespace });
  if (last.current.namespace !== namespace) last.current = { namespace };
  if (entry?.data !== undefined) last.current.data = entry.data as T;
  return {
    data: (entry?.data as T | undefined) ?? (key ? last.current.data : undefined),
    loading: !!key && entry?.data === undefined && !entry?.error,
    error: entry?.error ?? null,
  };
}
