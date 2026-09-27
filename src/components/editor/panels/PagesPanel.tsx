"use client";

import { ArrowDown, ArrowUp, Copy, Database, FileText, Home, Lock, MoreHorizontal, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { Dropdown } from "@/components/ui/Popover";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { pagePathFor } from "@/lib/shared/doc";
import { addPage, deletePage, ed, movePage, setHomePage, setPage, updatePage, useEditor } from "../store";

export function PagesPanel() {
  const pages = useEditor((s) => s.doc.pages);
  const homeId = useEditor((s) => s.doc.homePageId);
  const pageId = useEditor((s) => s.pageId);
  const collections = useEditor((s) => s.collections);

  const rename = async (id: string, current: string) => {
    const name = await promptDialog({ title: "Rename page", label: "Page name", defaultValue: current, confirmLabel: "Rename" });
    if (!name) return;
    updatePage(id, (p, d) => {
      p.name = name.slice(0, 60);
      if (p.id !== d.homePageId) p.path = pagePathFor(name, ed().doc.pages, p.id);
    });
  };

  return (
    <>
      <div className="panel-head">
        <h2>Pages</h2>
        <Dropdown
          placement="bottom-end"
          width={260}
          trigger={
            <button className="btn sm primary">
              <Plus size={14} /> Page
            </button>
          }
          items={[
            { label: "Blank page", icon: <FileText size={15} />, onClick: () => addPage("New page") },
            { label: "Copy of this page", icon: <Copy size={15} />, onClick: () => addPage("", { duplicateOf: ed().pageId }) },
            ...(collections.length
              ? [
                  "sep" as const,
                  { heading: "Detail page for one record" },
                  ...collections.map((c) => ({
                    label: `One ${c.name.replace(/s$/, "")}`,
                    icon: <Database size={15} />,
                    onClick: () => {
                      const id = addPage(`${c.name.replace(/s$/, "")} details`);
                      if (id) updatePage(id, (p) => void (p.recordCollectionId = c.id));
                    },
                  })),
                ]
              : []),
          ]}
        />
      </div>
      <div className="panel-scroll">
        <p className="panel-hint" style={{ marginBottom: 8 }}>
          Click a page to edit it. Set who can open a page in its settings (click the empty canvas).
        </p>
        {pages.map((p, i) => (
          <div key={p.id} className={`page-row ${p.id === pageId ? "active" : ""}`} onClick={() => setPage(p.id)}>
            {p.id === homeId ? <Home size={15} color="var(--brand)" /> : p.recordCollectionId ? <Database size={15} /> : <FileText size={15} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="p-name">{p.name}</div>
              <div className="p-path">/{p.path}</div>
            </div>
            {p.access === "users" && (
              <span title="Signed-in visitors only">
                <Lock size={13} />
              </span>
            )}
            {p.access === "admins" && (
              <span title="Admins only">
                <Shield size={13} />
              </span>
            )}
            <span onClick={(e) => e.stopPropagation()}>
              <Dropdown
                trigger={
                  <button className="icon-btn sm" aria-label={`Options for ${p.name}`}>
                    <MoreHorizontal size={15} />
                  </button>
                }
                items={[
                  { label: "Rename", icon: <Pencil size={15} />, onClick: () => rename(p.id, p.name) },
                  { label: "Duplicate", icon: <Copy size={15} />, onClick: () => addPage("", { duplicateOf: p.id }) },
                  { label: "Make home page", icon: <Home size={15} />, onClick: () => setHomePage(p.id), disabled: p.id === homeId },
                  { label: "Move up", icon: <ArrowUp size={15} />, onClick: () => movePage(p.id, -1), disabled: i === 0 },
                  { label: "Move down", icon: <ArrowDown size={15} />, onClick: () => movePage(p.id, 1), disabled: i === pages.length - 1 },
                  "sep",
                  {
                    label: "Delete page",
                    icon: <Trash2 size={15} />,
                    danger: true,
                    disabled: pages.length <= 1,
                    onClick: async () => {
                      if (await confirmDialog({ title: `Delete “${p.name}”?`, message: "Everything on this page will be removed. You can undo right after.", confirmLabel: "Delete page", danger: true })) deletePage(p.id);
                    },
                  },
                ]}
              />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
