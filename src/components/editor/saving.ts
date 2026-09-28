"use client";

import { useEffect } from "react";
import { saveRecovery, syncNow } from "./live";
import { ed } from "./store";
import { toast } from "@/components/ui/toast";

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
        saveRecovery();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    let leaving = false;
    const onLink = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.getAttribute("href")?.startsWith("#")) return;
      if (ed().saveState === "saved") return;
      event.preventDefault();
      event.stopPropagation();
      if (leaving) return;
      leaving = true;
      saveRecovery();
      void saveNow().then((saved) => {
        if (saved) window.location.assign(link.href);
        else toast.error("Your changes have not saved. Stay here and retry, or download your recovery copy.");
      }).finally(() => { leaving = false; });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onLink, true);
    return () => { window.removeEventListener("beforeunload", onBeforeUnload); document.removeEventListener("click", onLink, true); };
  }, []);
}
