"use client";

import type { Action, El, Page, TransactionStep } from "@/lib/shared/types";
import { evalCondition, evaluate, interpolate, truthy, type EvalContext } from "@/lib/shared/expressions";
import { descendantIds, inputsOfForm } from "@/lib/shared/doc";
import { isEmptyValue } from "@/lib/shared/fields";
import { safeUrl } from "@/lib/shared/util";
import { signInUrl } from "@/lib/shared/urls";
import { ApiError, errorMessage } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm";
import { buildContext, formValues, inputValue, isShown, type RecordScope } from "./context";
import { clearPersistedVars, currentPage, persistVar, type RTStore } from "./store";
import type { RuntimeApi } from "./api";

export interface ActionEnv {
  store: RTStore;
  api: RuntimeApi;
  scope: RecordScope | null;
  formId: string | null;
  /** the element that triggered the actions */
  sourceId?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Empty the installed app's offline copies (pages may have been shown to the person leaving). */
export async function clearOfflineCache() {
  try {
    navigator.serviceWorker?.controller?.postMessage("cb-clear-cache");
    if ("caches" in window) for (const k of await caches.keys()) if (k.startsWith("cb-app")) await caches.delete(k);
  } catch {
    /* nothing cached */
  }
}

function page(env: ActionEnv): Page {
  return currentPage(env.store.getState())!;
}

function bump(env: ActionEnv) {
  env.store.setState((s) => ({ dataVersion: s.dataVersion + 1 }));
}

function evalMapping(mapping: Record<string, string> | undefined, ctx: EvalContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(mapping || {})) if (k.trim()) out[k.trim()] = evaluate(v, ctx);
  return out;
}

/* ------------------------------------------------------------------ forms */

export function validateForm(env: ActionEnv, formId: string): boolean {
  const s = env.store.getState();
  const p = currentPage(s);
  if (!p || !p.elements[formId]) return true;
  const errors: Record<string, string> = {};
  for (const el of inputsOfForm(p, formId)) {
    if (!isShown(s, el)) continue;
    const v = inputValue(s, el, env.scope);
    const label = el.props.label || el.props.name || "This field";
    const t = el.props.inputType;
    const str = Array.isArray(v) ? v.join(",") : v === null || v === undefined ? "" : String(v);
    if (el.props.required && (isEmptyValue(v) || (t === "toggle" && !v) || (t === "rating" && !Number(v)))) {
      errors[el.id] = t === "toggle" ? "Please switch this on to continue" : `${label} is required`;
      continue;
    }
    if (!str) continue;
    if (t === "email" && !EMAIL_RE.test(str)) errors[el.id] = "Enter a valid email address";
    else if (t === "url" && !safeUrl(str)) errors[el.id] = "Enter a valid link";
    else if (t === "phone" && !/^[+()\-\s\d.]{6,}$/.test(str)) errors[el.id] = "Enter a valid phone number";
    else if (t === "number" || t === "range") {
      const n = Number(str);
      if (!Number.isFinite(n)) errors[el.id] = "Enter a number";
      else if (el.props.min !== undefined && el.props.min !== null && n < el.props.min) errors[el.id] = `Must be at least ${el.props.min}`;
      else if (el.props.max !== undefined && el.props.max !== null && n > el.props.max) errors[el.id] = `Must be at most ${el.props.max}`;
    }
  }
  const formInputIds = new Set(inputsOfForm(p, formId).map((e) => e.id));
  env.store.setState((st) => {
    const next = { ...st.inputErrors };
    for (const id of formInputIds) delete next[id];
    return { inputErrors: { ...next, ...errors } };
  });
  const firstBad = Object.keys(errors)[0];
  if (firstBad) {
    const node = document.querySelector<HTMLElement>(`[data-el-id="${firstBad}"] input, [data-el-id="${firstBad}"] textarea, [data-el-id="${firstBad}"] select`);
    node?.focus({ preventScroll: false });
  }
  return !firstBad;
}

export function resetForm(env: ActionEnv, formId: string) {
  const p = page(env);
  const ids = new Set(descendantIds(p, formId));
  env.store.setState((s) => {
    const inputs = { ...s.inputs };
    const inputErrors = { ...s.inputErrors };
    for (const id of ids) {
      delete inputs[id];
      delete inputErrors[id];
    }
    return { inputs, inputErrors };
  });
}

