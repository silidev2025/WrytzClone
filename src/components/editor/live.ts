"use client";

import type { AppDoc, Collection } from "@/lib/shared/types";
import { applyChanges, diffDocs, unitIs, type Change } from "@/lib/shared/sync";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";
import { bumpData, ed, setCollections, useEditor, type EditorState, type Peer } from "./store";

/*
 * Live collaboration in the browser (see lib/shared/sync.ts for the model).
 *
 *   base      the design as the server has it, at revision `rev`
 *   doc       what this tab shows: base + its own changes not confirmed yet
 *   inflight  the changes sent and waiting for their event
 *
 * Changes go out in small batches while you work; events come back over one Server-Sent Events
 * stream, strictly in revision order. Other people's changes are applied unless you have an
 * unconfirmed change to the same unit (yours wins: it reaches the server after theirs).
 */

type ChangeEvent = { type: "change"; rev: number; clientId: string; userId: string; changes: Change[]; accepted: string[]; adjusted: string[] };
type ReloadEvent = { type: "reload"; rev: number; clientId: string | null };
type AckEvent = { type: "ack"; rev: number; accepted: string[]; adjusted: string[] };
type Numbered = ChangeEvent | ReloadEvent;

const L = {
  appId: "",
  clientId: "",
  base: null as AppDoc | null,
  rev: 0,
  inflight: null as Map<string, unknown> | null,
  waiting: new Map<number, Numbered>(),
  es: null as EventSource | null,
  flushTimer: null as ReturnType<typeof setTimeout> | null,
  gapTimer: null as ReturnType<typeof setTimeout> | null,
  retryTimer: null as ReturnType<typeof setTimeout> | null,
  dataTimer: null as ReturnType<typeof setTimeout> | null,
  presenceTimer: null as ReturnType<typeof setTimeout> | null,
  lastPresence: "",
  cursor: null as { x: number; y: number } | null,
  applying: false,
  stopped: true,
  failures: 0,
  waiters: [] as (() => void)[],
};

const newId = () => (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);

/** Set the store without it counting as a local edit. */
function setRemote(patch: Partial<EditorState>) {
  L.applying = true;
  try {
    useEditor.setState(patch);
  } finally {
    L.applying = false;
  }
}

function pendingKeys(): Set<string> {
  const keys = new Set(diffDocs(L.base!, ed().doc).map((c) => c.k));
  for (const k of L.inflight?.keys() ?? []) keys.add(k);
  return keys;
}

/** Nothing unconfirmed left: mark saved; otherwise send what's left. */
function settle() {
  if (L.inflight) return;
  const s = ed();
  if (s.saveState === "conflict") return;
  if (diffDocs(L.base!, s.doc).length === 0) {
    if (s.saveState !== "saved") useEditor.setState({ saveState: "saved", saveError: null, lastSavedAt: new Date().toISOString() });
    for (const w of L.waiters.splice(0)) w();
  } else scheduleFlush();
}

/* ------------------------------------------------------------------ sending */

function scheduleFlush(delay?: number) {
  if (L.stopped || L.flushTimer) return;
  L.flushTimer = setTimeout(
    () => {
      L.flushTimer = null;
      void flush();
    },
    delay ?? (ed().gesture > 0 ? 220 : 140),
  );
}

