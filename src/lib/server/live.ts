import type { AppMeta, User } from "@/lib/shared/types";
import type { Change } from "@/lib/shared/sync";
import { getStore } from "./store";

/*
 * Live collaboration hub: everyone with the editor open subscribes to their app's channel
 * (Server-Sent Events). Design changes are numbered by the draft revision and kept for a
 * while so a reconnecting editor can catch up; presence (who's here, what they selected, where
 * their pointer is) is only ever held in memory.
 *
 * One server: events go straight to local subscribers. Several servers on Postgres: every event
 * goes through LISTEN/NOTIFY, so each server hears all of them in the same order.
 */

export interface Peer {
  clientId: string;
  userId: string;
  name: string;
  color: string;
  pageId: string | null;
  view: "design" | "database";
  bp: "desktop" | "mobile";
  selection: string[];
  cursor: { x: number; y: number } | null;
  at: number;
}

export type LiveEvent =
  | { type: "change"; rev: number; clientId: string; userId: string; changes: Change[]; accepted: string[]; adjusted: string[] }
  | { type: "reload"; rev: number; clientId: string | null }
  | { type: "presence"; peer: Peer }
  | { type: "leave"; clientId: string }
  | { type: "data"; kind: "records" | "collections"; collectionId: string | null }
  | { type: "access" };

interface Subscriber {
  clientId: string;
  userId: string;
  send: (e: LiveEvent) => void;
  /** re-validate the session and role; returns false when access is gone */
  check: () => Promise<boolean>;
  close: () => void;
}

interface Channel {
  subs: Set<Subscriber>;
  /** recent numbered events, oldest first */
  log: { rev: number; event: LiveEvent }[];
  peers: Map<string, Peer>;
  lock: Promise<unknown>;
}

const LOG_SIZE = 400;
const PEER_TTL = 60_000;
const NOTIFY_CHANNEL = "cb_live";
const NOTIFY_LIMIT = 7000;

interface Hub {
  channels: Map<string, Channel>;
  bridge?: Promise<Bridge | null>;
  sweeper?: boolean;
}
const g = globalThis as unknown as { __cbLive?: Hub };
const hub: Hub = (g.__cbLive ||= { channels: new Map() });

interface Bridge {
  publish: (payload: string) => Promise<void>;
}

function channel(appId: string): Channel {
  let ch = hub.channels.get(appId);
  if (!ch) {
    ch = { subs: new Set(), log: [], peers: new Map(), lock: Promise.resolve() };
    hub.channels.set(appId, ch);
  }
  return ch;
}

/** Run design writes for one app one at a time, so events leave in revision order. */
export function withAppLock<T>(appId: string, fn: () => Promise<T>): Promise<T> {
  const ch = channel(appId);
  const result = ch.lock.then(fn);
  ch.lock = result.catch(() => undefined);
  return result;
}

/* ------------------------------------------------------------------ delivery */

function deliver(appId: string, event: LiveEvent) {
  const ch = channel(appId);
  if (event.type === "change" || event.type === "reload") {
    if (!ch.log.some((e) => e.rev === event.rev)) {
      ch.log.push({ rev: event.rev, event });
      ch.log.sort((a, b) => a.rev - b.rev);
      if (ch.log.length > LOG_SIZE) ch.log.splice(0, ch.log.length - LOG_SIZE);
    }
  }
  if (event.type === "presence") ch.peers.set(event.peer.clientId, event.peer);
  if (event.type === "leave") ch.peers.delete(event.clientId);
  for (const sub of ch.subs) {
    // nobody needs their own pointer echoed back
    if ((event.type === "presence" && event.peer.clientId === sub.clientId) || (event.type === "leave" && event.clientId === sub.clientId)) continue;
    try {
      sub.send(event);
    } catch {
      /* a closed stream: its cleanup removes it */
    }
  }
}

async function bridge(): Promise<Bridge | null> {
  if (!hub.bridge) {
    hub.bridge = (async () => {
      const store = await getStore();
      if (!store.notify || !store.listen) return null;
      await store.listen(NOTIFY_CHANNEL, (payload: string) => {
        void (async () => {
          try {
            let msg = JSON.parse(payload) as { appId: string; event?: LiveEvent; ref?: string };
            if (msg.ref) {
              const doc = await (await getStore()).get<{ id: string; appId: string; event: LiveEvent }>("live", msg.ref);
              if (!doc) return;
              msg = { appId: doc.appId, event: doc.event };
            }
            if (msg.appId && msg.event) deliver(msg.appId, msg.event);
          } catch (err) {
            console.error("[live] bad notification", err);
          }
        })();
      });
      return {
        publish: async (payload) => store.notify!(NOTIFY_CHANNEL, payload),
      };
    })();
    hub.bridge.catch(() => (hub.bridge = undefined));
  }
  return hub.bridge;
}

