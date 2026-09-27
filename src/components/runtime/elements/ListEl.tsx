"use client";

import { useState, type CSSProperties } from "react";
import type { El } from "@/lib/shared/types";
import { layoutOf } from "@/lib/shared/elements";
import { fontStack, resolveColor } from "@/lib/shared/theme";
import { Icon } from "@/components/ui/Icon";
import { isStatic, useRT } from "../store";
import { RecordContext, schemaFor } from "../context";
import { ElementView, autoLayoutStyle } from "../ElementView";
import { queryRecords, sampleRecord, useDebounced, useElementRecords } from "./dataQuery";

export function Pager({ page, total, pageSize, onPage, color }: { page: number; total: number; pageSize: number; onPage: (p: number) => void; color: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="rt-pager" style={{ color }}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <Icon name="ChevronLeft" size={16} />
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        <Icon name="ChevronRight" size={16} />
      </button>
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder, theme, style }: { value: string; onChange: (v: string) => void; placeholder?: string; theme: import("@/lib/shared/types").Theme; style?: CSSProperties }) {
  return (
    <div className="rt-search" style={{ borderColor: resolveColor("$border", theme), background: theme.colors.background, color: theme.colors.text, fontFamily: fontStack("$body", theme), ...style }}>
      <Icon name="Search" size={16} color={theme.colors.muted} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "Search…"} aria-label="Search" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search">
          <Icon name="X" size={14} />
        </button>
      )}
    </div>
  );
}

export function ListContent({ el }: { el: El }) {
  const theme = useRT((s) => s.doc.theme);
  const bp = useRT((s) => s.bp);
  const mode = useRT((s) => s.mode);
  const schema = useRT((s) => schemaFor(s, el.props.collectionId));
  const examples = useRT((s) => (el.props.collectionId ? s.samples[el.props.collectionId] : undefined));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const { data, loading, error } = useElementRecords(el, { page, search: debounced });
  const template = el.childIds?.[0];
  const L = layoutOf(el);
  const editor = isStatic(mode);
  const q = el.props.query || {};
  const muted = theme.colors.muted;

  if (!template) {
    return mode === "editor" ? (
      <div className="rt-list-empty-editor">
        <Icon name="LayoutList" size={22} />
        <span>Drop a card or box in here — it will repeat for every record.</span>
      </div>
    ) : null;
  }

  const collectionId = el.props.collectionId || null;
  let records = data?.records || [];
  let sample = false;
  if (editor && (!collectionId || (!loading && records.length === 0 && !debounced))) {
    // thumbnails show a few sample cards so the preview looks like the real thing
    const n = mode === "thumb" ? Math.min(q.pageSize || 3, 6) : 1;
    records = mode === "thumb" && examples?.length ? queryRecords(examples, q, n) : Array.from({ length: n }, (_, i) => ({ ...sampleRecord(schema), id: `sample-${i}` }));
    sample = true;
  }

  const items = records.map((r) => (
    <RecordContext.Provider key={r.id} value={{ record: r, collectionId }}>
      <ElementView id={template} placement={{ kind: "auto", layout: L }} />
    </RecordContext.Provider>
  ));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      {q.search && <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={q.searchPlaceholder} theme={theme} />}
      {mode === "editor" && sample && (
        <div className="rt-list-hint">
          <Icon name="Info" size={14} />
          {collectionId ? "No records yet — showing a sample. Add records in the Database tab." : "Choose a collection in the Data tab to fill this list."}
        </div>
      )}
      {error && !editor ? (
        <div className="rt-list-message" style={{ color: muted }}>
          {error}
        </div>
      ) : !loading && records.length === 0 ? (
        <div className="rt-list-message" style={{ color: muted, fontFamily: fontStack("$body", theme) }}>
          {debounced ? `No results for “${debounced}”.` : el.props.emptyText || "Nothing here yet."}
        </div>
      ) : (
        <div className="rt-auto" style={{ ...autoLayoutStyle(L, bp), opacity: loading && !data ? 0.5 : 1 }}>
          {items}
        </div>
      )}
      {data && !sample && <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} color={theme.colors.text} />}
    </div>
  );
}