async function flush() {
  if (L.stopped || L.inflight || !L.base) return;
  const doc = ed().doc;
  const changes = diffDocs(L.base, doc);
  if (!changes.length) return settle();
  L.inflight = new Map(changes.map((c) => [c.k, c.v]));
  useEditor.setState({ saveState: "saving" });
  try {
    const res = await api<ChangeEvent | AckEvent>(`/api/apps/${L.appId}/live`, { body: { clientId: L.clientId, changes } });
    L.failures = 0;
    if (res.type === "ack") {
      // nothing changed on the server (it already had these values)
      L.base = applyChanges(L.base!, res.accepted.filter((k) => L.inflight?.has(k)).map((k) => ({ k, v: L.inflight!.get(k) })));
      L.inflight = null;
      settle();
    } else receive(res);
  } catch (err) {
    L.inflight = null;
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return accessLost();
    L.failures++;
    useEditor.setState({ saveState: "error", saveError: errorMessage(err) });
    // a change the server refuses (e.g. over the page limit) is dropped after a few tries
    if (err instanceof ApiError && err.status === 400 && L.failures >= 3) {
      toast.error(`${errorMessage(err)} Reloading the latest design.`);
      await resync("discard");
      return;
    }
    if (L.retryTimer) clearTimeout(L.retryTimer);
    L.retryTimer = setTimeout(() => {
      L.retryTimer = null;
      void flush();
    }, Math.min(15_000, 1500 * 2 ** Math.min(L.failures, 4)));
  }
}

/** Save everything now (publishing, restoring…). Resolves true once the server has it all. */
export async function syncNow(timeoutMs = 20_000): Promise<boolean> {
  if (!L.base) return true;
  if (L.flushTimer) {
    clearTimeout(L.flushTimer);
    L.flushTimer = null;
  }
  const done = new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(false), timeoutMs);
    L.waiters.push(() => {
      clearTimeout(t);
      resolve(true);
    });
  });
  if (!L.inflight) {
    if (diffDocs(L.base, ed().doc).length === 0) {
      settle();
      return true;
    }
    void flush();
  }
  const ok = await done;
  return ok && ed().saveState === "saved";
}

/* ------------------------------------------------------------------ receiving */

function receive(ev: Numbered) {
  if (ev.rev <= L.rev) return;
  L.waiting.set(ev.rev, ev);
  while (L.waiting.has(L.rev + 1)) {
    const next = L.waiting.get(L.rev + 1)!;
    L.waiting.delete(L.rev + 1);
    if (next.type === "reload") {
      L.waiting.clear();
      void resync(next.clientId === L.clientId ? "keep" : "announce");
      return;
    }
    apply(next);
  }
  if (L.waiting.size && !L.gapTimer) {
    // an event went missing: if it doesn't turn up soon, fetch the whole design
    L.gapTimer = setTimeout(() => {
      L.gapTimer = null;
      if (L.waiting.size) void resync("keep");
    }, 3000);
  }
  if (!L.waiting.size && L.gapTimer) {
    clearTimeout(L.gapTimer);
    L.gapTimer = null;
  }
}

function apply(ev: ChangeEvent) {
  const s = ed();
  const own = ev.clientId === L.clientId;
  const accepted = new Set(own ? ev.accepted : []);
  const adjusted = new Set(own ? ev.adjusted : []);
  const pending = pendingKeys();
  const baseChanges: Change[] = [];
  const docChanges: Change[] = [];
  // our own confirmed values: keep the exact objects we sent, so nothing looks changed
  for (const k of accepted) if (!adjusted.has(k) && L.inflight?.has(k)) baseChanges.push({ k, v: L.inflight.get(k) });
  for (const c of ev.changes) {
    if (accepted.has(c.k) && !adjusted.has(c.k)) continue;
    baseChanges.push(c);
    if (adjusted.has(c.k)) {
      // the server repaired what we sent: adopt its version unless we changed it again since
      if (unitIs(s.doc, c.k, L.inflight?.get(c.k))) docChanges.push(c);
    } else if (!pending.has(c.k)) docChanges.push(c);
  }
  L.base = applyChanges(L.base!, baseChanges);
  L.rev = ev.rev;
  if (own) {
    L.inflight = null;
  }
  const doc = applyChanges(s.doc, docChanges);
  if (doc !== s.doc) {
    const pageId = doc.pages.some((p) => p.id === s.pageId) ? s.pageId : doc.homePageId;
    const page = doc.pages.find((p) => p.id === pageId);
    if (pageId !== s.pageId) toast("The page you were on was deleted by someone else.");
    setRemote({
      doc,
      revision: ev.rev,
      pageId,
      selection: page ? s.selection.filter((id) => page.elements[id]) : [],
      editingTextId: s.editingTextId && page?.elements[s.editingTextId] ? s.editingTextId : null,
    });
  } else useEditor.setState({ revision: ev.rev });
  settle();
}

