"use client";

import { ArrowRight, Database, Plus } from "lucide-react";
import { FIELD_TYPE_MAP } from "@/lib/shared/fields";
import { Icon } from "@/components/ui/Icon";
import { useEditor } from "../store";
import { VariablesEditor } from "../inspector/PageSettings";

export function DataPanel() {
  const collections = useEditor((s) => s.collections);
  const open = (id?: string) => useEditor.setState({ view: "database", selection: [], dbCollectionId: id ?? useEditor.getState().dbCollectionId });
  return (
    <>
      <div className="panel-head">
        <h2>Data</h2>
        <button className="btn sm primary" onClick={() => open()}>
          <Database size={14} /> Open database
        </button>
      </div>
      <div className="panel-scroll">
        <p className="panel-hint">Collections are your app&apos;s tables. Connect them to lists, tables, forms and charts from each element&apos;s Data tab.</p>
        <div className="panel-section-title">
          Collections
          <button className="icon-btn sm" onClick={() => open()} title="New collection" aria-label="New collection">
            <Plus size={14} />
          </button>
        </div>
        {!collections.length && (
          <div className="empty-state" style={{ padding: "22px 12px" }}>
            <Database size={22} color="var(--brand)" />
            <p style={{ fontSize: 12.5 }}>No collections yet. Open the database to create one — like Tasks, Orders or Sign-ups.</p>
          </div>
        )}
        {collections.map((c) => (
          <button key={c.id} className="page-row collection-row" onClick={() => open(c.id)}>
            <span style={{ fontSize: 18 }}>{c.icon || "🗂️"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="p-name">{c.name}</div>
              <div style={{ display: "flex", gap: 3, marginTop: 3, flexWrap: "wrap" }}>
                {c.fields.slice(0, 6).map((f) => (
                  <span key={f.id} className="field-type-chip" title={f.name}>
                    <Icon name={FIELD_TYPE_MAP[f.type].icon} size={11} />
                  </span>
                ))}
              </div>
            </div>
            <ArrowRight size={14} />
          </button>
        ))}
        <div className="panel-section-title">Variables</div>
        <VariablesEditor />
      </div>
    </>
  );
}
