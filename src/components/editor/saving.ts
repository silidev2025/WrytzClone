"use client";

import { useEffect } from "react";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { ed, useEditor } from "./store";

let timer: ReturnType<typeof setTimeout> | null = null;
let again = false;

/** Save the draft now. `force` overwrites even if another tab saved in the meantime. */
export async function saveNow(force = false): Promise<boolean> {
  const s = ed();
  if (s.saveState === "saving") {
    again = true;
    return false;
  }
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const doc = s.doc;
  useEditor.setState({ saveState: "saving" });
  try {
    const res = await api<{ revision: number; updatedAt: string }>(`/api/apps/${s.app.id}/draft`, {
      method: "PUT",
      body: { doc, baseRevision: force ? undefined : s.revision },
    });
    const changedMeanwhile = ed().doc !== doc;
    useEditor.setState({ revision: res.revision, saveState: changedMeanwhile ? "dirty" : "saved", lastSavedAt: res.updatedAt, saveError: null });
    if (changedMeanwhile || again) {
      again = false;
      schedule(400);
    }
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      useEditor.setState({ saveState: "conflict", saveError: err.message });
      return false;
    }
    useEditor.setState({ saveState: "error", saveError: errorMessage(err) });
    schedule(5000);
    return false;
  }
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const st = ed().saveState;
    if (st === "dirty" || st === "error") void saveNow();
  }, ms);
}

/** Autosave a moment after the last change, and warn before leaving with unsaved work. */
export function useAutosave() {
  useEffect(() => {
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.doc !== prev.doc && s.saveState !== "conflict") schedule(s.gesture > 0 ? 2500 : 1100);
    });
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const st = ed().saveState;
      if (st === "dirty" || st === "saving" || st === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);
}