/**
 * Replace the base with the server's design. "keep" puts this tab's unconfirmed changes back on
 * top; "announce" (someone restored a version) and "discard" drop them.
 */
async function resync(mode: "keep" | "announce" | "discard") {
  const announce = mode === "announce";
  if (L.stopped) return;
  try {
    const res = await api<{ doc: AppDoc; revision: number; collections: Collection[] }>(`/api/apps/${L.appId}`);
    const s = ed();
    const local = mode === "keep" ? diffDocs(L.base!, s.doc) : [];
    L.base = res.doc;
    L.rev = res.revision;
    L.inflight = null;
    for (const r of [...L.waiting.keys()]) if (r <= L.rev) L.waiting.delete(r);
    const doc = applyChanges(res.doc, local);
    const pageId = doc.pages.some((p) => p.id === s.pageId) ? s.pageId : doc.homePageId;
    setRemote({ doc, revision: res.revision, pageId, selection: announce ? [] : s.selection, collections: res.collections, ...(announce ? { past: [], future: [] } : {}) });
    if (announce) toast("Someone restored an earlier version of this design.");
    settle();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) accessLost();
  }
}

/** After restoring a version here: the server's design replaces everything. */
export function resetFromServer(doc: AppDoc, revision: number) {
  L.base = doc;
  L.rev = revision;
  L.inflight = null;
  for (const r of [...L.waiting.keys()]) if (r <= revision) L.waiting.delete(r);
  setRemote({ doc, revision, past: [], future: [], selection: [], pageId: doc.homePageId, saveState: "saved" });
}

function accessLost() {
  if (L.stopped) return;
  stopLive();
  useEditor.setState({ live: "offline", saveState: "error", saveError: "You no longer have edit access to this app." });
  toast.error("You no longer have edit access to this app. Your recent changes weren't saved.");
  setTimeout(() => (window.location.href = "/apps"), 4000);
}

/* ------------------------------------------------------------------ presence */

function peersWithout(peers: Record<string, Peer>, clientId: string) {
  const next = { ...peers };
  delete next[clientId];
  return next;
}

function onPeer(peer: Peer) {
  if (peer.clientId === L.clientId) return;
  const s = ed();
  const known = Object.values(s.peers).some((p) => p.userId === peer.userId);
  if (!known && peer.userId !== s.user.id) toast(`${peer.name} is here`);
  useEditor.setState({ peers: { ...s.peers, [peer.clientId]: peer } });
}

function presencePayload() {
  const s = ed();
  return { clientId: L.clientId, pageId: s.pageId, view: s.view, bp: s.bp, selection: s.selection.slice(0, 50), cursor: s.view === "design" ? L.cursor : null };
}

function sendPresence(force = false) {
  if (L.stopped) return;
  const payload = presencePayload();
  const json = JSON.stringify(payload);
  if (!force && json === L.lastPresence) return;
  L.lastPresence = json;
  void api(`/api/apps/${L.appId}/live/presence`, { body: payload }).catch(() => undefined);
}

function schedulePresence() {
  if (L.presenceTimer) return;
  L.presenceTimer = setTimeout(() => {
    L.presenceTimer = null;
    sendPresence();
  }, 90);
}

/** The pointer position on the canvas, in page coordinates (null: off the canvas). */
export function liveCursor(pos: { x: number; y: number } | null) {
  const round = pos ? { x: Math.round(pos.x), y: Math.round(pos.y) } : null;
  if (round?.x === L.cursor?.x && round?.y === L.cursor?.y) return;
  L.cursor = round;
  schedulePresence();
}

/* ------------------------------------------------------------------ data */

