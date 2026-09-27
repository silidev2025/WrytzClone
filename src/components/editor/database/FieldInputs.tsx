"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Upload, X } from "lucide-react";
import type { Collection, Field, RecordDoc } from "@/lib/shared/types";
import { isEmptyValue } from "@/lib/shared/fields";
import { safeImageSrc } from "@/lib/shared/util";
import { api, errorMessage } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";
import { ed } from "../store";

/** Label for a record: its first text-like field. */
export function labelFor(col: Collection | undefined, rec: RecordDoc): string {
  const pf = col?.fields.find((f) => ["text", "email", "select", "phone", "url"].includes(f.type)) || col?.fields[0];
  const v = pf ? rec.data[pf.id] : null;
  return isEmptyValue(v) ? `Record ${rec.id.slice(-5)}` : String(v);
}

const refCache = new Map<string, Promise<RecordDoc[]>>();
export function loadRefRecords(collectionId: string, fresh = false): Promise<RecordDoc[]> {
  if (fresh || !refCache.has(collectionId)) {
    refCache.set(
      collectionId,
      api<{ records: RecordDoc[] }>(`/api/apps/${ed().app.id}/collections/${collectionId}/records?pageSize=500&sort=createdAt&dir=asc`).then((r) => r.records),
    );
  }
  return refCache.get(collectionId)!;
}

export function useRefOptions(field: Field, collections: Collection[]) {
  const [opts, setOpts] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    if (field.type !== "reference" || !field.refCollectionId) return;
    const target = collections.find((c) => c.id === field.refCollectionId);
    let alive = true;
    loadRefRecords(field.refCollectionId, true)
      .then((recs) => alive && setOpts(recs.map((r) => ({ id: r.id, label: labelFor(target, r) }))))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [field, collections]);
  return opts;
}

async function uploadOne(file: File): Promise<string | null> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("appId", ed().app.id);
    const { media } = await api<{ media: { url: string } }>("/api/media", { body: fd });
    window.dispatchEvent(new Event("cb:media-changed"));
    return media.url;
  } catch (err) {
    toast.error(errorMessage(err));
    return null;
  }
}

export function FieldValueInput({ field, value, onChange, collections, autoFocus }: { field: Field; value: unknown; onChange: (v: unknown) => void; collections: Collection[]; autoFocus?: boolean }) {
  const refOpts = useRefOptions(field, collections);
  const fileRef = useRef<HTMLInputElement>(null);
  const str = value === null || value === undefined ? "" : Array.isArray(value) ? value.join(", ") : String(value);
  switch (field.type) {
    case "longText":
      return <textarea className="textarea" rows={4} value={str} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />;
    case "number":
    case "currency":
      return <input className="input" type="number" step="any" value={str} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />;
    case "boolean":
      return <button type="button" className="switch" role="switch" aria-checked={!!value} onClick={() => onChange(!value)} />;
    case "date":
      return <input className="input" type="date" value={str.slice(0, 10)} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />;
    case "datetime":
      return <input className="input" type="datetime-local" value={toLocalInput(str)} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />;
    case "time":
      return <input className="input" type="time" value={str} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select className="select" value={str} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(field.options || []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    case "multiSelect": {
      const arr = Array.isArray(value) ? (value as string[]) : str ? str.split(",").map((s) => s.trim()) : [];
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {(field.options || []).map((o) => (
            <label key={o} className="checkbox-row">
              <input type="checkbox" checked={arr.includes(o)} onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} />
              {o}
            </label>
          ))}
          {!field.options?.length && <span className="mini-note">Add choices to this field first.</span>}
        </div>
      );
    }
    case "rating": {
      const n = Math.round(Number(value) || 0);
      return (
        <div style={{ display: "flex", gap: 2 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" className="icon-btn sm" onClick={() => onChange(n === i ? 0 : i)} aria-label={`${i} stars`}>
              <Star size={18} fill={i <= n ? "#f5a524" : "none"} color={i <= n ? "#f5a524" : "var(--faint)"} />
            </button>
          ))}
        </div>
      );
    }
    case "image":
    case "file": {
      const img = field.type === "image" ? safeImageSrc(str) : null;
      return (
        <div style={{ display: "grid", gap: 6 }}>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input className="input" value={str} placeholder="https://… or upload" autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Upload size={15} />
            </button>
            {str && (
              <button type="button" className="btn ghost" onClick={() => onChange("")} aria-label="Clear">
                <X size={15} />
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept={field.type === "image" ? "image/*" : undefined}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const url = await uploadOne(f);
              if (url) onChange(url);
            }}
          />
        </div>
      );
    }
    case "reference":
      return (
        <select className="select" value={str} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {refOpts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <input
          className="input"
          type={field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "phone" ? "tel" : "text"}
          value={str}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export function toLocalInput(v: string): string {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