function showFieldErrors(env: ActionEnv, formId: string | null, err: unknown) {
  if (!(err instanceof ApiError) || !err.details?.fields || !formId) return;
  const fields = err.details.fields as Record<string, string>;
  const p = page(env);
  const errors: Record<string, string> = {};
  for (const el of inputsOfForm(p, formId)) {
    const key = (el.props.name || el.name).toLowerCase();
    const match = Object.keys(fields).find((f) => f.toLowerCase() === key);
    if (match) errors[el.id] = fields[match];
  }
  env.store.setState((s) => ({ inputErrors: { ...s.inputErrors, ...errors } }));
}

/** Forms being sent right now: pressing Enter or Send twice can't submit twice. */
const submitting = new Set<string>();

/** Validate, save to the form's collection (if any), run its submit actions, then reset. */
export async function submitForm(env: ActionEnv, formId: string): Promise<boolean> {
  const key = `${env.store.getState().appId}:${formId}`;
  if (submitting.has(key)) return false;
  submitting.add(key);
  try {
    return await submitFormOnce(env, formId);
  } finally {
    submitting.delete(key);
  }
}

async function submitFormOnce(env: ActionEnv, formId: string): Promise<boolean> {
  const s = env.store.getState();
  const p = currentPage(s);
  const form: El | undefined = p?.elements[formId];
  if (!p || !form) return false;
  const formEnv = { ...env, formId };
  if (!validateForm(formEnv, formId)) return false;
  let result: unknown = undefined;
  if (form.props.collectionId) {
    try {
      const values = formValues(s, p, formId, env.scope);
      const res = await env.api.create(form.props.collectionId, values);
      result = res.record.id;
      bump(env);
    } catch (err) {
      showFieldErrors(formEnv, formId, err);
      toast.error(errorMessage(err));
      return false;
    }
  }
  const ok = await runActions(form.events?.submit, formEnv, result);
  if (!ok) {
    if (result !== undefined) {
      resetForm(formEnv, formId);
      toast.error("Your submission was saved, but a follow-up action failed. Do not submit it again.");
      return true;
    }
    return false;
  }
  const msg = form.props.successMessage?.trim();
  if (msg) toast.success(interpolate(msg, buildContext(env.store.getState(), env.scope, formId)));
  resetForm(formEnv, formId);
  return true;
}

/* ------------------------------------------------------------------ the runner */

function enclosingDialog(p: Page, id: string | undefined): string | null {
  let cur = id ? p.elements[id] : undefined;
  while (cur) {
    if (cur.type === "dialog") return cur.id;
    cur = cur.parentId ? p.elements[cur.parentId] : undefined;
  }
  return null;
}

