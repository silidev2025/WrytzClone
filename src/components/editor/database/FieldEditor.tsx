"use client";

import { useEffect, useState } from "react";
import type { Collection, Field, FieldType } from "@/lib/shared/types";
import { FIELD_TYPES, FIELD_TYPE_MAP, fieldNameError } from "@/lib/shared/fields";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";

const CURRENCIES = ["USD", "EUR", "GBP", "PHP", "JPY", "INR", "AUD", "CAD", "SGD", "BRL", "MXN", "ZAR", "NGN", "KRW", "CNY"];

export function FieldEditor({
  open,
  onClose,
  onSave,
  field,
  collection,
  collections,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: Partial<Field>) => void | Promise<void>;
  field: Field | null;
  collection: Collection;
  collections: Collection[];
}) {
  const [draft, setDraft] = useState<Partial<Field>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(field ? { ...field } : { name: "", type: "text" });
    setError(null);
  }, [open, field]);

  const set = (patch: Partial<Field>) => setDraft((d) => ({ ...d, ...patch }));
  const type = (draft.type || "text") as FieldType;
  const typeChanged = !!field && field.type !== type;

  const save = async () => {
    const others = collection.fields.filter((f) => f.id !== field?.id).map((f) => f.name);
    const err = fieldNameError(draft.name || "", others);
    if (err) {
      setError(err);
      return;
    }
    if (type === "reference" && !draft.refCollectionId) {
      setError("Choose which collection this links to.");
      return;
    }
    setBusy(true);
    try {
      await onSave({ ...draft, name: draft.name!.trim() });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      title={field ? `Edit “${field.name}”` : "Add a field"}
      description="A field is a column in your collection. Pick the kind of information it holds."
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {field ? "Save field" : "Add field"}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="f-name">Name</label>
        <input
          id="f-name"
          className={`input ${error ? "invalid" : ""}`}
          autoFocus
          value={draft.name || ""}
          placeholder="e.g. Email, Price, Due date"
          onChange={(e) => {
            set({ name: e.target.value });
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && void save()}
        />
        {error && <div className="field-error">{error}</div>}
      </div>
      <div className="field">
        <span className="field-label">Type</span>
        <div className="field-type-grid">
          {FIELD_TYPES.map((t) => (
            <button key={t.type} aria-pressed={type === t.type} onClick={() => set({ type: t.type })} title={t.hint}>
              <span className="field-type-chip">
                <Icon name={t.icon} size={13} />
              </span>
              <span style={{ display: "grid" }}>
                {t.label}
                <small className="mini-note" style={{ fontWeight: 500 }}>
                  {t.hint}
                </small>
              </span>
            </button>
          ))}
        </div>
        {typeChanged && <div className="alert info">Changing the type converts existing values. Values that don&apos;t fit the new type are cleared.</div>}
      </div>

      {(type === "select" || type === "multiSelect") && (
        <div className="field">
          <label htmlFor="f-opts">Choices (one per line)</label>
          <textarea
            id="f-opts"
            className="textarea"
            rows={5}
            value={(draft.options || []).join("\n")}
            placeholder={"Low\nMedium\nHigh"}
            onChange={(e) => set({ options: e.target.value.split("\n").map((s) => s.trimStart()) })}
          />
        </div>
      )}
      {type === "reference" && (
        <div className="field">
          <label htmlFor="f-ref">Links to</label>
          <select id="f-ref" className="select" value={draft.refCollectionId || ""} onChange={(e) => set({ refCollectionId: e.target.value })}>
            <option value="">Choose a collection…</option>
            {collections
              .filter((c) => c.id !== collection.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <span className="field-hint">For example, an Order can link to the Customer who placed it.</span>
        </div>
      )}
      {type === "currency" && (
        <div className="field">
          <label htmlFor="f-cur">Currency</label>
          <select id="f-cur" className="select" value={draft.currency || "USD"} onChange={(e) => set({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
      {(type === "number" || type === "currency") && (
        <div className="settings-row">
          <div className="field">
            <label>Smallest allowed</label>
            <input className="input" type="number" value={draft.min ?? ""} onChange={(e) => set({ min: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Largest allowed</label>
            <input className="input" type="number" value={draft.max ?? ""} onChange={(e) => set({ max: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="f-def">Default value (optional)</label>
        {type === "date" || type === "datetime" || type === "time" ? (
          <select id="f-def" className="select" value={draft.defaultValue === "now" ? "now" : ""} onChange={(e) => set({ defaultValue: e.target.value || undefined })}>
            <option value="">Empty</option>
            <option value="now">{type === "time" ? "The current time" : "Today / now"}</option>
          </select>
        ) : type === "boolean" ? (
          <select id="f-def" className="select" value={draft.defaultValue === "true" ? "true" : ""} onChange={(e) => set({ defaultValue: e.target.value || undefined })}>
            <option value="">No</option>
            <option value="true">Yes</option>
          </select>
        ) : (
          <input id="f-def" className="input" value={draft.defaultValue || ""} placeholder="Used when a new record leaves this empty" onChange={(e) => set({ defaultValue: e.target.value || undefined })} />
        )}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <label className="checkbox-row">
          <input type="checkbox" checked={!!draft.required} onChange={(e) => set({ required: e.target.checked || undefined })} />
          <span>
            <strong>Required</strong> — a record can&apos;t be saved without it
          </span>
        </label>
        {!["boolean", "multiSelect", "image", "file", "longText"].includes(type) && (
          <label className="checkbox-row">
            <input type="checkbox" checked={!!draft.unique} onChange={(e) => set({ unique: e.target.checked || undefined })} />
            <span>
              <strong>Unique</strong> — no two records can have the same value (great for emails)
            </span>
          </label>
        )}
        <label className="checkbox-row">
          <input type="checkbox" checked={!!draft.private} onChange={(e) => set({ private: e.target.checked || undefined })} />
          <span>
            <strong>Private</strong> — visitors never see it, unless they added the record or are an admin
          </span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={!!draft.locked} onChange={(e) => set({ locked: e.target.checked || undefined })} />
          <span>
            <strong>Admins only</strong> — visitors can&apos;t fill in or change it (status, prices, scores); new records get the default
          </span>
        </label>
        {(type === "number" || type === "rating") && (
          <label className="checkbox-row">
            <input type="checkbox" checked={!!draft.counter} onChange={(e) => set({ counter: e.target.checked || undefined })} />
            <span>
              <strong>Counter</strong> — visitors may add or take away 1 (votes, likes), if the collection&apos;s +/− access allows it
            </span>
          </label>
        )}
      </div>
      <span className="mini-note">
        Bindings use the name: {"{{record."}
        {draft.name || "Field"}
        {"}}"} · {FIELD_TYPE_MAP[type].label}
      </span>
    </Modal>
  );
}
