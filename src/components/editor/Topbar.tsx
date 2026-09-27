"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  Cloud,
  Database,
  Eye,
  FileText,
  History,
  Home,
  Keyboard,
  Loader,
  Minus,
  Monitor,
  PenTool,
  Plus,
  Redo2,
  Rocket,
  Smartphone,
  Undo2,
  UserPlus,
  WifiOff,
} from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { relativeTime } from "@/lib/shared/util";
import { Dropdown, type MenuEntry } from "@/components/ui/Popover";
import { toast } from "@/components/ui/toast";
import { addPage, ed, getPage, redo, setPage, undo, useEditor, type Peer } from "./store";
import { saveNow } from "./saving";

function SaveStatus() {
  const state = useEditor((s) => s.saveState);
  const error = useEditor((s) => s.saveError);
  const last = useEditor((s) => s.lastSavedAt);
  const live = useEditor((s) => s.live);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  if (live === "offline" && state !== "error")
    return (
      <span className="save-status error" title="Your changes are kept on this screen and saved as soon as the connection is back.">
        <WifiOff size={14} /> Reconnecting…
      </span>
    );
  if (state === "saving")
    return (
      <span className="save-status">
        <Loader size={14} className="spin" /> Saving…
      </span>
    );
  if (state === "dirty")
    return (
      <span className="save-status">
        <Cloud size={14} /> Unsaved
      </span>
    );
  if (state === "error")
    return (
      <button className="save-status error" onClick={() => void saveNow()} title={error || undefined}>
        <CircleAlert size={14} /> Retry save
      </button>
    );
  if (state === "conflict") return null;
  return (
    <span className="save-status ok" title={last ? `Saved ${relativeTime(last)}` : "All changes saved"}>
      <Check size={14} /> Saved
    </span>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

/** Jump to where a collaborator is working. */
function follow(p: Peer) {
  if (p.view === "database") return useEditor.setState({ view: "database" });
  useEditor.setState({ view: "design", bp: ed().doc.settings.kind === "mobile" ? "desktop" : p.bp });
  if (p.pageId && ed().doc.pages.some((x) => x.id === p.pageId)) setPage(p.pageId);
}

/** Everyone else editing right now (one avatar per person), like in Google Docs. */
function Collaborators() {
  const peers = useEditor((s) => s.peers);
  const me = useEditor((s) => s.user.id);
  const pages = useEditor((s) => s.doc.pages);
  const people = new Map<string, Peer>();
  for (const p of Object.values(peers)) {
    if (p.userId === me) continue;
    const seen = people.get(p.userId);
    if (!seen || p.at > seen.at) people.set(p.userId, p);
  }
  const list = [...people.values()];
  if (!list.length) return null;
  return (
    <div className="peer-stack" role="group" aria-label="People editing now">
      {list.slice(0, 4).map((p) => {
        const page = pages.find((x) => x.id === p.pageId)?.name;
        const where = p.view === "database" ? "in the database" : page ? `on ${page}` : "";
        return (
          <button key={p.userId} className="peer-avatar" style={{ background: p.color }} title={`${p.name}${where ? ` — ${where}` : ""}. Click to go there.`} aria-label={`${p.name}${where ? `, ${where}` : ""}. Go there.`} onClick={() => follow(p)}>
            {initials(p.name)}
          </button>
        );
      })}
      {list.length > 4 && <span className="peer-more">+{list.length - 4}</span>}
    </div>
  );
}

function AppName() {
  const app = useEditor((s) => s.app);
  const [value, setValue] = useState(app.name);
  const cancelled = useRef(false);
  useEffect(() => setValue(app.name), [app.name]);
  const commit = async () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const name = value.trim();
    if (!name || name === app.name) {
      setValue(app.name);
      return;
    }
    try {
      const res = await api<{ app: typeof app }>(`/api/apps/${app.id}`, { method: "PATCH", body: { name } });
      useEditor.setState({ app: res.app });
    } catch (err) {
      toast.error(errorMessage(err));
      setValue(app.name);
    }
  };
  return (
    <input
      className="app-name-input"
      value={value}
      maxLength={60}
      aria-label="App name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          setValue(app.name);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function Topbar({ onPreview, onPublish, onVersions, onShortcuts, onShare }: { onPreview: () => void; onPublish: () => void; onVersions: () => void; onShortcuts: () => void; onShare: () => void }) {
  const app = useEditor((s) => s.app);
  const pages = useEditor((s) => s.doc.pages);
  const homeId = useEditor((s) => s.doc.homePageId);
  const pageName = useEditor((s) => getPage(s).name);
  const pageId = useEditor((s) => s.pageId);
  const view = useEditor((s) => s.view);
  const bp = useEditor((s) => s.bp);
  const phoneApp = useEditor((s) => s.doc.settings.kind === "mobile");
  const zoom = useEditor((s) => s.zoom);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const revision = useEditor((s) => s.revision);
  const published = app.published;
  const outdated = !!published && published.revision !== revision;

  const pageItems: MenuEntry[] = [
    { heading: "Pages" },
    ...pages.map((p) => ({
      label: p.name,
      icon: p.id === homeId ? <Home size={15} /> : <FileText size={15} />,
      checked: p.id === pageId,
      onClick: () => setPage(p.id),
    })),
    "sep",
    { label: "Add a page", icon: <Plus size={15} />, onClick: () => addPage() },
    { label: "Manage pages…", icon: <FileText size={15} />, onClick: () => useEditor.setState({ leftTab: "pages", view: "design" }) },
  ];

  return (
    <header className="ed-topbar">
      <div className="ed-top-left">
        <Link href="/apps" className="icon-btn" aria-label="Back to my apps" title="Back to my apps">
          <ArrowLeft size={18} />
        </Link>
        <span className="app-icon sm" style={{ background: `${app.color}24` }}>
          {app.emoji}
        </span>
        <AppName />
        <span className="top-sep" />
        <Dropdown
          placement="bottom-start"
          width={250}
          trigger={
            <button className="btn ghost sm page-switch" title="Switch page">
              <FileText size={15} /> <span className="page-switch-name">{pageName}</span> <ChevronDown size={14} />
            </button>
          }
          items={pageItems}
        />
      </div>

      <div className="ed-top-center">
        <div className="segmented" role="group" aria-label="Editor mode">
          <button aria-pressed={view === "design"} onClick={() => useEditor.setState({ view: "design" })}>
            <PenTool size={14} /> Design
          </button>
          <button aria-pressed={view === "database"} onClick={() => useEditor.setState({ view: "database", selection: [], editingTextId: null })}>
            <Database size={14} /> Database
          </button>
        </div>
        {view === "design" && (
          <>
            <span className="top-sep" />
            {phoneApp ? (
              <span className="device-chip" title="A mobile app has one phone-sized screen. On computers it shows in a phone-width column.">
                <Smartphone size={14} /> Phone app
              </span>
            ) : (
              <div className="segmented" role="group" aria-label="Device">
                <button aria-pressed={bp === "desktop"} onClick={() => useEditor.setState({ bp: "desktop", selection: [], editingTextId: null })} title="Desktop layout">
                  <Monitor size={15} />
                </button>
                <button aria-pressed={bp === "mobile"} onClick={() => useEditor.setState({ bp: "mobile", selection: [], editingTextId: null })} title="Phone layout">
                  <Smartphone size={15} />
                </button>
              </div>
            )}
            <div className="zoom-ctl">
              <button className="icon-btn sm" onClick={() => window.dispatchEvent(new CustomEvent("cb:zoom", { detail: zoom / 1.25 }))} aria-label="Zoom out">
                <Minus size={14} />
              </button>
              <Dropdown
                placement="bottom-end"
                trigger={<button className="zoom-value">{Math.round(zoom * 100)}%</button>}
                items={[
                  { label: "Zoom to fit", shortcut: "Shift+1", onClick: () => window.dispatchEvent(new Event("cb:fit")) },
                  { label: "50%", onClick: () => window.dispatchEvent(new CustomEvent("cb:zoom", { detail: 0.5 })) },
                  { label: "100%", shortcut: "Ctrl+0", onClick: () => window.dispatchEvent(new CustomEvent("cb:zoom", { detail: 1 })) },
                  { label: "150%", onClick: () => window.dispatchEvent(new CustomEvent("cb:zoom", { detail: 1.5 })) },
                  { label: "200%", onClick: () => window.dispatchEvent(new CustomEvent("cb:zoom", { detail: 2 })) },
                ]}
              />
              <button className="icon-btn sm" onClick={() => window.dispatchEvent(new CustomEvent("cb:zoom", { detail: zoom * 1.25 }))} aria-label="Zoom in">
                <Plus size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="ed-top-right">
        {view === "design" && (
          <>
            <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
              <Undo2 size={17} />
            </button>
            <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
              <Redo2 size={17} />
            </button>
          </>
        )}
        <SaveStatus />
        <Collaborators />
        <button className="btn sm share-btn" onClick={onShare} title="Share: invite people to edit with you">
          <UserPlus size={15} /> <span className="hide-narrow">Share</span>
        </button>
        <button className="icon-btn hide-narrow" onClick={onShortcuts} title="Keyboard shortcuts" aria-label="Keyboard shortcuts">
          <Keyboard size={17} />
        </button>
        <button className="icon-btn" onClick={onVersions} title="Version history" aria-label="Version history">
          <History size={17} />
        </button>
        <button className="btn sm" onClick={onPreview}>
          <Eye size={15} /> <span className="hide-phone">Preview</span>
        </button>
        <button className="btn gradient sm" onClick={onPublish}>
          <Rocket size={15} /> {published ? (outdated ? "Publish update" : "Published") : "Publish"}
        </button>
      </div>
    </header>
  );
}

export function currentPageLabel() {
  return getPage(ed()).name;
}
