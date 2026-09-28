"use client";

import { useEffect, useState } from "react";
import type { Collection, RecordDoc } from "@/lib/shared/types";
import { FIELD_TYPE_MAP, defaultFieldValue } from "@/lib/shared/fields";
import { relativeTime } from "@/lib/shared/util";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";
import { ed } from "../store";
import { FieldValueInput } from "./FieldInputs";

export function RecordForm({
  open,
  onClose,
  collection,
  collections,
  record,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  collection: Collection;
  collections: Collection[];
  record: RecordDoc | null;
  onSaved: (r: RecordDoc) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const v: Record<string, unknown> = {};
    for (const f of collection.fields) v[f.id] = record ? (record.data[f.id] ?? null) : defaultFieldValue(f);
    setValues(v);
    setErrors({});
  }, [open, record, collection]);

  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      const base = `/api/apps/${ed().app.id}/collections/${collection.id}/records`;
      const res = record
        ? await api<{ record: RecordDoc }>(`${base}/${record.id}`, { method: "PATCH", body: { values } })
        : await api<{ record: RecordDoc }>(base, { body: { values } });
      onSaved(res.record);
      toast.success(record ? "Record saved" : "Record added");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.details?.fields) setErrors(err.details.fields);
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      title={record ? `Edit ${collection.name.replace(/s$/, "")}` : `New ${collection.name.replace(/s$/, "")}`}
      description={record ? `Added ${relativeTime(record.createdAt)} · last changed ${relativeTime(record.updatedAt)}` : "Fill in what you know — you can change it later."}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : record ? "Save changes" : "Add record"}
          </button>
        </>
      }
    >
      <form
        style={{ display: "grid", gap: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {collection.fields.map((f, i) => (
          <div key={f.id} className="field">
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="field-type-chip">
                <Icon name={FIELD_TYPE_MAP[f.type].icon} size={12} />
              </span>
              {f.name}
              {f.required && <span style={{ color: "var(--danger)" }}>*</span>}
              {f.private && <span className="badge">private</span>}
            </label>
            <FieldValueInput field={f} value={values[f.id]} collections={collections} autoFocus={i === 0} onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))} />
            {errors[f.name] && <div className="field-error">{errors[f.name]}</div>}
          </div>
        ))}
        {!collection.fields.length && <p className="muted">This collection has no fields yet. Add one first.</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
