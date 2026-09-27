import type { AppMeta, Collection, MediaItem, RecordDoc, User } from "@/lib/shared/types";
import { nowIso } from "@/lib/shared/util";
import { getStore } from "./store";
import { audit, userAuditLog } from "./audit";
import { hashPassword, publicUser, validatePassword, verifyPassword } from "./auth";
import { deleteApp } from "./apps";
import { removeUserFromAllApps } from "./admins";
import { listConsents } from "./consent";
import { HttpError, str } from "./http";

/*
 * Account changes run inside a transaction and only touch their own fields, so a profile
 * save can never undo a password change that happened at the same moment.
 */

export async function updateProfile(userId: string, patch: { name?: unknown; bio?: unknown }) {
  const store = await getStore();
  return store.transaction(async (tx) => {
    const user = await tx.get<User>("users", userId);
    if (!user) throw new HttpError(404, "That account doesn't exist anymore.");
    if (patch.name !== undefined) user.name = str(patch.name, "Name", { min: 1, max: 80 });
    if (patch.bio !== undefined) user.bio = str(patch.bio, "Bio", { max: 300, optional: true });
    await tx.put("users", user);
    return publicUser(user);
  });
}

export async function changePassword(userId: string, current: unknown, next: unknown, ip?: string) {
  const pw = validatePassword(next);
  const store = await getStore();
  // check against the stored hash at the moment of the change
  const fresh = await store.get<User>("users", userId);
  if (!fresh || typeof current !== "string" || !(await verifyPassword(current, fresh.passwordHash))) throw new HttpError(401, "Your current password isn't right.");
  const passwordHash = await hashPassword(pw);
  await store.transaction(async (tx) => {
    const user = await tx.get<User>("users", userId);
    if (!user || user.passwordHash !== fresh.passwordHash) throw new HttpError(409, "Your password was just changed somewhere else. Please try again.");
    user.passwordHash = passwordHash;
    // every session started before this moment stops working (see currentUser)
    user.passwordChangedAt = nowIso();
    await tx.put("users", user);
    await tx.deleteWhere("tokens", "userId", userId);
  });
  await audit({ action: "password.changed", userId, ip });
}

/**
 * Delete an account and what belongs to it: its apps (with their data and files), its
 * uploads everywhere, its admin roles, sign-ins, consents and reset links. Rows it added to
 * other people's apps belong to those apps; they stay, but are no longer linked to anyone.
 */
export async function deleteAccount(user: User, password: unknown, ip?: string) {
  if (typeof password !== "string" || !(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, "That password isn't right.");
  const store = await getStore();
  for (const app of await store.find<AppMeta>("apps", "ownerId", user.id)) await deleteApp(user, app.id);
  const files = await store.find<MediaItem>("media", "ownerId", user.id);
  await store.transaction(async (tx) => {
    await removeUserFromAllApps(user.id, tx);
    await tx.deleteWhere("consents", "userId", user.id);
    await tx.deleteWhere("tokens", "userId", user.id);
    await tx.deleteWhere("sessions", "userId", user.id);
    await tx.deleteWhere("media", "ownerId", user.id);
    await tx.delete("users", user.id);
  });
  for (const f of files) await store.deleteBlob(f.id);
  // unlink rows they added to other people's apps
  for (const r of await store.scan<RecordDoc>("records")) {
    if (r.createdBy === user.id) await store.put("records", { ...r, createdBy: null });
  }
  await audit({ action: "account.deleted", userId: user.id, ip });
}

/** Everything we hold about this person, as one JSON download. */
export async function exportMyData(user: User) {
  const store = await getStore();
  const apps = await store.find<AppMeta>("apps", "ownerId", user.id);
  const files = await store.find<MediaItem>("media", "ownerId", user.id);
  const cols = new Map<string, Collection | null>();
  const colName = async (id: string) => {
    if (!cols.has(id)) cols.set(id, await store.get<Collection>("collections", id));
    return cols.get(id)?.name ?? "(deleted)";
  };
  const added: { app: string; collection: string; createdAt: string; values: Record<string, unknown> }[] = [];
  for (const r of await store.scan<RecordDoc>("records")) {
    if (r.createdBy !== user.id || added.length >= 5000) continue;
    const col = cols.get(r.collectionId) ?? (await store.get<Collection>("collections", r.collectionId));
    cols.set(r.collectionId, col);
    const values: Record<string, unknown> = {};
    for (const f of col?.fields || []) values[f.name] = r.data[f.id] ?? null;
    const app = await store.get<AppMeta>("apps", r.appId);
    added.push({ app: app?.name ?? "(deleted app)", collection: await colName(r.collectionId), createdAt: r.createdAt, values });
  }
  return {
    exportedAt: nowIso(),
    account: { ...publicUser(user), createdAt: user.createdAt, termsVersion: user.termsVersion, termsAcceptedAt: user.termsAcceptedAt },
    apps: apps.map((a) => ({ id: a.id, name: a.name, createdAt: a.createdAt, published: a.published ? { slug: a.published.slug, at: a.published.at } : null })),
    sharedWithApps: await listConsents(user),
    uploads: files.map((f) => ({ name: f.name, type: f.mime, size: f.size, uploadedAt: f.createdAt })),
    recordsYouAddedInApps: added,
    securityLog: (await userAuditLog(user.id, 500)).map((e) => ({ at: e.at, action: e.action })),
  };
}
