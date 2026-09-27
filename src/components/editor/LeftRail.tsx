"use client";

import { Database, FileText, Image, Layers, LayoutTemplate, Palette, Plus, SlidersHorizontal, Type, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEditor, type LeftTab } from "./store";
import { AddPanel } from "./panels/AddPanel";
import { TextPanel } from "./panels/TextPanel";
import { BlocksPanel } from "./panels/BlocksPanel";
import { MediaPanel } from "./panels/MediaPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { PagesPanel } from "./panels/PagesPanel";
import { ThemePanel } from "./panels/ThemePanel";
import { DataPanel } from "./panels/DataPanel";

const TABS: { id: LeftTab; label: string; icon: ReactNode }[] = [
  { id: "add", label: "Add", icon: <Plus size={20} /> },
  { id: "text", label: "Text", icon: <Type size={19} /> },
  { id: "blocks", label: "Blocks", icon: <LayoutTemplate size={19} /> },
  { id: "media", label: "Media", icon: <Image size={19} /> },
  { id: "layers", label: "Layers", icon: <Layers size={19} /> },
  { id: "pages", label: "Pages", icon: <FileText size={19} /> },
  { id: "theme", label: "Theme", icon: <Palette size={19} /> },
  { id: "data", label: "Data", icon: <Database size={19} /> },
];

export function LeftRail() {
  const tab = useEditor((s) => s.leftTab);
  const inspectorOpen = useEditor((s) => s.inspectorOpen);
  return (
    <nav className="ed-rail" aria-label="Editor panels">
      {TABS.map((t) => (
        <button key={t.id} className="rail-btn" aria-pressed={tab === t.id} onClick={() => useEditor.setState({ leftTab: tab === t.id ? null : t.id, inspectorOpen: false })} title={t.label}>
          <span className="rail-ico">{t.icon}</span>
          {t.label}
        </button>
      ))}
      <button className="rail-btn ed-mobile-control" aria-pressed={inspectorOpen} aria-label="Inspector" onClick={() => useEditor.setState({ inspectorOpen: !inspectorOpen, leftTab: null })}>
        <span className="rail-ico"><SlidersHorizontal size={19} /></span>Inspect
      </button>
    </nav>
  );
}

export function LeftPanel() {
  const tab = useEditor((s) => s.leftTab);
  if (!tab) return null;
  return (
    <aside className="ed-left" aria-label={`${tab} panel`}>
      <button className="btn ghost sm ed-mobile-control ed-panel-close" onClick={() => useEditor.setState({ leftTab: null })}><X size={16} /> Close panel</button>
      {tab === "add" && <AddPanel />}
      {tab === "text" && <TextPanel />}
      {tab === "blocks" && <BlocksPanel />}
      {tab === "media" && <MediaPanel />}
      {tab === "layers" && <LayersPanel />}
      {tab === "pages" && <PagesPanel />}
      {tab === "theme" && <ThemePanel />}
      {tab === "data" && <DataPanel />}
    </aside>
  );
}
