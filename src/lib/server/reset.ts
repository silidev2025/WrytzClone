import crypto from "node:crypto";
import type { User } from "@/lib/shared/types";
import { BRAND } from "@/lib/shared/brand";
import { platformUrl } from "@/lib/shared/urls";
import { nowIso } from "@/lib/shared/util";
import { getStore } from "./store";
import { audit } from "./audit";
import { findUserByEmail, hashPassword, validatePassword } from "./auth";
import { notFound, rateLimit } from "./http";
import { mailConfigured, sendMail } from "./mail";

/* Password reset links: single use, valid for one hour, only their hash is stored. */

interface ResetToken {
  id: string; // sha256 of the token
  userId: string;
  createdAt: string;
  expiresAt: string;
}

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** A fresh reset link (path) for this account; older unused links stop working. */
export async function createResetPath(userId: string): Promise<string> {
  const store = await getStore();
  const token = crypto.randomBytes(24).toString("base64url");
  await store.transaction(async (tx) => {
    await tx.deleteWhere("tokens", "userId", userId);
    await tx.put("tokens", { id: hash(token), userId, createdAt: nowIso(), expiresAt: new Date(Date.now() + 3600_000).toISOString() } satisfies ResetToken);
  });
  return `/reset/${token}`;
}

/**
 * "Forgot password": emails a link when email is set up. The answer never says whether the
 * address has an account.
 */
export async function requestReset(email: string, ip?: string): Promise<{ emailed: boolean }> {
  if (!mailConfigured()) return { emailed: false };
  const user = await findUserByEmail(email);
  if (user) {
    try {
      rateLimit(`reset:${user.id}`, 3, 60 * 60_000);
    } catch {
      return { emailed: true };
    }
    const path = await createResetPath(user.id);
    const link = platformUrl(path);
    await sendMail(
      user.email,
      `Reset your ${BRAND.name} password`,
      `Hi ${user.name},\n\nSomeone asked to reset the password of your ${BRAND.name} account. If it was you, open this link within an hour:\n\n${link}\n\nIf it wasn't you, ignore this email — your password stays the same.`,
    );
    await audit({ action: "password.reset.requested", userId: user.id, ip });
  }
  return { emailed: true };
}

export async function resetInfo(token: string): Promise<{ valid: boolean }> {
  const store = await getStore();
  const t = await store.get<ResetToken>("tokens", hash(token));
  return { valid: !!t && new Date(t.expiresAt).getTime() > Date.now() };
}

/** Set a new password with a reset link; every existing session ends. */
export async function resetPassword(token: string, password: unknown, ip?: string) {
  const pw = validatePassword(password);
  const passwordHash = await hashPassword(pw);
  const store = await getStore();
  const userId = await store.transaction(async (tx) => {
    const t = await tx.get<ResetToken>("tokens", hash(String(token || "")));
    if (!t || new Date(t.expiresAt).getTime() < Date.now()) throw notFound("This reset link has expired or was already used. Ask for a new one.");
    const user = await tx.get<User>("users", t.userId);
    if (!user) throw notFound("That account doesn't exist anymore.");
    user.passwordHash = passwordHash;
    user.passwordChangedAt = nowIso();
    await tx.put("users", user);
    await tx.deleteWhere("tokens", "userId", user.id);
    await tx.deleteWhere("sessions", "userId", user.id);
    return user.id;
  });
  await audit({ action: "password.reset", userId, ip });
}
