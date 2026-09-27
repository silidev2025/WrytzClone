import type { AppMeta, User } from "@/lib/shared/types";
import { nowIso, uid } from "@/lib/shared/util";
import { getStore, type StoreOps } from "./store";
import { audit } from "./audit";
import { badRequest, forbidden, notFound, str } from "./http";

/*
 * Anyone can report an app (scams, illegal content, privacy abuse…). Operators — the
 * accounts listed in OPERATOR_IDS — review reports, take apps offline (they stay offline until
 * an operator allows them again), suspend accounts and, in an emergency, sign everyone out.
 */

export const REPORT_REASONS = ["Scam or fraud", "Phishing (asks for passwords or payment details)", "Illegal goods or content", "Privacy violation", "Copyright or trademark", "Harassment or hate", "Something else"];

export interface Report {
  id: string;
  appId: string | null;
  appRef: string;
  reason: string;
  details: string;
  contact?: string;
  createdAt: string;
  status: "open" | "resolved";
  resolvedAt?: string;
  resolution?: string;
}

/** Operators are named by account id (never by email: anyone can sign up with any address). */
export function isOperator(user: User | null): boolean {
  if (!user) return false;
  const ids = (process.env.OPERATOR_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(user.id);
}

export function requireOperator(user: User | null) {
  if (!isOperator(user)) throw forbidden("Only the site's operators can see this.");
}

/** Find the app a report is about from an address like https://name.example.com or /app/name. */
async function findApp(ref: string): Promise<AppMeta | null> {
  const store = await getStore();
  const s = ref.trim().toLowerCase();
  const slug = /\/app\/([a-z0-9-]+)/.exec(s)?.[1] || /^(?:https?:\/\/)?([a-z0-9-]+)\./.exec(s)?.[1] || (/^[a-z0-9-]+$/.test(s) ? s : null);
  if (!slug) return null;
  const [meta] = await store.find<AppMeta>("apps", "slug", slug);
  return meta ?? null;
}

export async function createReport(input: { app?: unknown; reason?: unknown; details?: unknown; contact?: unknown }, ip?: string) {
  const appRef = str(input.app, "Which app", { min: 2, max: 300 });
  const reason = typeof input.reason === "string" && REPORT_REASONS.includes(input.reason) ? input.reason : null;
  if (!reason) throw badRequest("Choose what's wrong.");
  const details = str(input.details, "Details", { min: 10, max: 3000 });
  const contact = str(input.contact, "Your email", { max: 200, optional: true });
  const meta = await findApp(appRef);
  const report: Report = { id: uid("rep", 12), appId: meta?.id ?? null, appRef, reason, details, createdAt: nowIso(), status: "open" };
  if (contact) report.contact = contact;
  const store = await getStore();
  await store.put("reports", report);
  await audit({ action: "report.created", appId: report.appId, target: report.id, detail: reason, ip });
  return report;
}

export async function listReports() {
  const store = await getStore();
  const open = await store.find<Report>("reports", "status", "open");
  const resolved = (await store.find<Report>("reports", "status", "resolved")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  const withApps = async (list: Report[]) => {
    const out = [];
    for (const r of list) {
      const meta = r.appId ? await store.get<AppMeta>("apps", r.appId) : null;
      out.push({ ...r, app: meta ? { id: meta.id, name: meta.name, slug: meta.published?.slug ?? null, ownerId: meta.ownerId } : null });
    }
    return out;
  };
  return { open: await withApps(open.sort((a, b) => a.createdAt.localeCompare(b.createdAt))), resolved: await withApps(resolved) };
}

/** Unpublish an app and keep it from being published again until an operator allows it. */
async function takeOffline(tx: StoreOps, meta: AppMeta, reason: string, bySuspension = false) {
  if (meta.published) {
    meta.published = null;
    await tx.delete("published", meta.id);
  }
  meta.takenDown = { at: nowIso(), reason: reason.trim().slice(0, 300) || "Breaks the terms of service", ...(bySuspension ? { bySuspension: true } : {}) };
  await tx.put("apps", meta);
}

/** Close a report, optionally taking its app offline (the owner keeps their design and data). */
export async function resolveReport(operator: User, id: string, action: "resolve" | "unpublish", note: string, ip?: string) {
  const store = await getStore();
  let appId: string | null = null;
  await store.transaction(async (tx) => {
    const r = await tx.get<Report>("reports", id);
    if (!r) throw notFound("That report doesn't exist.");
    if (action === "unpublish" && r.appId) {
      const meta = await tx.get<AppMeta>("apps", r.appId);
      if (meta) {
        await takeOffline(tx, meta, note || r.reason);
        appId = meta.id;
      }
    }
    r.status = "resolved";
    r.resolvedAt = nowIso();
    r.resolution = `${action === "unpublish" ? "App taken offline" : "Closed"}${note ? `: ${note.slice(0, 300)}` : ""}`;
    await tx.put("reports", r);
  });
  await audit({ action: "report.resolved", userId: operator.id, target: id, detail: action, ip });
  if (appId) await audit({ action: "app.takedown", appId, userId: operator.id, detail: (note || "from a report").slice(0, 200), ip });
}

/** Take an app offline by its address (or id), with or without a report. */
export async function takeDownApp(operator: User, ref: string, reason: string, ip?: string) {
  const store = await getStore();
  const id = ref.trim();
  const found = /^app_[A-Za-z0-9]{4,40}$/.test(id) ? await store.get<AppMeta>("apps", id) : await findApp(ref);
  if (!found) throw notFound("No app has that address.");
  await store.transaction(async (tx) => {
    const meta = await tx.get<AppMeta>("apps", found.id);
    if (!meta) throw notFound("No app has that address.");
    await takeOffline(tx, meta, reason);
  });
  await audit({ action: "app.takedown", appId: found.id, userId: operator.id, detail: reason.slice(0, 200), ip });
  return { id: found.id, name: found.name };
}

/** Let the owner publish a taken-down app again (they publish it themselves). */
export async function allowRepublish(operator: User, appId: string, ip?: string) {
  const store = await getStore();
  await store.transaction(async (tx) => {
    const meta = await tx.get<AppMeta>("apps", appId);
    if (!meta) throw notFound("That app doesn't exist anymore.");
    delete meta.takenDown;
    await tx.put("apps", meta);
  });
  await audit({ action: "app.restored", appId, userId: operator.id, ip });
}

/** Stop an account signing in, sign it out everywhere and take its published apps offline. */
export async function suspendAccount(operator: User, email: string, reason: string, ip?: string) {
  const store = await getStore();
  const [target] = await store.find<User>("users", "email", email.trim().toLowerCase());
  if (!target) throw notFound("No account uses that email.");
  if (isOperator(target)) throw badRequest("Operators can't be suspended: remove them from OPERATOR_IDS first.");
  const why = reason.trim().slice(0, 300) || "Breaks the terms of service";
  let apps = 0;
  await store.transaction(async (tx) => {
    const user = await tx.get<User>("users", target.id);
    if (!user) throw notFound("No account uses that email.");
    user.suspended = { at: nowIso(), reason: why };
    await tx.put("users", user);
    await tx.deleteWhere("sessions", "userId", user.id);
    for (const meta of await tx.find<AppMeta>("apps", "ownerId", user.id)) {
      if (!meta.published || meta.takenDown) continue;
      await takeOffline(tx, meta, `Account suspended: ${why}`, true);
      apps++;
    }
  });
  await audit({ action: "account.suspended", userId: target.id, detail: `by operator ${operator.id}: ${why.slice(0, 150)}`, ip });
  return { apps };
}

/** Undo a suspension; apps it took offline may be published again by their owner. */
export async function liftSuspension(operator: User, email: string, ip?: string) {
  const store = await getStore();
  const [target] = await store.find<User>("users", "email", email.trim().toLowerCase());
  if (!target?.suspended) throw notFound("That account isn't suspended.");
  let apps = 0;
  await store.transaction(async (tx) => {
    const user = await tx.get<User>("users", target.id);
    if (!user) throw notFound("That account isn't suspended.");
    delete user.suspended;
    await tx.put("users", user);
    for (const meta of await tx.find<AppMeta>("apps", "ownerId", user.id)) {
      if (!meta.takenDown?.bySuspension) continue;
      delete meta.takenDown;
      await tx.put("apps", meta);
      apps++;
    }
  });
  await audit({ action: "account.unsuspended", userId: target.id, detail: `by operator ${operator.id}`, ip });
  return { apps };
}

export async function listModeration() {
  const store = await getStore();
  const apps = (await store.scan<AppMeta>("apps"))
    .filter((m) => m.takenDown)
    .map((m) => ({ id: m.id, name: m.name, takenDown: m.takenDown! }))
    .sort((a, b) => b.takenDown.at.localeCompare(a.takenDown.at));
  const users = (await store.scan<User>("users"))
    .filter((u) => u.suspended)
    .map((u) => ({ email: u.email, name: u.name, suspended: u.suspended! }))
    .sort((a, b) => b.suspended.at.localeCompare(a.suspended.at));
  return { apps, users };
}

/** Emergency: end every session except the operator's own (everyone signs in again). */
export async function signEveryoneOut(operator: User, keepSessionId: string | null, ip?: string) {
  const store = await getStore();
  let n = 0;
  const sessions = await store.scan<{ id: string }>("sessions");
  await store.transaction(async (tx) => {
    for (const s of sessions) {
      if (s.id === keepSessionId) continue;
      await tx.delete("sessions", s.id);
      n++;
    }
  });
  await audit({ action: "sessions.revoked", userId: operator.id, detail: `everyone signed out by an operator (${n} sessions)`, ip });
  return n;
}
