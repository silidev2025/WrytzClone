"use client";

import { useEffect, useRef, useState } from "react";
import type { DataFilter, RuntimeRecord, TransactionStep } from "@/lib/shared/types";
import { api } from "@/lib/client/api";

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
export function runtimeApi(appId: string) {
  const base = `/api/run/${appId}`;
  return {
    query: (q: QueryBody) => api<QueryResult>(`${base}/query`, { body: { ...q, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
    create: (collectionId: string, values: Record<string, unknown>) =>
      api<{ record: RuntimeRecord }>(`${base}/records`, { body: { collectionId, values, idempotencyKey: newKey() } }),
    update: (collectionId: string, recordId: string, values: Record<string, unknown>) =>
      api<{ record: RuntimeRecord }>(`${base}/records`, { method: "PATCH", body: { collectionId, recordId, values } }),
    remove: (collectionId: string, recordId: string) => api(`${base}/records`, { method: "DELETE", body: { collectionId, recordId } }),
    adjust: (collectionId: string, recordId: string, field: string, amount: number, min?: number) =>
      api<{ record: RuntimeRecord }>(`${base}/adjust`, { body: { collectionId, recordId, field, amount, min } }),
    transaction: (steps: TransactionStep[]) => api<{ steps: { id: string }[] }>(`${base}/transaction`, { body: { steps, idempotencyKey: newKey() } }),
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

const cache = new Map<string, { data?: unknown; promise?: Promise<unknown>; error?: string }>();

export function invalidateAll() {
  cache.clear();
}

/** Tiny stale-while-revalidate hook keyed by a string. `key = null` skips fetching. */
export function useCached<T>(key: string | null, fetcher: () => Promise<T>): { data: T | undefined; loading: boolean; error: string | null } {
  const [, force] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const entry = key ? cache.get(key) : undefined;

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const existing = cache.get(key);
    if (existing?.data !== undefined || existing?.error) return;
    const promise =
      existing?.promise ||
      fetcherRef.current().then(
        (data) => {
          cache.set(key, { data });
          if (cache.size > 400) cache.delete(cache.keys().next().value as string);
          return data;
        },
        (err: Error) => {
          cache.set(key, { error: err.message || "Couldn't load data" });
          throw err;
        },
      );
    if (!existing?.promise) cache.set(key, { promise });
    promise.then(
      () => alive && force((n) => n + 1),
      () => alive && force((n) => n + 1),
    );
    return () => {
      alive = false;
    };
  }, [key]);

  // keep showing the previous data for this "family" while the new key loads
  const last = useRef<T | undefined>(undefined);
  if (entry?.data !== undefined) last.current = entry.data as T;
  return {
    data: (entry?.data as T | undefined) ?? (key ? last.current : undefined),
    loading: !!key && entry?.data === undefined && !entry?.error,
    error: entry?.error ?? null,
  };
}
