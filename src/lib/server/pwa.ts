import { headers } from "next/headers";

/** Base path of a published app for this request: "" on its own subdomain, else /app/<slug>. */
export async function appBasePath(slug: string): Promise<string> {
  const onSubdomain = (await headers()).get("x-cb-app-host") === slug;
  return onSubdomain ? "" : `/app/${slug}`;
}

/**
 * The offline helper for installed apps: pages come from the network when possible and
 * from a small cache when offline; app files are cached; data (API) is never cached. Pages
 * rendered for a signed-in person are never stored, and signing in or out empties the cache.
 */
export function serviceWorkerSource(scope: string, appName: string): string {
  const offline = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(appName)}</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;color:#333"><div><div style="font-size:42px">📡</div><h1 style="font-size:20px">You're offline</h1><p>Check your connection and try again.</p><button onclick="location.reload()" style="font:inherit;padding:10px 18px;border-radius:10px;border:0;background:#6c47ff;color:#fff">Try again</button></div></body>`;
  return `// Offline helper for ${appName.replace(/[\r\n*/]/g, " ")}
const PREFIX = "cb-app-v3-" + ${JSON.stringify(encodeURIComponent(scope))} + "-";
const CACHE = PREFIX + ${JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || "2026-09-29")};
const MAX_ENTRIES = 100;
async function remember(req, res) {
  const cache = await caches.open(CACHE);
  const headers = new Headers(res.headers); headers.set("x-cb-cached-at", String(Date.now()));
  headers.delete("content-encoding"); headers.delete("content-length");
  await cache.put(req, new Response(await res.arrayBuffer(), { status: res.status, statusText: res.statusText, headers }));
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((key) => cache.delete(key)));
}
async function cached(req) {
  const cache = await caches.open(CACHE); const hit = await cache.match(req);
  if (hit && Date.now() - Number(hit.headers.get("x-cb-cached-at")) < 86400000) return hit;
  if (hit) await cache.delete(req);
  return undefined;
}
const SCOPE = ${JSON.stringify(scope)};
const OFFLINE = ${JSON.stringify(offline)};

self.addEventListener("install", () => self.skipWaiting());
// old caches (which could hold pages made for a signed-in person) are removed
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith(PREFIX) || k === "cb-app-v2") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

// the page asks for this when someone signs in or out
self.addEventListener("message", (event) => {
  if (event.data === "cb-clear-cache") event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("cb-app")).map((k) => caches.delete(k)))));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          // only pages made for nobody in particular are kept (the server marks them)
          if (res.ok && res.headers.get("x-cb-cacheable") === "1") {
            const copy = res.clone();
            await remember(req, copy).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached(req).then((hit) => hit || new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } }))),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith(SCOPE + "/pwa-icon")) {
    event.respondWith(
      cached(req).then(
        (hit) =>
          hit ||
          fetch(req).then(async (res) => {
            if (res.ok) {
              const copy = res.clone();
              await remember(req, copy).catch(() => undefined);
            }
            return res;
          }),
      ),
    );
  }
});
`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
