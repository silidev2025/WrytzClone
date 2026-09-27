"use client";

import { createContext } from "react";
import type { El, Page, RuntimeRecord } from "@/lib/shared/types";
import { evaluate, type EvalContext } from "@/lib/shared/expressions";
import { formatFieldValue } from "@/lib/shared/fields";
import { descendantIds } from "@/lib/shared/doc";
import { currentPage, type RTState, type SchemaCollection } from "./store";

export interface RecordScope {
  record: RuntimeRecord;
  collectionId: string | null;
}

/** The record an element is showing (inside a list/table row, or on a detail page). */
export const RecordContext = createContext<RecordScope | null>(null);
/** The form an element lives in. */
export const FormContext = createContext<string | null>(null);

export function schemaFor(s: RTState, collectionId: string | null | undefined): SchemaCollection | undefined {
  return collectionId ? s.schema.find((c) => c.id === collectionId) : undefined;
}

function isChoiceMulti(el: El) {
  return el.props.inputType === "checkbox";
}

/** The value an input holds right now (typed value, or its default). */
export function inputValue(s: RTState, el: El, record?: RecordScope | null): unknown {
  if (el.id in s.inputs) return s.inputs[el.id];
  const t = el.props.inputType;
  const def = el.props.defaultValue;
  if (def) {
    const v = evaluate(def, baseContext(s, record ?? null));
    if (t === "toggle") return v === true || /^(true|yes|1|on)$/i.test(String(v));
    if (isChoiceMulti(el)) return Array.isArray(v) ? v : String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    if (t === "number" || t === "range" || t === "rating") return v === "" || v === undefined || v === null ? "" : Number(v);
    return v ?? "";
  }
  if (t === "toggle") return false;
  if (isChoiceMulti(el)) return [];
  if (t === "range") return el.props.min ?? 0;
  if (t === "rating") return 0;
  return "";
}

export function isShown(s: RTState, el: El): boolean {
  if (el.id in s.shown) return s.shown[el.id];
  return !el.startHidden;
}

/** Context without component values (used while computing defaults, avoids loops). */
export function baseContext(s: RTState, scope: RecordScope | null): EvalContext {
  const page = currentPage(s);
  const col = schemaFor(s, scope?.collectionId);
  return {
    vars: s.vars,
    record: scope?.record ?? s.pageRecord ?? null,
    user: s.user ? { ...s.user, signedIn: true } : null,
    page: page ? { name: page.name, path: page.path, params: { id: s.recordId || "" } } : undefined,
    app: { name: s.appName },
    formatRecordField: (field, value) => {
      const collection = col || schemaFor(s, page?.recordCollectionId);
      const f = collection?.fields.find((x) => x.name.toLowerCase() === field.toLowerCase());
      if (!f) {
        if (/^(createdat|updatedat)$/i.test(field) && typeof value === "string") return formatFieldValue({ type: "datetime" }, value);
        return undefined;
      }
      if (value && typeof value === "object" && !Array.isArray(value) && "_label" in (value as object)) return String((value as { _label: unknown })._label);
      return formatFieldValue(f, value);
    },
  };
}

/** Values of the inputs inside a form, keyed by their field name. */
export function formValues(s: RTState, page: Page, formId: string, scope?: RecordScope | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const id of descendantIds(page, formId)) {
    const el = page.elements[id];
    if (!el || el.type !== "input") continue;
    const key = (el.props.name || el.name).trim();
    if (key) out[key] = inputValue(s, el, scope);
  }
  return out;
}

/** Everything a {{binding}} can see from where an element sits. */
export function buildContext(s: RTState, scope: RecordScope | null, formId: string | null): EvalContext {
  const ctx = baseContext(s, scope);
  const page = currentPage(s);
  const components: Record<string, Record<string, unknown>> = {};
  if (page) {
    for (const el of Object.values(page.elements)) {
      const o = s.overrides[el.id] || {};
      const entry: Record<string, unknown> = { visible: isShown(s, el), ...o };
      if (el.type === "input") {
        const v = inputValue(s, el, scope);
        entry.value = v;
        entry.checked = el.props.inputType === "toggle" ? !!v : Array.isArray(v) ? v.length > 0 : !!v;
      } else if (el.type === "text") {
        entry.text = o.text ?? el.props.text ?? "";
        entry.value = entry.text;
      } else if (el.type === "button") {
        entry.text = o.text ?? el.props.label ?? "";
        entry.value = entry.text;
      } else if (el.type === "tabs") {
        const idx = s.tabs[el.id] ?? el.props.activeTab ?? 0;
        entry.selectedIndex = idx;
        entry.selectedValue = el.props.tabs?.[idx]?.label ?? "";
        entry.value = entry.selectedValue;
      } else if (el.type === "dialog") {
        entry.open = !!s.dialogs[el.id];
      } else if (el.type === "image") {
        entry.source = o.source ?? el.props.src ?? "";
        entry.value = entry.source;
      }
      components[el.name] = entry;
    }
  }
  ctx.components = components;
  if (formId && page) ctx.form = formValues(s, page, formId, scope);
  return ctx;
}
