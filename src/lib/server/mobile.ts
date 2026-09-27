import crypto from "node:crypto";
import type { AppMeta, User } from "@/lib/shared/types";
import type { MobileDeployment, MobileDeploymentList, MobileTarget } from "@/lib/shared/mobile";
import { appUrl, platformUrl } from "@/lib/shared/urls";
import { uid } from "@/lib/shared/util";
import { badRequest, conflict, forbidden, HttpError, notFound, unauthorized } from "./http";
import { getStore, type Store, type StoreOps } from "./store";

export const MAX_APK_BYTES = 20 * 1024 * 1024;
const LEASE_MS = 90_000;
const QUEUE_MS = 10 * 60_000;
const BUILD_MS = 15 * 60_000;
const TUNNEL_MS = 60 * 60_000;
const APK_MS = 7 * 86400_000;

export interface DeploymentDoc extends MobileDeployment {
  ownerId: string;
  appName: string;
  appUrl: string;
  platformUrl: string;
  slug: string;
  workerId?: string;
  leaseToken?: string;
  leaseUntil?: string;
  artifactId?: string;
}
interface WorkerDoc { id: string; targets: MobileTarget[]; seenAt: string }

export function requireMobileWorker(req: Request) {
  const secret = process.env.CRAFTBASE_MOBILE_WORKER_TOKEN || "";
  const given = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (secret.length < 32 || Buffer.byteLength(given) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) throw unauthorized();
}

function publicOrigin() {
  try {
    const url = new URL(process.env.CRAFTBASE_PUBLIC_URL || "");
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || /^(localhost|127\.|\[::1\])/.test(url.hostname) || url.hostname.endsWith(".localhost")) throw new Error();
    return url.origin;
  } catch {
    throw new HttpError(503, "Phone testing needs a public HTTPS address. Ask the site operator to configure mobile deployment.");
  }
}

function deploymentUrls(slug: string) {
  const origin = publicOrigin();
  const app = new URL(appUrl(slug), origin);
  const platform = new URL(platformUrl("/"), origin);
  for (const url of [app, platform]) {
    if (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname.endsWith(".localhost")) throw new HttpError(503, "The app domain must use public HTTPS for phone testing.");
  }
  return { appUrl: app.href, platformUrl: platform.origin };
}

export async function mobileAvailability(ops: StoreOps): Promise<MobileDeploymentList["availability"]> {
  let reason = "";
  try {
    deploymentUrls("mobile-check");
    if ((process.env.CRAFTBASE_MOBILE_WORKER_TOKEN || "").length < 32) reason = "Phone testing has not been configured by the site operator yet.";
  } catch (err) { reason = (err as Error).message; }
  const workers = await ops.get<WorkerDoc>("mobileWorkers", "primary");
  const online = workers && Date.now() - Date.parse(workers.seenAt) < LEASE_MS;
  const availability = (target: MobileTarget) => {
    const message = reason || (!online || !workers.targets.includes(target) ? `${target === "android" ? "Android builds" : "iOS tunnels"} are currently unavailable. Ask the site operator to start the mobile worker.` : "");
    return { available: !message, reason: message };
  };
  return { android: availability("android"), ios: availability("ios") };
}

/** Called inside the publish transaction: either the publication and job both commit, or neither does. */
export async function queueMobileDeployment(tx: StoreOps, meta: AppMeta, target: unknown) {
  if (target !== "android" && target !== "ios") throw badRequest("Choose Android APK or iOS live tunnel.");
  if (!meta.published) throw conflict("Publish your app first.");
  const availability = await mobileAvailability(tx);
  if (!availability[target].available) throw new HttpError(503, availability[target].reason);
  const existing = await tx.find<DeploymentDoc>("mobileDeployments", "appId", meta.id);
  if (existing.some((job) => job.target === target && isActive(job))) throw conflict(`There is already an active ${target === "android" ? "Android build" : "iOS tunnel"}. Stop it before starting another.`);
  const at = new Date().toISOString();
  const job: DeploymentDoc = {
    id: uid("mob", 24), appId: meta.id, ownerId: meta.ownerId, target,
    appName: meta.name, slug: meta.published.slug, ...deploymentUrls(meta.published.slug),
    revision: meta.published.revision, status: "queued", createdAt: at, updatedAt: at,
    expiresAt: new Date(Date.now() + QUEUE_MS).toISOString(),
  };
  await tx.put("mobileDeployments", job);
}

function isActive(job: DeploymentDoc) {
  return Date.parse(job.expiresAt) > Date.now() &&
    (job.status === "queued" || job.status === "building" || (job.target === "ios" && job.status === "ready")) &&
    (!job.leaseUntil || Date.parse(job.leaseUntil) > Date.now());
}

