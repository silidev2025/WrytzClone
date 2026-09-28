"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Check, Maximize2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import type { Collection, Field, RecordDoc } from "@/lib/shared/types";
import { FIELD_TYPE_MAP, formatFieldValue, isEmptyValue } from "@/lib/shared/fields";
import { relativeTime, safeImageSrc } from "@/lib/shared/util";
import { Icon } from "@/components/ui/Icon";
import { Popover, MenuList, type MenuEntry } from "@/components/ui/Popover";
import { FieldValueInput, labelFor, loadRefRecords, toLocalInput } from "./FieldInputs";

const INLINE = new Set(["text", "email", "phone", "url", "number", "currency", "date", "time", "datetime"]);
const DEFAULT_W: Partial<Record<Field["type"], number>> = { longText: 260, number: 120, currency: 130, boolean: 96, rating: 130, image: 110, date: 150, time: 110, email: 220, url: 220 };

export function colWidth(f: Field) {
  return f.width || DEFAULT_W[f.type] || 190;
}

interface Props {
  collection: Collection;
  collections: Collection[];
  records: RecordDoc[];
  sort: { field: string; dir: "asc" | "desc" };
  onSort: (s: { field: string; dir: "asc" | "desc" }) => void;
  onCommit: (rec: RecordDoc, field: Field, value: unknown) => Promise<void>;
  onOpenRecord: (rec: RecordDoc) => void;
  onEditField: (f: Field | null) => void;
  onDeleteField: (f: Field) => void;
  onResizeField: (f: Field, width: number) => void;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onAddRecord: () => void;
}

