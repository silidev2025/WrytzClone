import crypto from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import type { PublicUser, User } from "@/lib/shared/types";
import { nowIso, uid } from "@/lib/shared/util";
import { ROOT_DOMAIN, rootHostname } from "@/lib/shared/urls";
import { LEGAL } from "@/lib/shared/legal";
import { getStore } from "./store";
import { badRequest, conflict, trustProxy, unauthorized } from "./http";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, keylen: number, opts: crypto.ScryptOptions) => Promise<Buffer>;

export const SESSION_COOKIE = "cb_session";
const SESSION_DAYS = 30;
const AVATAR_COLORS = ["#6c47ff", "#ff6b9d", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

export interface Session {
  id: string; // sha256 of the token
  userId: string;
  createdAt: string;
  expiresAt: string;
  /** a rough description of the device, shown in Settings */
  device?: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const N = 16384;
  const key = await scrypt(password, salt, 64, { N, r: 8, p: 1 });
  return `scrypt$${N}$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt") return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function publicUser(u: User): PublicUser {
  return { id: u.id, email: u.email, name: u.name, avatarColor: u.avatarColor, bio: u.bio };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string) {
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e) || e.length > 200) throw badRequest("Please enter a valid email address.");
  return e;
}

export function validatePassword(pw: unknown) {
  if (typeof pw !== "string" || pw.length < 8) throw badRequest("Passwords need at least 8 characters.");
  if (pw.length > 200) throw badRequest("That password is too long.");
  return pw;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const store = await getStore();
  const [u] = await store.find<User>("users", "email", email.toLowerCase());
  return u ?? null;
}

export async function createUser(input: { name: string; email: string; password: string; acceptTerms?: unknown; ageOk?: unknown }): Promise<User> {
  const store = await getStore();
  const email = validateEmail(input.email);
  const password = validatePassword(input.password);
  if (input.acceptTerms !== true) throw badRequest("Please accept the Terms and the Privacy notice to create an account.");
  if (input.ageOk !== true) throw badRequest(`You need to be at least ${LEGAL.minimumAge} to create an account.`);
  const name = input.name.trim().slice(0, 80) || email.split("@")[0];
  const passwordHash = await hashPassword(password);
  return store.transaction(async (tx) => {
    const existing = await tx.find<User>("users", "email", email);
    if (existing.length) throw conflict("We couldn't create an account with that email. If it's yours, sign in or reset your password.");
    const now = nowIso();
    const user: User = {
      id: uid("usr"),
      email,
      name,
      passwordHash,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      createdAt: now,
      termsVersion: LEGAL.termsVersion,
      termsAcceptedAt: now,
    };
    await tx.put("users", user);
    return user;
  });
}

/**
 * With app subdomains on, the session cookie is shared by the main domain and every
 * <app>.<domain>, so visitors stay signed in inside published apps.
 */
function cookieDomain(): string | undefined {
  const host = rootHostname();
  if (!ROOT_DOMAIN || !host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return undefined;
  return host;
}

function deviceName(ua: string | null): string | undefined {
  if (!ua) return undefined;
  const os = /iphone|ipad/i.test(ua) ? "iPhone/iPad" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "Mac" : /linux/i.test(ua) ? "Linux" : "Unknown device";
  const browser = /edg\//i.test(ua) ? "Edge" : /chrome|crios/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

export async function createSession(userId: string, secure: boolean, userAgent?: string | null) {
  const store = await getStore();
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  const session: Session = { id: hashToken(token), userId, createdAt: nowIso(), expiresAt: expires.toISOString(), device: deviceName(userAgent ?? null) };
  await store.put("sessions", session);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", expires, domain: cookieDomain() });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const store = await getStore();
    await store.delete("sessions", hashToken(token));
  }
  jar.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, domain: cookieDomain() });
}

/** The session id (hashed token) of this request, if any. */
export async function currentSessionId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/** The signed-in user for this request, or null. */
export async function currentUser(): Promise<User | null> {
  const id = await currentSessionId();
  if (!id) return null;
  const store = await getStore();
  const session = await store.get<Session>("sessions", id);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await store.delete("sessions", session.id);
    return null;
  }
  const user = await store.get<User>("users", session.userId);
  // sessions from before a password change stop working, and suspended accounts are signed out
  if ((user?.passwordChangedAt && session.createdAt < user.passwordChangedAt) || user?.suspended) {
    await store.delete("sessions", session.id);
    return null;
  }
  return user;
}

export async function listSessions(userId: string) {
  const store = await getStore();
  const now = Date.now();
  const current = await currentSessionId();
  return (await store.find<Session>("sessions", "userId", userId))
    .filter((s) => new Date(s.expiresAt).getTime() > now)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((s) => ({ id: s.id.slice(0, 12), createdAt: s.createdAt, expiresAt: s.expiresAt, device: s.device || "Unknown device", current: s.id === current }));
}

/** End every session of this person except (optionally) the current one. */
export async function signOutOthers(userId: string) {
  const store = await getStore();
  const current = await currentSessionId();
  let n = 0;
  for (const s of await store.find<Session>("sessions", "userId", userId)) {
    if (s.id === current) continue;
    await store.delete("sessions", s.id);
    n++;
  }
  return n;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function signOutEverywhere(userId: string) {
  const store = await getStore();
  await store.deleteWhere("sessions", "userId", userId);
}

/** Was this request made over HTTPS? Forwarded headers count only behind a trusted proxy. */
export function isSecureRequest(req: Request) {
  if (trustProxy()) {
    const proto = req.headers.get("x-forwarded-proto");
    if (proto) return proto.split(",")[0].trim() === "https";
  }
  return new URL(req.url).protocol === "https:";
}

export { hashToken };
