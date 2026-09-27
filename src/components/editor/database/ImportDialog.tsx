"use client";

import { useRef, useState } from "react";
import { CircleAlert, CircleCheck, FileUp } from "lucide-react";
import type { Collection } from "@/lib/shared/types";
import { parseCsv } from "@/lib/shared/util";
import { api, errorMessage } from "@/lib/client/api";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";
import { ed } from "../store";

/** Bring rows in from a spreadsheet (CSV). Columns are matched to fields by name. */
export function ImportDialog({ open, onClose, collection, onDone }: { open: boolean; onClose: () => void; collection: Collection; onDone: (updated?: Collection) => void }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [createMissing, setCreateMissing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; errors: { row: number; error: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = rows?.[0]?.map((h) => h.trim()) || [];
  const body = rows?.slice(1) || [];
  const matched = headers.map((h) => collection.fields.find((f) => f.name.toLowerCase() === h.toLowerCase()));

  const reset = () => {
    setRows(null);
    setResult(null);
    setFileName("");
  };

  const doImport = async () => {
    setBusy(true);
    try {
      let col = collection;
      const missing = headers.filter((h, i) => h && !matched[i] && !/^(id|createdat|updatedat|createdby)$/i.test(h));
      if (createMissing && missing.length) {
        const res = await api<{ collection: Collection }>(`/api/apps/${ed().app.id}/collections/${collection.id}`, {
          method: "PATCH",
          body: { fields: [...collection.fields, ...missing.map((name) => ({ name: name.replace(/[{}.|]/g, "").slice(0, 40), type: "text" }))] },
        });
        col = res.collection;
      }
      const payload = body.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
      const res = await api<{ added: number; errors: { row: number; error: string }[] }>(`/api/apps/${ed().app.id}/collections/${collection.id}/import`, { body: { rows: payload } });
      setResult(res);
      onDone(col !== collection ? col : undefined);
      if (res.added) toast.success(`Imported ${res.added} row${res.added === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      size="wide"
      title={`Import rows into ${collection.name}`}
      description="Use a CSV file (in Excel or Google Sheets: File → Download → CSV). The first row should hold the column names."
      footer={
        result ? (
          <button
            className="btn primary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Done
          </button>
        ) : (
          <>
            <button className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!rows || !body.length || busy} onClick={doImport}>
              {busy ? "Importing…" : `Import ${body.length} row${body.length === 1 ? "" : "s"}`}
            </button>
          </>
        )
      }
    >
      {!rows ? (
        <button className="upload-drop" onClick={() => fileRef.current?.click()}>
          <FileUp size={22} />
          Choose a CSV file
          <span className="mini-note">Up to 10,000 rows</span>
        </button>
      ) : result ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="alert info">
            <CircleCheck size={17} /> Added {result.added} row{result.added === 1 ? "" : "s"}.
          </div>
          {result.errors.length > 0 && (
            <div className="alert">
              <CircleAlert size={17} />
              <div>
                {result.errors.length} row{result.errors.length === 1 ? "" : "s"} couldn&apos;t be imported:
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {result.errors.slice(0, 8).map((e) => (
                    <li key={e.row}>
                      Row {e.row + 1}: {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div className="mini-note">
            <strong>{fileName}</strong> · {body.length} rows · {headers.length} columns
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {headers.map((h, i) => (
              <div key={i} className="insp-row" style={{ gap: 8 }}>
                {matched[i] ? <CircleCheck size={15} color="var(--success)" /> : <CircleAlert size={15} color="var(--warning)" />}
                <span style={{ fontWeight: 600 }}>{h || "(no name)"}</span>
                <span className="mini-note">{matched[i] ? `→ ${matched[i]!.name}` : createMissing ? "→ new text field" : "→ skipped"}</span>
              </div>
            ))}
          </div>
          {matched.some((m) => !m) && (
            <label className="checkbox-row">
              <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
              Create new fields for columns that don&apos;t match
            </label>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 10 * 1024 * 1024) {
            toast.error("That file is bigger than 10 MB.");
            return;
          }
          const parsed = parseCsv(await f.text());
          if (parsed.length < 2) {
            toast.error("That file has no rows under the header.");
            return;
          }
          setFileName(f.name);
          setRows(parsed.slice(0, 10001));
        }}
      />
    </Modal>
  );
}
