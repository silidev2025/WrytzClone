"use client";

import dynamic from "next/dynamic";
import type { EditorInit } from "./store";

// The editor is a fully interactive canvas: render it in the browser only.
const Editor = dynamic(() => import("./Editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="editor-loading">
      <span className="spinner" style={{ width: 26, height: 26 }} />
    </div>
  ),
});

export function EditorClient({ initial }: { initial: EditorInit }) {
  return <Editor initial={initial} />;
}
