import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { AppMeta, User } from "@/lib/shared/types";
import { canEditApp } from "./apps";
import { getStore, serverSecret } from "./store";

/*
 * A preview pass lets another device (a phone that scanned the QR code in Preview) view an
 * app's draft for a short while without signing in to the editor's account. It is signed with
 * the server key, names the app and the editor who made it, and stops working when it expires
 * or when that editor loses edit access. It unlocks the draft design and lets that device run
 * the app before it is published; data still follows the app's own access rules for whoever
 * is viewing, never the editor's.
 */

export const PREVIEW_PASS_TTL_MS = 60 * 60 * 1000;

/** One cookie per app, so passes for different apps never overwrite each other. */
export function previewCookieName(appId: string) {
  return `cb_pp_${appId.replace(/[^A-Za-z0-9_]/g, "")}`;
}

function sign(body: string) {
  return crypto.createHmac("sha256", serverSecret()).update(`preview-pass:${body}`).digest("base64url").slice(0, 32);
}

export function createPreviewPass(appId: string, userId: string, now = Date.now()) {
  const expires = now + PREVIEW_PASS_TTL_MS;
  const body = `${appId}~${userId}~${expires.toString(36)}`;
  return { pass: `${Buffer.from(body).toString("base64url")}.${sign(body)}`, expiresAt: new Date(expires).toISOString() };
}

/** The editor who issued this pass, if it is genuine, unexpired and for this app. */
export function readPreviewPass(pass: string | undefined | null, appId: string, now = Date.now()): { userId: string; expires: number } | null {
  if (!pass || pass.length > 300) return null;
  const [encoded, sig] = pass.split(".");
  if (!encoded || !sig) return null;
  const body = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  const [passApp, userId, exp] = body.split("~");
  const expires = parseInt(exp || "", 36);
  if (passApp !== appId || !userId || !Number.isFinite(expires) || expires <= now) return null;
  return { userId, expires };
}

/** The pass this request carries for the app, if any (set when someone opens the QR link). */
export async function requestPreviewPass(appId: string) {
  try {
    return readPreviewPass((await cookies()).get(previewCookieName(appId))?.value, appId);
  } catch {
    return null;
  }
}

/** A pass only counts while the person who made it still has a working account that can edit the app. */
export async function previewPassAllows(meta: AppMeta, pass: { userId: string } | null): Promise<boolean> {
  if (!pass) return false;
  const issuer = await (await getStore()).get<User>("users", pass.userId).catch(() => null);
  if (!issuer || issuer.suspended || (issuer as { deletingAt?: string }).deletingAt) return false;
  return canEditApp(meta, issuer);
}