/** Send an event to everyone with this app open (on every server). */
export async function publish(appId: string, event: LiveEvent) {
  const b = await bridge().catch(() => null);
  if (!b) return deliver(appId, event);
  let payload = JSON.stringify({ appId, event });
  if (payload.length > NOTIFY_LIMIT) {
    // too big for a notification: park it in the database and send a pointer
    const store = await getStore();
    const id = `lv_${appId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await store.put("live", { id, appId, at: new Date().toISOString(), event });
    payload = JSON.stringify({ appId, ref: id });
  }
  await b.publish(payload);
}

/* ------------------------------------------------------------------ subscriptions */

/** Make sure this server hears events published by other servers (Postgres only). */
export async function ready() {
  await bridge().catch(() => null);
}

export function subscribe(appId: string, sub: Subscriber) {
  const ch = channel(appId);
  sweeper();
  ch.subs.add(sub);
  return () => {
    ch.subs.delete(sub);
    if (ch.peers.has(sub.clientId)) void publish(appId, { type: "leave", clientId: sub.clientId });
  };
}

export function connectionCount(appId: string, userId: string) {
  return [...channel(appId).subs].filter((s) => s.userId === userId).length;
}

/** What a newly connected editor needs: who's here, and the changes after `since` (or null: reload). */
export function catchUp(appId: string, since: number, currentRev: number): { peers: Peer[]; events: LiveEvent[] | null } {
  const ch = channel(appId);
  const peers = [...ch.peers.values()].filter((p) => Date.now() - p.at < PEER_TTL);
  if (since >= currentRev) return { peers, events: [] };
  const missing = ch.log.filter((e) => e.rev > since);
  // every revision in between must still be in the log
  const complete = missing.length === currentRev - since && missing[0]?.rev === since + 1;
  return { peers, events: complete ? missing.map((e) => e.event) : null };
}

/** After someone's role changed or they were removed: close streams that lost access. */
export async function recheckLiveAccess(appId: string) {
  for (const sub of [...channel(appId).subs]) {
    if (!(await sub.check().catch(() => false))) {
      try {
        sub.send({ type: "access" });
      } catch {
        /* closed */
      }
      sub.close();
    }
  }
}

/** Records or collections changed (by anyone, including visitors of the live app). */
export function dataChanged(appId: string, kind: "records" | "collections", collectionId: string | null = null) {
  if (!hub.channels.get(appId)?.subs.size && !hub.bridge) return;
  void publish(appId, { type: "data", kind, collectionId }).catch(() => undefined);
}

/* ------------------------------------------------------------------ presence */

const PEER_COLORS = ["#e11d48", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

export function peerFor(user: User, clientId: string, input: Record<string, unknown>): Peer {
  const str = (v: unknown, max = 80) => (typeof v === "string" && v.length <= max && /^[A-Za-z0-9_-]+$/.test(v) ? v : null);
  const selection = Array.isArray(input.selection) ? input.selection.slice(0, 50).map((s) => str(s)).filter((s): s is string => !!s) : [];
  const c = input.cursor as { x?: unknown; y?: unknown } | null;
  const cursor = c && Number.isFinite(c.x) && Number.isFinite(c.y) ? { x: Math.round(Number(c.x)), y: Math.round(Number(c.y)) } : null;
  let hash = 0;
  for (const ch of user.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    clientId,
    userId: user.id,
    name: user.name.slice(0, 40),
    color: PEER_COLORS[hash % PEER_COLORS.length],
    pageId: str(input.pageId),
    view: input.view === "database" ? "database" : "design",
    bp: input.bp === "mobile" ? "mobile" : "desktop",
    selection,
    cursor,
    at: Date.now(),
  };
}

function sweeper() {
  if (!hub.sweeper) {
    hub.sweeper = true;
    setInterval(() => {
      for (const [appId, ch] of hub.channels) {
        for (const peer of ch.peers.values()) if (Date.now() - peer.at > PEER_TTL) deliver(appId, { type: "leave", clientId: peer.clientId });
        // nobody has this app open: forget its history (a late reconnect reloads the design instead)
        if (!ch.subs.size && !ch.peers.size) hub.channels.delete(appId);
      }
    }, 20_000).unref?.();
  }
  return true;
}

export function isEditorOf(meta: AppMeta, userId: string) {
  return meta.ownerId === userId || (meta.editorIds || []).includes(userId);
}
