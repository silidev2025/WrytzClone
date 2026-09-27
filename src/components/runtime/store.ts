"use client";

import { createContext, useContext } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import type { AppDoc, Breakpoint, FieldType, Page, RuntimeRecord, Variable } from "@/lib/shared/types";

/** editor = design canvas, thumb = static card preview, preview/live = the running app */
export type RuntimeMode = "editor" | "thumb" | "preview" | "live";

export function isStatic(mode: RuntimeMode): boolean {
  return mode === "editor" || mode === "thumb";
}

export interface SchemaField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  currency?: string;
  refCollectionId?: string;
  min?: number;
  max?: number;
}

export interface SchemaCollection {
  id: string;
  name: string;
  fields: SchemaField[];
  access?: { read: string; create: string; update: string; delete: string };
}

export interface RuntimeUser {
  id: string;
  name: string;
  email: string;
  avatarColor?: string;
  isAdmin: boolean;
}

export interface RTState {
  mode: RuntimeMode;
  appId: string;
  appName: string;
  doc: AppDoc;
  schema: SchemaCollection[];
  /** thumbnails only: example rows per collection id, shown instead of loading data */
  samples: Record<string, RuntimeRecord[]>;
  user: RuntimeUser | null;
  pageId: string;
  recordId: string | null;
  pageRecord: RuntimeRecord | null;
  pageRecordState: "idle" | "loading" | "missing" | "ready" | "error";
  vars: Record<string, unknown>;
  inputs: Record<string, unknown>;
  inputErrors: Record<string, string>;
  shown: Record<string, boolean>;
  overrides: Record<string, Record<string, unknown>>;
  dialogs: Record<string, boolean>;
  tabs: Record<string, number>;
  dataVersion: number;
  busy: Record<string, boolean>;
  bp: Breakpoint;
  /** how much the page is scaled to fit the screen (pop-ups use the same scale) */
  scale: number;
  /** Live auto-flow width. Authored desktop and custom phone layouts keep their dimensions. */
  frameWidth?: number;
  /** extra frame-space on each side when the page is centred on a very wide screen */
  bleed: number;
  /** editor: ids that are selected (pop-ups show while selected) */
  selection: string[];
  /** editor: show every pop-up */
  showDialogs: boolean;
  /** editor: the text element being edited in place */
  editingId: string | null;
  commitText: (id: string, text: string) => void;
  /** editor: switch the tab shown on the canvas */
  selectTab: (tabsId: string, index: number) => void;
  /** navigation hook supplied by the host (preview/live) */
  navigate: (pageId: string, recordId?: string | null) => void;
  goBack: () => void;
}

export type RTStore = StoreApi<RTState>;

/** Remembered variables are kept per person on a shared device ("guest" when signed out). */
function varKey(appId: string, userId: string | null | undefined, name: string) {
  return `cb-var:${appId}:${userId || "guest"}:${name}`;
}

/** Forget everything this app remembered on this device (used when someone signs out). */
export function clearPersistedVars(appId: string) {
  if (typeof window === "undefined") return;
  try {
    const prefix = `cb-var:${appId}:`;
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(prefix)) window.localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export function initialVars(vars: Variable[], appId: string, mode: RuntimeMode, userId?: string | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const v of vars) {
    let value: unknown = v.initial;
    if (v.type === "number") value = Number(v.initial) || 0;
    if (v.type === "boolean") value = /^(true|yes|1)$/i.test(String(v.initial));
    if (v.persist && mode !== "editor" && typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(varKey(appId, userId, v.name));
        if (saved !== null) value = JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    out[v.name] = value;
  }
  return out;
}

export function createRuntimeStore(init: {
  mode: RuntimeMode;
  appId: string;
  appName: string;
  doc: AppDoc;
  schema?: SchemaCollection[];
  samples?: Record<string, RuntimeRecord[]>;
  user?: RuntimeUser | null;
  pageId?: string;
  recordId?: string | null;
  bp?: Breakpoint;
}): RTStore {
  return createStore<RTState>(() => ({
    mode: init.mode,
    appId: init.appId,
    appName: init.appName,
    doc: init.doc,
    schema: init.schema || [],
    samples: init.samples || {},
    user: init.user ?? null,
    pageId: init.pageId || init.doc.homePageId,
    recordId: init.recordId ?? null,
    pageRecord: null,
    pageRecordState: "idle",
    vars: initialVars(init.doc.variables, init.appId, init.mode, init.user?.id),
    inputs: {},
    inputErrors: {},
    shown: {},
    overrides: {},
    dialogs: {},
    tabs: {},
    dataVersion: 0,
    busy: {},
    bp: init.bp || "desktop",
    scale: 1,
    bleed: 0,
    selection: [],
    showDialogs: false,
    editingId: null,
    commitText: () => undefined,
    selectTab: () => undefined,
    navigate: () => undefined,
    goBack: () => undefined,
  }));
}

export const RuntimeContext = createContext<RTStore | null>(null);

export function useRTStore(): RTStore {
  const s = useContext(RuntimeContext);
  if (!s) throw new Error("Runtime store missing");
  return s;
}

export function useRT<T>(selector: (s: RTState) => T): T {
  return useStore(useRTStore(), selector);
}

export function currentPage(s: RTState): Page | undefined {
  return s.doc.pages.find((p) => p.id === s.pageId) || s.doc.pages.find((p) => p.id === s.doc.homePageId);
}

export function persistVar(appId: string, v: Variable | undefined, value: unknown, userId?: string | null) {
  if (!v?.persist || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(varKey(appId, userId, v.name), JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
