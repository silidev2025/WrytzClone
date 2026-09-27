"use client";

import { useState, type ReactNode } from "react";
import type { El, RuntimeRecord, TableColumn } from "@/lib/shared/types";
import { formatFieldValue, isEmptyValue } from "@/lib/shared/fields";
import { fontStack, resolveColor, withAlpha } from "@/lib/shared/theme";
import { safeImageSrc, safeUrl } from "@/lib/shared/util";
import { Icon } from "@/components/ui/Icon";
import { isStatic, useRT, useRTStore, type SchemaField } from "../store";
import { schemaFor } from "../context";
import { runActions } from "../actions";
import { useRuntimeApi } from "../hooks";
import { Pager, SearchBar } from "./ListEl";
import { queryRecords, sampleRecord, useDebounced, useElementRecords } from "./dataQuery";
import { effectiveFontSize } from "../styles";

function Cell({ field, value, accent }: { field?: SchemaField; value: unknown; accent: string }): ReactNode {
  if (isEmptyValue(value)) return <span style={{ opacity: 0.35 }}>—</span>;
  if (value && typeof value === "object" && !Array.isArray(value) && "_label" in (value as object)) return String((value as { _label: unknown })._label);
  switch (field?.type) {
    case "image": {
      const src = safeImageSrc(String(value));
      // eslint-disable-next-line @next/next/no-img-element
      return src ? <img src={src} alt="" className="rt-cell-img" /> : null;
    }
    case "boolean":
      return value ? <Icon name="CircleCheck" size={17} color={accent} /> : <span style={{ opacity: 0.35 }}>—</span>;
    case "url": {
      const href = safeUrl(String(value));
      return href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: accent }} onClick={(e) => e.stopPropagation()}>
          {String(value).replace(/^https?:\/\//, "").slice(0, 40)}
        </a>
      ) : (
        String(value)
      );
    }
    case "file":
      return (
        <a href={String(value)} target="_blank" rel="noopener noreferrer" style={{ color: accent }} onClick={(e) => e.stopPropagation()}>
          Open file
        </a>
      );
    case "select":
      return (
        <span className="rt-pill" style={{ background: withAlpha(accent, 0.12), color: accent }}>
          {String(value)}
        </span>
      );
    case "multiSelect":
      return (
        <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
          {(Array.isArray(value) ? value : String(value).split(",")).map((v) => (
            <span key={String(v)} className="rt-pill" style={{ background: withAlpha(accent, 0.12), color: accent }}>
              {String(v)}
            </span>
          ))}
        </span>
      );
    case "longText": {
      const s = String(value);
      return s.length > 80 ? s.slice(0, 80) + "…" : s;
    }
    default:
      return formatFieldValue(field, value);
  }
}

export function TableContent({ el }: { el: El }) {
  const store = useRTStore();
  const api = useRuntimeApi();
  const theme = useRT((s) => s.doc.theme);
  const bp = useRT((s) => s.bp);
  const mode = useRT((s) => s.mode);
  const schema = useRT((s) => schemaFor(s, el.props.collectionId));
  const examples = useRT((s) => (el.props.collectionId ? s.samples[el.props.collectionId] : undefined));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" } | null>(null);
  const debounced = useDebounced(search);
  const { data, loading, error } = useElementRecords(el, { page, search: debounced, sortField: sort?.field, sortDir: sort?.dir });
  const editor = isStatic(mode);
  const q = el.props.query || {};
  const fs = effectiveFontSize(el, bp);
  const text = resolveColor(el.style.color ?? "$text", theme);
  const border = resolveColor(el.style.borderColor ?? "$border", theme);
  const accent = theme.colors.primary;

  const fields = schema?.fields || [];
  const base: TableColumn[] = el.props.columns?.length ? el.props.columns : fields.slice(0, 6).map((f) => ({ field: f.name }));
  const columns = base.map((c) => ({
    ...c,
    def: fields.find((f) => f.name.toLowerCase() === c.field.toLowerCase()),
  }));

  let rows: RuntimeRecord[] = data?.records || [];
  const sample = editor && (!el.props.collectionId || (!loading && !rows.length && !debounced));
  if (sample) rows = mode === "thumb" && examples?.length ? queryRecords(examples, q, 6) : [sampleRecord(schema), sampleRecord(schema)];
  const rowClick = el.events?.rowClick;

  if (!el.props.collectionId && !editor) return null;

  return (
    <div className="rt-table-wrap" style={{ fontFamily: fontStack(el.style.fontFamily ?? "$body", theme), fontSize: fs, color: text }}>
      {q.search && (
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={q.searchPlaceholder} theme={theme} style={{ margin: "12px 12px 0" }} />
      )}
      <div className="rt-table-scroll">
        {!el.props.collectionId ? (
          <div className="rt-list-message" style={{ color: theme.colors.muted }}>
            Choose a collection in the Data tab to show its records here.
          </div>
        ) : (
          <table className="rt-table" style={{ borderColor: border }}>
            <thead>
              <tr style={{ background: theme.colors.surface }}>
                {columns.map((c) => {
                  const active = sort?.field === c.field;
                  return (
                    <th
                      key={c.field}
                      scope="col"
                      aria-sort={active ? sort?.dir === "asc" ? "ascending" : "descending" : "none"}
                      tabIndex={editor ? undefined : 0}
                      onKeyDown={(e) => {
                        if (!editor && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}
                      style={{ borderColor: border, width: c.width, cursor: editor ? undefined : "pointer" }}
                      onClick={() => {
                        if (editor) return;
                        setSort(active && sort?.dir === "asc" ? { field: c.field, dir: "desc" } : { field: c.field, dir: "asc" });
                        setPage(1);
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {c.label || c.field}
                        {active && <Icon name={sort?.dir === "asc" ? "ArrowUp" : "ArrowDown"} size={13} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id + i}
                  tabIndex={rowClick?.length && !editor ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && rowClick?.length && !editor && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}
                  style={{ background: el.props.striped !== false && i % 2 ? withAlpha(theme.colors.surface.startsWith("#") ? theme.colors.surface : "#f5f5f5", 0.7) : undefined, cursor: rowClick?.length && !editor ? "pointer" : undefined, opacity: sample ? 0.6 : 1 }}
                  onClick={
                    rowClick?.length && !editor
                      ? () => void runActions(rowClick, { store, api, scope: { record: r, collectionId: el.props.collectionId || null }, formId: null, sourceId: el.id })
                      : undefined
                  }
                >
                  {columns.map((c) => (
                    <td key={c.field} style={{ borderColor: border }}>
                      <Cell field={c.def} value={r[c.def?.name ?? c.field]} accent={accent} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {el.props.collectionId && !loading && !sample && rows.length === 0 && (
          <div className="rt-list-message" style={{ color: theme.colors.muted }}>
            {debounced ? `No results for “${debounced}”.` : el.props.emptyText || "No records yet."}
          </div>
        )}
        {error && !editor && <div className="rt-list-message">{error}</div>}
      </div>
      {data && !sample && <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} color={text} />}
    </div>
  );
}
