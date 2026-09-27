"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { initEditor, useEditor, type EditorInit } from "./store";
import { useAutosave, saveNow } from "./saving";
import { useShortcuts } from "./shortcuts";
import { Topbar } from "./Topbar";
import { LeftPanel, LeftRail } from "./LeftRail";
import { Canvas } from "./canvas/Canvas";
import { Inspector } from "./inspector/Inspector";
import { DatabaseView } from "./database/DatabaseView";
import { PublishDialog } from "./dialogs/PublishDialog";
import { PreviewDialog, ShortcutsDialog, VersionsDialog } from "./dialogs/OtherDialogs";

function ConflictDialog() {
  const conflict = useEditor((s) => s.saveState === "conflict");
  return (
    <Modal
      open={conflict}
      onClose={() => undefined}
      closeOnBackdrop={false}
      title="This app changed somewhere else"
      description="It looks like you edited this app in another tab or window. Which version do you want to keep?"
      footer={
        <>
          <button className="btn" onClick={() => window.location.reload()}>
            Load the newer version
          </button>
          <button className="btn primary" onClick={() => void saveNow(true)}>
            Keep what&apos;s on this screen
          </button>
        </>
      }
    >
      <p className="muted">Loading the newer version discards the changes on this screen. Keeping this screen overwrites the other one.</p>
    </Modal>
  );
}

export function Editor({ initial }: { initial: EditorInit }) {
  // set up the store before anything below reads from it
  const started = useRef(false);
  if (!started.current) {
    initEditor(initial);
    started.current = true;
  }
  useAutosave();
  useShortcuts();
  const view = useEditor((s) => s.view);
  useEffect(() => {
    if (window.matchMedia("(max-width: 860px)").matches) useEditor.setState({ leftTab: null });
  }, []);
  const [dialog, setDialog] = useState<"publish" | "preview" | "versions" | "shortcuts" | null>(null);

  return (
    <div className="editor">
      <Topbar onPreview={() => setDialog("preview")} onPublish={() => setDialog("publish")} onVersions={() => setDialog("versions")} onShortcuts={() => setDialog("shortcuts")} />
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
      <ConflictDialog />
    </div>
  );
}
