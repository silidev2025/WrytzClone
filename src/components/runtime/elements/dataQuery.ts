"use client";

import { useEffect, useState } from "react";
import type { DataQuery, El, RuntimeRecord } from "@/lib/shared/types";
import { evaluate, hasBindings } from "@/lib/shared/expressions";
import { useRT } from "../store";
import { useBindingContext, useRuntimeApi } from "../hooks";
import { useCached, type QueryBody, type QueryResult } from "../api";
import type { SchemaCollection } from "../store";

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Records for a list/table/chart element, honouring its filters (which may use bindings). */
export function useElementRecords(el: El, opts: { page: number; search: string; sortField?: string; sortDir?: "asc" | "desc"; pageSize?: number }) {
  const api = useRuntimeApi();
  const version = useRT((s) => s.dataVersion);
  const thumb = useRT((s) => s.mode === "thumb");
  const q = el.props.query || {};
  const collectionId = el.props.collectionId;
  const filters = q.filters || [];
  const ctx = useBindingContext(filters.some((f) => hasBindings(f.value)));
  const evaluated = filters.map((f) => ({ ...f, value: f.value && ctx ? String(evaluate(f.value, ctx) ?? "") : f.value }));
  const body: QueryBody = {
    collectionId: collectionId || "",
    filters: evaluated,
    sortField: opts.sortField ?? q.sortField,
    sortDir: opts.sortDir ?? q.sortDir,
    page: opts.page,
    pageSize: opts.pageSize ?? q.pageSize ?? 10,
    search: opts.search || undefined,
  };
  const key = collectionId && !thumb ? `q:${JSON.stringify(body)}:${version}` : null;
  return useCached<QueryResult>(key, () => api.query(body));
}

/** A believable placeholder row so an empty list can still be designed. */
export function sampleRecord(col: SchemaCollection | undefined): RuntimeRecord {
  const now = new Date().toISOString();
  const rec: RuntimeRecord = { id: "sample", createdAt: now, updatedAt: now, createdBy: null };
  for (const f of col?.fields || []) {
    switch (f.type) {
      case "number":
        rec[f.name] = 42;
        break;
      case "currency":
        rec[f.name] = 19.99;
        break;
      case "rating":
        rec[f.name] = 4;
        break;
      case "boolean":
        rec[f.name] = true;
        break;
      case "date":
        rec[f.name] = now.slice(0, 10);
        break;
      case "datetime":
        rec[f.name] = now;
        break;
      case "time":
        rec[f.name] = "09:30";
        break;
      case "image":
        rec[f.name] = `https://picsum.photos/seed/${encodeURIComponent(f.name)}/600/400`;
        break;
      case "select":
        rec[f.name] = f.options?.[0] || f.name;
        break;
      case "multiSelect":
        rec[f.name] = f.options?.slice(0, 2) || [f.name];
        break;
      case "email":
        rec[f.name] = "hello@example.com";
        break;
      case "url":
        rec[f.name] = "https://example.com";
        break;
      case "longText":
        rec[f.name] = `A few sentences describing the ${f.name.toLowerCase()} of this record.`;
        break;
      default:
        rec[f.name] = f.name;
    }
  }
  return rec;
}

/* ------------------------------------------------------------------ thumbnails */

function fieldValue(r: RuntimeRecord, name: string): unknown {
  if (name in r) return r[name];
  const lower = name.toLowerCase();
  const key = Object.keys(r).find((k) => k.toLowerCase() === lower);
  const v = key ? r[key] : undefined;
  return v && typeof v === "object" && !Array.isArray(v) && "_label" in (v as object) ? (v as { _label: unknown })._label : v;
}

/** Filter + sort example rows the way the server would, for thumbnails. */
export function queryRecords(records: RuntimeRecord[], q: DataQuery, limit?: number): RuntimeRecord[] {
  let out = records.filter((r) =>
    (q.filters || []).every((f) => {
      if (f.op === "mine") return true;
      const v = fieldValue(r, f.field);
      const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join(",") : String(v);
      const want = f.value ?? "";
      switch (f.op) {
        case "equals":
          return s.toLowerCase() === want.toLowerCase();
        case "notEquals":
          return s.toLowerCase() !== want.toLowerCase();
        case "contains":
          return s.toLowerCase().includes(want.toLowerCase());
        case "greater":
          return Number(s) > Number(want);
        case "less":
          return Number(s) < Number(want);
        case "isEmpty":
          return s === "";
        case "isNotEmpty":
          return s !== "";
        case "isTrue":
          return v === true || s === "true";
        case "isFalse":
          return !(v === true || s === "true");
        default:
          return true;
      }
    }),
  );
  const field = q.sortField || "createdAt";
  const dir = q.sortDir === "asc" ? 1 : -1;
  out = out.slice().sort((a, b) => {
    const x = fieldValue(a, field);
    const y = fieldValue(b, field);
    const nx = Number(x);
    const ny = Number(y);
    const numbers = x !== null && y !== null && x !== "" && y !== "" && Number.isFinite(nx) && Number.isFinite(ny);
    return (numbers ? nx - ny : String(x ?? "").localeCompare(String(y ?? ""))) * dir;
  });
  return limit ? out.slice(0, limit) : out;
}

/** count / sum / avg … over example rows, optionally grouped (for thumbnail stats and charts). */
export function aggregateRecords(records: RuntimeRecord[], aggregate: string, field: string | undefined, groupBy?: string): { value: number; groups: { label: string; value: number }[] } {
  const calc = (rows: RuntimeRecord[]) => {
    if (aggregate === "count" || !field) return rows.length;
    const nums = rows.map((r) => Number(fieldValue(r, field))).filter((n) => Number.isFinite(n));
    if (!nums.length) return 0;
    if (aggregate === "sum") return nums.reduce((a, b) => a + b, 0);
    if (aggregate === "avg") return nums.reduce((a, b) => a + b, 0) / nums.length;
    if (aggregate === "min") return Math.min(...nums);
    if (aggregate === "max") return Math.max(...nums);
    return rows.length;
  };
  const groups: { label: string; value: number }[] = [];
  if (groupBy) {
    const map = new Map<string, RuntimeRecord[]>();
    for (const r of records) {
      let v = fieldValue(r, groupBy);
      if (groupBy === "createdAt" || /^\d{4}-\d{2}-\d{2}/.test(String(v ?? ""))) v = String(v ?? "").slice(0, 10);
      const labels = Array.isArray(v) ? v.map(String) : [v === null || v === undefined || v === "" ? "(empty)" : String(v)];
      for (const l of labels) map.set(l, [...(map.get(l) || []), r]);
    }
    for (const [label, rows] of map) groups.push({ label, value: calc(rows) });
  }
  return { value: calc(records), groups };
}
