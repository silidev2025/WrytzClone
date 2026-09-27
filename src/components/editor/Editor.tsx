"use client";

import { useEffect, useRef, useState } from "react";
import { initEditor, useEditor, type EditorInit } from "./store";
import { useAutosave } from "./saving";
import { startLive } from "./live";
import { useShortcuts } from "./shortcuts";
import { Topbar } from "./Topbar";
import { LeftPanel, LeftRail } from "./LeftRail";
import { Canvas } from "./canvas/Canvas";
import { Inspector } from "./inspector/Inspector";
import { DatabaseView } from "./database/DatabaseView";
import { PublishDialog } from "./dialogs/PublishDialog";
import { PreviewDialog, ShortcutsDialog, VersionsDialog } from "./dialogs/OtherDialogs";
import { ShareDialog } from "./dialogs/ShareDialog";

export function Editor({ initial }: { initial: EditorInit }) {
  // set up the store before anything below reads from it
  const started = useRef(false);
  if (!started.current) {
    initEditor(initial);
    started.current = true;
  }
  useAutosave();
  useShortcuts();
  useEffect(() => startLive(), []);
  const view = useEditor((s) => s.view);
  useEffect(() => {
    if (window.matchMedia("(max-width: 860px)").matches) useEditor.setState({ leftTab: null });
  }, []);
  const [dialog, setDialog] = useState<"publish" | "preview" | "versions" | "shortcuts" | "share" | null>(null);

  return (
    <div className="editor">
      <Topbar onPreview={() => setDialog("preview")} onPublish={() => setDialog("publish")} onVersions={() => setDialog("versions")} onShortcuts={() => setDialog("shortcuts")} onShare={() => setDialog("share")} />
      <div className="ed-body">
        {view === "design" ? (
          <>
            <LeftRail />
            <LeftPanel />
            <Canvas />
            <Inspector />
          </>
        ) : (
          <DatabaseView />
        )}
      </div>
      <PublishDialog open={dialog === "publish"} onClose={() => setDialog(null)} />
      <PreviewDialog open={dialog === "preview"} onClose={() => setDialog(null)} />
      <VersionsDialog open={dialog === "versions"} onClose={() => setDialog(null)} />
      <ShortcutsDialog open={dialog === "shortcuts"} onClose={() => setDialog(null)} />
      <ShareDialog open={dialog === "share"} onClose={() => setDialog(null)} />
    </div>
  );
}