export async function stopAppDeployments(tx: StoreOps, appId: string, reason: string) {
  for (const summary of await tx.find<DeploymentDoc>("mobileDeployments", "appId", appId)) {
    const job = await tx.get<DeploymentDoc>("mobileDeployments", summary.id);
    if (!job || !["queued", "building", "ready"].includes(job.status)) continue;
    job.status = "stopped";
    job.error = reason;
    job.tunnelUrl = undefined;
    job.updatedAt = new Date().toISOString();
    await tx.put("mobileDeployments", job);
  }
}

function owner(meta: AppMeta | null, user: User) {
  if (!meta) throw notFound();
  if (meta.ownerId !== user.id) throw forbidden();
  return meta;
}

function publicJob(job: DeploymentDoc): MobileDeployment {
  const { id, appId, target, revision, status, createdAt, updatedAt, expiresAt, error, tunnelUrl, size, sha256 } = job;
  return { id, appId, target, revision, status, createdAt, updatedAt, expiresAt, error, tunnelUrl: status === "ready" ? tunnelUrl : undefined, size, sha256 };
}

async function expireJob(tx: StoreOps, job: DeploymentDoc, meta: AppMeta | null) {
  if (!["queued", "building", "ready"].includes(job.status)) return job;
  const offline = !meta?.published || !!meta.takenDown || meta.published.slug !== job.slug;
  const expired = Date.parse(job.expiresAt) <= Date.now();
  const lost = job.leaseUntil && Date.parse(job.leaseUntil) <= Date.now() && (job.status === "building" || job.target === "ios");
  if (offline || expired || lost) {
    job.status = offline ? "stopped" : job.status === "ready" ? "expired" : "failed";
    job.error = offline ? "The app is offline or its address changed." : lost ? "The mobile worker disconnected. Please try again." : "This build or testing session expired. Start a new one.";
    job.tunnelUrl = undefined;
    job.updatedAt = new Date().toISOString();
    await tx.put("mobileDeployments", job);
  }
  return job;
}

export async function listMobileDeployments(user: User, appId: string): Promise<MobileDeploymentList> {
  const store = await getStore();
  const deployments = await store.transaction(async (tx) => {
    const meta = owner(await tx.get<AppMeta>("apps", appId), user);
    const jobs = await tx.find<DeploymentDoc>("mobileDeployments", "appId", appId);
    const result: MobileDeployment[] = [];
    for (const summary of jobs) {
      const job = await tx.get<DeploymentDoc>("mobileDeployments", summary.id);
      if (job) result.push(publicJob(await expireJob(tx, job, meta)));
    }
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
  });
  return { deployments, availability: await mobileAvailability(store) };
}

export async function stopMobileDeployment(user: User, appId: string, id: string) {
  const store = await getStore();
  const artifact = await store.transaction(async (tx) => {
    owner(await tx.get<AppMeta>("apps", appId), user);
    const job = await tx.get<DeploymentDoc>("mobileDeployments", id);
    if (!job || job.appId !== appId) throw notFound();
    job.status = "stopped";
    job.tunnelUrl = undefined;
    job.updatedAt = new Date().toISOString();
    await tx.put("mobileDeployments", job);
    return job.artifactId;
  });
  if (artifact) await store.deleteBlob(artifact);
}

export async function downloadMobileApk(user: User, appId: string, id: string) {
  const store = await getStore();
  const job = await store.transaction(async (tx) => {
    const meta = owner(await tx.get<AppMeta>("apps", appId), user);
    const found = await tx.get<DeploymentDoc>("mobileDeployments", id);
    if (!found || found.appId !== appId) throw notFound();
    return expireJob(tx, found, meta);
  });
  if (job.target !== "android" || job.status !== "ready" || !job.artifactId) throw notFound("This APK is no longer available. Publish a new build.");
  const data = await store.getBlob(job.artifactId);
  if (!data) throw notFound("This APK is no longer available. Publish a new build.");
  return { data, filename: `${job.slug}-r${job.revision}.apk` };
}

/** A single long-running worker owns a bounded set of build/tunnel processes. */
export async function claimMobileJob(workerId: unknown, targets: unknown, available: unknown) {
  if (typeof workerId !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(workerId)) throw badRequest("Invalid worker id.");
  if (!Array.isArray(targets) || targets.some((t) => t !== "android" && t !== "ios") || !Array.isArray(available) || available.some((t) => !targets.includes(t))) throw badRequest("Invalid worker capabilities.");
  const store = await getStore();
  await store.transaction(async (tx) => {
    const current = await tx.get<WorkerDoc & { workerId?: string }>("mobileWorkers", "primary");
    if (current?.workerId && current.workerId !== workerId && Date.now() - Date.parse(current.seenAt) < LEASE_MS) throw conflict("Another mobile worker is already running.");
    await tx.put("mobileWorkers", { id: "primary", workerId, targets, seenAt: new Date().toISOString() });
  });
  return store.transaction(async (tx) => {
    const queued = await tx.find<DeploymentDoc>("mobileDeployments", "status", "queued");
    for (const summary of queued.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (!available.includes(summary.target)) continue;
      // Lock ordering matches publish/list/stop: app first, job second.
      const meta = await tx.get<AppMeta>("apps", summary.appId);
      const job = await tx.get<DeploymentDoc>("mobileDeployments", summary.id);
      if (!job || job.status !== "queued") continue;
      await expireJob(tx, job, meta);
      if (job.status !== "queued") continue;
      job.status = "building";
      job.workerId = workerId;
      job.leaseToken = crypto.randomBytes(32).toString("hex");
      job.leaseUntil = new Date(Date.now() + LEASE_MS).toISOString();
      job.expiresAt = new Date(Date.now() + BUILD_MS).toISOString();
      job.updatedAt = new Date().toISOString();
      await tx.put("mobileDeployments", job);
      return job;
    }
    return null;
  });
}