function coerceVar(type: string | undefined, v: unknown): unknown {
  if (type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (type === "boolean") return truthy(v);
  return v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** Run a list of actions in order. Returns false when the chain stopped (validation or an error). */
export async function runActions(actions: Action[] | undefined, env: ActionEnv, initialResult?: unknown): Promise<boolean> {
  if (!actions?.length) return true;
  let result: unknown = initialResult;
  for (const a of actions) {
    const s = env.store.getState();
    const ctx = buildContext(s, env.scope, env.formId);
    ctx.result = result;
    if (a.condition && !evalCondition(a.condition, ctx)) continue;
    try {
      const out = await runAction(a, env, ctx);
      if (out === false) return false;
      if (out !== undefined && out !== true) result = out;
    } catch (err) {
      showFieldErrors(env, a.formId || env.formId, err);
      toast.error(errorMessage(err));
      return false;
    }
  }
  return true;
}

async function runAction(a: Action, env: ActionEnv, ctx: EvalContext): Promise<unknown> {
  const store = env.store;
  const s = store.getState();
  const p = currentPage(s)!;
  const formId = a.formId || env.formId;
  switch (a.type) {
    case "navigate": {
      if (!a.pageId) return;
      const rid = a.recordId ? String(evaluate(a.recordId, ctx) ?? "") : null;
      s.navigate(a.pageId, rid || null);
      return;
    }
    case "goBack":
      s.goBack();
      return;
    case "habitCheckIn": {
      if (!a.collectionId) throw new Error("Choose the check-ins collection first.");
      const habitId = String(evaluate(a.recordId || "{{record.id}}", ctx) || "");
      const result = await env.api.habitCheckIn(a.collectionId, habitId);
      bump(env);
      toast.success(result.alreadyDone ? "Already checked in today." : `Check-in saved. Streak: ${result.streak} ${result.unit}.`);
      return result;
    }
    case "openUrl": {
      const url = safeUrl(interpolate(a.url, ctx));
      if (!url) throw new Error("That link isn't valid.");
      if (a.newTab) window.open(url, "_blank", "noopener,noreferrer");
      else window.location.href = url;
      return;
    }
    case "notify": {
      const msg = interpolate(a.message, ctx) || "Done!";
      if (a.tone === "error") toast.error(msg);
      else if (a.tone === "info") toast(msg);
      else toast.success(msg);
      return;
    }
    case "setVisibility": {
      if (!a.targetId || !p.elements[a.targetId]) return;
      const el = p.elements[a.targetId];
      const now = isShown(s, el);
      const next = a.mode === "show" ? true : a.mode === "hide" ? false : !now;
      store.setState((st) => ({ shown: { ...st.shown, [el.id]: next } }));
      return;
    }
    case "openDialog":
      if (a.targetId) store.setState((st) => ({ dialogs: { ...st.dialogs, [a.targetId!]: true } }));
      return;
    case "closeDialog": {
      const target = a.targetId || enclosingDialog(p, env.sourceId);
      store.setState((st) => (target ? { dialogs: { ...st.dialogs, [target]: false } } : { dialogs: {} }));
      return;
    }
    case "setVariable": {
      const name = a.variable;
      const v = s.doc.variables.find((x) => x.name === name);
      if (!name || !v) throw new Error(`There's no variable called "${name}".`);
      const cur = s.vars[name];
      const val = evaluate(a.value ?? "", ctx);
      let next: unknown;
      switch (a.op || "set") {
        case "add":
          next = Number(cur || 0) + Number(val || 0);
          break;
        case "subtract":
          next = Number(cur || 0) - Number(val || 0);
          break;
        case "multiply":
          next = Number(cur || 0) * Number(val || 0);
          break;
        case "divide":
          next = Number(val) ? Number(cur || 0) / Number(val) : 0;
          break;
        case "toggle":
          next = !truthy(cur);
          break;
        case "append":
          next = `${cur ?? ""}${val ?? ""}`;
          break;
        default:
          next = val;
      }
      next = coerceVar(v.type, next);
      store.setState((st) => ({ vars: { ...st.vars, [name]: next } }));
      persistVar(s.appId, v, next, s.user?.id);
      return;
    }
    case "setProperty": {
      if (!a.targetId || !a.property) return;
      const value = evaluate(a.value ?? "", ctx);
      if (a.property === "visible") {
        store.setState((st) => ({ shown: { ...st.shown, [a.targetId!]: truthy(value) } }));
        return;
      }
      if (a.property === "value") {
        store.setState((st) => ({ inputs: { ...st.inputs, [a.targetId!]: value } }));
        return;
      }
      store.setState((st) => ({ overrides: { ...st.overrides, [a.targetId!]: { ...(st.overrides[a.targetId!] || {}), [a.property!]: value } } }));
      return;
    }
    case "validateForm":
      if (!formId) return;
      return validateForm(env, formId) ? undefined : false;
    case "submitForm": {
      const target = a.formId || env.formId;
      if (!target) return;
      return (await submitForm({ ...env, formId: target }, target)) ? undefined : false;
    }
    case "resetForm":
      if (formId) resetForm(env, formId);
      return;
    case "createRecord": {
      if (!a.collectionId) throw new Error("Choose which collection to save to.");
      // the form's named inputs are the starting point; explicit mappings win
      const values = { ...(formId ? formValues(s, p, formId, env.scope) : {}), ...evalMapping(a.mapping, ctx) };
      const res = await env.api.create(a.collectionId, values);
      bump(env);
      if (a.saveIdTo) store.setState((st) => ({ vars: { ...st.vars, [a.saveIdTo!]: res.record.id } }));
      if (a.resetAfter && formId) resetForm(env, formId);
      return res.record.id;
    }
    case "updateRecord": {
      if (!a.collectionId) throw new Error("Choose which collection to update.");
      const rid = a.recordId ? String(evaluate(a.recordId, ctx) ?? "") : env.scope?.record.id || s.pageRecord?.id || "";
      if (!rid) throw new Error("There's no record to update here.");
      const values = { ...(formId ? formValues(s, p, formId, env.scope) : {}), ...evalMapping(a.mapping, ctx) };
      const res = await env.api.update(a.collectionId, rid, values);
      bump(env);
      if (s.pageRecord?.id === rid) store.setState({ pageRecord: res.record });
      if (a.resetAfter && formId) resetForm(env, formId);
      return res.record.id;
    }
    case "deleteRecord": {
      if (!a.collectionId) throw new Error("Choose which collection to delete from.");
      const rid = a.recordId ? String(evaluate(a.recordId, ctx) ?? "") : env.scope?.record.id || s.pageRecord?.id || "";
      if (!rid) throw new Error("There's no record to delete here.");
      if (a.confirmText) {
        const ok = await confirmDialog({ title: interpolate(a.confirmText, ctx), confirmLabel: "Delete", danger: true });
        if (!ok) return false;
      }
      await env.api.remove(a.collectionId, rid);
      bump(env);
      return;
    }
    case "adjustNumber": {
      if (!a.collectionId || !a.fieldName) throw new Error("Choose a collection and a number field.");
      const rid = a.recordId ? String(evaluate(a.recordId, ctx) ?? "") : env.scope?.record.id || s.pageRecord?.id || "";
      if (!rid) throw new Error("There's no record to change here.");
      const amount = Number(evaluate(a.amount ?? "1", ctx));
      const min = a.min !== undefined && a.min !== "" ? Number(evaluate(a.min, ctx)) : undefined;
      const res = await env.api.adjust(a.collectionId, rid, a.fieldName, Number.isFinite(amount) ? amount : 1, min);
      bump(env);
      if (s.pageRecord?.id === rid) store.setState({ pageRecord: res.record });
      return;
    }
    case "transaction": {
      const protect = (v: string | undefined) => (v || "").replace(/\{\{\s*steps\.(\d+)\.id\s*\}\}/g, "§STEP$1§");
      const restore = (v: unknown) => (typeof v === "string" ? v.replace(/§STEP(\d+)§/g, "{{steps.$1.id}}") : v);
      const steps: TransactionStep[] = (a.steps || []).map((st) => {
        const mapping: Record<string, string> = {};
        for (const [k, v] of Object.entries(st.mapping || {})) mapping[k] = String(restore(evaluate(protect(v), ctx)) ?? "");
        const rid = st.recordId ? String(restore(evaluate(protect(st.recordId), ctx)) ?? "") : env.scope?.record.id || "";
        return {
          ...st,
          mapping,
          recordId: rid,
          amount: st.amount !== undefined ? String(evaluate(st.amount, ctx) ?? "") : undefined,
          min: st.min !== undefined && st.min !== "" ? String(evaluate(st.min, ctx) ?? "") : undefined,
        };
      });
      const res = await env.api.transaction(steps);
      bump(env);
      return res.steps[res.steps.length - 1]?.id;
    }
    case "refreshData":
      bump(env);
      return;
    case "setTab":
      if (a.targetId) store.setState((st) => ({ tabs: { ...st.tabs, [a.targetId!]: Math.max(0, a.tabIndex ?? 0) } }));
      return;
    case "scrollTo": {
      const node = a.targetId ? document.querySelector(`[data-el-id="${a.targetId}"]`) : null;
      node?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    case "copyText": {
      const text = interpolate(a.text ?? a.value, ctx);
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Couldn't copy — your browser blocked it.");
      }
      return;
    }
    case "signIn":
      window.location.href = signInUrl(s.appId);
      return false;
    case "signOut":
      await fetch("/api/auth/logout", { method: "POST" });
      // leave nothing personal behind on this device
      clearPersistedVars(s.appId);
      await clearOfflineCache();
      window.location.reload();
      return false;
    case "wait":
      await sleep(Math.max(0, Math.min(10000, a.ms ?? 500)));
      return;
    default:
      return;
  }
}
