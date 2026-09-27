"use client";

import { useEffect } from "react";
import { syncNow } from "./live";
import { ed } from "./store";

/**
 * Saving is continuous: every change streams to the server a moment after you make it (see
 * live.ts), which is also how collaborators see it. saveNow() waits until everything is saved.
 */
export async function saveNow(): Promise<boolean> {
  return syncNow();
}

/** Warn before leaving with changes the server doesn't have yet. */
export function useAutosave() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const st = ed().saveState;
      if (st === "dirty" || st === "saving" || st === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
}