export function RecordsGrid(props: Props) {
  const { collection, collections, records, sort, onSort, onCommit, onOpenRecord, onEditField, onDeleteField, onResizeField, selected, setSelected, onAddRecord } = props;
  const fields = collection.fields;
  const [focus, setFocus] = useState<{ r: number; c: number } | null>(null);
  const [editing, setEditing] = useState<{ r: number; c: number; value: unknown; anchor: HTMLElement | null } | null>(null);
  const [headerMenu, setHeaderMenu] = useState<{ field: Field; anchor: HTMLElement } | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [refLabels, setRefLabels] = useState<Record<string, Record<string, string>>>({});
  const wrapRef = useRef<HTMLDivElement>(null);

  // labels for link-to-record fields
  const refKey = fields.filter((f) => f.type === "reference").map((f) => f.refCollectionId).join(",");
  useEffect(() => {
    for (const f of fields) {
      if (f.type !== "reference" || !f.refCollectionId) continue;
      const target = collections.find((c) => c.id === f.refCollectionId);
      loadRefRecords(f.refCollectionId, true)
        .then((recs) => setRefLabels((m) => ({ ...m, [f.refCollectionId!]: Object.fromEntries(recs.map((r) => [r.id, labelFor(target, r)])) })))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey, records.length]);

  const width = (f: Field) => widths[f.id] ?? colWidth(f);

  const startEdit = (r: number, c: number, initial?: string) => {
    const rec = records[r];
    const f = fields[c];
    if (!rec || !f) return;
    if (f.type === "boolean") {
      void onCommit(rec, f, !rec.data[f.id]);
      return;
    }
    const cell = wrapRef.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`) ?? null;
    setEditing({ r, c, value: initial !== undefined ? initial : (rec.data[f.id] ?? ""), anchor: cell });
  };

  const commit = async (value: unknown) => {
    if (!editing) return;
    const rec = records[editing.r];
    const f = fields[editing.c];
    setEditing(null);
    wrapRef.current?.focus();
    if (!rec || !f) return;
    const before = rec.data[f.id] ?? "";
    if (JSON.stringify(before) === JSON.stringify(value ?? "")) return;
    await onCommit(rec, f, value);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing || !focus) return;
    const { r, c } = focus;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      setFocus({ r: Math.max(0, Math.min(records.length - 1, r + dr)), c: Math.max(0, Math.min(fields.length - 1, c + dc)) });
    };
    if (e.key === "ArrowDown") move(1, 0);
    else if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) move(0, 1);
    else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) move(0, -1);
    else if (e.key === "Enter") {
      e.preventDefault();
      startEdit(r, c);
    } else if (e.key === "Escape") setFocus(null);
    else if ((e.key === "Delete" || e.key === "Backspace") && records[r] && fields[c]) {
      e.preventDefault();
      void onCommit(records[r], fields[c], fields[c].type === "boolean" ? false : null);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && fields[c] && INLINE.has(fields[c].type)) {
      e.preventDefault();
      startEdit(r, c, e.key);
    }
  };

  const display = (f: Field, v: unknown) => {
    if (isEmptyValue(v)) return <span style={{ color: "var(--faint)" }}>—</span>;
    switch (f.type) {
      case "boolean":
        return v ? <Check size={16} color="var(--success)" strokeWidth={3} /> : <span style={{ color: "var(--faint)" }}>—</span>;
      case "image": {
        const src = safeImageSrc(String(v));
        // eslint-disable-next-line @next/next/no-img-element
        return src ? <img className="cell-img" src={src} alt="" /> : String(v);
      }
      case "select":
        return <span className="cell-pill">{String(v)}</span>;
      case "multiSelect":
        return (Array.isArray(v) ? v : [v]).map((x) => (
          <span key={String(x)} className="cell-pill">
            {String(x)}
          </span>
        ));
      case "rating":
        return <span style={{ color: "#f5a524", letterSpacing: 1 }}>{formatFieldValue(f, v)}</span>;
      case "reference":
        return <span className="cell-pill">{refLabels[f.refCollectionId || ""]?.[String(v)] ?? "…"}</span>;
      case "file":
        return <span style={{ color: "var(--brand)" }}>{decodeURIComponent(String(v).split("/").pop() || "file")}</span>;
      default:
        return formatFieldValue(f, v);
    }
  };

  const headerItems = (f: Field): MenuEntry[] => [
    { label: "Edit field", icon: <Pencil size={15} />, onClick: () => onEditField(f) },
    { label: "Sort A → Z", icon: <ArrowDownAZ size={15} />, onClick: () => onSort({ field: f.name, dir: "asc" }) },
    { label: "Sort Z → A", icon: <ArrowUpAZ size={15} />, onClick: () => onSort({ field: f.name, dir: "desc" }) },
    "sep",
    { label: "Delete field", icon: <Trash2 size={15} />, danger: true, onClick: () => onDeleteField(f) },
  ];

  const allChecked = records.length > 0 && records.every((r) => selected.has(r.id));
  const editField = editing ? fields[editing.c] : null;
  const inlineEditing = editing && editField && INLINE.has(editField.type);

  const startResize = (f: Field, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = e.clientX;
    const w0 = width(f);
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    let latest = w0;
    const move = (ev: PointerEvent) => {
      latest = Math.max(70, Math.min(800, w0 + ev.clientX - start));
      setWidths((m) => ({ ...m, [f.id]: latest }));
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      if (latest !== w0) onResizeField(f, latest);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  const columns = useMemo(() => fields.map((f) => ({ f, w: width(f) })), [fields, widths]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="db-grid-wrap" ref={wrapRef} tabIndex={0} onKeyDown={onKeyDown} aria-label={`${collection.name} records`}>
      <table className="db-grid">
        <thead>
          <tr>
            <th className="sticky-col">
              <input
                type="checkbox"
                aria-label="Select all rows"
                checked={allChecked}
                onChange={(e) => setSelected(e.target.checked ? new Set(records.map((r) => r.id)) : new Set())}
                style={{ accentColor: "var(--brand)" }}
              />
            </th>
            {columns.map(({ f, w }) => (
              <th key={f.id} style={{ width: w, minWidth: w, maxWidth: w }}>
                <div className="th-inner" onClick={(e) => setHeaderMenu({ field: f, anchor: e.currentTarget })} title={`${f.name} · ${FIELD_TYPE_MAP[f.type].label}${f.required ? " · required" : ""}`}>
                  <span className="field-type-chip">
                    <Icon name={FIELD_TYPE_MAP[f.type].icon} size={12} />
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                  {f.required && <span style={{ color: "var(--danger)" }}>*</span>}
                  {sort.field === f.name && (sort.dir === "asc" ? <ArrowDownAZ size={13} /> : <ArrowUpAZ size={13} />)}
                  <span className="col-resize" onPointerDown={(e) => startResize(f, e)} onClick={(e) => e.stopPropagation()} />
                </div>
              </th>
            ))}
            <th style={{ width: 150, minWidth: 150 }}>
              <div className="th-inner" onClick={() => onSort({ field: "createdAt", dir: sort.field === "createdAt" && sort.dir === "desc" ? "asc" : "desc" })}>
                <Icon name="Clock" size={13} /> Added
              </div>
            </th>
            <th style={{ width: 54, minWidth: 54 }}>
              <div className="th-inner" onClick={() => onEditField(null)} title="Add a field" style={{ justifyContent: "center" }}>
                <Plus size={16} />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec, r) => (
            <tr key={rec.id} className={selected.has(rec.id) ? "row-selected" : ""}>
              <td className="sticky-col">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                  <input
                    type="checkbox"
                    aria-label="Select row"
                    checked={selected.has(rec.id)}
                    style={{ accentColor: "var(--brand)" }}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(rec.id);
                      else next.delete(rec.id);
                      setSelected(next);
                    }}
                  />
                  <button className="icon-btn sm" style={{ width: 20, height: 20 }} title="Open record" aria-label="Open record" onClick={() => onOpenRecord(rec)}>
                    <Maximize2 size={11} />
                  </button>
                </div>
              </td>
              {columns.map(({ f, w }, c) => {
                const isFocus = focus?.r === r && focus?.c === c;
                const isEditing = editing?.r === r && editing?.c === c;
                return (
                  <td key={f.id} style={{ width: w, minWidth: w, maxWidth: w }}>
                    {f.type === "rating" ? (
                      <div className={`cell ${isFocus ? "focused" : ""}`} data-cell={`${r}-${c}`} onClick={() => setFocus({ r, c })}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            size={15}
                            fill={i <= Number(rec.data[f.id] || 0) ? "#f5a524" : "none"}
                            color={i <= Number(rec.data[f.id] || 0) ? "#f5a524" : "var(--faint)"}
                            style={{ cursor: "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              void onCommit(rec, f, Number(rec.data[f.id] || 0) === i ? 0 : i);
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`cell ${isFocus ? "focused" : ""}`}
                        data-cell={`${r}-${c}`}
                        onClick={() => {
                          setFocus({ r, c });
                          if (f.type === "boolean") startEdit(r, c);
                        }}
                        onDoubleClick={() => startEdit(r, c)}
                        title={typeof rec.data[f.id] === "string" && String(rec.data[f.id]).length > 30 ? String(rec.data[f.id]) : undefined}
                      >
                        {display(f, rec.data[f.id])}
                      </div>
                    )}
                    {isEditing && inlineEditing && (
                      <InlineEditor field={f} initial={editing!.value} onCommit={commit} onCancel={() => setEditing(null)} />
                    )}
                  </td>
                );
              })}
              <td>
                <div className="cell" style={{ color: "var(--muted)", fontSize: 12 }} title={new Date(rec.createdAt).toLocaleString()}>
                  {relativeTime(rec.createdAt)}
                </div>
              </td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      <button className="add-row-btn" onClick={onAddRecord}>
        <Plus size={15} /> New record
      </button>

      {editing && editField && !INLINE.has(editField.type) && (
        <Popover anchor={editing.anchor} open onClose={() => setEditing(null)} placement="bottom-start" width={320}>
          <PopoverEditor field={editField} collections={collections} initial={editing.value} onCommit={commit} onCancel={() => setEditing(null)} />
        </Popover>
      )}
      <Popover anchor={headerMenu?.anchor ?? null} open={!!headerMenu} onClose={() => setHeaderMenu(null)} placement="bottom-start">
        {headerMenu && <MenuList items={headerItems(headerMenu.field)} onDone={() => setHeaderMenu(null)} />}
      </Popover>
    </div>
  );
}

function InlineEditor({ field, initial, onCommit, onCancel }: { field: Field; initial: unknown; onCommit: (v: unknown) => void; onCancel: () => void }) {
  const str = initial === null || initial === undefined ? "" : String(initial);
  const [value, setValue] = useState(field.type === "datetime" ? toLocalInput(str) : field.type === "date" ? str.slice(0, 10) : str);
  const done = useRef(false);
  const type = field.type === "number" || field.type === "currency" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : field.type === "datetime" ? "datetime-local" : "text";
  return (
    <input
      className="cell-editor"
      autoFocus
      type={type}
      step={type === "number" ? "any" : undefined}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (!done.current) {
          done.current = true;
          onCommit(value);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          done.current = true;
          onCommit(value);
        } else if (e.key === "Escape") {
          done.current = true;
          onCancel();
        }
        e.stopPropagation();
      }}
    />
  );
}

function PopoverEditor({ field, collections, initial, onCommit, onCancel }: { field: Field; collections: Collection[]; initial: unknown; onCommit: (v: unknown) => void; onCancel: () => void }) {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <div style={{ display: "grid", gap: 10, padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
      <div className="field-label">{field.name}</div>
      <FieldValueInput
        field={field}
        value={value}
        collections={collections}
        autoFocus
        onChange={(v) => {
          setValue(v);
          if (field.type === "select" || field.type === "reference") onCommit(v);
        }}
      />
      {field.type !== "select" && field.type !== "reference" && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button className="btn sm ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn sm primary" onClick={() => onCommit(value)}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}
