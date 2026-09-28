"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Collection, CollectionAccess } from "@/lib/shared/types";
import { ACCESS_LABELS, ACCESS_PRESETS } from "@/lib/shared/fields";
import { Modal } from "@/components/ui/Modal";

const ROWS: { key: keyof CollectionAccess; label: string; levels: string[] }[] = [
  { key: "read", label: "Who can see rows", levels: ["anyone", "users", "owner", "admins"] },
  { key: "create", label: "Who can add rows", levels: ["anyone", "users", "admins"] },
  { key: "update", label: "Who can edit rows", levels: ["anyone", "users", "owner", "admins"] },
  { key: "delete", label: "Who can delete rows", levels: ["anyone", "users", "owner", "admins"] },
];

export function AccessDialog({ open, onClose, collection, onSave }: { open: boolean; onClose: () => void; collection: Collection; onSave: (a: CollectionAccess) => Promise<void> }) {
  const [access, setAccess] = useState<CollectionAccess>(collection.access);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setAccess(collection.access);
  }, [open, collection.access]);
  const preset = ACCESS_PRESETS.find((p) => JSON.stringify(p.access) === JSON.stringify(access));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      icon={
        <span className="empty-icon">
          <ShieldCheck size={20} />
        </span>
      }
      title={`Who can use “${collection.name}”?`}
      description="These rules protect your data in the live app. You (the creator) and your app admins can always see and change everything."
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(access);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            Save rules
          </button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">Quick choices</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {ACCESS_PRESETS.map((p) => (
            <button key={p.id} className={`template-pick ${preset?.id === p.id ? "selected" : ""}`} style={{ padding: 12, gap: 4 }} onClick={() => setAccess({ ...p.access })}>
              <strong style={{ fontSize: 13 }}>{p.label}</strong>
              <span className="mini-note" style={{ fontWeight: 500 }}>
                {p.description}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field-label">Or set each rule</span>
        <div style={{ display: "grid", gap: 8 }}>
          {ROWS.map((r) => (
            <div key={r.key} className="access-row">
              <span style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</span>
              <select className="select" value={access[r.key]} onChange={(e) => setAccess({ ...access, [r.key]: e.target.value } as CollectionAccess)}>
                {r.levels.map((l) => (
                  <option key={l} value={l}>
                    {ACCESS_LABELS[l]}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="access-row">
            <span style={{ fontSize: 13, fontWeight: 600 }} title="Votes, likes, stock counts: numbers changed with 'Add to / subtract from a number'">
              Who can use +/− buttons
            </span>
            <select
              className="select"
              value={access.adjust ?? ""}
              onChange={(e) => {
                const next = { ...access };
                if (e.target.value) next.adjust = e.target.value as CollectionAccess["adjust"];
                else delete next.adjust;
                setAccess(next);
              }}
            >
              <option value="">Same as who can edit</option>
              {["anyone", "users", "owner", "admins"].map((l) => (
                <option key={l} value={l}>
                  {ACCESS_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="alert info">
        “Only the person who added it” means each signed-in visitor sees (or edits) just their own rows — perfect for personal lists and profiles. To hide a single column, mark that field Private.
      </div>
    </Modal>
  );
}
