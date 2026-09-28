import type { AppMeta, MediaItem, RecordDoc, User } from "@/lib/shared/types";
import { nowIso } from "@/lib/shared/util";
import { getStore } from "./store";
import { audit } from "./audit";
import { activeUser, hashPassword, publicUser, validatePassword, verifyPassword } from "./auth";
import { deleteApp } from "./apps";
import { removeUserFromAllApps } from "./admins";
import { HttpError, str } from "./http";
import { queueBlobDeletion } from "./blob-cleanup";

/*
 * Account changes run inside a transaction and only touch their own fields, so a profile
 * save can never undo a password change that happened at the same moment.
 */

export async function updateProfile(userId: string, patch: { name?: unknown; bio?: unknown }) {
  const store = await getStore();
  return store.transaction(async (tx) => {
    const user = await activeUser(tx, userId);
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
    const user = await activeUser(tx, userId);
    if (!user || user.passwordHash !== fresh.passwordHash) throw new HttpError(409, "Your password was just changed somewhere else. Please try again.");
    user.passwordHash = passwordHash;
    // every session started before this moment stops working (see currentUser)
    user.passwordChangedAt = nowIso();
    await tx.put("users", user);
    await tx.deleteWhere("tokens", "userId", userId);
  });
  await audit({ action: "password.changed", userId, ip });
  return passwordHash;
}

/**
 * Delete an account and what belongs to it: its apps (with their data and files), its
 * uploads everywhere, its admin roles, sign-ins, consents and reset links. Rows it added to
 * other people's apps belong to those apps; they stay, but are no longer linked to anyone.
 */
export async function deleteAccount(user: User, password: unknown, ip?: string) {
  if (typeof password !== "string" || !(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, "That password isn't right.");
  const store = await getStore();
  await store.transaction(async (tx) => {
    const fresh = await tx.get<User>("users", user.id);
    if (!fresh || fresh.passwordHash !== user.passwordHash) throw new HttpError(409, "Your account changed. Please try again.");
    fresh.deletingAt ||= nowIso();
    await tx.put("users", fresh);
    await tx.deleteWhere("sessions", "userId", user.id);
    await tx.put("jobs", { id: `account_${user.id}`, kind: "accountDeletion", userId: user.id, createdAt: nowIso() });
  });
  await audit({ action: "account.deleted", userId: user.id, detail: "Deletion queued; account access revoked", ip });
  await resumeAccountDeletion(user.id).catch((err) => console.error("[account] deletion queued for retry", err));
}

/** Bounded and idempotent; the durable maintenance job repeats until everything is gone. */
export async function resumeAccountDeletion(userId: string): Promise<boolean> {
  const store = await getStore();
  const user = await store.get<User>("users", userId);
  if (!user) { await store.delete("jobs", `account_${userId}`); return true; }
  if (!user.deletingAt) return false;
  const apps = await store.page<AppMeta>("apps", { index: "ownerId", value: userId, limit: 5 });
  for (const app of apps) await deleteApp(user, app.id, true);
  if (apps.length) return false;
  const files = await store.page<MediaItem>("media", { index: "ownerId", value: userId, limit: 250 });
  await store.transaction(async (tx) => {
    for (const file of files) {
      await queueBlobDeletion(tx, file.id);
      await tx.delete("media", file.id);
    }
  });
  if (files.length) return false;
  const records = await store.page<RecordDoc>("records", { index: "createdBy", value: userId, limit: 250 });
  await store.transaction(async (tx) => {
    for (const record of records) {
      const fresh = await tx.get<RecordDoc>("records", record.id);
      if (fresh?.createdBy === userId) await tx.put("records", { ...fresh, createdBy: null });
    }
  });
  if (records.length) return false;
  await store.transaction(async (tx) => {
    await removeUserFromAllApps(userId, tx);
    for (const table of ["consents", "tokens", "sessions"] as const) await tx.deleteWhere(table, "userId", userId);
    await tx.delete("users", userId);
    await tx.delete("jobs", `account_${userId}`);
  });
  return true;
}

export { exportMyData } from "./export";
