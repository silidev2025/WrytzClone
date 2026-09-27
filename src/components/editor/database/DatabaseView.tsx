"use client";

import { useCallback, useEffect, useState } from "react";
import { Boxes, ChevronLeft, ChevronRight, Database, Download, FileUp, ListPlus, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import type { Collection, CollectionAccess, Field, FieldType, RecordDoc } from "@/lib/shared/types";
import { ACCESS_PRESETS, collectionNameError } from "@/lib/shared/fields";
import { csvEscape } from "@/lib/shared/util";
import { api, errorMessage } from "@/lib/client/api";
import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Popover";
import { Icon, iconExists } from "@/components/ui/Icon";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { bumpData, ed, setCollections, useEditor } from "../store";
import { RecordsGrid } from "./RecordsGrid";
import { FieldEditor } from "./FieldEditor";
import { AccessDialog } from "./AccessDialog";
import { StockRuleDialog } from "./StockRuleDialog";
import { RecordForm } from "./RecordForm";
import { ImportDialog } from "./ImportDialog";

type StarterField = { name: string; type: FieldType; required?: boolean; options?: string[]; currency?: string };
const STARTERS: { id: string; name: string; emoji: string; hint: string; fields: StarterField[]; access: string }[] = [
  { id: "blank", name: "Blank", emoji: "🗂️", hint: "Start with one Name field", fields: [{ name: "Name", type: "text" }], access: "private" },
  {
    id: "contacts",
    name: "Contacts",
    emoji: "📇",
    hint: "People and how to reach them",
    fields: [
      { name: "Name", type: "text", required: true },
      { name: "Email", type: "email" },
      { name: "Phone", type: "phone" },
      { name: "Company", type: "text" },
      { name: "Notes", type: "longText" },
    ],
    access: "inbox",
  },
  {
    id: "tasks",
    name: "Tasks",
    emoji: "✅",
    hint: "To-dos with due dates and priority",
    fields: [
      { name: "Title", type: "text", required: true },
      { name: "Done", type: "boolean" },
      { name: "Due", type: "date" },
      { name: "Priority", type: "select", options: ["Low", "Medium", "High"] },
      { name: "Notes", type: "longText" },
    ],
    access: "personal",
  },
  {
    id: "products",
    name: "Products",
    emoji: "🛍️",
    hint: "Things you sell, with prices and stock",
    fields: [
      { name: "Name", type: "text", required: true },
      { name: "Price", type: "currency", currency: "USD" },
      { name: "Photo", type: "image" },
      { name: "Description", type: "longText" },
      { name: "Stock", type: "number" },
      { name: "Category", type: "select", options: ["New", "Popular", "Sale"] },
    ],
    access: "catalog",
  },
  {
    id: "events",
    name: "Events",
    emoji: "📅",
    hint: "Dates, places and descriptions",
    fields: [
      { name: "Title", type: "text", required: true },
      { name: "When", type: "datetime" },
      { name: "Where", type: "text" },
      { name: "Description", type: "longText" },
      { name: "Spots", type: "number" },
    ],
    access: "catalog",
  },
  {
    id: "posts",
    name: "Blog posts",
    emoji: "📝",
    hint: "Articles with a cover image",
    fields: [
      { name: "Title", type: "text", required: true },
      { name: "Cover", type: "image" },
      { name: "Body", type: "longText" },
      { name: "Author", type: "text" },
      { name: "Published", type: "boolean" },
      { name: "Tags", type: "multiSelect", options: ["News", "Guide", "Story"] },
    ],
    access: "catalog",
  },
  {
    id: "feedback",
    name: "Feedback",
    emoji: "💬",
    hint: "Ratings and messages from visitors",
    fields: [
      { name: "Name", type: "text" },
      { name: "Email", type: "email" },
      { name: "Rating", type: "rating" },
      { name: "Message", type: "longText", required: true },
      { name: "Status", type: "select", options: ["New", "Reviewed", "Done"] },
    ],
    access: "inbox",
  },
];

const EMOJIS = ["🗂️", "📇", "✅", "🛍️", "📅", "📝", "💬", "📦", "🧾", "👥", "⭐", "🎟️", "🏠", "📚", "🍕", "💡", "🎯", "📈"];

function NewCollectionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const collections = useEditor((s) => s.collections);
  const [starter, setStarter] = useState(STARTERS[0]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setStarter(STARTERS[0]);
      setName("");
      setError(null);
    }
  }, [open]);
  const create = async () => {
    const finalName = (name || (starter.id === "blank" ? "" : starter.name)).trim();
    const err = collectionNameError(finalName, collections.map((c) => c.name));
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    try {
      const access = ACCESS_PRESETS.find((p) => p.id === starter.access)?.access;
      const { collection } = await api<{ collection: Collection }>(`/api/apps/${ed().app.id}/collections`, { body: { name: finalName, icon: starter.emoji, fields: starter.fields, access } });
      setCollections([...ed().collections, collection]);
      useEditor.setState({ dbCollectionId: collection.id });
      toast.success(`Created ${collection.name}`);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      title="New collection"
      description="A collection is like a spreadsheet tab: each row is a record, each column a field."
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={create} disabled={busy}>
            Create collection
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="c-name">Name</label>
        <input
          id="c-name"
          className={`input ${error ? "invalid" : ""}`}
          autoFocus
          value={name}
          placeholder={starter.id === "blank" ? "e.g. Orders, Members, Recipes" : starter.name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && void create()}
        />
        {error && <div className="field-error">{error}</div>}
      </div>
      <div className="field">
        <span className="field-label">Start with</span>
        <div className="template-pick-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
          {STARTERS.map((s) => (
            <button key={s.id} className={`template-pick ${starter.id === s.id ? "selected" : ""}`} style={{ padding: 12 }} onClick={() => setStarter(s)}>
              <span style={{ fontSize: 22 }}>{s.emoji}</span>
              <strong>{s.name}</strong>
              <span className="mini-note" style={{ fontWeight: 500 }}>
                {s.hint}
              </span>
              <span className="mini-note" style={{ fontWeight: 500 }}>
                {s.fields.map((f) => f.name).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      </div>
      {(() => {
        const preset = ACCESS_PRESETS.find((p) => p.id === starter.access);
        return preset ? (
          <div className="alert info">
            <strong>Who can use it: {preset.label}.</strong> {preset.description} You can change this any time under Access.
          </div>
        ) : null;
      })()}
    </Modal>
  );
}

export function DatabaseView() {
  const collections = useEditor((s) => s.collections);
  const published = useEditor((s) => !!s.app.published);
  const selectedId = useEditor((s) => s.dbCollectionId);
  const col = collections.find((c) => c.id === selectedId) || collections[0];
  const [records, setRecords] = useState<RecordDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "createdAt", dir: "desc" });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);
  const [fieldEdit, setFieldEdit] = useState<{ field: Field | null } | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [recordEdit, setRecordEdit] = useState<{ record: RecordDoc | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const PAGE_SIZE = 100;

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!col) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort: sort.field, dir: sort.dir });
      if (query) qs.set("search", query);
      const res = await api<{ records: RecordDoc[]; total: number }>(`/api/apps/${ed().app.id}/collections/${col.id}/records?${qs}`);
      setRecords(res.records);
      setTotal(res.total);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [col, page, sort, query]);

  useEffect(() => {
    void load();
    setSelected(new Set());
  }, [load]);

  useEffect(() => {
    setPage(1);
    setSearch("");
    setSort({ field: "createdAt", dir: "desc" });
  }, [col?.id]);

  const patchCollection = async (patch: Record<string, unknown>) => {
    if (!col) return;
    try {
      const { collection } = await api<{ collection: Collection }>(`/api/apps/${ed().app.id}/collections/${col.id}`, { method: "PATCH", body: patch });
      setCollections(ed().collections.map((c) => (c.id === collection.id ? collection : c)));
      return collection;
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  const commitCell = async (rec: RecordDoc, field: Field, value: unknown) => {
    if (!col) return;
    const prev = records;
    setRecords((rs) => rs.map((r) => (r.id === rec.id ? { ...r, data: { ...r.data, [field.id]: value } } : r)));
    try {
      const { record } = await api<{ record: RecordDoc }>(`/api/apps/${ed().app.id}/collections/${col.id}/records/${rec.id}`, { method: "PATCH", body: { values: { [field.id]: value } } });
      setRecords((rs) => rs.map((r) => (r.id === record.id ? record : r)));
      bumpData();
    } catch (err) {
      setRecords(prev);
      toast.error(errorMessage(err));
    }
  };

  const deleteSelected = async () => {
    if (!col || !selected.size) return;
    if (!(await confirmDialog({ title: `Delete ${selected.size} record${selected.size === 1 ? "" : "s"}?`, message: "This can't be undone.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await api(`/api/apps/${ed().app.id}/collections/${col.id}/records`, { method: "DELETE", body: { ids: Array.from(selected) } });
      setSelected(new Set());
      await load();
      bumpData();
      toast.success("Deleted");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const exportCsv = async () => {
    if (!col) return;
    try {
      const all: RecordDoc[] = [];
      for (let p = 1; p < 100; p++) {
        const res = await api<{ records: RecordDoc[]; total: number }>(`/api/apps/${ed().app.id}/collections/${col.id}/records?page=${p}&pageSize=500&sort=createdAt&dir=asc`);
        all.push(...res.records);
        if (all.length >= res.total || !res.records.length) break;
      }
      const header = [...col.fields.map((f) => f.name), "Added"];
      const lines = [header.map(csvEscape).join(","), ...all.map((r) => [...col.fields.map((f) => csvEscape(r.data[f.id])), csvEscape(r.createdAt)].join(","))];
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${col.name}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const deleteCollection = async () => {
    if (!col) return;
    const ok = await confirmDialog({
      title: `Delete the “${col.name}” collection?`,
      message: "All of its records are deleted too. Lists and forms connected to it will stop showing or saving data.",
      confirmLabel: "Delete collection",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/apps/${ed().app.id}/collections/${col.id}`, { method: "DELETE" });
      const rest = ed().collections.filter((c) => c.id !== col.id);
      setCollections(rest);
      useEditor.setState({ dbCollectionId: rest[0]?.id ?? null });
      toast.success("Collection deleted");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const saveField = async (draft: Partial<Field>) => {
    if (!col) return;
    const fields = fieldEdit?.field ? col.fields.map((f) => (f.id === fieldEdit.field!.id ? ({ ...f, ...draft } as Field) : f)) : [...col.fields, draft as Field];
    const old = fieldEdit?.field;
    const updated = await patchCollection({ fields });
    // keep bindings like {{record.Old}} working after a rename
    if (updated && old && draft.name && draft.name !== old.name) renameFieldBindings(old.name, draft.name);
    await load();
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="db-view">
      <div className="db-mobile-picker">
        <select className="select" aria-label="Collection" value={col?.id || ""} onChange={(e) => useEditor.setState({ dbCollectionId: e.target.value })}>
          {!collections.length && <option value="">No collections</option>}
          {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn sm" onClick={() => setNewOpen(true)}><Plus size={14} /> New collection</button>
      </div>
      <aside className="db-side">
        <div className="panel-head">
          <h2>Collections</h2>
          <button className="btn sm primary" onClick={() => setNewOpen(true)}>
            <Plus size={14} /> New
          </button>
        </div>
        <div className="panel-scroll">
          {collections.map((c) => (
            <button type="button" key={c.id} className={`db-col-row ${c.id === col?.id ? "active" : ""}`} aria-pressed={c.id === col?.id} onClick={() => useEditor.setState({ dbCollectionId: c.id })}>
              <span className="db-emoji">{c.icon && iconExists(c.icon) ? <Icon name={c.icon} size={18} /> : c.icon || "🗂️"}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
              <span className="mini-note">{c.fields.length}</span>
            </button>
          ))}
          {!collections.length && <p className="panel-hint">No collections yet.</p>}
          <p className="panel-hint" style={{ marginTop: 18 }}>
            Tip: the data you add here is the same data your app shows in Preview and when published.
          </p>
        </div>
      </aside>

      <section className="db-main">
        {!col ? (
          <div className="db-empty">
            <div className="empty-icon">
              <Database size={26} />
            </div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink)" }}>Give your app a memory</h3>
            <p style={{ maxWidth: 420 }}>Create a collection to store sign-ups, orders, tasks, posts — anything. Then show it with lists and tables, and fill it with forms.</p>
            <button className="btn gradient" onClick={() => setNewOpen(true)}>
              <Plus size={16} /> Create a collection
            </button>
          </div>
        ) : (
          <>
            {published && (
              <div className="alert info" style={{ margin: "10px 16px 0" }}>
                Your app is live: rows, fields and access rules you change here apply to it right away (unlike page designs, which wait for "Publish update").
              </div>
            )}
            <div className="db-toolbar">
              <Dropdown
                trigger={<button className="icon-btn bordered" aria-label="Collection icon" title="Change collection icon">{col.icon && iconExists(col.icon) ? <Icon name={col.icon} size={20} /> : col.icon || "🗂️"}</button>}
                items={Array.from(new Set([col.icon || "🗂️", ...EMOJIS])).map((icon) => ({ label: icon, icon: iconExists(icon) ? <Icon name={icon} size={16} /> : undefined, checked: icon === (col.icon || "🗂️"), onClick: () => void patchCollection({ icon }) }))}
              />
              <h2>{col.name}</h2>
              <span className="badge">
                {total} record{total === 1 ? "" : "s"}
              </span>
              <div className="search-box" style={{ minWidth: 180, maxWidth: 280 }}>
                <Search size={15} />
                <input className="input sm" style={{ height: 34, paddingLeft: 34 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search records" />
              </div>
              <div style={{ flex: 1 }} />
              {selected.size > 0 && (
                <button className="btn sm danger-ghost" onClick={deleteSelected}>
                  <Trash2 size={14} /> Delete {selected.size}
                </button>
              )}
              <button className="btn sm" onClick={() => setFieldEdit({ field: null })}>
                <ListPlus size={14} /> Add field
              </button>
              <button className="btn sm" onClick={() => setAccessOpen(true)} title="Who can see and change this data">
                <ShieldCheck size={14} /> Access
              </button>
              <button className="btn sm primary" onClick={() => setRecordEdit({ record: null })}>
                <Plus size={14} /> Add record
              </button>
              <Dropdown
                trigger={
                  <button className="icon-btn bordered" aria-label="More collection actions">
                    <MoreHorizontal size={16} />
                  </button>
                }
                items={[
                  { label: "Import from CSV…", icon: <FileUp size={15} />, onClick: () => setImportOpen(true) },
                  { label: "Download as CSV", icon: <Download size={15} />, onClick: () => void exportCsv() },
                  { label: col.stock ? "Stock rule (on)…" : "Stock rule…", icon: <Boxes size={15} />, onClick: () => setStockOpen(true) },
                  "sep",
                  {
                    label: "Rename collection",
                    icon: <Pencil size={15} />,
                    onClick: async () => {
                      const name = await promptDialog({
                        title: "Rename collection",
                        defaultValue: col.name,
                        label: "Name",
                        validate: (v) => collectionNameError(v, collections.filter((c) => c.id !== col.id).map((c) => c.name)),
                      });
                      if (name) await patchCollection({ name });
                    },
                  },
                  { label: "Delete collection", icon: <Trash2 size={15} />, danger: true, onClick: () => void deleteCollection() },
                ]}
              />
            </div>
            {col.fields.length === 0 ? (
              <div className="db-empty">
                <p>This collection has no fields yet.</p>
                <button className="btn primary" onClick={() => setFieldEdit({ field: null })}>
                  <ListPlus size={15} /> Add the first field
                </button>
              </div>
            ) : (
              <RecordsGrid
                collection={col}
                collections={collections}
                records={records}
                sort={sort}
                onSort={(s) => {
                  setSort(s);
                  setPage(1);
                }}
                onCommit={commitCell}
                onOpenRecord={(record) => setRecordEdit({ record })}
                onEditField={(field) => setFieldEdit({ field })}
                onDeleteField={async (f) => {
                  if (!(await confirmDialog({ title: `Delete the “${f.name}” field?`, message: "Its values are removed from every record. This can't be undone.", confirmLabel: "Delete field", danger: true }))) return;
                  await patchCollection({ fields: col.fields.filter((x) => x.id !== f.id) });
                  await load();
                }}
                onResizeField={(f, width) => void patchCollection({ fields: col.fields.map((x) => (x.id === f.id ? { ...x, width } : x)) }).catch(() => undefined)}
                selected={selected}
                setSelected={setSelected}
                onAddRecord={() => setRecordEdit({ record: null })}
              />
            )}
            <div className="db-footer">
              <span>{loading ? "Loading…" : query ? `${total} match${total === 1 ? "" : "es"} for “${query}”` : `${total} record${total === 1 ? "" : "s"}`}</span>
              {pages > 1 && (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="icon-btn sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                    <ChevronLeft size={15} />
                  </button>
                  Page {page} of {pages}
                  <button className="icon-btn sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                    <ChevronRight size={15} />
                  </button>
                </span>
              )}
              <span>Double-click a cell to edit · Enter to edit · Arrows to move</span>
            </div>
          </>
        )}
      </section>

      <NewCollectionDialog open={newOpen} onClose={() => setNewOpen(false)} />
      {col && (
        <>
          <FieldEditor open={!!fieldEdit} onClose={() => setFieldEdit(null)} field={fieldEdit?.field ?? null} collection={col} collections={collections} onSave={saveField} />
          <AccessDialog open={accessOpen} onClose={() => setAccessOpen(false)} collection={col} onSave={async (access: CollectionAccess) => void (await patchCollection({ access }))} />
          <StockRuleDialog open={stockOpen} onClose={() => setStockOpen(false)} collection={col} onSave={async (stock) => void (await patchCollection({ stock }))} />
          <RecordForm
            open={!!recordEdit}
            onClose={() => setRecordEdit(null)}
            collection={col}
            collections={collections}
            record={recordEdit?.record ?? null}
            onSaved={() => {
              void load();
              bumpData();
            }}
          />
          <ImportDialog
            open={importOpen}
            onClose={() => setImportOpen(false)}
            collection={col}
            onDone={(updated) => {
              if (updated) setCollections(ed().collections.map((c) => (c.id === updated.id ? updated : c)));
              void load();
              bumpData();
            }}
          />
        </>
      )}
    </div>
  );
}

/** After a field rename, rewrite {{record.Old}} bindings and form field names in every page. */
function renameFieldBindings(oldName: string, newName: string) {
  const s = ed();
  const esc = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(\\{\\{\\s*(?:record|item)\\.)${esc}(\\s*(?:\\||\\}\\}))`, "gi");
  const text = JSON.stringify(s.doc);
  const next = text.replace(re, (_m, a: string, b: string) => `${a}${JSON.stringify(newName).slice(1, -1)}${b}`);
  if (next !== text) {
    useEditor.setState({ doc: JSON.parse(next), saveState: "dirty" });
    toast("Updated your pages to use the new field name.");
  }
}
