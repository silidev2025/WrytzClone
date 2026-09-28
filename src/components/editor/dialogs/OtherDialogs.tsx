"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, History, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import type { AppDoc } from "@/lib/shared/types";
import { relativeTime } from "@/lib/shared/util";
import { api, errorMessage } from "@/lib/client/api";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm";
import { ed, useEditor } from "../store";
import { saveNow } from "../saving";
import { liveClientId, resetFromServer } from "../live";
import { DevicePreview } from "./DevicePreview";

interface VersionRow {
  id: string;
  label: string;
  createdAt: string;
}

export function VersionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [list, setList] = useState<VersionRow[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const appId = useEditor((s) => s.app.id);

  const load = useCallback(async () => {
    try {
      const { versions } = await api<{ versions: VersionRow[] }>(`/api/apps/${appId}/versions`);
      setList(versions);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [appId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const save = async () => {
    setBusy(true);
    try {
      if (ed().saveState !== "saved") await saveNow();
      await api(`/api/apps/${appId}/versions`, { body: { label } });
      setLabel("");
      await load();
      toast.success("Version saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (v: VersionRow) => {
    if (!(await confirmDialog({ title: `Restore “${v.label}”?`, message: "Your current design is replaced by this version (save a version first if you want to keep it). Your database isn't changed.", confirmLabel: "Restore" }))) return;
    try {
      if (ed().saveState !== "saved") await saveNow();
      const res = await api<{ doc: AppDoc; revision: number }>(`/api/apps/${appId}/versions/${v.id}`, { method: "POST", body: { clientId: liveClientId() } });
      resetFromServer(res.doc, res.revision);
      toast.success("Version restored");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="wide" title="Version history" description="Save milestones of your design and go back to any of them. Restoring never touches your data. Your 50 most recent versions are kept; saving more removes the oldest.">
      <form
        style={{ display: "flex", gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <input className="input" placeholder="Name this version, e.g. “Before new homepage”" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn primary" disabled={busy}>
          <Save size={15} /> Save version
        </button>
      </form>
      {list && list.length >= 50 && (
        <div className="alert">You have 50 saved versions. Saving another removes the oldest: “{list[list.length - 1].label}”. Delete ones you don&apos;t need to keep it.</div>
      )}
      {list === null ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <div className="empty-state" style={{ padding: 30 }}>
          <History size={24} color="var(--brand)" />
          <p>No saved versions yet.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {list.map((v) => (
            <div key={v.id} className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
              <History size={16} color="var(--brand)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 650 }}>{v.label}</div>
                <div className="mini-note">{new Date(v.createdAt).toLocaleString()} · {relativeTime(v.createdAt)}</div>
              </div>
              <button className="btn sm" onClick={() => void restore(v)}>
                <RotateCcw size={14} /> Restore
              </button>
              <button
                className="icon-btn sm"
                aria-label={`Delete ${v.label}`}
                onClick={async () => {
                  if (!(await confirmDialog({ title: `Delete “${v.label}”?`, confirmLabel: "Delete", danger: true }))) return;
                  await api(`/api/apps/${appId}/versions/${v.id}`, { method: "DELETE" }).catch((err) => toast.error(errorMessage(err)));
                  await load();
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}


export function PreviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const appId = useEditor((s) => s.app.id);
  const phoneApp = useEditor((s) => s.doc.settings.kind === "mobile");
  const pagePath = useEditor((s) => s.doc.pages.find((p) => p.id === s.pageId)?.path || "");
  const [key, setKey] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    // make sure the preview shows the latest changes
    void (async () => {
      if (ed().saveState !== "saved") await saveNow();
      setReady(true);
      setKey((k) => k + 1);
    })();
  }, [open]);

  const src = `/preview/${appId}${pagePath ? `/${pagePath}` : ""}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      className="preview-dialog"
      title="Preview"
      description="Test your app on the device you choose. Buttons, forms and data all work (using your real database)."
      footer={
        <>
          <button className="btn" onClick={() => setKey((k) => k + 1)}>
            <RefreshCw size={15} /> Reload
          </button>
          <a className="btn primary" href={src} target="_blank" rel="noopener">
            <ExternalLink size={15} /> Open in new tab
          </a>
        </>
      }
    >
      {ready ? <DevicePreview appId={appId} src={src} reloadKey={key} phoneApp={phoneApp} /> : <span className="spinner" />}
    </Modal>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Undo / redo", "Ctrl+Z · Ctrl+Shift+Z"],
  ["Save now", "Ctrl+S"],
  ["Copy · cut · paste", "Ctrl+C · Ctrl+X · Ctrl+V"],
  ["Duplicate", "Ctrl+D"],
  ["Delete", "Delete / Backspace"],
  ["Select all", "Ctrl+A"],
  ["Group · ungroup", "Ctrl+G · Ctrl+Shift+G"],
  ["Bring forward · send backward", "Ctrl+] · Ctrl+["],
  ["To front · to back", "Ctrl+Shift+] · Ctrl+Shift+["],
  ["Lock · hide", "Ctrl+L · Ctrl+Shift+H"],
  ["Copy style · paste style", "Ctrl+Alt+C · Ctrl+Alt+V"],
  ["Nudge", "Arrows (Shift = 10px)"],
  ["Edit text · step inside", "Enter or double-click"],
  ["Deselect · select parent", "Esc"],
  ["Zoom", "Ctrl + wheel / pinch · Ctrl+= · Ctrl+-"],
  ["Zoom to fit · 100%", "Shift+1 · Ctrl+0"],
  ["Pan", "Space + drag · middle mouse · wheel"],
  ["Select inside groups", "Ctrl/Alt + click"],
  ["Keep proportions · from centre", "Shift · Alt while resizing"],
  ["Turn off snapping", "Alt while dragging"],
  ["Quick add", "T text · H heading · B button · R box · O circle · I image · L line · F form"],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" description="On a Mac, use ⌘ instead of Ctrl.">
      <div style={{ display: "grid", gap: 6 }}>
        {SHORTCUTS.map(([what, keys]) => (
          <div key={what} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "5px 0", borderBottom: "1px solid var(--line-2)" }}>
            <span>{what}</span>
            <span className="kbd" style={{ height: "auto", padding: "2px 6px" }}>
              {keys}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
