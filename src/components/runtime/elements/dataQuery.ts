"use client";

import { useEffect, useState } from "react";
import type { DataQuery, El, RuntimeRecord } from "@/lib/shared/types";
import { compareForSort, isDateGroup, numericAggregate, orderGroups } from "@/lib/shared/aggregate";
import { compareValues, evaluate, hasBindings } from "@/lib/shared/expressions";
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

function fieldValue(r: RuntimeRecord, name: string, schema?: SchemaCollection): unknown {
  name = schema?.fields.find((f) => f.id === name)?.name || name;
  const lower = name.toLowerCase();
  const key = name in r ? name : Object.keys(r).find((k) => k.toLowerCase() === lower);
  const v = key ? r[key] : undefined;
  return v && typeof v === "object" && !Array.isArray(v) && "_label" in (v as object) ? (v as { _label: unknown })._label : v;
}

/** Filter + sort example rows the way the server would, for thumbnails. */
export function queryRecords(records: RuntimeRecord[], q: DataQuery, limit?: number, schema?: SchemaCollection): RuntimeRecord[] {
  let out = records.filter((r) =>
    (q.filters || []).every((f) => {
      if (f.op === "mine") return true;
      if (!["isEmpty", "isNotEmpty", "isTrue", "isFalse"].includes(f.op) && (f.value === undefined || f.value === null || f.value === "")) return true;
      const v = fieldValue(r, f.field, schema);
      return compareValues(v, f.op, f.value);
    }),
  );
  const field = q.sortField || "createdAt";
  const dir = q.sortDir === "asc" ? 1 : -1;
  const type = schema?.fields.find((f) => f.id === field || f.name.toLowerCase() === field.toLowerCase())?.type;
  out = out.slice().sort((a, b) => {
    const x = fieldValue(a, field, schema);
    const y = fieldValue(b, field, schema);
    const compared = compareForSort(x, y, type);
    return compared !== 0 ? compared * dir : b.createdAt.localeCompare(a.createdAt);
  });
  return limit ? out.slice(0, limit) : out;
}

/** count / sum / avg … over example rows, optionally grouped (for thumbnail stats and charts). */
export function aggregateRecords(records: RuntimeRecord[], aggregate: string, field: string | undefined, groupBy?: string, schema?: SchemaCollection): { value: number; groups: { label: string; value: number }[] } {
  const calc = (rows: RuntimeRecord[]) => numericAggregate(rows.map((r) => fieldValue(r, field || "", schema)), field ? aggregate : "count");
  const groups: { label: string; value: number }[] = [];
  const groupField = schema?.fields.find((f) => f.id === groupBy || f.name.toLowerCase() === groupBy?.toLowerCase());
  if (groupBy) {
    const map = new Map<string, RuntimeRecord[]>();
    for (const r of records) {
      let v = fieldValue(r, groupBy, schema);
      if (isDateGroup(groupBy, groupField?.type) && typeof v === "string") v = v.slice(0, 10);
      const labels = Array.isArray(v) ? v.map(String) : [v === null || v === undefined || v === "" ? "(empty)" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)];
      for (const l of labels) { if (!map.has(l)) map.set(l, []); map.get(l)!.push(r); }
    }
    for (const [label, rows] of map) groups.push({ label, value: calc(rows) });
  }
  return { value: calc(records), groups: orderGroups(groups, groupBy || "", groupField) };
}
