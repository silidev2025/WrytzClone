"use client";

import { useCallback, useContext, useMemo } from "react";
import type { Action } from "@/lib/shared/types";
import type { EvalContext } from "@/lib/shared/expressions";
import { buildContext, FormContext, RecordContext } from "./context";
import { runActions, submitForm } from "./actions";
import { runtimeApi } from "./api";
import { isStatic, useRT, useRTStore } from "./store";

export function useRuntimeApi() {
  const appId = useRT((s) => s.appId);
  const viewer = useRT((s) => s.user?.id || "anonymous");
  return useMemo(() => runtimeApi(appId, viewer), [appId, viewer]);
}

/**
 * Binding context for an element. Only subscribes to the whole runtime state when the
 * element actually uses {{bindings}}, so static elements don't re-render on every keystroke.
 */
export function useBindingContext(enabled: boolean): EvalContext | null {
  const scope = useContext(RecordContext);
  const formId = useContext(FormContext);
  const state = useRT((s) => (enabled ? s : null));
  return useMemo(() => (state ? buildContext(state, scope, formId) : null), [state, scope, formId]);
}

export function useActions() {
  const store = useRTStore();
  const api = useRuntimeApi();
  const scope = useContext(RecordContext);
  const formId = useContext(FormContext);
  const run = useCallback(
    async (actions: Action[] | undefined, sourceId?: string) => {
      if (isStatic(store.getState().mode)) return true;
      return runActions(actions, { store, api, scope, formId, sourceId });
    },
    [store, api, scope, formId],
  );
  const submit = useCallback(
    async (targetFormId?: string | null) => {
      const id = targetFormId ?? formId;
      if (!id || isStatic(store.getState().mode)) return false;
      return submitForm({ store, api, scope, formId: id }, id);
    },
    [store, api, scope, formId],
  );
  return { run, submit, formId, scope };
}