function onData(kind: "records" | "collections") {
  if (L.dataTimer) clearTimeout(L.dataTimer);
  L.dataTimer = setTimeout(async () => {
    L.dataTimer = null;
    if (kind === "collections") {
      try {
        const res = await api<{ collections: Collection[] }>(`/api/apps/${L.appId}/collections`);
        setCollections(res.collections);
      } catch {
        /* next event tries again */
      }
    } else bumpData();
    useEditor.setState((s) => ({ liveDataVersion: s.liveDataVersion + 1 }));
  }, 250);
}

/* ------------------------------------------------------------------ connection */

function connect() {
  if (L.stopped) return;
  L.es?.close();
  const es = new EventSource(`/api/apps/${L.appId}/live?clientId=${encodeURIComponent(L.clientId)}&rev=${L.rev}`);
  L.es = es;
  useEditor.setState({ live: "connecting" });
  es.addEventListener("hello", (e) => {
    const hello = JSON.parse((e as MessageEvent).data) as { rev: number; peers: Peer[]; resync: boolean };
    const peers: Record<string, Peer> = {};
    for (const p of hello.peers) if (p.clientId !== L.clientId) peers[p.clientId] = p;
    useEditor.setState({ live: "live", peers });
    if (hello.resync || hello.rev < L.rev) void resync("keep");
    sendPresence(true);
  });
  es.addEventListener("change", (e) => receive(JSON.parse((e as MessageEvent).data)));
  es.addEventListener("reload", (e) => receive(JSON.parse((e as MessageEvent).data)));
  es.addEventListener("presence", (e) => onPeer((JSON.parse((e as MessageEvent).data) as { peer: Peer }).peer));
  es.addEventListener("leave", (e) => {
    const { clientId } = JSON.parse((e as MessageEvent).data) as { clientId: string };
    useEditor.setState((s) => ({ peers: peersWithout(s.peers, clientId) }));
  });
  es.addEventListener("data", (e) => onData((JSON.parse((e as MessageEvent).data) as { kind: "records" | "collections" }).kind));
  es.addEventListener("access", () => accessLost());
  es.onerror = () => {
    if (L.stopped) return;
    useEditor.setState({ live: "offline" });
    // the browser retries on its own unless the server refused the stream
    if (es.readyState === EventSource.CLOSED) {
      setTimeout(async () => {
        if (L.stopped || L.es !== es) return;
        try {
          await api(`/api/apps/${L.appId}`);
          connect();
        } catch (err) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) accessLost();
          else connect();
        }
      }, 4000);
    }
  };
}

/** Start collaborating on the app loaded into the editor store. Returns the clean-up. */
export function startLive() {
  const s = ed();
  L.appId = s.app.id;
  L.clientId = newId();
  L.base = s.doc;
  L.rev = s.revision;
  L.inflight = null;
  L.waiting.clear();
  L.stopped = false;
  L.failures = 0;
  connect();
  const unsub = useEditor.subscribe((st, prev) => {
    if (st.doc !== prev.doc && !L.applying) scheduleFlush();
    if (st.pageId !== prev.pageId || st.selection !== prev.selection || st.view !== prev.view || st.bp !== prev.bp) schedulePresence();
  });
  const heartbeat = setInterval(() => sendPresence(true), 25_000);
  const sweep = setInterval(() => {
    const now = Date.now();
    const peers = ed().peers;
    const alive = Object.fromEntries(Object.entries(peers).filter(([, p]) => now - p.at < 75_000));
    if (Object.keys(alive).length !== Object.keys(peers).length) useEditor.setState({ peers: alive });
  }, 20_000);
  const onVisible = () => {
    if (document.visibilityState === "visible") sendPresence(true);
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    unsub();
    clearInterval(heartbeat);
    clearInterval(sweep);
    document.removeEventListener("visibilitychange", onVisible);
    stopLive();
  };
}

export function stopLive() {
  L.stopped = true;
  L.es?.close();
  L.es = null;
  for (const t of [L.flushTimer, L.gapTimer, L.retryTimer, L.dataTimer, L.presenceTimer]) if (t) clearTimeout(t);
  L.flushTimer = L.gapTimer = L.retryTimer = L.dataTimer = L.presenceTimer = null;
}

export const liveClientId = () => L.clientId;