async function jobSummary(id: string) {
  const summary = await (await getStore()).get<DeploymentDoc>("mobileDeployments", id);
  if (!summary) throw notFound();
  return summary;
}

async function leasedJob(tx: StoreOps, summary: DeploymentDoc, lease: string) {
  const meta = await tx.get<AppMeta>("apps", summary.appId);
  const job = await tx.get<DeploymentDoc>("mobileDeployments", summary.id);
  if (!job || !lease || job.leaseToken !== lease) throw forbidden();
  await expireJob(tx, job, meta);
  if (!isActive(job) || job.status === "queued") throw conflict("This job is no longer active.");
  return job;
}

export function validateTunnelUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 1000) throw badRequest("Invalid tunnel address.");
  try {
    const url = new URL(value);
    if (!["exp:", "exps:"].includes(url.protocol) || url.username || url.password || !["exp.direct", "ngrok.io", "ngrok-free.app", "ngrok.app"].some((domain) => url.hostname.endsWith(`.${domain}`))) throw new Error();
    return url.href;
  } catch { throw badRequest("The worker must return an Expo Go tunnel address."); }
}

export async function updateMobileJob(id: string, lease: string, body: { action?: unknown; url?: unknown; error?: unknown }) {
  const store = await getStore();
  const summary = await jobSummary(id);
  return store.transaction(async (tx) => {
    const job = await leasedJob(tx, summary, lease);
    if (body.action === "ready") {
      if (job.target !== "ios" || job.status !== "building") throw conflict("This job cannot open a tunnel.");
      job.tunnelUrl = validateTunnelUrl(body.url);
      job.status = "ready";
      job.expiresAt = new Date(Date.now() + TUNNEL_MS).toISOString();
    } else if (body.action === "failed") {
      job.status = "failed";
      // Worker messages are controlled, short descriptions; command output stays on the worker.
      job.error = typeof body.error === "string" ? body.error.slice(0, 300) : "Build failed. Please try again.";
      job.tunnelUrl = undefined;
    } else if (body.action !== "heartbeat") throw badRequest("Invalid worker action.");
    job.leaseUntil = new Date(Date.now() + LEASE_MS).toISOString();
    job.updatedAt = new Date().toISOString();
    await tx.put("mobileDeployments", job);
    return { status: job.status, expiresAt: job.expiresAt };
  });
}

export async function uploadMobileApk(id: string, lease: string, data: Buffer) {
  if (data.length < 100 || data.length > MAX_APK_BYTES || data.readUInt32LE(0) !== 0x04034b50) throw badRequest("Upload a valid APK.");
  const store = await getStore();
  const summary = await jobSummary(id);
  await store.transaction(async (tx) => {
    const job = await leasedJob(tx, summary, lease);
    if (job.target !== "android" || job.status !== "building") throw conflict("This job cannot receive an APK.");
  });
  const artifactId = uid("apk", 24);
  await store.putBlob(artifactId, data);
  try {
    await store.transaction(async (tx) => {
      const job = await leasedJob(tx, summary, lease);
      if (job.target !== "android" || job.status !== "building") throw conflict("This job cannot receive an APK.");
      job.status = "ready";
      job.artifactId = artifactId;
      job.size = data.length;
      job.sha256 = crypto.createHash("sha256").update(data).digest("hex");
      job.expiresAt = new Date(Date.now() + APK_MS).toISOString();
      job.updatedAt = new Date().toISOString();
      await tx.put("mobileDeployments", job);
    });
  } catch (err) { await store.deleteBlob(artifactId); throw err; }
}

export async function cleanMobileDeployments(store: Store) {
  for (const summary of await store.scan<DeploymentDoc>("mobileDeployments")) {
    const job = await store.transaction(async (tx) => {
      const meta = await tx.get<AppMeta>("apps", summary.appId);
      const current = await tx.get<DeploymentDoc>("mobileDeployments", summary.id);
      return current ? expireJob(tx, current, meta) : null;
    });
    if (!job) continue;
    if (["failed", "stopped", "expired"].includes(job.status)) {
      if (job.artifactId) await store.deleteBlob(job.artifactId);
      if (Date.now() - Date.parse(job.createdAt) > 30 * 86400_000) await store.delete("mobileDeployments", job.id);
    }
  }
}
