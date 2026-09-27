import type { AppMeta, User } from "@/lib/shared/types";
import { UNIT_KEY, type Change } from "@/lib/shared/sync";
import { currentSessionId, requireUser, type Session } from "@/lib/server/auth";
import { applyLiveChanges, canEditApp, getEditableApp } from "@/lib/server/apps";
import { catchUp, connectionCount, ready as liveReady, subscribe, type LiveEvent } from "@/lib/server/live";
import { getStore } from "@/lib/server/store";
import { badRequest, HttpError, rateLimit, readJson, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// serverless hosts end long requests: the browser reconnects and catches up on its own
export const maxDuration = 300;

type Ctx = { params: Promise<{ appId: string }> };

const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * The live stream for one editor tab (Server-Sent Events): a `hello` with the current revision
 * and who else is here, any design changes it missed, then everything as it happens.
 */
export const GET = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  await getEditableApp(user, appId);
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") || "";
  if (!CLIENT_ID.test(clientId)) throw badRequest("Missing editor id.");
  if (connectionCount(appId, user.id) >= 8) throw new HttpError(429, "Too many editor tabs are open for this app. Close some and try again.");
  const lastId = Number(req.headers.get("last-event-id") ?? url.searchParams.get("rev") ?? NaN);
  const sessionId = await currentSessionId();

  // still signed in, not suspended, and still allowed to edit?
  const check = async () => {
    const store = await getStore();
    const session = sessionId ? await store.get<Session>("sessions", sessionId) : null;
    if (!session || Date.parse(session.expiresAt) < Date.now()) return false;
    const u = await store.get<User>("users", session.userId);
    if (!u || u.suspended || (u.passwordChangedAt && session.createdAt < u.passwordChangedAt)) return false;
    const meta = await store.get<AppMeta>("apps", appId);
    return !!meta && canEditApp(meta, u);
  };

  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const write = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          stop();
        }
      };
      const send = (e: LiveEvent) => {
        const id = e.type === "change" || e.type === "reload" ? `id: ${e.rev}\n` : "";
        write(`${id}event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
      };
      // events that arrive while we work out what this tab missed wait here
      const queue: LiveEvent[] = [];
      let ready = false;
      const unsubscribe = subscribe(appId, {
        clientId,
        userId: user.id,
        send: (e) => (ready ? send(e) : queue.push(e)),
        check,
        close: () => stop(),
      });
      const ping = setInterval(() => write(": ping\n\n"), 15_000);
      const recheck = setInterval(() => {
        void check()
          .catch(() => false)
          .then((ok) => {
            if (!ok) {
              send({ type: "access" });
              stop();
            }
          });
      }, 30_000);
      stop = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        clearInterval(recheck);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", () => stop());
      // close a little before the host would, so the reconnect is clean
      const lifetime = process.env.VERCEL ? setTimeout(() => stop(), 280_000) : null;
      const prevStop = stop;
      stop = () => {
        if (lifetime) clearTimeout(lifetime);
        prevStop();
      };

      // listen to other servers before working out what this tab missed
      await liveReady();
      const draft = await (await getStore()).get<{ id: string; revision: number }>("drafts", appId);
      const rev = draft?.revision ?? 0;
      const since = Number.isFinite(lastId) ? lastId : rev;
      const { peers, events } = catchUp(appId, since, rev);
      write("retry: 3000\n\n");
      write(`event: hello\ndata: ${JSON.stringify({ rev, peers, resync: events === null })}\n\n`);
      for (const e of events ?? []) send(e);
      ready = true;
      for (const e of queue.splice(0)) send(e);
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

/** { clientId, changes: [{ k, v }] } — apply design changes (see lib/shared/sync.ts). */
export const POST = route<Ctx>(async (req, { params }) => {
  const { appId } = await params;
  const user = await requireUser();
  rateLimit(`live:${user.id}`, 300, 10_000);
  const body = await readJson<{ clientId?: unknown; changes?: unknown }>(req, 8_000_000);
  if (typeof body.clientId !== "string" || !CLIENT_ID.test(body.clientId)) throw badRequest("Missing editor id.");
  if (!Array.isArray(body.changes) || body.changes.length === 0 || body.changes.length > 5000) throw badRequest("Nothing to save.");
  const changes: Change[] = [];
  const seen = new Set<string>();
  for (const c of body.changes as { k?: unknown; v?: unknown }[]) {
    if (!c || typeof c.k !== "string" || !UNIT_KEY.test(c.k) || seen.has(c.k)) throw badRequest("Invalid change.");
    seen.add(c.k);
    changes.push({ k: c.k, v: c.v === undefined ? null : c.v });
  }
  const result = await applyLiveChanges(user, appId, body.clientId, changes);
  return result.event ?? { type: "ack", rev: result.rev, accepted: result.accepted, adjusted: result.adjusted };
});
